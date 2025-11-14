# PayPal Setup Guide

## Current Issue
Your PayPal credentials are failing authentication with error: "Client Authentication failed"

## Quick Fix Steps

### 1. Get PayPal Sandbox Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Log in with your PayPal account
3. Click **"Apps & Credentials"** in the left sidebar
4. Make sure you're viewing **"Sandbox"** (not Live)
5. Find your app or click **"Create App"** to create a new one
6. Copy the **Client ID** and **Secret**

### 2. Test Your Credentials

Run the test script:
```bash
node test-paypal-credentials.js
```

This will verify your credentials work before updating files.

### 3. Update Local .env File

Edit `.env` in the root directory:
```bash
PAYPAL_CLIENT_ID=your_new_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_new_sandbox_secret
PAYPAL_ENVIRONMENT=sandbox
```

### 4. Update Netlify Environment Variables (for production)

```bash
netlify env:set PAYPAL_CLIENT_ID "your_new_sandbox_client_id"
netlify env:set PAYPAL_CLIENT_SECRET "your_new_sandbox_secret"
netlify env:set PAYPAL_ENVIRONMENT "sandbox"
```

### 5. Restart Netlify Dev

After updating credentials:
1. Stop Netlify Dev (Ctrl+C)
2. Restart: `netlify dev --port 9999`

## Important Notes

- **Sandbox vs Production**: Make sure you're using SANDBOX credentials for local development
- **Matching Credentials**: Client ID and Secret must be from the same PayPal app
- **Active Account**: Your PayPal Developer account must be active

## Verification

After updating, test the PayPal button again. You should see:
- ✅ Connection to port 9999 works
- ✅ PayPal authentication succeeds
- ✅ Payment creation works

