# Create PayPal Product and Plans for Production

## Quick Steps

1. **Make sure you have your Production Client ID and Secret** (you already have these!)

2. **Run this command** (replace with your actual values):

```bash
cd /Users/aamirfaiz/Desktop/Projects/Alt-text/v2/app-main

PAYPAL_CLIENT_ID=your_production_client_id_here PAYPAL_CLIENT_SECRET=your_production_secret_here node create-paypal-product-and-plans-production.js
```

**Example:**
```bash
PAYPAL_CLIENT_ID=AeYRmGyOsNgOGt4c2c3ocffcOvObOv3A_c9PL5BDSPvGCtJZJB9EzNFwGWKxPR3HkR8wUXk3V2O_nBaf PAYPAL_CLIENT_SECRET=EG1QNGbm9PHkuYgbxqBx-5HLAoJR6uE8R8oIDDZg4Ieqfvy4Ba1cqJBMBfPpU3eV_0pdWG_dJCf0VfQX node create-paypal-product-and-plans-production.js
```

3. **The script will:**
   - Create the Product
   - Create all 3 Plans (Tier 1, Tier 2, Tier 3)
   - Output all the IDs you need

4. **Copy the output** - it will show you all the environment variables to add to Netlify

---

## What You'll Get

After running the script, you'll see output like:

```
✅ PayPal Product created: PROD_XXXXX
✅ PayPal Plan created for Tier 1: P-XXXXX
✅ PayPal Plan created for Tier 2: P-XXXXX
✅ PayPal Plan created for Tier 3: P-XXXXX

📋 Add these to your Netlify environment variables:
PAYPAL_ENVIRONMENT=production
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_PRODUCT_ID=PROD_XXXXX
PAYPAL_PLAN_TIER1=P-XXXXX
PAYPAL_PLAN_TIER2=P-XXXXX
PAYPAL_PLAN_TIER3=P-XXXXX
REACT_APP_PAYPAL_CLIENT_ID=...
```

Then you just copy these values to Netlify!

