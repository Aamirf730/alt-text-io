# Custom Domain Setup Guide - www.alt-text.pro

This guide will help you configure your custom domain `www.alt-text.pro` for your Alt-Text AI SaaS application.

## 🌐 Domain Configuration Steps

### 1. Netlify Domain Setup

#### Step 1: Add Custom Domain in Netlify
1. Go to [Netlify Dashboard](https://app.netlify.com/projects/alt-text-ai)
2. Navigate to **Site settings** → **Domain management**
3. Click **Add custom domain**
4. Enter: `www.alt-text.pro`
5. Click **Verify**

#### Step 2: Configure DNS Records
You need to configure these DNS records with your domain provider:

**For WWW Subdomain (Primary):**
```
Type: CNAME
Name: www
Value: alt-text-ai.netlify.app
```

**For Root Domain Redirect (Optional):**
```
Type: A
Name: @
Value: 75.2.60.5
```

#### Step 3: Enable HTTPS
1. In Netlify → **Site settings** → **Domain management**
2. Under **HTTPS**, click **Verify DNS configuration**
3. Once verified, click **Provision certificate**
4. Wait for SSL certificate to be issued (usually 1-24 hours)

### 2. Supabase Configuration Update

#### Update Site URL
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `qurbdtzrngzfzevgoolp`
3. Navigate to **Authentication** → **URL Configuration**
4. Update **Site URL** to: `https://www.alt-text.pro`

#### Update Redirect URLs
Add these redirect URLs in **Authentication** → **URL Configuration**:
```
https://www.alt-text.pro/**
https://www.alt-text.pro/dashboard
https://www.alt-text.pro/
```

#### Remove Old URLs (Optional)
You can remove the old Netlify URLs:
- `https://alt-text-ai.netlify.app/**`
- `https://alt-text-ai.netlify.app/dashboard`

### 3. PayPal Configuration (If Using)

If you're using PayPal for payments, update your PayPal app settings:

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/developer/applications/)
2. Select your application
3. Update **Return URL** to: `https://www.alt-text.pro/payment-success`
4. Update **Cancel URL** to: `https://www.alt-text.pro/payment-cancelled`
5. Add `https://www.alt-text.pro` to allowed domains

### 4. Environment Variables

No changes needed! The application will automatically detect the production domain.

### 5. Deploy Updated Code

Deploy the updated code with the new domain references:

```bash
cd /Users/aamirfaiz/Desktop/Projects/Alt-text/v2/app-main
netlify deploy --prod
```

## 🔍 Verification Checklist

After setup, verify these items work:

- [ ] **Domain Access**: `https://www.alt-text.pro` loads the website
- [ ] **HTTPS**: SSL certificate is active (green lock icon)
- [ ] **Authentication**: Google OAuth works with new domain
- [ ] **API Calls**: Netlify functions work at `https://www.alt-text.pro/.netlify/functions/*`
- [ ] **Payment System**: PayPal integration works (if configured)
- [ ] **Redirects**: Authentication redirects work properly

## 🚨 Important Notes

1. **DNS Propagation**: DNS changes can take 24-48 hours to propagate globally
2. **SSL Certificate**: May take up to 24 hours to provision
3. **Supabase**: Update redirect URLs before testing authentication
4. **PayPal**: Update return URLs before testing payments

## 📋 Updated Files Summary

The following files have been updated with the new domain:

### Frontend Files:
- `frontend/src/App.js` - Site URL and API base URLs
- `frontend/public/index.html` - Open Graph meta tags

### Netlify Functions:
- `netlify-functions/create-payment.js` - PayPal return URLs

### Documentation:
- `PAYMENT_SETUP.md` - API base URL example
- `SUPABASE_REDIRECT_URLS_SETUP.md` - All domain references
- `SUPABASE_AUTH_STATUS.md` - All domain references  
- `SUPABASE_SETUP.md` - All domain references
- `netlify-functions/README.md` - API endpoint examples

## 🔧 Troubleshooting

### Domain Not Loading
- Check DNS propagation: [whatsmydns.net](https://www.whatsmydns.net/)
- Verify A record points to: `75.2.60.5`

### SSL Certificate Issues
- Wait 24 hours for automatic provisioning
- Check Netlify domain settings for certificate status

### Authentication Issues
- Verify Supabase Site URL is updated
- Check redirect URLs are correctly configured
- Clear browser cache and cookies

### API Function Issues
- Ensure functions are deployed to production
- Check function logs in Netlify dashboard
- Verify environment variables are set

## 📞 Support

If you encounter issues:
1. Check Netlify deploy logs
2. Check Supabase authentication logs  
3. Verify DNS configuration
4. Contact domain provider if DNS issues persist

---

**New Production URL**: https://www.alt-text.pro
**Netlify Project**: alt-text-ai
**Supabase Project**: qurbdtzrngzfzevgoolp
