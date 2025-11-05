-- Fix use_credit function to return correct credit values
-- Bug: Function was subtracting/adding to already-updated values
-- This caused credit calculation discrepancies

CREATE OR REPLACE FUNCTION public.use_credit(user_uuid UUID, alt_text TEXT, context TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
  new_credits INTEGER;
  new_total_processed INTEGER;
  result JSON;
BEGIN
  -- Get current credits
  SELECT credits_remaining, total_processed INTO current_credits, new_total_processed
  FROM public.profiles 
  WHERE id = user_uuid;
  
  -- Check if user has credits
  IF current_credits <= 0 THEN
    RETURN JSON_BUILD_OBJECT('error', 'No credits remaining');
  END IF;
  
  -- Calculate new values
  new_credits := current_credits - 1;
  new_total_processed := (new_total_processed + 1);
  
  -- Deduct credit and update stats
  UPDATE public.profiles 
  SET 
    credits_remaining = new_credits,
    total_processed = new_total_processed,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Log usage
  INSERT INTO public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  VALUES (user_uuid, 1, alt_text, context);
  
  -- Return result with correct values (already calculated above)
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'total_processed', new_total_processed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

