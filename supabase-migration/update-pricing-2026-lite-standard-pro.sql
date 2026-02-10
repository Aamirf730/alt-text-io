-- Migration: Update pricing to Lite/Standard/Pro plans
-- Date: February 2026
-- Description: Updates subscription_plans to new blogger-friendly pricing

-- Update Tier 1 → Lite: $3/mo, $30/yr, 150 images
UPDATE subscription_plans 
SET 
    name = 'Lite', 
    price = 3.00, 
    annual_price = 30.00, 
    credits = 150,
    per_credit_cost = 0.02, -- $3/150 = $0.02
    features = '["150 AI-Optimized Alt Texts", "Auto-Describe on Upload", "High-Accuracy Visual AI", "Standard Email Support"]'::jsonb
WHERE id = 'tier1';

-- Update Tier 2 → Standard: $5/mo, $48/yr, 400 images
UPDATE subscription_plans 
SET 
    name = 'Standard', 
    price = 5.00, 
    annual_price = 48.00, 
    credits = 400,
    per_credit_cost = 0.0125, -- $5/400 = $0.0125
    features = '["400 AI-Optimized Alt Texts", "Bulk One-Click Library Fix", "Multi-Language AI (130+)", "SEO & WCAG Compliance", "Priority Support"]'::jsonb
WHERE id = 'tier2';

-- Update Tier 3 → Pro: $9/mo, $86/yr, 1000 images
UPDATE subscription_plans 
SET 
    name = 'Pro', 
    price = 9.00, 
    annual_price = 86.00, 
    credits = 1000,
    per_credit_cost = 0.009, -- $9/1000 = $0.009
    features = '["1,000 AI-Optimized Alt Texts", "Advanced Context-Aware AI", "Full Auto-Pilot Workflow", "Custom Post Type Support", "Premium 24/7 Support"]'::jsonb
WHERE id = 'tier3';

-- Verify the updates
SELECT id, name, price, annual_price, credits, per_credit_cost FROM subscription_plans 
WHERE id IN ('tier1', 'tier2', 'tier3')
ORDER BY price;
