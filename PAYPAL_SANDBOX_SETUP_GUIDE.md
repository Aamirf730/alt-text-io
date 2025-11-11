# PayPal Sandbox Setup Guide

## Step-by-Step Instructions for Testing with PayPal Sandbox

### Step 1: Get PayPal Sandbox API Credentials

1. **Log in to PayPal Developer Dashboard**:
   - Go to: https://developer.paypal.com
   - Click "Log In" and complete authentication

2. **Navigate to Sandbox Applications**:
   - Go to: https://developer.paypal.com/dashboard/applications/sandbox
   - Or click "Dashboard" → "My Apps & Credentials" → Switch to **Sandbox** tab

3. **Create or Select a Sandbox App**:
   - If you don't have a sandbox app, click "Create App"
   - Name it: "Alt Text Pro Sandbox" or similar
   - Select environment: **Sandbox** (make sure it's sandbox, not production!)
   - Click "Create App"

4. **Copy Your Sandbox Credentials**:
   - You'll see:
     - **Client ID**: Copy this (sandbox IDs look different from production)
     - **Secret**: Click "Show" and copy this
   - Save these securely - you'll need them for Netlify environment variables

### Step 2: Create PayPal Sandbox Product

1. **Navigate to Sandbox Products**:
   - In PayPal Developer Dashboard, make sure you're in **Sandbox** mode
   - Go to: https://developer.paypal.com/dashboard/catalog/products
   - Or: Dashboard → Products (ensure Sandbox tab is selected)

2. **Create New Product**:
   - Click "Create Product"
   - Fill in:
     - **Name**: Alt Text Pro
     - **Description**: AI-powered alt-text generation service for WordPress and websites
     - **Type**: Service
     - **Category**: Software
   - Click "Save"
   - **Copy the Product ID** (starts with `PROD_`)

### Step 3: Create Sandbox Subscription Plans

For each subscription tier, create a plan in **Sandbox** mode:

1. **Navigate to Sandbox Plans**:
   - Go to: https://developer.paypal.com/dashboard/catalog/plans
   - Make sure you're on the **Sandbox** tab (not Production)

2. **Create Plan for Tier 1** ($12/month):
   - Click "Create Plan"
   - **Product**: Select "Alt Text Pro" (the sandbox product you just created)
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


### Step 4: Set Up Sandbox Webhook

1. **Navigate to Your Sandbox App**:
   - Go to: https://developer.paypal.com/dashboard/applications/sandbox
   - Make sure you're on the **Sandbox** tab (not Production)
   - Click on your sandbox app name (the one you created in Step 1)

2. **Find the Webhooks Section**:
   - Scroll down in your app settings
   - Look for the **"Webhooks"** section
   - Click **"Add Webhook"** or **"Create Webhook"**

3. **Create Webhook**:
   - **Webhook URL**: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
     - **Note**: Make sure this URL is publicly accessible (it should be since it's on Netlify)
   - **Event Types** (select all):
     - `BILLING.SUBSCRIPTION.CREATED`
     - `BILLING.SUBSCRIPTION.ACTIVATED`
     - `BILLING.SUBSCRIPTION.CANCELLED`
     - `BILLING.SUBSCRIPTION.EXPIRED`
     - `BILLING.SUBSCRIPTION.SUSPENDED`
     - `PAYMENT.SALE.COMPLETED`
     - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - Click **"Save"** or **"Create"**
   - **Copy the Webhook ID** (optional, for reference)

**Alternative Method (if webhooks section not visible in app)**:
- Go to: https://developer.paypal.com/dashboard
- Click on **"My Apps & Credentials"**
- Make sure you're on **Sandbox** tab
- Click on your app
- Look for **"Webhooks"** in the left sidebar or scroll down in the app details

### Step 5: Create Sandbox Test Accounts (Optional but Recommended)

1. **Navigate to Sandbox Accounts**:
   - Go to: https://developer.paypal.com/dashboard/accounts
   - Or: Dashboard → Accounts → Sandbox tab

2. **Create Test Accounts**:
   - Click "Create Account"
   - Create a **Personal** account for testing customer payments
   - Create a **Business** account if needed
   - These accounts can be used to test the payment flow

### Step 6: Add Environment Variables to Netlify

1. **Go to Netlify Dashboard**:
   - https://app.netlify.com/sites/alt-text-ai/settings/env

2. **Add These Variables** (with "Functions" scope for backend, "Build" scope for frontend):
   
   **Backend Variables (Functions scope):**
   ```
   PAYPAL_ENVIRONMENT=sandbox
   PAYPAL_CLIENT_ID=your_sandbox_client_id_here
   PAYPAL_CLIENT_SECRET=your_sandbox_secret_here
   PAYPAL_PRODUCT_ID=PROD_XXXXX
   PAYPAL_PLAN_TIER1=P-XXXXX
   PAYPAL_PLAN_TIER2=P-XXXXX
   PAYPAL_PLAN_TIER3=P-XXXXX
   ```
   
   **Frontend Variable (Build scope):**
   ```
   REACT_APP_PAYPAL_CLIENT_ID=your_sandbox_client_id_here
   ```
   
   **Important Notes:**
   - `PAYPAL_ENVIRONMENT=sandbox` tells the backend to use sandbox API
   - Use the **same** sandbox Client ID for both `PAYPAL_CLIENT_ID` and `REACT_APP_PAYPAL_CLIENT_ID`
   - Replace all `XXXXX` values with your actual sandbox IDs

3. **Save** all variables

### Step 7: Test the Integration

1. **Deploy to Netlify** (if not already deployed)

2. **Test Subscription Creation**:
   - Go to your website
   - Try to subscribe to a plan
   - Use a sandbox test account to complete the payment
   - Check that the subscription is created in PayPal sandbox dashboard

3. **Test Webhook**:
   - Complete a test payment
   - Check Netlify function logs to see if webhook events are received
   - Verify that user credits are updated in Supabase

### Step 8: Switch to Production (When Ready)

When you're ready to go live:

1. **Create Production App** in PayPal Dashboard (switch to Production tab)
2. **Create Production Product and Plans** (same steps as sandbox, but in Production tab)
3. **Update Netlify Environment Variables**:
   - Change `PAYPAL_ENVIRONMENT` to `production` (or remove it)
   - Update all IDs to production values
   - Update webhook URL if needed

## Quick Reference: What You Need for Sandbox

After completing the steps above, you should have:

1. ✅ **PAYPAL_ENVIRONMENT**: `sandbox`
2. ✅ **PAYPAL_CLIENT_ID**: Sandbox client ID (from sandbox app)
3. ✅ **PAYPAL_CLIENT_SECRET**: Sandbox secret (from sandbox app)
4. ✅ **REACT_APP_PAYPAL_CLIENT_ID**: Same as PAYPAL_CLIENT_ID
5. ✅ **PAYPAL_PRODUCT_ID**: `PROD_...` (from sandbox product)
6. ✅ **PAYPAL_PLAN_TIER1**: `P-...` (from sandbox plan)
7. ✅ **PAYPAL_PLAN_TIER2**: `P-...` (from sandbox plan)
8. ✅ **PAYPAL_PLAN_TIER3**: `P-...` (from sandbox plan)

## Testing Tips

- **Sandbox Test Accounts**: Use PayPal's sandbox test accounts to test payments without using real money
- **Webhook Testing**: You can use PayPal's webhook simulator to test webhook events
- **Logs**: Check Netlify function logs to debug any issues
- **PayPal Dashboard**: Monitor subscriptions and payments in the sandbox dashboard

## Troubleshooting

- **"Invalid Client ID"**: Make sure you're using sandbox credentials, not production
- **"Plan not found"**: Verify the plan IDs are from the sandbox environment
- **Webhook not receiving events**: Check that the webhook URL is correct and accessible
- **Subscription not activating**: Check function logs and PayPal dashboard for errors

