# PayPal Manual Subscription Setup Guide

This guide walks you through manually creating PayPal subscription products and plans in the PayPal Developer Dashboard. This is the recommended approach for production environments.

## Prerequisites

1. A PayPal Business account
2. Access to the PayPal Developer Dashboard (https://developer.paypal.com)
3. Your production PayPal app credentials (Client ID and Secret)

## Step 1: Create a Subscription Product

1. Log in to the PayPal Developer Dashboard: https://developer.paypal.com
2. Navigate to your **Live** (production) app
3. Go to **Subscriptions** → **Products** (or look for "Manage subscriptions" or "Create plan")
4. Click **Create Product** or **Create plan**

### Product Details

Fill in the following information:

- **Product Name:** `Alt Text Pro`
- **Product Description:** `AI-powered alt-text generation service for WordPress and websites`
- **Product ID:** Leave empty (PayPal will generate one) OR use: `ALT_TEXT_PRO`
- **Product Type:** Select `SERVICE` or `SOFTWARE`
- **Industry Category:** Select `SOFTWARE` or `DIGITAL_SERVICES`
- **Product Page URL:** `https://www.alt-text.pro`
- **Product Image URL:** `https://www.alt-text.pro/logo-alt-text-pro.png` (if you have one)

5. Click **Next** or **Save** to create the product
6. **IMPORTANT:** Copy the **Product ID** (it will look like `PROD-XXXXXXXXXXXXX`) - you'll need this later

## Step 2: Create Subscription Plans

For each subscription tier, create a separate plan:

### Plan 1: Tier 1 ($12/month - 1,000 credits)

1. In the same Subscriptions section, click **Create Plan**
2. Select the product you just created (`Alt Text Pro`)
3. Fill in the plan details:

   - **Plan Name:** `Alt Text Pro - Tier 1`
   - **Description:** `1,000 credits per month - Tier 1`
   - **Billing Cycle:**
     - **Frequency:** Monthly
     - **Interval:** 1 month
     - **Price:** $12.00 USD
   - **Setup Fee:** $0.00 (IMPORTANT: Set to 0)
   - **Trial Period:** None
   - **Auto-renewal:** Enabled
   - **Payment Failure:** Set to continue after 3 failures

4. Click **Create Plan** or **Save**
5. **IMPORTANT:** Copy the **Plan ID** (it will look like `P-XXXXXXXXXXXXX`) - you'll need this for `PAYPAL_PLAN_TIER1`

### Plan 2: Tier 2 ($20/month - 2,500 credits)

Repeat the process with:
- **Plan Name:** `Alt Text Pro - Tier 2`
- **Description:** `2,500 credits per month - Tier 2`
- **Price:** $20.00 USD
- Copy the **Plan ID** for `PAYPAL_PLAN_TIER2`

### Plan 3: Tier 3 ($40/month - 5,000 credits)

Repeat the process with:
- **Plan Name:** `Alt Text Pro - Tier 3`
- **Description:** `5,000 credits per month - Tier 3`
- **Price:** $40.00 USD
- Copy the **Plan ID** for `PAYPAL_PLAN_TIER3`

## Step 3: Set Up Webhooks

1. In your PayPal Developer Dashboard, go to your **Live** app
2. Navigate to **Webhooks** section
3. Click **Add Webhook** or **Create Webhook**
4. Enter the webhook URL: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
5. Select the following events to listen for:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - `BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED`
   - `PAYMENT.SALE.COMPLETED`
6. Click **Save**
7. **IMPORTANT:** Copy the **Webhook ID** (you may need this for verification)

## Step 4: Collect Your Credentials

You'll need the following values from your PayPal Developer Dashboard:

### From Your Live App:
- **Client ID:** Found in your app's credentials section
- **Client Secret:** Found in your app's credentials section (click "Show" to reveal)

### From Products & Plans:
- **Product ID:** From Step 1 (e.g., `PROD-XXXXXXXXXXXXX`)
- **Plan ID for Tier 1:** From Step 2 (e.g., `P-XXXXXXXXXXXXX`)
- **Plan ID for Tier 2:** From Step 2 (e.g., `P-YYYYYYYYYYYYY`)
- **Plan ID for Tier 3:** From Step 2 (e.g., `P-ZZZZZZZZZZZZZ`)

## Step 5: Update Netlify Environment Variables

Add the following environment variables to your Netlify site:

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select your site (`alt-text.pro` or similar)
3. Go to **Site settings** → **Environment variables**
4. Add or update the following variables:

```
PAYPAL_ENVIRONMENT=production
PAYPAL_CLIENT_ID=<Your Live Client ID>
PAYPAL_CLIENT_SECRET=<Your Live Client Secret>
PAYPAL_PRODUCT_ID=<Product ID from Step 1>
PAYPAL_PLAN_TIER1=<Plan ID for Tier 1>
PAYPAL_PLAN_TIER2=<Plan ID for Tier 2>
PAYPAL_PLAN_TIER3=<Plan ID for Tier 3>
REACT_APP_PAYPAL_CLIENT_ID=<Your Live Client ID>
```

5. Click **Save**

## Step 6: Redeploy Your Site

After updating environment variables, trigger a new deployment:

```bash
git commit --allow-empty -m "Trigger deployment after PayPal manual setup"
git push origin main
```

Or manually trigger a deploy from the Netlify dashboard.

## Verification Checklist

- [ ] Product created in PayPal Dashboard
- [ ] Product ID copied and added to Netlify
- [ ] All 3 plans created (Tier 1, Tier 2, Tier 3)
- [ ] All plan IDs copied and added to Netlify
- [ ] Webhook configured with correct URL
- [ ] All environment variables set in Netlify
- [ ] Site redeployed with new environment variables
- [ ] Test subscription flow works correctly

## Troubleshooting

### If subscription creation fails:
1. Verify all Plan IDs are correct in Netlify environment variables
2. Check that plans are set to "ACTIVE" status in PayPal Dashboard
3. Ensure setup fees are set to $0.00
4. Verify webhook URL is accessible (should return 200 OK)

### If approval URL doesn't work:
1. Check that the Product ID matches in both PayPal and Netlify
2. Verify the plan is associated with the correct product
3. Ensure you're using production credentials (not sandbox)

## Notes

- Manual setup gives you full control over product and plan configuration
- You can modify plans in the PayPal Dashboard without code changes
- Plan IDs are permanent and won't change unless you delete and recreate plans
- Always test in sandbox first before setting up production

