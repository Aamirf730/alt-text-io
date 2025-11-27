-- Add Launch Program Credits
-- Adds 5000 free credits to user "nedra@adventuremomblog.com" as part of launch program
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  user_email TEXT := 'nedra@adventuremomblog.com';
  credits_to_add INTEGER := 5000;
  user_id UUID;
  current_credits INTEGER;
  new_credits INTEGER;
BEGIN
  -- Find user ID by email
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_email;
  END IF;
  
  -- Get current credits
  SELECT credits_remaining INTO current_credits
  FROM public.profiles
  WHERE id = user_id;
  
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user: %', user_email;
  END IF;
  
  -- Calculate new credits
  new_credits := current_credits + credits_to_add;
  
  -- Update user credits
  UPDATE public.profiles
  SET 
    credits_remaining = new_credits,
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Output results
  RAISE NOTICE '✅ Launch Program Credits Added Successfully!';
  RAISE NOTICE '   User Email: %', user_email;
  RAISE NOTICE '   User ID: %', user_id;
  RAISE NOTICE '   Previous Credits: %', current_credits;
  RAISE NOTICE '   Credits Added: %', credits_to_add;
  RAISE NOTICE '   New Total Credits: %', new_credits;
  
END $$;

-- Verify the update
SELECT 
  p.email,
  p.credits_remaining,
  p.total_processed,
  p.subscription_plan,
  p.subscription_status,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'nedra@adventuremomblog.com';

