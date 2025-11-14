# PayPal Fresh Plans Setup Guide

## Current Plan Details

Based on your codebase, here are the exact details for each plan:

---

## **TIER 1**

### Plan Information:
- **Plan Name:** `Alt Text Pro - Tier 1`
- **Description:** `1,000 credits per month - Tier 1`
- **Price:** `$12.00 USD`
- **Credits:** `1,000 per month`
- **Billing Cycle:** `Monthly` (recurring)

### PayPal Dashboard Settings:

**Basic Information:**
- **Plan Name:** `Alt Text Pro - Tier 1`
- **Description:** `1,000 credits per month - Tier 1`

**Pricing:**
- **Billing Cycle:** `Monthly`
- **Interval:** `1 month`
- **Price:** `$12.00`
- **Currency:** `USD`

**Additional Settings:**
- **Setup Fee:** `$0.00` ⚠️ **MUST BE ZERO**
- **Trial Period:** `None`
- **Auto-renewal:** `Enabled`
- **Payment Failure Handling:** `Continue after 3 failures`

**After Creation:**
- Copy the **Plan ID** (starts with `P-`) → This will be your new `PAYPAL_PLAN_TIER1`

---

## **TIER 2**

### Plan Information:
- **Plan Name:** `Alt Text Pro - Tier 2`
- **Description:** `2,500 credits per month - Tier 2`
- **Price:** `$20.00 USD`
- **Credits:** `2,500 per month`
- **Billing Cycle:** `Monthly` (recurring)

### PayPal Dashboard Settings:

**Basic Information:**
- **Plan Name:** `Alt Text Pro - Tier 2`
- **Description:** `2,500 credits per month - Tier 2`

**Pricing:**
- **Billing Cycle:** `Monthly`
- **Interval:** `1 month`
- **Price:** `$20.00`
- **Currency:** `USD`

**Additional Settings:**
- **Setup Fee:** `$0.00` ⚠️ **MUST BE ZERO**
- **Trial Period:** `None`
- **Auto-renewal:** `Enabled`
- **Payment Failure Handling:** `Continue after 3 failures`

**After Creation:**
- Copy the **Plan ID** (starts with `P-`) → This will be your new `PAYPAL_PLAN_TIER2`

---

## **TIER 3**

### Plan Information:
- **Plan Name:** `Alt Text Pro - Tier 3`
- **Description:** `5,000 credits per month - Tier 3`
- **Price:** `$40.00 USD`
- **Credits:** `5,000 per month`
- **Billing Cycle:** `Monthly` (recurring)

### PayPal Dashboard Settings:

**Basic Information:**
- **Plan Name:** `Alt Text Pro - Tier 3`
- **Description:** `5,000 credits per month - Tier 3`

**Pricing:**
- **Billing Cycle:** `Monthly`
- **Interval:** `1 month`
- **Price:** `$40.00`
- **Currency:** `USD`

**Additional Settings:**
- **Setup Fee:** `$0.00` ⚠️ **MUST BE ZERO**
- **Trial Period:** `None`
- **Auto-renewal:** `Enabled`
- **Payment Failure Handling:** `Continue after 3 failures`

**After Creation:**
- Copy the **Plan ID** (starts with `P-`) → This will be your new `PAYPAL_PLAN_TIER3`

---

## Step-by-Step Instructions

### Step 1: Create Product (if needed)

1. Go to PayPal Developer Dashboard: https://developer.paypal.com/dashboard/
2. Navigate to **Products & Plans**
3. If you don't have a product, create one:
   - **Product Name:** `Alt Text Pro`
   - **Product Description:** `AI-powered alt-text generation service for WordPress and websites`
   - **Product Type:** `Service`
   - **Category:** `Software`
   - Copy the **Product ID** (starts with `PROD-`)

### Step 2: Create Plans

For each tier (Tier 1, Tier 2, Tier 3):

1. Click **Create Plan** (or **Add Plan** if editing existing product)
2. Fill in the details from the sections above
3. **IMPORTANT:** Make sure:
   - Setup Fee is **$0.00** (not blank, not null, exactly zero)
   - Plan status is **ACTIVE** (not draft)
   - Billing cycle is **Monthly**
   - Auto-renewal is **Enabled**
4. Click **Save** or **Create Plan**
5. **Copy the Plan ID** immediately (it starts with `P-`)

### Step 3: Update Netlify Environment Variables

After creating all three plans, update your Netlify environment variables:

1. Go to Netlify Dashboard → Your Site → **Site settings** → **Environment variables**
2. Update these variables:

```
PAYPAL_PLAN_TIER1=P-XXXXXXXXXXXXX  (new Tier 1 Plan ID)
PAYPAL_PLAN_TIER2=P-XXXXXXXXXXXXX  (new Tier 2 Plan ID)
PAYPAL_PLAN_TIER3=P-XXXXXXXXXXXXX  (new Tier 3 Plan ID)
```

3. If you created a new product, also update:
```
PAYPAL_PRODUCT_ID=PROD-XXXXXXXXXXXXX  (new Product ID)
```

4. **Redeploy** your site after updating environment variables

### Step 4: Verify Plans

After creating plans, verify they are:
- ✅ Status: **ACTIVE** (not draft)
- ✅ Setup Fee: **$0.00**
- ✅ Billing Cycle: **Monthly**
- ✅ Auto-renewal: **Enabled**

---

## Quick Reference Table

| Tier | Name | Price | Credits | Plan ID Variable |
|------|------|-------|---------|------------------|
| Tier 1 | Alt Text Pro - Tier 1 | $12.00/month | 1,000 | `PAYPAL_PLAN_TIER1` |
| Tier 2 | Alt Text Pro - Tier 2 | $20.00/month | 2,500 | `PAYPAL_PLAN_TIER2` |
| Tier 3 | Alt Text Pro - Tier 3 | $40.00/month | 5,000 | `PAYPAL_PLAN_TIER3` |

---

## Important Notes

1. **Setup Fee MUST be $0.00** - This is critical. PayPal may reject subscriptions if setup fee is not explicitly set to zero.

2. **Plan Status MUST be ACTIVE** - Plans in "Draft" status cannot be used for subscriptions.

3. **All plans must be linked to the same Product** - This ensures consistency.

4. **After creating plans, wait 1-2 minutes** before testing - PayPal needs time to activate them.

5. **Test with a small amount first** - Consider creating a test plan with $1.00 to verify the flow works before using production plans.

---

## After Setup

Once you've created the new plans and updated Netlify environment variables:

1. ✅ Redeploy your Netlify site
2. ✅ Test subscription creation with Tier 1 (smallest plan)
3. ✅ Verify the approval URL contains `/billing/subscriptions` and `ba_token`
4. ✅ Test the full flow: Create → Approve → Complete

If the issue persists even with fresh plans, this confirms it's a PayPal account-level issue that requires PayPal Support intervention.

