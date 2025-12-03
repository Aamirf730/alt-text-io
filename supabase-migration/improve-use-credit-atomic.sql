-- Improve use_credit function for atomic credit deduction
-- This ensures both profile update and usage log are in a single transaction
-- with proper row-level locking to prevent race conditions

CREATE OR REPLACE FUNCTION public.use_credit(user_uuid UUID, alt_text TEXT, context TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
  current_total_processed INTEGER;
  new_credits INTEGER;
  new_total_processed INTEGER;
  usage_log_id UUID;
BEGIN
  -- Validate input
  IF user_uuid IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'User UUID is required');
  END IF;

  -- Lock row and get current credits atomically
  -- FOR UPDATE ensures no other transaction can modify this row until we're done
  SELECT credits_remaining, total_processed 
  INTO current_credits, current_total_processed
  FROM public.profiles 
  WHERE id = user_uuid
  FOR UPDATE; -- Row-level lock prevents concurrent modifications
  
  -- Check if user exists
  IF current_credits IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'User not found');
  END IF;
  
  -- Check if user has credits
  IF current_credits <= 0 THEN
    RETURN JSON_BUILD_OBJECT(
      'error', 'No credits remaining',
      'credits_remaining', current_credits
    );
  END IF;
  
  -- Calculate new values BEFORE updating (prevents double-calculation bugs)
  new_credits := current_credits - 1;
  new_total_processed := COALESCE(current_total_processed, 0) + 1;
  
  -- Update profile atomically (in same transaction as lock)
  UPDATE public.profiles 
  SET 
    credits_remaining = new_credits,
    total_processed = new_total_processed,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Insert usage log in same transaction
  -- If this fails, the entire transaction rolls back
  INSERT INTO public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  VALUES (user_uuid, 1, alt_text, context)
  RETURNING id INTO usage_log_id;
  
  -- If we get here, both operations succeeded atomically
  -- Return result with calculated values (don't re-read from DB)
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'total_processed', new_total_processed,
    'usage_log_id', usage_log_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Any exception causes automatic rollback of the transaction
    -- Log error for debugging
    RAISE WARNING 'Error in use_credit for user %: %', user_uuid, SQLERRM;
    
    -- Return error without exposing internal details
    RETURN JSON_BUILD_OBJECT(
      'error', 'Database error during credit deduction',
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.use_credit(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_credit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_credit(UUID, TEXT, TEXT) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.use_credit(UUID, TEXT, TEXT) IS 
'Atomically deducts 1 credit from user profile and logs usage. 
Uses FOR UPDATE row locking to prevent race conditions.
Both profile update and usage log insertion happen in a single transaction.
Returns JSON with success status, credits_remaining, and total_processed.';

