# Payment System Setup Guide

This guide explains how to set up the complete PayPal payment system for the Alt-Text AI SaaS application.

## Environment Variables Required

### Frontend (.env in frontend/ directory)
```bash
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_PAYPAL_CLIENT_ID=your_paypal_client_id
REACT_APP_API_BASE=https://www.alt-text.pro/.netlify/functions
```

### Netlify Functions (Environment Variables in Netlify Dashboard)
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=production
```

## PayPal Setup

### 1. Create PayPal Developer Account
1. Go to https://developer.paypal.com/
2. Sign in or create an account
3. Create a new app in the PayPal Developer Dashboard

### 2. Get PayPal Credentials
- **Client ID**: Use for both frontend and backend
- **Client Secret**: Use only for backend (Netlify functions)

### 3. PayPal Webhook Setup (Optional)
For production, set up webhooks to handle subscription events:
- Webhook URL: `https://your-domain.netlify.app/.netlify/functions/paypal-webhook`
- Events to subscribe to:
  - `BILLING.SUBSCRIPTION.ACTIVATED`
  - `BILLING.SUBSCRIPTION.CANCELLED`
  - `BILLING.SUBSCRIPTION.SUSPENDED`
  - `PAYMENT.SALE.COMPLETED`

## Database Migration

Run the updated schema.sql to add payment tables and functions:

```sql
-- Apply the migration
psql -h your-supabase-host -U postgres -d postgres -f supabase-migration/schema.sql
```

## Features Implemented

### 1. Payment Integration
- ✅ PayPal payment buttons on pricing plans
- ✅ One-time payments for pay-as-go credits
- ✅ Subscription payments for monthly plans
- ✅ Payment completion handling

### 2. Credit Management
- ✅ Credit allocation based on subscription plans
- ✅ Credit validation before alt-text generation
- ✅ Automatic credit deduction
- ✅ Credit balance tracking

### 3. Subscription Management
- ✅ Upgrade/downgrade functionality in dashboard
- ✅ Subscription status tracking
- ✅ Next billing date display
- ✅ Payment history

### 4. User Experience
- ✅ Low credit warnings
- ✅ Upgrade prompts when credits are exhausted
- ✅ Real-time credit updates
- ✅ Payment success/failure notifications

## Testing

### Test Credit System
1. Sign up for a new account
2. Use the dashboard to generate alt-text
3. Watch credits decrease with each generation
4. When credits reach 0, verify generation is blocked
5. Test upgrade flow to add more credits

### Test Payment Flow
1. Select a pricing plan
2. Complete PayPal payment (use PayPal sandbox for testing)
3. Verify subscription is activated
4. Verify credits are added to account
5. Test alt-text generation with new credits

## Production Deployment

1. Set all environment variables in Netlify
2. Deploy updated code to Netlify
3. Apply database migration to Supabase
4. Test payment flow with PayPal sandbox
5. Switch to PayPal live credentials for production

## Troubleshooting

### Common Issues
1. **PayPal button not loading**: Check REACT_APP_PAYPAL_CLIENT_ID
2. **Payment creation fails**: Verify backend PayPal credentials
3. **Credits not updating**: Check Supabase RPC functions
4. **Session expired errors**: Verify Supabase auth configuration

### Debug Logs
- Frontend: Check browser console for payment errors
- Backend: Check Netlify function logs for API errors
- Database: Check Supabase logs for RPC function errors
