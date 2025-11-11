# 🔴 URGENT: Netlify 404 Error Fix

## Current Status
- ✅ Build files are ready in `frontend/build/`
- ❌ Site is returning 404 on https://www.alt-text.pro
- ❌ Netlify CLI cannot find the site (likely in different team/account)

## Immediate Action Required

### Option 1: Fix via Netlify Dashboard (RECOMMENDED)

1. **Go to Netlify Dashboard:**
   https://app.netlify.com/sites/alt-text-ai/configuration/deploys

2. **Verify Build Settings:**
   - Build command: `cd frontend && yarn build`
   - Publish directory: `frontend/build` (MUST be exactly this)
   - Base directory: Leave empty or `.`

3. **Check Redirects:**
   https://app.netlify.com/sites/alt-text-ai/configuration/redirects
   
   Must have these redirects (in order):
   - `/api/*` → `/.netlify/functions/:splat` (Status: 200)
   - `/*` → `/index.html` (Status: 200) ← MUST be last

4. **Clear Cache and Redeploy:**
   - Go to: https://app.netlify.com/sites/alt-text-ai/deploys
   - Click "Trigger deploy" → "Clear cache and deploy site"

### Option 2: Manual Deploy via Dashboard

1. Go to: https://app.netlify.com/sites/alt-text-ai/deploys
2. Click "Trigger deploy" → "Deploy site"
3. Or drag and drop the `frontend/build` folder

## Why This Keeps Happening

The Netlify Dashboard settings can override `netlify.toml`. If the publish directory is wrong in the Dashboard, it will always return 404.

## Quick Test After Fix

```bash
curl -I https://www.alt-text.pro/
curl -I https://www.alt-text.pro/dashboard
```

Both should return `200 OK`, not `404`.
