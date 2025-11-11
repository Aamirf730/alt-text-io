-- Reset total_processed when upgrading to a subscription plan
-- This ensures that "X of Y credits used" shows usage from the new plan, not the old plan

CREATE OR REPLACE FUNCTION public.upgrade_subscription(
  user_uuid UUID,
  new_plan TEXT,
  payment_id TEXT,
  subscription_id_param TEXT DEFAULT NULL
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
  UPDATE public.profiles p
  SET 
    -- For credit packs, keep the current subscription plan and just add credits
    -- For subscription plans, change to the new plan
    subscription_plan = CASE
      WHEN new_plan IN ('pay_as_go', 'small_pack') THEN p.subscription_plan
      ELSE new_plan
    END,
    credits_remaining = CASE
      WHEN new_plan IN ('pay_as_go', 'small_pack') THEN p.credits_remaining + plan_credits
      ELSE plan_credits
    END,
    -- Reset total_processed to 0 when upgrading to a subscription plan (not credit packs)
    -- This ensures usage count starts fresh for the new plan
    total_processed = CASE
      WHEN new_plan IN ('tier1', 'tier2', 'tier3') THEN 0
      ELSE p.total_processed  -- Keep existing count for credit packs
    END,
    subscription_status = 'active',
    subscription_id = COALESCE(subscription_id_param, p.subscription_id),
    next_billing_date = CASE
      WHEN new_plan IN ('tier1', 'tier2', 'tier3') THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE p.id = user_uuid;
  
  -- Record payment
  INSERT INTO public.payments (user_id, payment_id, subscription_id, plan_id, amount, status)
  VALUES (user_uuid, payment_id, subscription_id_param, new_plan, plan_price, 'completed');
  
  -- Return result
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'plan', p.subscription_plan,
    'credits_remaining', p.credits_remaining,
    'next_billing_date', p.next_billing_date
  ) INTO result
  FROM public.profiles p
  WHERE p.id = user_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

