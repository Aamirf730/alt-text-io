# PayPal Setup Guide - Fix Payment Failures

## 🚨 **Issue Identified**
Your payment system is failing because **PayPal credentials are missing** from Netlify environment variables.

## 🔧 **Solution: Set Up PayPal Credentials**

### **Step 1: Get PayPal Credentials**

#### **For Testing (Sandbox):**
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/developer/applications/)
2. Log in with your PayPal account
3. Click **"Create App"**
4. Fill in:
   - **App Name**: `Alt-Text AI`
   - **Merchant**: Select your account
   - **Features**: Check **"Accept payments"**
5. Click **"Create App"**
6. Copy your **Client ID** and **Client Secret**

#### **For Production (Live):**
1. In the same app, switch to **"Live"** mode
2. Get your **Live Client ID** and **Live Client Secret**

### **Step 2: Add Credentials to Netlify**

1. Go to [Netlify Dashboard](https://app.netlify.com/projects/alt-text-ai)
2. Navigate to **Site settings** → **Environment variables**
3. Add these variables:

```bash
# For Sandbox Testing
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret

# For Production (when ready)
# PAYPAL_CLIENT_ID=your_live_client_id  
# PAYPAL_CLIENT_SECRET=your_live_client_secret
```

### **Step 3: Configure PayPal App Settings**

In your PayPal app settings, add these **Return URLs**:

```
https://www.alt-text.pro/payment-success
https://www.alt-text.pro/payment-cancelled
https://www.alt-text.pro/
```

### **Step 4: Deploy Changes**

After adding the environment variables:
1. Go to **Deploys** in Netlify
2. Click **"Trigger deploy"** → **"Deploy site"**

## 🧪 **Testing the Fix**

After setup, test the debug endpoint:
```bash
curl "https://www.alt-text.pro/.netlify/functions/debug-payment"
```

You should see:
```json
{
  "paypal": {
    "connected": true,
    "tokenReceived": true
  }
}
```

## 📋 **Updated Pricing Plans**

I've also prepared an update to match your pricing requirements:

- **Free**: 100 Credits/month - $0
- **Tier 1**: 1000 Credits/month - $9  
- **Tier 2**: 2500 Credits/month - $19
- **Pay as you go**: 500 Credits - $4 (one-time)

## 🚀 **Next Steps**

1. ✅ **Add PayPal credentials to Netlify** (most important)
2. ✅ **Update subscription plans** in Supabase
3. ✅ **Test payment flow**
4. ✅ **Switch to production PayPal** when ready

Once you add the PayPal credentials, the payment system will work immediately! 🎉
