# PayPal Production Migration - Step by Step Guide

Follow these steps in order. Complete each step before moving to the next.

---

## 📋 STEP 1: Access PayPal Developer Dashboard

1. **Open your browser** and go to: https://developer.paypal.com
2. **Log in** with your PayPal business account
3. You should see the PayPal Developer Dashboard

**✅ Checkpoint:** You're logged into PayPal Developer Dashboard

---

## 📋 STEP 2: Create Production App

1. **Click on "Dashboard"** in the top menu
2. **Click "My Apps & Credentials"** (or go directly to: https://developer.paypal.com/dashboard/applications)
3. **IMPORTANT:** Look at the top of the page - you'll see tabs like "Sandbox" and "Live" or "Production"
4. **Click on "Live" or "Production" tab** (NOT Sandbox!)
5. **Click "Create App"** button
6. Fill in the form:
   - **App Name**: `Alt Text Pro Production`
   - **Merchant**: Select your business account
   - **Features**: Check "Accept payments"
7. **Click "Create App"**
8. **Copy these values** (you'll need them later):
   - **Client ID**: Copy this value (starts with `Ae...` or `AZ...`)
   - **Secret**: Click "Show" next to Secret, then copy it (starts with `EC...`)

**✅ Checkpoint:** You have:
- Production Client ID: `_________________`
- Production Secret: `_________________`

---

## 📋 STEP 3: Create Production Product

1. **Stay in Production mode** (make sure you're on "Live" or "Production" tab, not Sandbox)
2. **Go to Products**: Click "Dashboard" → "Products" OR go to: https://developer.paypal.com/dashboard/catalog/products
3. **Make sure you're on Production tab** (check the top of the page)
4. **Click "Create Product"** button
5. Fill in the form:
   - **Name**: `Alt Text Pro`
   - **Description**: `AI-powered alt-text generation service for WordPress and websites`
   - **Type**: Select `Service`
   - **Category**: Select `Software`
   - **Image URL** (optional): `https://www.alt-text.pro/logo-alt-text-pro.png`
   - **Home URL** (optional): `https://www.alt-text.pro`
6. **Click "Save"**
7. **Copy the Product ID** (starts with `PROD_...`)

**✅ Checkpoint:** You have:
- Production Product ID: `PROD__________________`

---

## 📋 STEP 4: Create Production Plan for Tier 1

1. **Stay in Production mode** (check the tab at the top)
2. **Go to Plans**: Click "Dashboard" → "Plans" OR go to: https://developer.paypal.com/dashboard/catalog/plans
3. **Make sure you're on Production tab**
4. **Click "Create Plan"** button
5. Fill in the form:
   - **Product**: Select `Alt Text Pro` (the product you just created)
   - **Name**: `Alt Text Pro - Tier 1`
   - **Description**: `1,000 credits per month`
   - **Billing Cycle**: Select `Monthly`
   - **Price**: `12.00`
   - **Currency**: `USD`
   - **Setup Fee**: `0.00` (IMPORTANT: Must be 0!)
   - Leave other fields as default
6. **Click "Save"**
7. **Copy the Plan ID** (starts with `P-...`)

**✅ Checkpoint:** You have:
- Tier 1 Plan ID: `P-_________________`

---

## 📋 STEP 5: Create Production Plan for Tier 2

1. **Still in Production mode** (Plans page)
2. **Click "Create Plan"** again
3. Fill in:
   - **Product**: Select `Alt Text Pro`
   - **Name**: `Alt Text Pro - Tier 2`
   - **Description**: `2,500 credits per month`
   - **Billing Cycle**: `Monthly`
   - **Price**: `20.00`
   - **Currency**: `USD`
   - **Setup Fee**: `0.00` (IMPORTANT!)
4. **Click "Save"**
5. **Copy the Plan ID**

**✅ Checkpoint:** You have:
- Tier 2 Plan ID: `P-_________________`

---

## 📋 STEP 6: Create Production Plan for Tier 3

1. **Still in Production mode** (Plans page)
2. **Click "Create Plan"** again
3. Fill in:
   - **Product**: Select `Alt Text Pro`
   - **Name**: `Alt Text Pro - Tier 3`
   - **Description**: `5,000 credits per month`
   - **Billing Cycle**: `Monthly`
   - **Price**: `40.00`
   - **Currency**: `USD`
   - **Setup Fee**: `0.00` (IMPORTANT!)
4. **Click "Save"**
5. **Copy the Plan ID**

**✅ Checkpoint:** You have:
- Tier 3 Plan ID: `P-_________________`

---

## 📋 STEP 7: Set Up Production Webhook

1. **Go back to Apps**: 
   - Click "Dashboard" → "My Apps & Credentials"
   - OR go directly to: https://developer.paypal.com/dashboard/applications

2. **Make sure you're on Live/Production tab**:
   - Look at the top of the page
   - You should see tabs: "Sandbox" and "Live" (or "Production")
   - **Click on "Live" tab** (NOT Sandbox!)

3. **Click on your production app**:
   - Find `Alt Text Pro Production` in the list
   - Click on it to open the app details

4. **Find the Webhooks section**:
   - Scroll down in the app details page
   - Look for a section called **"Live Webhooks"** or **"Webhooks"**
   - It might be in a sidebar on the left, or in the main content area
   - If you don't see it, try clicking on different tabs/sections in the app details page

5. **Add the Webhook**:
   - Click **"Add Webhook"** button (or "Create Webhook")
   - If you see an existing webhook, you can click "Edit" or "Add another webhook"

6. **Configure the Webhook**:
   - **Webhook URL**: Enter exactly: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
   - **Event types** - Select these events (check the boxes):
     - ✅ `BILLING.SUBSCRIPTION.ACTIVATED`
     - ✅ `BILLING.SUBSCRIPTION.CANCELLED`
     - ✅ `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
     - ✅ `BILLING.SUBSCRIPTION.SUSPENDED`
     - ✅ `PAYMENT.SALE.COMPLETED`
   - **Click "Save"** or "Create Webhook"

7. **Verify the Webhook**:
   - After saving, you should see the webhook listed
   - The status should show as "Active" or "Enabled"
   - **Copy the Webhook ID** if shown (you might need this later)

**⚠️ If you can't find "Add Webhook" button:**
- Make sure you're on the **Live** tab, not Sandbox
- Make sure you've clicked on your **production app** (not sandbox app)
- Try refreshing the page
- Some PayPal accounts may have webhooks in a different location - look for "Webhooks" in the left sidebar or main menu

**Alternative method (if webhook is in a different location):**
- Go to: https://developer.paypal.com/dashboard/webhooks
- Make sure you're on **Live** tab
- Click "Add Webhook" from there
- Select your app when prompted

**✅ Checkpoint:** Webhook is configured with URL: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`

---

## 📋 STEP 8: Collect All Your Production Values

Before moving to Netlify, make sure you have all these values written down:

- [ ] Production Client ID: `_________________`
- [ ] Production Secret: `_________________`
- [ ] Production Product ID: `PROD__________________`
- [ ] Tier 1 Plan ID: `P-_________________`
- [ ] Tier 2 Plan ID: `P-_________________`
- [ ] Tier 3 Plan ID: `P-_________________`

**✅ Checkpoint:** All values collected and written down

---

## 📋 STEP 9: Update Netlify Environment Variables

1. **Open a new browser tab** and go to: https://app.netlify.com
2. **Log in** to your Netlify account
3. **Select your site** (`alt-text-ai` or similar)
4. **Go to Site Settings**: Click on your site → "Site settings" (or click the site name → Settings)
5. **Click "Environment variables"** in the left sidebar
6. **Find and update these variables** (click on each one to edit):

   **Variable 1: PAYPAL_ENVIRONMENT**
   - Find `PAYPAL_ENVIRONMENT` in the list
   - Click on it to edit
   - Change value from `sandbox` to `production`
   - Click "Save"
   - OR if it doesn't exist, click "Add a variable":
     - Key: `PAYPAL_ENVIRONMENT`
     - Value: `production`
     - Scope: Select `Functions`
     - Click "Add variable"

   **Variable 2: PAYPAL_CLIENT_ID**
   - Find `PAYPAL_CLIENT_ID`
   - Click to edit
   - Replace the sandbox value with your **Production Client ID**
   - Click "Save"

   **Variable 3: PAYPAL_CLIENT_SECRET**
   - Find `PAYPAL_CLIENT_SECRET`
   - Click to edit
   - Replace the sandbox value with your **Production Secret**
   - Click "Save"

   **Variable 4: REACT_APP_PAYPAL_CLIENT_ID**
   - Find `REACT_APP_PAYPAL_CLIENT_ID`
   - Click to edit
   - Replace with your **Production Client ID** (same as PAYPAL_CLIENT_ID)
   - Click "Save"

   **Variable 5: PAYPAL_PRODUCT_ID**
   - Find `PAYPAL_PRODUCT_ID`
   - Click to edit
   - Replace with your **Production Product ID** (starts with `PROD_`)
   - Click "Save"

   **Variable 6: PAYPAL_PLAN_TIER1**
   - Find `PAYPAL_PLAN_TIER1`
   - Click to edit
   - Replace with your **Tier 1 Plan ID** (starts with `P-`)
   - Click "Save"

   **Variable 7: PAYPAL_PLAN_TIER2**
   - Find `PAYPAL_PLAN_TIER2`
   - Click to edit
   - Replace with your **Tier 2 Plan ID** (starts with `P-`)
   - Click "Save"

   **Variable 8: PAYPAL_PLAN_TIER3**
   - Find `PAYPAL_PLAN_TIER3`
   - Click to edit
   - Replace with your **Tier 3 Plan ID** (starts with `P-`)
   - Click "Save"

**✅ Checkpoint:** All 8 environment variables updated in Netlify

---

## 📋 STEP 10: Verify Environment Variables

Double-check that all variables are correct:

1. **In Netlify**, go to Environment variables page
2. **Verify each variable**:
   - `PAYPAL_ENVIRONMENT` = `production`
   - `PAYPAL_CLIENT_ID` = Your production Client ID
   - `PAYPAL_CLIENT_SECRET` = Your production Secret
   - `REACT_APP_PAYPAL_CLIENT_ID` = Same as PAYPAL_CLIENT_ID
   - `PAYPAL_PRODUCT_ID` = Your production Product ID
   - `PAYPAL_PLAN_TIER1` = Your Tier 1 Plan ID
   - `PAYPAL_PLAN_TIER2` = Your Tier 2 Plan ID
   - `PAYPAL_PLAN_TIER3` = Your Tier 3 Plan ID

**✅ Checkpoint:** All variables verified

---

## 📋 STEP 11: Trigger Netlify Deployment

1. **In Netlify**, go to "Deploys" tab
2. **Click "Trigger deploy"** button (top right)
3. **Select "Deploy site"**
4. **Wait for deployment to complete** (usually 2-3 minutes)
5. **Check that deployment succeeded** (green checkmark)

**✅ Checkpoint:** Site deployed successfully

---

## 📋 STEP 12: Test Production Payment (Small Test First!)

**IMPORTANT:** Test with a small amount first to make sure everything works!

1. **Go to your website**: https://www.alt-text.pro
2. **Sign in** to your account
3. **Try to purchase the smallest credit pack** first (Small Pack - $3)
   - This is a one-time payment, good for testing
4. **Complete the payment** with your real PayPal account
5. **Check if credits are added** to your account
6. **Check PayPal dashboard** - you should see the payment

**✅ Checkpoint:** Small test payment completed successfully

---

## 📋 STEP 13: Test Subscription (Optional - After Small Test Works)

Only do this after Step 12 works!

1. **Go to your website**
2. **Try subscribing to Tier 1** ($12/month)
3. **Complete the payment**
4. **Verify**:
   - Subscription appears in PayPal dashboard
   - Credits are added to your account
   - Next billing date is set

**✅ Checkpoint:** Subscription test completed

---

## 📋 STEP 14: Monitor for Issues

For the first 24 hours, monitor:

1. **Netlify Function Logs**:
   - Go to Netlify → Functions → View logs
   - Check for any errors

2. **PayPal Dashboard**:
   - Check for payments
   - Check for any failed transactions

3. **Your Website**:
   - Test that payments are working
   - Check that credits are being added correctly

**✅ Checkpoint:** Monitoring set up

---

## 🎉 CONGRATULATIONS!

You've successfully migrated to production! Your PayPal integration is now live and accepting real payments.

---

## 🆘 If Something Goes Wrong

**To rollback to sandbox:**
1. In Netlify, change `PAYPAL_ENVIRONMENT` back to `sandbox`
2. Update `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to sandbox values
3. Update `REACT_APP_PAYPAL_CLIENT_ID` to sandbox value
4. Redeploy

**Common Issues:**
- **"Invalid Client ID"**: Make sure you're using production Client ID, not sandbox
- **"Plan not found"**: Verify Plan IDs are from production, not sandbox
- **Webhook not working**: Check that webhook URL is correct and accessible

---

## 📝 Quick Reference

**Production URLs:**
- PayPal Developer Dashboard: https://developer.paypal.com
- Netlify Dashboard: https://app.netlify.com
- Your Website: https://www.alt-text.pro

**Important IDs to Keep:**
- Production Client ID: `_________________`
- Production Secret: `_________________`
- Product ID: `PROD__________________`
- Tier 1 Plan: `P-_________________`
- Tier 2 Plan: `P-_________________`
- Tier 3 Plan: `P-_________________`

