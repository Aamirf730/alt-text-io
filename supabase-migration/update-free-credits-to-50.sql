-- Update Free Plan Credits from 100 to 50
-- This migration updates all references to free plan credits
-- Run this in Supabase SQL Editor

-- Step 1: Update the handle_new_user function to give 50 credits instead of 100
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_plan, credits_remaining)
  VALUES (NEW.id, NEW.email, 'free', 50);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update the profiles table default value
ALTER TABLE public.profiles 
  ALTER COLUMN credits_remaining SET DEFAULT 50;

-- Step 3: Update the subscription_plans table for the free plan
UPDATE public.subscription_plans
SET 
  credits = 50,
  features = '["50 Credits each month", "Basic support", "WordPress plugin access"]'::jsonb
WHERE id = 'free';

-- Verification queries (run these to confirm changes)
-- SELECT * FROM subscription_plans WHERE id = 'free';
-- SELECT column_default FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'credits_remaining';

RAISE NOTICE '✅ Free plan credits updated from 100 to 50';
RAISE NOTICE '✅ New users will now receive 50 credits on signup';
RAISE NOTICE '⚠️  Existing users with 100 credits are NOT affected';
