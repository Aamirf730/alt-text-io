# Environment Variables Configuration

## Netlify Environment Variables

Add these to your Netlify dashboard:
**Site Settings → Environment Variables**

### Required PayPal Variables

```
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_secret_here
PAYPAL_ENVIRONMENT=sandbox  // Change to 'production' when ready
```

**Note:** We use `PAYPAL_ENVIRONMENT` (not `PAYPAL_ENV`) to match our codebase convention.

### Optional PayPal Variables

```
PAYPAL_PRODUCT_ID=PROD-XXXXXXXXXX  // Your PayPal Product ID
PAYPAL_PLAN_TIER1=P-XXXXXXXXXX      // Tier 1 Monthly
PAYPAL_PLAN_TIER1_ANNUAL=P-XXXXXXXXXX // Tier 1 Annual
PAYPAL_PLAN_TIER2=P-XXXXXXXXXX      // Tier 2 Monthly
PAYPAL_PLAN_TIER2_ANNUAL=P-XXXXXXXXXX // Tier 2 Annual
PAYPAL_PLAN_TIER3=P-XXXXXXXXXX      // Tier 3 Monthly
PAYPAL_PLAN_TIER3_ANNUAL=P-XXXXXXXXXX // Tier 3 Annual
```

### Frontend PayPal Variables

```
REACT_APP_PAYPAL_CLIENT_ID=your_client_id_here  // Same as PAYPAL_CLIENT_ID
```

### Netlify Auto-Provided Variables

```
URL=https://www.alt-text.pro  // Automatically provided by Netlify (no need to set manually)
```

### Supabase Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

### Other Variables

```
SUPERUSER_EMAILS=help@wpgeared.com  // Comma-separated list of admin emails
```

## Environment Context

Set these variables for the appropriate context:
- **Production**: For live site
- **Development**: For deploy previews
- **All**: For all contexts (not recommended for secrets)

## Important Notes

1. **PAYPAL_ENVIRONMENT**: 
   - Set to `sandbox` for testing
   - Set to `production` for live payments
   - We use `PAYPAL_ENVIRONMENT` (not `PAYPAL_ENV` as shown in some guides)

2. **URL**: 
   - Automatically provided by Netlify
   - No need to set manually
   - Used for PayPal return/cancel URLs

3. **Plan IDs**: 
   - Optional - plans will be auto-created if not set
   - Recommended to pre-create plans for better reliability

