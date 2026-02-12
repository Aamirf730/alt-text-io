-- Monthly Drip for Annual Subscriptions
-- Annual subscribers receive their monthly credit allowance (150/400/1000)
-- each month via pg_cron, rather than the full yearly lump sum at activation.
--
-- Depends on:  add-monthly-renewal-system.sql  (credits_last_renewed_at column)

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Add columns to track billing cycle and monthly allowance
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT NULL,               -- 'monthly' | 'annual' | NULL (free)
  ADD COLUMN IF NOT EXISTS monthly_credit_allowance INTEGER DEFAULT NULL; -- credits to drip each month for annual plans

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Back-fill existing annual subscribers (if any)
-- If a user already has an annual plan, set their monthly allowance based on plan.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET
  billing_cycle = 'annual',
  monthly_credit_allowance = CASE subscription_plan
    WHEN 'tier1' THEN 150
    WHEN 'tier2' THEN 400
    WHEN 'tier3' THEN 1000
    ELSE NULL
  END
WHERE subscription_status = 'active'
  AND billing_cycle IS NULL
  AND next_billing_date IS NOT NULL
  AND next_billing_date > NOW() + INTERVAL '60 days';   -- annual plans have a far-future billing date

-- Back-fill monthly subscribers
UPDATE public.profiles
SET
  billing_cycle = 'monthly',
  monthly_credit_allowance = CASE subscription_plan
    WHEN 'tier1' THEN 150
    WHEN 'tier2' THEN 400
    WHEN 'tier3' THEN 1000
    ELSE NULL
  END
WHERE subscription_status = 'active'
  AND billing_cycle IS NULL
  AND subscription_plan IN ('tier1', 'tier2', 'tier3')
  AND (next_billing_date IS NULL OR next_billing_date <= NOW() + INTERVAL '60 days');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Create the monthly credit drip function for PAID annual subscribers
-- Runs daily via pg_cron; only renews annual users whose last renewal was 30+ days ago.
-- Credits ROLL OVER (added, not reset).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.renew_paid_monthly_credits()
RETURNS TABLE(
  renewed_count INTEGER,
  user_ids UUID[]
) AS $$
DECLARE
  renewed_users UUID[];
  count INTEGER := 0;
BEGIN
  WITH renewed AS (
    UPDATE public.profiles
    SET
      credits_remaining = credits_remaining + monthly_credit_allowance,
      credits_last_renewed_at = NOW(),
      updated_at = NOW()
    WHERE
      subscription_status = 'active'
      AND billing_cycle = 'annual'
      AND monthly_credit_allowance IS NOT NULL
      AND monthly_credit_allowance > 0
      AND (
        credits_last_renewed_at IS NULL
        OR credits_last_renewed_at <= NOW() - INTERVAL '30 days'
      )
    RETURNING id
  )
  SELECT
    ARRAY_AGG(id) AS ids,
    COUNT(*)::INTEGER AS total
  INTO renewed_users, count
  FROM renewed;

  IF count > 0 THEN
    RAISE NOTICE 'Monthly drip: renewed credits for % annual subscribers', count;
  END IF;

  RETURN QUERY SELECT count, COALESCE(renewed_users, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Schedule the daily cron job
-- ─────────────────────────────────────────────────────────────────────────────
-- Remove existing job if present (idempotent)
SELECT cron.unschedule('renew-paid-credits') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'renew-paid-credits'
);

-- Run every day at 2:05 AM UTC (offset from free-user job at 2:00 AM)
SELECT cron.schedule(
  'renew-paid-credits',
  '5 2 * * *',
  $$ SELECT public.renew_paid_monthly_credits(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after deploying)
-- ─────────────────────────────────────────────────────────────────────────────

-- Check new columns exist
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name IN ('billing_cycle', 'monthly_credit_allowance');

-- Check cron jobs
-- SELECT jobname, schedule, command FROM cron.job;

-- Test the function (dry run is not possible, this will actually update)
-- SELECT * FROM public.renew_paid_monthly_credits();

RAISE NOTICE '✅ Monthly Drip migration complete';
RAISE NOTICE '✅ Annual subscribers will receive monthly credit top-ups';
RAISE NOTICE '✅ pg_cron job "renew-paid-credits" scheduled at 2:05 AM UTC daily';
