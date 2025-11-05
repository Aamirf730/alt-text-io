# Clear Cache to Download v1.0.1

## 🔄 The Plugin ZIP is Updated (v1.0.1)

The file has been updated with:
- ✅ Version: 1.0.1
- ✅ Endpoint: `auth-validate` (fixed)
- ✅ File location: `frontend/public/wordpress-plugin/alt-text-ai-plugin.zip`

## 🚨 Browser/Cache Issue

If you're still seeing v1.0.0, it's likely cached. Try these:

### Method 1: Hard Refresh Browser
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Safari**: `Cmd+Option+R`

### Method 2: Download with Cache Buster
Add `?v=1.0.1` or timestamp to the URL:
```
https://www.alt-text.pro/wordpress-plugin/alt-text-ai-plugin.zip?v=1.0.1
https://www.alt-text.pro/wordpress-plugin/alt-text-ai-plugin.zip?t=1730666400
```

### Method 3: Clear Browser Cache
1. Open browser settings
2. Clear browsing data/cache
3. Select "Cached images and files"
4. Clear data
5. Try downloading again

### Method 4: Use Incognito/Private Window
- Open a new incognito/private window
- Navigate to the download link
- Download should show v1.0.1

### Method 5: Direct File Check
If you have SSH/FTP access:
```bash
# Check the actual file
cd /path/to/frontend/public/wordpress-plugin/
ls -lh alt-text-ai-plugin.zip
unzip -p alt-text-ai-plugin.zip alt-text-ai/alt-text-ai.php | grep "ALT_TEXT_AI_VERSION"
```

### Method 6: Netlify Cache Clear
If your site is on Netlify:
1. Go to Netlify Dashboard
2. Site → Deploys
3. Trigger a new deploy
4. Or purge cache in Netlify settings

## ✅ Verify You Have v1.0.1

After downloading, check the version:

1. **Extract the ZIP**
2. **Open** `alt-text-ai/alt-text-ai.php`
3. **Look for**: `define('ALT_TEXT_AI_VERSION', '1.0.1');`

OR check in WordPress:
- Go to Plugins → Installed Plugins
- Look at Alt Text Pro version number
- Should show: **1.0.1**

## 📋 File Verification

The updated ZIP should have:
- File size: ~47KB
- Modified: Nov 3, 2025 18:33 (or later)
- Contains `auth-validate` endpoint (not `auth/validate`)

## 🔧 If Still Showing v1.0.0

1. Check file timestamp matches today's date
2. Verify MD5 hash: `2f137b203c3d511771008d6f202c2e67`
3. Try downloading from different browser/device
4. Check if your hosting/CDN is caching the file

## 📍 Current File Location

The updated ZIP is at:
```
frontend/public/wordpress-plugin/alt-text-ai-plugin.zip
```

Make sure this file is deployed to your hosting/CDN.

