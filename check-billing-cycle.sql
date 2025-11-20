-- Check billing_cycle values in subscription_plans table
-- Run this in Supabase SQL Editor

SELECT id, name, price, billing_cycle 
FROM subscription_plans 
WHERE id IN ('tier1', 'tier2', 'tier3')
ORDER BY id;

-- If billing_cycle is NULL or not 'monthly', run this fix:
-- UPDATE subscription_plans 
-- SET billing_cycle = 'monthly' 
-- WHERE id IN ('tier1', 'tier2', 'tier3') 
--   AND (billing_cycle IS NULL OR billing_cycle != 'monthly');
