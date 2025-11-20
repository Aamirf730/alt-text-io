# Testing Production from Localhost

## Current Configuration

✅ **PayPal:** Production credentials  
✅ **Supabase:** Production database  
✅ **Netlify Functions:** Local (port 9999)  
✅ **Frontend:** Local (port 3000)

## Quick Start

### 1. Start Netlify Dev
```bash
npm run dev
```

This will:
- Start Netlify Dev on port 9999 (functions)
- Start React dev server on port 3000 (frontend)
- Load environment variables from `.env` file

### 2. Access the App
- **Frontend:** http://localhost:3000
- **Functions:** http://localhost:9999/.netlify/functions

### 3. Test Production PayPal
- Go to: http://localhost:3000/#pricing
- Sign in with your account
- Click "Choose Plan"
- Click "Subscribe with PayPal"
- **⚠️ WARNING:** This will process REAL payments!

## Environment Variables

The `.env` file is configured with:
- `PAYPAL_ENVIRONMENT=production`
- `PAYPAL_CLIENT_ID` = Production Client ID
- `PAYPAL_CLIENT_SECRET` = Production Secret
- `PAYPAL_PRODUCT_ID` = Production Product ID
- `REACT_APP_PAYPAL_CLIENT_ID` = Production Client ID (for frontend)

## Important Warnings

⚠️ **REAL PAYMENTS:** This uses production PayPal, so real payments will be processed!

⚠️ **TEST CAREFULLY:** Use small amounts or test PayPal accounts

⚠️ **DATABASE:** All changes go to production Supabase database

## Switching Back to Sandbox

To switch back to sandbox for safe testing:

```bash
cp .env.sandbox.backup.local .env
```

Then restart Netlify Dev.

## Troubleshooting

### Functions Not Loading
- Check Netlify Dev is running on port 9999
- Check `.env` file exists and has correct values
- Restart Netlify Dev after changing `.env`

### PayPal Errors
- Verify `PAYPAL_ENVIRONMENT=production` in `.env`
- Check PayPal credentials are production (not sandbox)
- Check Netlify function logs for errors

### Frontend Not Connecting
- Verify `REACT_APP_API_BASE=http://localhost:9999/.netlify/functions` in `.env`
- Check browser console for API errors
- Ensure Netlify Dev is running

## Files

- `.env` - Current environment (production)
- `.env.sandbox.backup.local` - Sandbox backup
- `.env.production.local` - Production template

