-- Enforce monthly subscription allowance semantics.
-- Annual plans may keep an internal annual/rollover balance, but subscription usage
-- is capped by the monthly allowance and resets each refill cycle.

CREATE OR REPLACE FUNCTION public.use_credit(user_uuid UUID, alt_text TEXT, context TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
  current_total_processed INTEGER;
  current_plan TEXT;
  current_monthly_allowance INTEGER;
  current_credits_last_renewed_at TIMESTAMPTZ;
  plan_credits INTEGER;
  monthly_limit INTEGER;
  new_credits INTEGER;
  new_total_processed INTEGER;
  usage_log_id UUID;
BEGIN
  IF user_uuid IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'User UUID is required');
  END IF;

  SELECT
    p.credits_remaining,
    p.total_processed,
    p.subscription_plan,
    p.monthly_credit_allowance,
    p.credits_last_renewed_at,
    sp.credits
  INTO
    current_credits,
    current_total_processed,
    current_plan,
    current_monthly_allowance,
    current_credits_last_renewed_at,
    plan_credits
  FROM public.profiles p
  LEFT JOIN public.subscription_plans sp ON sp.id = p.subscription_plan
  WHERE p.id = user_uuid
  FOR UPDATE OF p;

  IF current_credits IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'User not found');
  END IF;

  IF current_credits <= 0 THEN
    RETURN JSON_BUILD_OBJECT(
      'error', 'No credits remaining',
      'credits_remaining', current_credits
    );
  END IF;

  IF current_plan IN ('free', 'tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro') THEN
    monthly_limit := COALESCE(NULLIF(current_monthly_allowance, 0), plan_credits, 0);

    SELECT COALESCE(SUM(credits_used), 0)::INTEGER
    INTO current_total_processed
    FROM public.usage_logs
    WHERE user_id = user_uuid
      AND created_at >= COALESCE(current_credits_last_renewed_at, date_trunc('month', NOW()));

    IF monthly_limit > 0 AND COALESCE(current_total_processed, 0) >= monthly_limit THEN
      RETURN JSON_BUILD_OBJECT(
        'error', 'Monthly credits exhausted',
        'credits_remaining', current_credits,
        'total_processed', COALESCE(current_total_processed, 0),
        'monthly_credit_limit', monthly_limit,
        'monthly_credits_remaining', 0
      );
    END IF;
  END IF;

  new_credits := current_credits - 1;
  new_total_processed := COALESCE(current_total_processed, 0) + 1;

  UPDATE public.profiles
  SET
    credits_remaining = new_credits,
    total_processed = new_total_processed,
    updated_at = NOW()
  WHERE id = user_uuid;

  INSERT INTO public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  VALUES (user_uuid, 1, alt_text, context)
  RETURNING id INTO usage_log_id;

  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'total_processed', new_total_processed,
    'monthly_credit_limit', monthly_limit,
    'monthly_credits_remaining', CASE
      WHEN monthly_limit > 0 THEN GREATEST(0, monthly_limit - new_total_processed)
      ELSE new_credits
    END,
    'usage_log_id', usage_log_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in use_credit for user %: %', user_uuid, SQLERRM;
    RETURN JSON_BUILD_OBJECT(
      'error', 'Database error during credit deduction',
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.use_credit(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_credit(UUID, TEXT, TEXT) TO service_role;

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
      total_processed = 0,
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
    RAISE NOTICE 'Monthly drip: renewed credits and reset cycle usage for % annual subscribers', count;
  END IF;

  RETURN QUERY SELECT count, COALESCE(renewed_users, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.renew_paid_monthly_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_paid_monthly_credits() TO service_role;
