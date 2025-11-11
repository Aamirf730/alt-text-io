# PayPal Manual Setup Guide

## Step-by-Step Instructions to Get PayPal Credentials and Set Up Subscriptions

### Step 1: Get PayPal API Credentials

1. **Log in to PayPal Developer Dashboard**:
   - Go to: https://developer.paypal.com
   - Click "Log In" and complete authentication

2. **Navigate to Applications**:
   - Go to: https://developer.paypal.com/dashboard/applications
   - Or click "Dashboard" → "My Apps & Credentials"

3. **Create or Select an App**:
   - If you don't have an app, click "Create App"
   - Name it: "Alt Text Pro" or similar
   - Select environment: **Production** (for live site) or **Sandbox** (for testing)
   - Click "Create App"

4. **Copy Your Credentials**:
   - You'll see:
     - **Client ID**: Copy this
     - **Secret**: Click "Show" and copy this
   - Save these securely - you'll need them for Netlify environment variables

### Step 2: Create PayPal Product

1. **Navigate to Products**:
   - In PayPal Developer Dashboard, go to: https://developer.paypal.com/dashboard/catalog/products
   - Or: Dashboard → Products

2. **Create New Product**:
   - Click "Create Product"
   - Fill in:
     - **Name**: Alt Text Pro
     - **Description**: AI-powered alt-text generation service for WordPress and websites
     - **Type**: Service
     - **Category**: Software
   - Click "Save"
   - **Copy the Product ID** (starts with `PROD_`)

### Step 3: Create Subscription Plans

For each subscription tier, create a plan:

1. **Navigate to Plans**:
   - Go to: https://developer.paypal.com/dashboard/catalog/plans
   - Or: Dashboard → Plans

2. **Create Plan for Tier 1** ($12/month):
   - Click "Create Plan"
   - **Product**: Select "Alt Text Pro" (the product you just created)
   - **Name**: Alt Text Pro - Tier 1
   - **Description**: 1,000 credits per month - Tier 1
   - **Billing Cycle**: Monthly
   - **Price**: $12.00 USD
   - **Setup Fee**: $12.00 USD (first payment)
   - Click "Save"
   - **Copy the Plan ID** (starts with `P-`)

3. **Repeat for Tier 2** ($20/month):
   - Name: Alt Text Pro - Tier 2
   - Description: 2,500 credits per month - Tier 2
   - Price: $20.00 USD
   - Setup Fee: $20.00 USD
   - Copy Plan ID

4. **Repeat for Tier 3** ($40/month):
   - Name: Alt Text Pro - Tier 3
   - Description: 5,000 credits per month - Tier 3
   - Price: $40.00 USD
   - Setup Fee: $40.00 USD
   - Copy Plan ID


### Step 4: Set Up Webhook

1. **Navigate to Webhooks**:
   - Go to: https://developer.paypal.com/dashboard/webhooks
   - Or: Dashboard → Webhooks

2. **Create Webhook**:
   - Click "Create Webhook"
   - **Webhook URL**: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
   - **Event Types** (select all):
     - `BILLING.SUBSCRIPTION.CREATED`
     - `BILLING.SUBSCRIPTION.ACTIVATED`
     - `BILLING.SUBSCRIPTION.CANCELLED`
     - `BILLING.SUBSCRIPTION.EXPIRED`
     - `BILLING.SUBSCRIPTION.SUSPENDED`
     - `PAYMENT.SALE.COMPLETED`
     - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - Click "Save"
   - **Copy the Webhook ID** (optional, for reference)

### Step 5: Add Environment Variables to Netlify

1. **Go to Netlify Dashboard**:
   - https://app.netlify.com/sites/alt-text-ai/settings/env

2. **Add These Variables** (with "Functions" scope):
   ```
   PAYPAL_CLIENT_ID=your_client_id_here
   PAYPAL_CLIENT_SECRET=your_secret_here
   PAYPAL_PRODUCT_ID=PROD_XXXXX
   PAYPAL_PLAN_TIER1=P-XXXXX
   PAYPAL_PLAN_TIER2=P-XXXXX
   PAYPAL_PLAN_TIER3=P-XXXXX
   ```

3. **Save** all variables

### Step 6: Update Code to Use Pre-Created Plans

Once you have the Plan IDs, I'll update `create-payment.js` to use them instead of creating plans on-the-fly.

## Quick Reference: What You Need

After completing the steps above, provide me with:

1. ✅ **PAYPAL_CLIENT_ID**: `Ae...` (starts with A)
2. ✅ **PAYPAL_CLIENT_SECRET**: `EC...` (starts with EC)
3. ✅ **PAYPAL_PRODUCT_ID**: `PROD_...`
4. ✅ **PAYPAL_PLAN_TIER1**: `P-...`
5. ✅ **PAYPAL_PLAN_TIER2**: `P-...`
6. ✅ **PAYPAL_PLAN_TIER3**: `P-...`

Once you provide these, I can:
- Update the code to use the pre-created plans
- Test the subscription creation
- Deploy everything

