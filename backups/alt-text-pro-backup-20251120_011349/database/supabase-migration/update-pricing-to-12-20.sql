-- Update subscription plans pricing to match homepage
-- Tier 1: $12/month (was $9)
-- Tier 2: $20/month (was $19)
-- Tier 2 credits: 2,500 (confirmed)

UPDATE public.subscription_plans 
SET price = 12.00
WHERE id = 'tier1';

UPDATE public.subscription_plans 
SET price = 20.00
WHERE id = 'tier2';

-- Verify the updates
SELECT id, name, price, credits, billing_cycle 
FROM public.subscription_plans 
WHERE id IN ('tier1', 'tier2')
ORDER BY price;

