# Gemini API Paid Tier Setup Guide

## Overview

Your WordPress plugin uses Google's Gemini API through Netlify functions. Currently, you're on the free tier which has rate limits (15 requests per minute). For a public plugin, you'll need to upgrade to a paid tier.

## Architecture

```
WordPress Plugin (User's API Key from alt-text.pro)
    ↓
Netlify Functions (Your GEMINI_API_KEY)
    ↓
Google Gemini API (Paid Tier)
```

**Important:** Each WordPress site using your plugin will have their own API key from `alt-text.pro`, but ALL requests go through YOUR Netlify function which uses YOUR Gemini API key.

## Step 1: Upgrade Gemini API to Paid Tier

### 1.1 Go to Google AI Studio
1. Visit: https://aistudio.google.com/
2. Sign in with your Google account
3. Navigate to **API Keys** section

### 1.2 Enable Billing
1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Select your project (or create one)
3. Navigate to **Billing** → **Link a billing account**
4. Add a payment method (credit card)
5. Enable billing for the project

### 1.3 Check Current Quotas
1. Go to **APIs & Services** → **Quotas**
2. Search for "Generative Language API"
3. Check current limits:
   - **Free Tier**: 15 requests/minute
   - **Paid Tier**: Much higher limits (varies by plan)

### 1.4 Request Quota Increase (if needed)
1. In **Quotas** page, find the quota you want to increase
2. Click **Edit Quotas**
3. Request your desired limit (e.g., 1000 requests/minute)
4. Google will review and approve (usually within 24-48 hours)

## Step 2: Update Netlify Environment Variable

### 2.1 Get Your Gemini API Key
1. Go to: https://aistudio.google.com/app/apikey
2. Copy your API key (starts with `AIza...`)

### 2.2 Update in Netlify
1. Go to your Netlify dashboard
2. Navigate to: **Site settings** → **Environment variables**
3. Find `GEMINI_API_KEY`
4. Update it with your API key (if it's the same, no change needed)
5. The key will automatically use the billing account linked to your Google Cloud project

## Step 3: Understanding Rate Limits

### Current Setup (Free Tier)
- **Limit**: 15 requests/minute per project
- **Issue**: Multiple users hitting this limit simultaneously causes 429 errors

### Paid Tier Options

#### Option 1: Pay-As-You-Go (Recommended)
- **Cost**: ~$0.00025 per image (Gemini 2.0 Flash)
- **Rate Limit**: Much higher (typically 1000+ requests/minute)
- **Best for**: Public plugins with variable usage

#### Option 2: Fixed Monthly Plan
- Check Google Cloud pricing for fixed plans
- Better for predictable high-volume usage

### Pricing Estimate
- **Per Image**: ~$0.00025 (Gemini 2.0 Flash)
- **1000 images**: ~$0.25
- **10,000 images**: ~$2.50
- **100,000 images**: ~$25.00

## Step 4: Implement Rate Limiting (Optional but Recommended)

To prevent abuse and control costs, consider implementing:

### 4.1 User-Level Rate Limiting
- Track requests per user API key
- Limit requests per hour/day
- Implement in your Netlify functions

### 4.2 Global Rate Limiting
- Limit total requests per minute across all users
- Implement queuing system for high traffic
- Add delays between requests

### 4.3 Cost Monitoring
- Set up Google Cloud billing alerts
- Monitor usage in Google Cloud Console
- Set budget limits to prevent unexpected charges

## Step 5: Testing After Upgrade

1. **Test Single Request**
   ```bash
   # Test via curl or Postman
   curl -X POST https://your-site.netlify.app/.netlify/functions/generate-alt-text \
     -H "Authorization: Bearer USER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"image_base64": "..."}'
   ```

2. **Test Bulk Processing**
   - Process 20+ images in quick succession
   - Verify no 429 errors
   - Check response times

3. **Monitor Costs**
   - Check Google Cloud billing dashboard
   - Verify charges match expected usage

## Step 6: Cost Management Strategies

### 6.1 Implement Caching
- Cache alt-text for identical images
- Reduce redundant API calls
- Save costs on duplicate images

### 6.2 User Credits System
- Your `alt-text.pro` platform already has credits
- Each user pays for their usage
- You cover Gemini API costs from user payments

### 6.3 Batch Processing Optimization
- Add delays between requests (already implemented: 0.5s)
- Process in smaller batches
- Queue requests during high traffic

## Step 7: Monitoring & Alerts

### 7.1 Google Cloud Monitoring
1. Go to **Cloud Monitoring** in Google Cloud Console
2. Set up alerts for:
   - High API usage
   - Quota approaching limits
   - Unexpected cost spikes

### 7.2 Netlify Function Logs
- Monitor Netlify function logs
- Track error rates
- Identify rate limit issues

## Important Notes

1. **Billing**: You'll be charged for ALL requests made through your Netlify function, regardless of which WordPress site/user made the request.

2. **User API Keys**: Users get their API keys from `alt-text.pro`. Your platform should:
   - Charge users appropriately
   - Track their usage
   - Cover your Gemini API costs

3. **Rate Limits**: Even on paid tier, there are limits. Request increases if needed.

4. **Cost Control**: Set up billing alerts and budget limits to prevent surprises.

## Quick Start Checklist

- [ ] Enable billing in Google Cloud Console
- [ ] Link billing account to your project
- [ ] Verify GEMINI_API_KEY in Netlify environment variables
- [ ] Test with bulk processing (20+ images)
- [ ] Set up billing alerts
- [ ] Monitor costs for first week
- [ ] Adjust rate limiting if needed

## Support Resources

- **Google AI Studio**: https://aistudio.google.com/
- **Gemini API Docs**: https://ai.google.dev/gemini-api/docs
- **Pricing**: https://ai.google.dev/pricing
- **Rate Limits**: https://ai.google.dev/gemini-api/docs/rate-limits
- **Google Cloud Billing**: https://console.cloud.google.com/billing

## Next Steps

1. Upgrade to paid tier following steps above
2. Test thoroughly with bulk processing
3. Monitor costs and adjust as needed
4. Consider implementing additional rate limiting
5. Update plugin documentation with usage guidelines

