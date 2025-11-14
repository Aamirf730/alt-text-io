# PayPal Production Setup Checklist

## ✅ Sandbox Testing Complete
- [x] Sandbox payment successful
- [x] Subscription activated
- [x] All functionality working

## 📋 Steps to Go Live

### 1. Get PayPal Production Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. **Switch to "Live" mode** (toggle in top right, switch from "Sandbox" to "Live")
3. Navigate to **"Apps & Credentials"**
4. Find your existing app OR click **"Create App"** to create a new Live app
5. Copy the **Client ID** and **Secret** (these are different from sandbox!)

### 2. Create Production Product

Products must be created via API. Run this command with your production credentials:

```bash
# Replace with your PRODUCTION credentials
CLIENT_ID="your_production_client_id"
SECRET="your_production_secret"

# Get access token
auth=$(echo -n "${CLIENT_ID}:${SECRET}" | base64)
access_token=$(curl -s -X POST "https://api-m.paypal.com/v1/oauth2/token" \
  -H "Authorization: Basic ${auth}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

# Create product
product_response=$(curl -s -X POST "https://api-m.paypal.com/v1/catalogs/products" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alt Text Pro Subscriptions","type":"SERVICE","description":"Monthly subscription plans for Alt Text Pro"}')

# Extract Product ID
PRODUCT_ID=$(echo "$product_response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
echo "Production Product ID: $PRODUCT_ID"
```

### 3. Update Netlify Environment Variables

Update these in Netlify Dashboard (Site Settings → Environment Variables):

- `PAYPAL_CLIENT_ID` = Your production Client ID
- `PAYPAL_CLIENT_SECRET` = Your production Secret
- `PAYPAL_ENVIRONMENT` = `production` (or remove it, production is default)
- `PAYPAL_PRODUCT_ID` = Your production Product ID

**Important:** Remove or don't set `PAYPAL_PLAN_TIER1`, `PAYPAL_PLAN_TIER2`, `PAYPAL_PLAN_TIER3` - let the function auto-create them.

### 4. Update Local .env (for testing)

Update your local `.env` file with production credentials for final testing:

```bash
PAYPAL_CLIENT_ID=your_production_client_id
PAYPAL_CLIENT_SECRET=your_production_secret
PAYPAL_ENVIRONMENT=production
PAYPAL_PRODUCT_ID=your_production_product_id
```

### 5. Test Production Locally (Optional but Recommended)

1. Update `.env` with production credentials
2. Restart Netlify Dev: `netlify dev --port 9999`
3. Test at: http://localhost:3000/#pricing
4. **Use a real PayPal account** (not sandbox) to test
5. Verify subscription creation works

### 6. Deploy to Netlify

Once production credentials are set in Netlify Dashboard:

```bash
git add .
git commit -m "Switch PayPal to production"
git push
```

Netlify will automatically deploy with the production environment variables.

### 7. Verify Production

1. Visit your live site: https://www.alt-text.pro/#pricing
2. Test with a real PayPal account
3. Verify subscription is created
4. Check PayPal dashboard for the subscription

## ⚠️ Important Notes

- **Sandbox vs Production**: Sandbox credentials won't work in production and vice versa
- **Product ID**: Each environment (sandbox/production) needs its own Product ID
- **Plan IDs**: Will be auto-created on first use in production
- **Testing**: Always test in sandbox first (which you've done ✅)
- **Security**: Never commit production credentials to git - use Netlify environment variables only

## 🔒 Security Checklist

- [ ] Production credentials are ONLY in Netlify Dashboard (not in git)
- [ ] `.env` file is in `.gitignore`
- [ ] No credentials in code or config files
- [ ] Tested sandbox thoroughly before going live

