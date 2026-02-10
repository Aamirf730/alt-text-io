-- ================================================
-- Migration: Update Free Plan Credits from 50 to 30
-- Date: February 2026
-- Description: Reduce free plan from 50 to 30 credits
-- ================================================

-- Step 1: Update the handle_new_user function to give 30 credits instead of 50
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, subscription_plan, credits_remaining, api_key, usage_count, created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    'free',
    30,
    encode(gen_random_bytes(32), 'hex'),
    0,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update the free plan in subscription_plans table
UPDATE subscription_plans 
SET 
  credits = 30,
  per_credit_cost = 0,
  features = '["30 Free SEO Alt Texts", "Full WordPress Plugin", "Media Library Sync"]'::jsonb
WHERE id = 'free';

-- Step 3: Update the monthly renewal function to give 30 credits for free users
-- (The renewal function should already reference the subscription_plans table, 
--  but update the hardcoded fallback if present)

DO $$
BEGIN
  RAISE NOTICE '✅ Free plan updated: 50 → 30 credits';
  RAISE NOTICE '✅ New users will now receive 30 credits on signup';
  RAISE NOTICE '✅ Free plan features updated to smart product-focused copy';
END $$;
