# ⚠️ CRITICAL: Deploy API Fixes

## 🔴 Issue Found

The Netlify function `generate-alt-text.js` only accepted `altai_` format API keys, but your dashboard generates `alt_` format keys.

## ✅ Fixes Applied

### 1. Updated API Key Validator (`utils/api-key-validator.js`)
- ✅ Now accepts both `alt_` and `altai_` formats
- ✅ Checks `api_keys` table first (new system)
- ✅ Falls back to `users` table (legacy)

### 2. Updated Generate Function (`generate-alt-text.js`)
- ✅ Now checks for both `alt_` and `altai_` API key formats
- ✅ Better error logging

### 3. Plugin Error Handling
- ✅ Properly detects error responses even with 200 status
- ✅ Prevents NULL database inserts
- ✅ Better error messages

## 🚀 Deploy Steps

### Option 1: Netlify CLI
```bash
cd /Users/aamirfaiz/Desktop/Projects/Alt-text/v2/app-main
netlify deploy --prod
```

### Option 2: Git Deploy
```bash
git add netlify-functions/
git commit -m "Fix: Support both alt_ and altai_ API key formats"
git push
```

### Option 3: Netlify Dashboard
1. Go to Netlify Dashboard
2. Click "Deploy site"
3. Or trigger redeploy from latest commit

## ✅ After Deployment

1. Test API key validation:
   ```bash
   curl -X POST "https://www.alt-text.pro/.netlify/functions/auth-validate" \
     -H "Authorization: Bearer alt_fUd4jYIyP4mfXT7YKMNmj9R6HEgnP2iD8GbYpKogDo8=" \
     -H "Content-Type: application/json"
   ```

2. Test alt-text generation:
   ```bash
   curl -X POST "https://www.alt-text.pro/.netlify/functions/generate-alt-text" \
     -H "Authorization: Bearer alt_fUd4jYIyP4mfXT7YKMNmj9R6HEgnP2iD8GbYpKogDo8=" \
     -H "Content-Type: application/json" \
     -d '{"image_base64": "test", "context": ""}'
   ```

## 📋 Files Changed

1. `netlify-functions/utils/api-key-validator.js` - Accepts both formats
2. `netlify-functions/generate-alt-text.js` - Checks both formats
3. `wordpress-plugin/alt-text-ai/includes/class-api-client.php` - Better error handling
4. `wordpress-plugin/alt-text-ai/alt-text-ai.php` - Prevents NULL logging
5. `wordpress-plugin/alt-text-ai/includes/class-media-handler.php` - Prevents NULL logging

## ⚠️ IMPORTANT

**The plugin fixes are ready, but the API fixes MUST be deployed to Netlify for the plugin to work!**

Without deploying the API fixes, you'll continue to see "Invalid or expired token" errors.

