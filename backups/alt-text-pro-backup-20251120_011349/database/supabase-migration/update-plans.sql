-- Update subscription plans to match user requirements
-- File: supabase-migration/update-plans.sql

-- Clear existing plans
DELETE FROM subscription_plans;

-- Insert new plans according to user specifications
INSERT INTO subscription_plans (id, name, price, credits, billing_cycle, features) VALUES
('free', 'Free', 0, 100, 'monthly', ARRAY[
  '100 Credits each month',
  'Basic support',
  'WordPress plugin access'
]),
('tier1', 'Tier 1', 9, 1000, 'monthly', ARRAY[
  '1000 Credits each month',
  'Priority support', 
  'Advanced features',
  'Email support'
]),
('tier2', 'Tier 2', 19, 2500, 'monthly', ARRAY[
  '2500 Credits each month',
  'Premium support',
  'Advanced API access',
  'Priority processing'
]),
('pay_as_go', 'Pay as you go', 4, 500, 'one-time', ARRAY[
  '500 Credits (no expiration)',
  'Flexible usage',
  'Perfect for occasional use',
  'No monthly commitment'
]);

-- Update any existing user profiles to use the new plan IDs
-- Convert old plan IDs to new ones
UPDATE profiles 
SET subscription_plan = CASE 
  WHEN subscription_plan = 'free_trial' THEN 'free'
  WHEN subscription_plan = 'starter' THEN 'tier1'
  WHEN subscription_plan = 'pro' THEN 'tier2'
  WHEN subscription_plan = 'pay_as_go' THEN 'pay_as_go'
  ELSE 'free'
END
WHERE subscription_plan IS NOT NULL;
