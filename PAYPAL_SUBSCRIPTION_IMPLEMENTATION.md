# PayPal Subscription Implementation Guide

## Overview
This document describes the PayPal subscription system implementation for Alt Text Pro.

## Payment Types

### One-Time Payments
- **Small Pack**: $3, 100 credits (one-time)
- **Pay as you go**: $5, 500 credits (one-time)

### Subscriptions (Monthly Recurring)
- **Tier 1**: $12/month, 1,000 credits
- **Tier 2**: $20/month, 2,500 credits
- **Tier 3**: $40/month, 5,000 credits

## Implementation Status

### ✅ Completed
1. **create-payment.js**: Updated to create PayPal subscriptions for monthly plans and one-time payments for one-time plans
2. **complete-payment.js**: Updated to handle both subscription approvals and one-time payment captures
3. **paypal-webhook.js**: Created webhook handler for subscription events (renewals, cancellations, etc.)
4. **Frontend**: Updated to handle subscription flow correctly

### ⚠️ Important: PayPal Product & Plan Setup Required

Before the subscription system will work, you need to:

1. **Create a PayPal Product**:
   - Go to PayPal Developer Dashboard
   - Create a product called "Alt Text Pro" or similar
   - Note the Product ID

2. **Create Subscription Plans in PayPal**:
   - For each tier (tier1, tier2, tier3), create a subscription plan in PayPal
   - Store the PayPal Plan IDs in environment variables or database
   - Example environment variables:
     - `PAYPAL_PLAN_TIER1=PLAN_XXXXX`
     - `PAYPAL_PLAN_TIER2=PLAN_XXXXX`
     - `PAYPAL_PLAN_TIER3=PLAN_XXXXX`

3. **Update create-payment.js**:
   - Replace the `getOrCreatePayPalPlan` function to use pre-created plan IDs
   - Or update it to create plans if they don't exist (current implementation)

4. **Set Up Webhook in PayPal**:
   - In PayPal Developer Dashboard, create a webhook
   - Point it to: `https://www.alt-text.pro/.netlify/functions/paypal-webhook`
   - Subscribe to these events:
     - `BILLING.SUBSCRIPTION.CREATED`
     - `BILLING.SUBSCRIPTION.ACTIVATED`
     - `BILLING.SUBSCRIPTION.CANCELLED`
     - `BILLING.SUBSCRIPTION.EXPIRED`
     - `BILLING.SUBSCRIPTION.SUSPENDED`
     - `PAYMENT.SALE.COMPLETED`
     - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

## How It Works

### Subscription Flow
1. User selects a subscription plan (tier1, tier2, or tier3)
2. `create-payment.js` creates a PayPal subscription
3. User approves subscription in PayPal
4. `complete-payment.js` verifies subscription is active
5. User profile updated with subscription and credits
6. Webhook handles monthly renewals automatically

### One-Time Payment Flow
1. User selects one-time plan (small_pack or pay_as_go)
2. `create-payment.js` creates a one-time PayPal order
3. User approves payment in PayPal
4. `complete-payment.js` captures the payment
5. User profile updated with credits

## Environment Variables Required

```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_PRODUCT_ID=PROD_XXXXX (optional, for plan creation)
PAYPAL_PLAN_TIER1=PLAN_XXXXX (optional, if using pre-created plans)
PAYPAL_PLAN_TIER2=PLAN_XXXXX (optional)
PAYPAL_PLAN_TIER3=PLAN_XXXXX (optional)
```

## Testing

### Test Subscriptions
- Use PayPal Sandbox for testing
- Create test accounts in PayPal Sandbox
- Test subscription creation and approval flow
- Test webhook events using PayPal's webhook simulator

### Test One-Time Payments
- Test small_pack and pay_as_go purchases
- Verify credits are added correctly
- Verify no subscription is created

## Next Steps

1. Set up PayPal Product and Plans in PayPal Dashboard
2. Configure webhook URL in PayPal
3. Test subscription creation flow
4. Test webhook events
5. Deploy to production

