-- Fix Critical Credit Deduction Bug
-- This migration fixes the use_credit RPC function and corrects user credits

-- Step 1: Fix the use_credit RPC function to properly deduct credits
CREATE OR REPLACE FUNCTION public.use_credit(user_uuid UUID, alt_text TEXT, context TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
  current_total_processed INTEGER;
  new_credits INTEGER;
  new_total_processed INTEGER;
  result JSON;
BEGIN
  -- Get current credits and total_processed atomically
  SELECT credits_remaining, total_processed 
  INTO current_credits, current_total_processed
  FROM public.profiles 
  WHERE id = user_uuid
  FOR UPDATE; -- Lock row to prevent race conditions
  
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
  
  -- Calculate new values BEFORE updating
  new_credits := current_credits - 1;
  new_total_processed := COALESCE(current_total_processed, 0) + 1;
  
  -- Deduct credit and update stats atomically
  UPDATE public.profiles 
  SET 
    credits_remaining = new_credits,
    total_processed = new_total_processed,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Log usage
  INSERT INTO public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  VALUES (user_uuid, 1, alt_text, context);
  
  -- Return result with the calculated values (not reading from DB again)
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'total_processed', new_total_processed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Correct credits for user iamaamirfaiz@gmail.com
-- Calculate correct credits based on actual usage
DO $$
DECLARE
  user_email TEXT := 'iamaamirfaiz@gmail.com';
  user_id UUID;
  total_credits_used INTEGER;
  plan_total_credits INTEGER;
  correct_credits_remaining INTEGER;
BEGIN
  -- Find user ID
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'User % not found', user_email;
    RETURN;
  END IF;
  
  -- Get total credits used from usage_logs
  SELECT COALESCE(SUM(credits_used), 0) INTO total_credits_used
  FROM public.usage_logs
  WHERE user_id = user_id;
  
  -- Get plan total credits
  SELECT sp.credits INTO plan_total_credits
  FROM public.profiles p
  JOIN public.subscription_plans sp ON p.subscription_plan = sp.id
  WHERE p.id = user_id;
  
  -- If plan not found, default to 100 (free plan)
  IF plan_total_credits IS NULL THEN
    plan_total_credits := 100;
  END IF;
  
  -- Calculate correct credits remaining
  correct_credits_remaining := plan_total_credits - total_credits_used;
  
  -- Ensure credits_remaining is not negative (cap at 0)
  IF correct_credits_remaining < 0 THEN
    correct_credits_remaining := 0;
  END IF;
  
  -- Update user's credits
  UPDATE public.profiles
  SET 
    credits_remaining = correct_credits_remaining,
    total_processed = total_credits_used,
    updated_at = NOW()
  WHERE id = user_id;
  
  RAISE NOTICE 'Corrected credits for user %:', user_email;
  RAISE NOTICE '  Plan total credits: %', plan_total_credits;
  RAISE NOTICE '  Total credits used: %', total_credits_used;
  RAISE NOTICE '  Corrected credits remaining: %', correct_credits_remaining;
END $$;

