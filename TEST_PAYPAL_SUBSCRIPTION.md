# Test PayPal Subscription Creation Directly

## Step 1: Get PayPal Client Secret from Netlify

1. **Go to Netlify Dashboard:**
   - Visit: https://app.netlify.com
   - Log in to your account

2. **Navigate to Environment Variables:**
   - Click on your site (`alt-text.pro` or similar)
   - Go to **Site settings** → **Environment variables**
   - Find `PAYPAL_CLIENT_SECRET`
   - Click on it to reveal the value
   - **Copy the secret** (it's a long string)

## Step 2: Run the Test

Open your terminal and run:

```bash
# Set the environment variables
export PAYPAL_CLIENT_ID='AVn67qyfxlOpoaBx6nR-IRj7AnJhzBzet90iovgp_hdQEbUNommj_PJZx48Ye8Ua3GLZ1RtOphXJyXW0'
export PAYPAL_CLIENT_SECRET='<paste_your_secret_here>'
export PAYPAL_ENVIRONMENT='production'

# Run the test
node test-paypal-subscription-direct.js
```

## What the Test Will Show

The test will:
1. ✅ Get PayPal access token
2. ✅ Verify the plan exists and is ACTIVE
3. ✅ Create a test subscription
4. ✅ Show the approval URL PayPal returns
5. ✅ **Analyze if the URL is for subscriptions or one-time payments**

## Expected Results

### ✅ If Working Correctly:
- Subscription created successfully
- Approval URL: `https://www.paypal.com/webapps/billing/subscriptions?ba_token=BA-XXXXX`
- URL path contains `/billing/subscriptions`
- URL has `ba_token` parameter (not `token`)

### ❌ If There's a Problem:
- Approval URL: `https://www.paypal.com/webapps/hermes?token=XXXXX`
- URL path contains `/webapps/hermes` or `/checkout`
- URL has `token` parameter (order token) instead of `ba_token`

## What This Tells Us

- **If the test shows correct subscription URL**: The problem is in our code or how we're handling the response
- **If the test shows order URL**: The problem is with PayPal's plan configuration or account settings

## After Running the Test

Share the output with me, especially:
- The approval URL PayPal returns
- Whether it's a subscription URL or order URL
- Any error messages

This will help us identify if the issue is:
1. PayPal plan configuration
2. PayPal account settings
3. Our code
4. PayPal API bug

