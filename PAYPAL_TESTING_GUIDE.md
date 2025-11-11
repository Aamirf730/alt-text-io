# PayPal Subscription Testing Guide

## Prerequisites Checklist

Before testing, ensure you have:
- ✅ PayPal sandbox environment variables added to Netlify
- ✅ PayPal Product and Plans created in sandbox
- ✅ PayPal webhook configured in sandbox
- ✅ Website deployed to Netlify with latest code

## Step 1: Verify Environment Variables

Check that all these are set in Netlify (Site settings → Environment variables):
- `PAYPAL_ENVIRONMENT=sandbox`
- `PAYPAL_CLIENT_ID` (sandbox client ID)
- `PAYPAL_CLIENT_SECRET` (sandbox secret)
- `PAYPAL_PRODUCT_ID` (sandbox product ID)
- `PAYPAL_PLAN_TIER1` (sandbox plan ID)
- `PAYPAL_PLAN_TIER2` (sandbox plan ID)
- `PAYPAL_PLAN_TIER3` (sandbox plan ID)
- `REACT_APP_PAYPAL_CLIENT_ID` (same as PAYPAL_CLIENT_ID)

## Step 2: Create a Sandbox Test Account (Optional)

1. Go to: https://developer.paypal.com/dashboard/accounts
2. Make sure you're on **Sandbox** tab
3. Click **"Create Account"**
4. Create a **Personal** account for testing
5. Note the email and password (you'll use this to test payments)

## Step 3: Test Subscription Flow

### Test 1: Create a Subscription (Tier 1)

1. **Go to your website**: https://www.alt-text.pro
2. **Sign in** or create a test account
3. **Navigate to Pricing** or Dashboard
4. **Click "Subscribe"** on Tier 1 plan ($12/month)
5. **You should see**:
   - PayPal payment button appears
   - Clicking it redirects to PayPal sandbox
6. **In PayPal Sandbox**:
   - Log in with your sandbox test account
   - Approve the subscription
   - You'll be redirected back to your site
7. **Expected Results**:
   - Subscription is created in PayPal
   - User's subscription plan is updated in Supabase
   - Credits are added to user's account (1,000 credits for Tier 1)
   - Dashboard shows updated subscription status

### Test 2: Verify Webhook Events

After completing a subscription:

1. **Check Netlify Function Logs**:
   - Go to: https://app.netlify.com/sites/alt-text-ai/functions
   - Click on `paypal-webhook` function
   - Check "Logs" tab
   - You should see webhook events being received

2. **Check PayPal Dashboard**:
   - Go to: https://developer.paypal.com/dashboard/applications/sandbox
   - Click on your app
   - Go to "Webhooks" section
   - You should see webhook delivery attempts and status

3. **Expected Webhook Events**:
   - `BILLING.SUBSCRIPTION.CREATED` - When subscription is first created
   - `BILLING.SUBSCRIPTION.ACTIVATED` - When subscription becomes active
   - `PAYMENT.SALE.COMPLETED` - When payment is processed

### Test 3: Verify Database Updates

1. **Check Supabase**:
   - Go to your Supabase dashboard
   - Check `profiles` table:
     - `subscription_plan` should be updated (e.g., 'tier1')
     - `credits_remaining` should be updated (e.g., 1000 for Tier 1)
   - Check `payments` table:
     - New payment record should be created
     - `subscription_id` should be populated
     - `status` should be 'completed'

### Test 4: Test Different Tiers

Repeat the subscription flow for:
- **Tier 2** ($20/month, 2,500 credits)
- **Tier 3** ($40/month, 5,000 credits)

Verify that:
- Correct plan ID is used
- Correct credits are allocated
- Correct pricing is displayed

### Test 5: Test One-Time Payments (Credit Packs)

1. **Test "Small Pack"** (one-time payment):
   - Should use PayPal Orders API (not Subscriptions API)
   - Should add credits immediately
   - Should not create a subscription

2. **Test "Pay as You Go"** (one-time payment):
   - Same as above

## Step 4: Monitor for Issues

### Common Issues to Watch For:

1. **"Error creating subscription"**:
   - Check Netlify function logs
   - Verify plan IDs are correct
   - Check PayPal sandbox credentials

2. **"Webhook not receiving events"**:
   - Verify webhook URL is correct
   - Check webhook is active in PayPal dashboard
   - Ensure webhook function is deployed

3. **"Credits not updating"**:
   - Check webhook function logs
   - Verify Supabase connection
   - Check `upgrade_subscription` function in Supabase

4. **"Subscription not activating"**:
   - Check `complete-payment.js` function logs
   - Verify subscription status in PayPal dashboard
   - Check for `APPROVAL_PENDING` status handling

## Step 5: Test Webhook Events Manually (Optional)

You can use PayPal's webhook simulator to test events:

1. Go to your PayPal app in dashboard
2. Go to "Webhooks" section
3. Click on your webhook
4. Use "Send test event" or "Simulate event"
5. Select event type (e.g., `BILLING.SUBSCRIPTION.ACTIVATED`)
6. Send the test event
7. Check Netlify function logs to see if it's received

## Step 6: Verify Production Readiness

Before going live, ensure:

1. ✅ All sandbox tests pass
2. ✅ Webhook events are being received and processed
3. ✅ Credits are correctly allocated
4. ✅ Subscriptions are properly tracked
5. ✅ Error handling works correctly
6. ✅ Payment completion flow works end-to-end

## Troubleshooting Commands

### Check if webhook endpoint is accessible:
```bash
curl -X POST https://www.alt-text.pro/.netlify/functions/paypal-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "event"}'
```

### Check Netlify function logs:
- Go to: https://app.netlify.com/sites/alt-text-ai/functions
- Click on function name
- View "Logs" tab

### Check Supabase data:
- Go to Supabase dashboard
- Use SQL Editor to query:
  ```sql
  SELECT * FROM profiles WHERE email = 'your-test-email@example.com';
  SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
  ```

## Next Steps After Testing

Once all tests pass:
1. Document any issues found and fixes applied
2. Prepare for production deployment
3. Set up production PayPal app and credentials
4. Update environment variables for production
5. Test in production with small amounts first

