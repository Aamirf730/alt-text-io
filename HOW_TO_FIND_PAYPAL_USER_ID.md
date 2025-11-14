# How to Find PayPal User/Account ID

## Method 1: PayPal Developer Dashboard (Easiest)

1. **Go to PayPal Developer Dashboard:**
   - Visit: https://developer.paypal.com
   - Log in with your PayPal Business account

2. **Check Account Information:**
   - Click on your profile/account icon (top right)
   - Your account email will be displayed
   - The account ID is usually in the URL or account settings

3. **Check App Information:**
   - Go to: https://developer.paypal.com/dashboard/applications
   - Click on your app
   - The **Merchant ID** or **Account ID** may be shown in the app details

## Method 2: PayPal Business Dashboard

1. **Log into PayPal Business:**
   - Visit: https://www.paypal.com/businessprofile
   - Log in with your business account

2. **Account Settings:**
   - Go to Account Settings
   - Look for "Merchant ID" or "Account ID"
   - This is usually a long alphanumeric string

## Method 3: Using PayPal API (What We Found)

From the API response we got, your PayPal account has this identity:

**User ID (from API):**
```
https://www.paypal.com/webapps/auth/identity/user/18SkdmkrVBCapO1dablvdH0WCh7YjQNvDNvk_-BEr3M
```

**Extracted User ID:**
```
18SkdmkrVBCapO1dablvdH0WCh7YjQNvDNvk_-BEr3M
```

## Method 4: Check Transaction/Webhook Logs

1. **Go to PayPal Dashboard:**
   - https://developer.paypal.com/dashboard/webhooks
   - Check webhook events
   - The `payer_id` or `merchant_id` in webhook payloads shows account IDs

2. **Check Transaction History:**
   - In PayPal Business dashboard
   - View transaction details
   - Account/Merchant ID may be shown in transaction details

## Method 5: Using Our Check Function

You can use the function we created to get account information:

```bash
curl https://www.alt-text.pro/.netlify/functions/check-paypal-account
```

This will show:
- User ID from PayPal API
- Client ID (which is linked to your account)
- Account information

## What We Found From Your Account

Based on the API call, here's what we know:

- **Client ID**: `AVn67qyfxlOpoaBx6nR-IRj7AnJhzBzet90iovgp_hdQEbUNommj_PJZx48Ye8Ua3GLZ1RtOphXJyXW0`
- **User ID**: `18SkdmkrVBCapO1dablvdH0WCh7YjQNvDNvk_-BEr3M`
- **User ID Full URL**: `https://www.paypal.com/webapps/auth/identity/user/18SkdmkrVBCapO1dablvdH0WCh7YjQNvDNvk_-BEr3M`

## Note About Email

The PayPal API with client credentials doesn't return the account email. To find your account email:

1. Log into https://developer.paypal.com
2. Check the top-right corner - your email should be displayed
3. Or go to Account Settings in PayPal Business dashboard

