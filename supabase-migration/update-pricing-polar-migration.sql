-- Migration: Update pricing for Polar.sh integration
-- Date: December 2024

-- Update Tier 1 pricing: $10/month, $108/year, 1000 credits
UPDATE subscription_plans 
SET price = 10.00, annual_price = 108.00, credits = 1000, per_credit_cost = 0.01
WHERE id = 'tier1';

-- Update Tier 2 pricing: $20/month, $216/year, 2300 credits
UPDATE subscription_plans 
SET price = 20.00, annual_price = 216.00, credits = 2300, per_credit_cost = 0.0087
WHERE id = 'tier2';

-- Update Tier 3 pricing: $30/month, $324/year, 3500 credits
UPDATE subscription_plans 
SET price = 30.00, annual_price = 324.00, credits = 3500, per_credit_cost = 0.0086
WHERE id = 'tier3';

-- Update existing pay_as_go (now called credit_pack): $5 for 550 credits
UPDATE subscription_plans 
SET name = 'Credit Pack', price = 5.00, credits = 550, per_credit_cost = 0.0091
WHERE id = 'pay_as_go';

-- Add new small_pack: $3 for 350 credits
INSERT INTO subscription_plans (id, name, price, credits, billing_cycle, features, per_credit_cost)
VALUES (
  'small_pack', 
  'Small Pack', 
  3.00, 
  350, 
  'one-time', 
  '["350 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
  0.0086
)
ON CONFLICT (id) DO UPDATE 
SET price = 3.00, credits = 350, name = 'Small Pack';
