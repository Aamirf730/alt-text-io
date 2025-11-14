# Update Netlify Environment Variable

## New Tier 1 Plan ID

**Plan ID:** `P-92242555HA520015WNEKPNOY`

## Steps to Update:

1. Go to **Netlify Dashboard**: https://app.netlify.com/
2. Select your site: **alt-text.pro** (or your site name)
3. Go to **Site settings** → **Environment variables**
4. Find `PAYPAL_PLAN_TIER1`
5. Click **Edit** (or **Add variable** if it doesn't exist)
6. Set value to: `P-92242555HA520015WNEKPNOY`
7. Click **Save**
8. **Redeploy** your site (or trigger a new deployment)

## After Update:

1. Wait for deployment to complete
2. Test subscription creation with Tier 1
3. Verify the approval URL contains `/billing/subscriptions` and `ba_token`

## Note:

The plan is linked to a **new Product ID**: `PROD-51S62165VB572643N`

If you want to use this product for all tiers, you may also want to update:
- `PAYPAL_PRODUCT_ID=PROD-51S62165VB572643N`

But this is optional - plans can work independently of the product ID variable.

