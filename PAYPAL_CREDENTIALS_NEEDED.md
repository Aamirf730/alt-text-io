# PayPal Credentials Needed

## What I Need From You

Since PayPal is blocking automated browser access, please provide the following information after you log in to PayPal Developer Dashboard:

### Required Information:

1. **PAYPAL_CLIENT_ID**: Your PayPal Client ID (starts with `Ae...` or `AZ...`)
2. **PAYPAL_CLIENT_SECRET**: Your PayPal Secret (starts with `EC...`)

### Optional (but recommended for better performance):

3. **PAYPAL_PRODUCT_ID**: Product ID if you create a product (starts with `PROD_...`)
4. **PAYPAL_PLAN_TIER1**: Plan ID for Tier 1 (starts with `P-...`)
5. **PAYPAL_PLAN_TIER2**: Plan ID for Tier 2 (starts with `P-...`)
6. **PAYPAL_PLAN_TIER3**: Plan ID for Tier 3 (starts with `P-...`)

## Where to Find These:

### Step 1: Get Client ID and Secret
1. Go to: https://developer.paypal.com/dashboard/applications
2. Log in
3. Create or select your app
4. Copy **Client ID** and **Secret**

### Step 2: Create Product (Optional)
1. Go to: https://developer.paypal.com/dashboard/catalog/products
2. Click "Create Product"
3. Name: "Alt Text Pro"
4. Copy the **Product ID**

### Step 3: Create Plans (Optional - Code can create them automatically)
1. Go to: https://developer.paypal.com/dashboard/catalog/plans
2. Create a plan for each tier:
   - Tier 1: $12/month
   - Tier 2: $20/month
   - Tier 3: $40/month
3. Copy each **Plan ID**

## Once You Provide These:

I will:
1. ✅ Update the code to use your credentials
2. ✅ Set up the PayPal Product and Plans (if you provide Product ID)
3. ✅ Configure webhooks
4. ✅ Test the integration
5. ✅ Deploy everything

**Note**: If you only provide Client ID and Secret, the code will automatically create the Product and Plans on first use, but it's better to create them manually for production.

