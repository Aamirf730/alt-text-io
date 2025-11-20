-- Update subscription plans with revised pricing and add new tiers
-- Includes annual pricing support and marks Tier 2 as most popular

-- First, update the profiles table constraint to include new tiers
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check 
  CHECK (subscription_plan IN ('free', 'tier1', 'tier2', 'tier3', 'pay_as_go', 'small_pack'));

-- Update subscription_plans table structure to support annual pricing
ALTER TABLE public.subscription_plans 
  ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS per_credit_cost DECIMAL(10,4);

-- Clear existing plans (except free)
DELETE FROM subscription_plans WHERE id NOT IN ('free');

-- Insert updated and new plans
INSERT INTO public.subscription_plans (id, name, price, annual_price, credits, billing_cycle, features, is_popular, per_credit_cost) VALUES
-- Free plan (unchanged)
('free', 'Free', 0, 0, 100, 'monthly', 
 '["100 Credits each month", "Basic support", "WordPress plugin access"]'::jsonb, 
 false, 0),

-- Tier 1: Updated pricing
('tier1', 'Tier 1', 15.00, 144.00, 1000, 'monthly', 
 '["1,000 Credits each month", "Priority support", "Advanced features", "Email support", "API access"]'::jsonb, 
 false, 0.015),

-- Tier 2: Updated pricing - MARKED AS MOST POPULAR
('tier2', 'Tier 2', 25.00, 240.00, 2500, 'monthly', 
 '["2,500 Credits each month", "Premium support", "Advanced API access", "Priority processing", "Bulk processing", "Custom integrations"]'::jsonb, 
 true, 0.01),

-- Tier 3: New high-volume tier
('tier3', 'Tier 3', 40.00, 432.00, 5000, 'monthly', 
 '["5,000 Credits each month", "Premium support", "Advanced API access", "Priority processing", "Bulk processing", "Custom integrations", "Dedicated support"]'::jsonb, 
 false, 0.0118),

-- Pay as you go: Updated pricing
('pay_as_go', 'Pay as you go', 5.00, NULL, 500, 'one-time', 
 '["500 Credits (no expiration)", "Flexible usage", "Perfect for occasional use", "No monthly commitment", "API access"]'::jsonb, 
 false, 0.01),

-- Small pack: New small credit pack
('small_pack', 'Small Pack', 3.00, NULL, 100, 'one-time', 
 '["100 Credits (no expiration)", "Flexible usage", "Perfect for testing", "No commitment", "API access"]'::jsonb, 
 false, 0.03)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  annual_price = EXCLUDED.annual_price,
  credits = EXCLUDED.credits,
  billing_cycle = EXCLUDED.billing_cycle,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  per_credit_cost = EXCLUDED.per_credit_cost;

-- Update the upgrade_subscription function to handle new tiers
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
      WHEN new_plan IN ('tier1', 'tier2', 'tier3') THEN NOW() + INTERVAL '1 month'
      ELSE NULL
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

