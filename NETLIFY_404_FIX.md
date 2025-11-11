# Netlify 404 Error - Manual Fix Required

## Issue
The site is returning 404 errors even though redirects are configured correctly.

## Root Cause
The Netlify Dashboard settings might be overriding the `netlify.toml` configuration.

## Manual Fix Steps

### 1. Check Netlify Dashboard Settings

Go to: https://app.netlify.com/sites/alt-text-ai/configuration/deploys

**Verify these settings match:**

- **Build command**: `cd frontend && yarn build`
- **Publish directory**: `frontend/build` (NOT just `build`)
- **Base directory**: Leave empty or set to `.` (root)

### 2. Check Redirects in Dashboard

Go to: https://app.netlify.com/sites/alt-text-ai/configuration/redirects

**Verify these redirects exist:**

1. `/api/*` → `/.netlify/functions/:splat` (Status: 200)
2. `/*` → `/index.html` (Status: 200)

**Important**: The catch-all redirect (`/*` → `/index.html`) MUST be last.

### 3. Clear Netlify Cache

1. Go to: https://app.netlify.com/sites/alt-text-ai/deploys
2. Click "Trigger deploy" → "Clear cache and deploy site"

### 4. Verify Files Are Deployed

After deploying, check:
- https://www.alt-text.pro/index.html (should work)
- https://www.alt-text.pro/static/js/main.*.js (should load)

### 5. If Still Not Working

**Option A: Check if publish directory is correct**
- In Netlify Dashboard → Site settings → Build & deploy
- Make sure "Publish directory" is exactly: `frontend/build`

**Option B: Try deploying from root**
- Change publish directory to: `build` (without `frontend/`)
- Update netlify.toml:
  ```toml
  [build]
    publish = "build"
    command = "cd frontend && yarn build && cp -r build ../build"
  ```

**Option C: Check domain configuration**
- Go to: Site settings → Domain management
- Verify `www.alt-text.pro` is set as primary domain
- Check DNS settings are correct

## Quick Test

After fixing, test with:
```bash
curl -I https://www.alt-text.pro/
curl -I https://www.alt-text.pro/dashboard
```

Both should return `200 OK`, not `404`.

## Current Configuration

- **netlify.toml**: ✅ Configured correctly
- **frontend/build/_redirects**: ✅ Exists with correct rules
- **Build output**: ✅ Files exist in `frontend/build/`
- **Deploy**: ✅ Deployed successfully

The issue is likely in the Netlify Dashboard settings overriding the configuration.

