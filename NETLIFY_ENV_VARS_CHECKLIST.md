# Netlify Environment Variables Checklist

## Production PayPal Variables (Required)

### 1. PAYPAL_ENVIRONMENT
- **Should be:** `production`
- **NOT:** `sandbox`
- **Context:** Production

### 2. PAYPAL_CLIENT_ID
- **Should be:** `AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v`
- **NOT:** `AdawCJQ9qxN5aZAQZL1Ke9YVYz7d-Cll31iDWA92-JcfT4PzHYqxY9LzvayCBLGPQY2V_ta4qVe_2ofp` (sandbox)
- **Context:** Production

### 3. PAYPAL_CLIENT_SECRET
- **Should be:** `EMffXHKQEzrsWqYgjzvqnXCLodaYY2RBibpf0wTAqqYwRdA8tvrai8GFJoozyfl6d9GY355p5w0l9rFT`
- **NOT:** `EPdEQqM_BspNes1CPCRe0pjbBL-JrhIAODM18xjTUCCmXN8OnSZ4ZNL2kLqEk3xS9VsVa0vZoRwoukYq` (sandbox)
- **Context:** Production

### 4. PAYPAL_PRODUCT_ID
- **Should be:** `PROD-89T43770P6349820G`
- **NOT:** `PROD-1A984321M9661514A` (sandbox)
- **Context:** Production

### 5. REACT_APP_PAYPAL_CLIENT_ID
- **Should be:** `AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v`
- **NOT:** `AdawCJQ9qxN5aZAQZL1Ke9YVYz7d-Cll31iDWA92-JcfT4PzHYqxY9LzvayCBLGPQY2V_ta4qVe_2ofp` (sandbox)
- **Context:** Production

## Optional Variables (Plans will be auto-created if not set)

### 6. PAYPAL_PLAN_TIER1 (optional)
- Leave empty to auto-create plans

### 7. PAYPAL_PLAN_TIER1_ANNUAL (optional)
- Leave empty to auto-create plans

### 8. PAYPAL_PLAN_TIER2 (optional)
- Leave empty to auto-create plans

### 9. PAYPAL_PLAN_TIER2_ANNUAL (optional)
- Leave empty to auto-create plans

### 10. PAYPAL_PLAN_TIER3 (optional)
- Leave empty to auto-create plans

### 11. PAYPAL_PLAN_TIER3_ANNUAL (optional)
- Leave empty to auto-create plans

## Important Notes

1. **ALL PayPal variables must be set to PRODUCTION values, NOT sandbox**
2. Set these for **'Production'** context in Netlify (not 'All' or 'Development')
3. After updating, trigger a new deployment for changes to take effect

## How to Verify in Netlify Dashboard

1. Go to: https://app.netlify.com/sites/alt-text-ai/configuration/env
2. Filter by "Production" context
3. Check each variable matches the values above
4. Make sure no sandbox values are present

## Common Issues

### Issue: One-time payment instead of subscription
**Symptom:** PayPal redirect shows `flow=1-P` error
**Cause:** `billing_cycle` in Supabase `subscription_plans` table is NULL or not 'monthly'
**Fix:** Run this SQL in Supabase:
```sql
UPDATE subscription_plans
SET billing_cycle = 'monthly'
WHERE id IN ('tier1', 'tier2', 'tier3')
  AND (billing_cycle IS NULL OR billing_cycle != 'monthly');
```

### Issue: Payment processing fails
**Cause:** Using sandbox credentials in production
**Fix:** Verify all PayPal variables are set to production values (see above)

