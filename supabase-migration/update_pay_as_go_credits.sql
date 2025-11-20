-- Update Pay as you go plan to 300 credits for $5
UPDATE subscription_plans 
SET credits = 300 
WHERE id = 'pay_as_go';

