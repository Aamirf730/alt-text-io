# PayPal Production Migration Guide

## ✅ Pre-Migration Checklist

Before moving to production, ensure:

- [x] Sandbox testing is complete and working
- [x] All payment flows tested (subscriptions + one-time payments)
- [x] Webhook handling verified
- [x] Database functions working correctly
- [x] Error handling in place

## 🚀 Step-by-Step Production Migration

### Step 1: Create PayPal Production App

1. **Go to PayPal Developer Dashboard**:
   - https://developer.paypal.com
   - Log in with your **production PayPal business account**

2. **Switch to Production Mode**:
   - Click "Dashboard" → "My Apps & Credentials"
   - Switch to **Production** tab (not Sandbox)

3. **Create Production App**:
   - Click "Create App"
   - Name: "Alt Text Pro Production"
   - Environment: **Production** (make sure it's production!)
   - Click "Create App"

4. **Copy Production Credentials**:
   - **Client ID**: Copy this (production IDs look different from sandbox)
   - **Secret**: Click "Show" and copy this
   - ⚠️ **Save these securely** - these are your live credentials!

### Step 2: Create PayPal Production Product

1. **Navigate to Production Products**:
   - Go to: https://developer.paypal.com/dashboard/catalog/products
   - **Make sure you're on the Production tab** (not Sandbox)

2. **Create Product**:
   - Click "Create Product"
   - Fill in:
     - **Name**: Alt Text Pro
     - **Description**: AI-powered alt-text generation service for WordPress and websites
     - **Type**: Service
     - **Category**: Software
     - **Image URL** (optional): https://www.alt-text.pro/logo-alt-text-pro.png
     - **Home URL**: https://www.alt-text.pro
   - Click "Save"
   - **Copy the Product ID** (starts with `PROD_`)

### Step 3: Create Production Subscription Plans

For each subscription tier, create a plan in **Production** mode:

1. **Navigate to Production Plans**:
   - Go to: https://developer.paypal.com/dashboard/catalog/plans
   - **Make sure you're on the Production tab**

2. **Create Plan for Tier 1** ($12/month):
   - Click "Create Plan"
   - **Product**: Select "Alt Text Pro" (the product you just created)
   - **Name**: Alt Text Pro - Tier 1
   - **Description**: 1,000 credits per month
   - **Billing Cycle**: Monthly
   - **Price**: $12.00 USD
   - **Setup Fee**: $0.00 (important!)
   - Click "Save"
   - **Copy the Plan ID** (starts with `P-`)

3. **Create Plan for Tier 2** ($20/month):
   - Same steps as Tier 1
   - **Name**: Alt Text Pro - Tier 2
   - **Description**: 2,500 credits per month
   - **Price**: $20.00 USD
   - **Copy the Plan ID**

4. **Create Plan for Tier 3** ($40/month):
   - Same steps as Tier 1
   - **Name**: Alt Text Pro - Tier 3
   - **Description**: 5,000 credits per month
   - **Price**: $40.00 USD
   - **Copy the Plan ID**

### Step 4: Set Up Production Webhook

1. **Navigate to Production App Settings**:
   - Go to: https://developer.paypal.com/dashboard/applications
   - Switch to **Production** tab
   - Click on your production app

2. **Add Webhook**:
   - Look for **"Webhooks"** section
   - Click "Add Webhook" or "Edit Webhook"
   - **Webhook URL**: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
   - **Events to Subscribe**:
     - `BILLING.SUBSCRIPTION.ACTIVATED`
     - `BILLING.SUBSCRIPTION.CANCELLED`
     - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
     - `BILLING.SUBSCRIPTION.SUSPENDED`
     - `PAYMENT.SALE.COMPLETED`
   - Click "Save"
   - **Copy the Webhook ID** (you'll need this for verification)

### Step 5: Update Netlify Environment Variables

1. **Go to Netlify Dashboard**:
   - https://app.netlify.com/sites/[your-site]/settings/env

2. **Update/Add These Variables**:

   **Backend Variables (Functions scope):**
   ```
   PAYPAL_ENVIRONMENT=production
   PAYPAL_CLIENT_ID=your_production_client_id_here
   PAYPAL_CLIENT_SECRET=your_production_secret_here
   PAYPAL_PRODUCT_ID=PROD_XXXXX
   PAYPAL_PLAN_TIER1=P-XXXXX
   PAYPAL_PLAN_TIER2=P-XXXXX
   PAYPAL_PLAN_TIER3=P-XXXXX
   ```

   **Frontend Variable (Build scope):**
   ```
   REACT_APP_PAYPAL_CLIENT_ID=your_production_client_id_here
   ```

   **Important Notes:**
   - Set `PAYPAL_ENVIRONMENT=production` (or remove it - defaults to production)
   - Use **production** Client ID (different from sandbox)
   - Replace all `XXXXX` values with your actual production IDs
   - The same production Client ID goes in both `PAYPAL_CLIENT_ID` and `REACT_APP_PAYPAL_CLIENT_ID`

3. **Remove or Keep Sandbox Variables**:
   - You can keep sandbox variables for testing, but make sure production ones are set
   - The code uses `PAYPAL_ENVIRONMENT` to determine which to use

### Step 6: Verify Production Configuration

1. **Check Code is Ready**:
   - ✅ Code already switches between sandbox/production based on `PAYPAL_ENVIRONMENT`
   - ✅ All functions use `PAYPAL_BASE_URL` which switches automatically
   - ✅ Frontend PayPal SDK auto-detects production vs sandbox from Client ID

2. **Test Production Setup** (Optional - with small test):
   - Create a test subscription in production
   - Verify it appears in PayPal production dashboard
   - Cancel it immediately if testing

### Step 7: Deploy to Production

1. **Trigger Netlify Deployment**:
   - Go to Netlify Dashboard → Deploys
   - Click "Trigger deploy" → "Deploy site"
   - Or push a commit to trigger auto-deploy

2. **Verify Deployment**:
   - Check that environment variables are loaded
   - Check Netlify function logs for any errors

### Step 8: Final Production Testing

1. **Test Subscription Flow**:
   - Go to https://www.alt-text.pro
   - Try subscribing to Tier 1, Tier 2, or Tier 3
   - Complete payment with real PayPal account
   - Verify subscription is created
   - Verify credits are added to account

2. **Test One-Time Payment**:
   - Try purchasing "Small Pack" or "Pay as you go"
   - Complete payment
   - Verify credits are added

3. **Test Webhook**:
   - Complete a payment
   - Check Netlify function logs: `/.netlify/functions/paypal-webhook`
   - Verify webhook events are received

4. **Monitor for Issues**:
   - Check Netlify function logs regularly
   - Monitor PayPal dashboard for payments
   - Check Supabase for payment records

## 🔒 Security Checklist

- [ ] Production credentials are secure (not in code)
- [ ] Webhook URL is HTTPS
- [ ] Webhook signature verification is enabled (optional but recommended)
- [ ] Environment variables are scoped correctly (Functions vs Build)
- [ ] No sandbox credentials in production environment

## 📋 Production Environment Variables Summary

After migration, you should have:

1. ✅ **PAYPAL_ENVIRONMENT**: `production` (or removed - defaults to production)
2. ✅ **PAYPAL_CLIENT_ID**: Production client ID
3. ✅ **PAYPAL_CLIENT_SECRET**: Production secret
4. ✅ **REACT_APP_PAYPAL_CLIENT_ID**: Same as PAYPAL_CLIENT_ID
5. ✅ **PAYPAL_PRODUCT_ID**: `PROD_...` (production product)
6. ✅ **PAYPAL_PLAN_TIER1**: `P-...` (production plan)
7. ✅ **PAYPAL_PLAN_TIER2**: `P-...` (production plan)
8. ✅ **PAYPAL_PLAN_TIER3**: `P-...` (production plan)

## ⚠️ Important Notes

1. **Keep Sandbox for Testing**: You can keep sandbox environment variables and switch back by setting `PAYPAL_ENVIRONMENT=sandbox`

2. **Webhook URL**: Make sure your production webhook URL is accessible and returns 200 OK

3. **First Real Payment**: Consider testing with a small amount first to verify everything works

4. **Monitoring**: Set up alerts for payment failures and webhook errors

5. **Backup Plan**: Keep sandbox credentials in case you need to test fixes

## 🆘 Rollback Plan

If something goes wrong:

1. **Switch Back to Sandbox**:
   - Set `PAYPAL_ENVIRONMENT=sandbox` in Netlify
   - Update `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to sandbox values
   - Update `REACT_APP_PAYPAL_CLIENT_ID` to sandbox value
   - Redeploy

2. **Fix Issues**:
   - Check Netlify function logs
   - Check PayPal dashboard for errors
   - Verify all environment variables are correct

## ✅ Ready for Production?

Once you've completed all steps above, you're ready for production! The code is already configured to handle both sandbox and production environments seamlessly.

