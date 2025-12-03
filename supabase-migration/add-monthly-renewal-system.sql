-- Add Monthly Credit Renewal System for Free Users
-- This migration implements automatic monthly credit renewal for free plan users
-- Credits are REPLACED (not added) every 30 days

-- Step 1: Add tracking column for last renewal date
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS credits_last_renewed_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Set initial value for existing free users
-- This prevents immediate renewal - they'll get renewed in 30 days
UPDATE public.profiles
SET credits_last_renewed_at = NOW()
WHERE subscription_plan = 'free' 
  AND credits_last_renewed_at IS NULL;

-- Step 3: Update handle_new_user trigger to set initial renewal date
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_plan, credits_remaining, credits_last_renewed_at)
  VALUES (NEW.id, NEW.email, 'free', 50, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create the monthly credit renewal function
CREATE OR REPLACE FUNCTION public.renew_monthly_credits()
RETURNS TABLE(
  renewed_count INTEGER,
  user_ids UUID[]
) AS $$
DECLARE
  renewed_users UUID[];
  count INTEGER := 0;
BEGIN
  -- Find and renew credits for free users who are due (30+ days since last renewal)
  WITH renewed AS (
    UPDATE public.profiles
    SET 
      credits_remaining = 50,
      credits_last_renewed_at = NOW(),
      updated_at = NOW()
    WHERE 
      subscription_plan = 'free'
      AND subscription_status = 'active'
      AND (
        credits_last_renewed_at IS NULL 
        OR credits_last_renewed_at <= NOW() - INTERVAL '30 days'
      )
    RETURNING id
  )
  SELECT 
    ARRAY_AGG(id) as ids,
    COUNT(*) as total
  INTO renewed_users, count
  FROM renewed;
  
  -- Log the renewal event
  IF count > 0 THEN
    RAISE NOTICE 'Renewed credits for % free users', count;
  END IF;
  
  RETURN QUERY SELECT count, COALESCE(renewed_users, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Update upgrade_subscription to handle renewal tracking
CREATE OR REPLACE FUNCTION public.upgrade_subscription(
  user_uuid UUID, 
  new_plan TEXT, 
  payment_id TEXT,
  subscription_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  plan_credits INTEGER;
  plan_price DECIMAL(10,2);
  result JSON;
BEGIN
  -- Get plan details
  SELECT credits, price INTO plan_credits, plan_price
  FROM public.subscription_plans 
  WHERE id = new_plan;
  
  IF plan_credits IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'Invalid plan');
  END IF;
  
  -- Update user subscription
  UPDATE public.profiles 
  SET 
    subscription_plan = new_plan,
    credits_remaining = CASE 
      WHEN new_plan IN ('pay_as_go', 'small_pack') THEN credits_remaining + plan_credits
      ELSE plan_credits
    END,
    subscription_status = 'active',
    subscription_id = COALESCE(subscription_id, subscription_id),
    next_billing_date = CASE 
      WHEN new_plan IN ('tier1', 'tier2', 'tier3', 'tier4') THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END,
    -- Reset renewal tracking when moving to/from free plan
    credits_last_renewed_at = CASE
      WHEN new_plan = 'free' THEN NOW()  -- Start renewal cycle for downgrades to free
      ELSE NULL  -- Stop renewal tracking for paid plans
    END,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Record payment
  INSERT INTO public.payments (user_id, payment_id, subscription_id, plan_id, amount, status)
  VALUES (user_uuid, payment_id, subscription_id, new_plan, plan_price, 'completed');
  
  -- Return result
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'plan', subscription_plan,
    'credits_remaining', credits_remaining,
    'next_billing_date', next_billing_date
  ) INTO result
  FROM public.profiles 
  WHERE id = user_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 7: Schedule daily credit renewal job at 2 AM UTC
-- First, remove any existing job with this name
SELECT cron.unschedule('renew-free-credits') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'renew-free-credits'
);

-- Then create the new job
SELECT cron.schedule(
  'renew-free-credits',           -- job name
  '0 2 * * *',                    -- cron expression (2 AM UTC daily)
  $$ SELECT public.renew_monthly_credits(); $$
);

-- Verification queries
-- Run these after migration to confirm everything is set up correctly

-- Check column was added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'credits_last_renewed_at';

-- Check all free users have renewal date
-- SELECT 
--   COUNT(*) as total_free_users,
--   COUNT(credits_last_renewed_at) as users_with_renewal_date
-- FROM profiles
-- WHERE subscription_plan = 'free';

-- Check cron job is scheduled
-- SELECT * FROM cron.job WHERE jobname = 'renew-free-credits';

RAISE NOTICE '✅ Monthly credit renewal system installed successfully';
RAISE NOTICE '✅ Free users will get 50 credits renewed every 30 days';
RAISE NOTICE '✅ Cron job scheduled to run daily at 2 AM UTC';
RAISE NOTICE '⚠️  Existing free users will get first renewal in 30 days';
