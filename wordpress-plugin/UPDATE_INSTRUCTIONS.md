# ⚠️ CRITICAL: Plugin Update Required

## 🔴 You're Still Using the Old Plugin Version!

Your debug log shows the old endpoint `auth/validate` is being used. This means **you need to update the plugin**.

## ✅ How to Update the Plugin

### Method 1: Replace Plugin Files (Recommended)

1. **Deactivate the plugin** in WordPress:
   - Go to Plugins → Installed Plugins
   - Find "Alt Text Pro"
   - Click "Deactivate"

2. **Delete the old version**:
   - Still in Plugins page
   - Click "Delete" under Alt Text Pro

3. **Install the new version**:
   - Go to Plugins → Add New → Upload Plugin
   - Download: https://www.alt-text.pro/wordpress-plugin/alt-text-ai-plugin.zip
   - Upload and activate

4. **Clear any caches** (if you use caching plugins)

### Method 2: FTP/File Manager Update

1. **Download the new plugin ZIP**:
   - https://www.alt-text.pro/wordpress-plugin/alt-text-ai-plugin.zip

2. **Extract the ZIP file**

3. **Upload via FTP/File Manager**:
   - Delete: `/wp-content/plugins/alt-text-ai/`
   - Upload: The new `alt-text-ai/` folder to `/wp-content/plugins/`

4. **Activate in WordPress**

## 🔍 Verify the Update

After updating, check the debug log. You should see:

**NEW (Correct):**
```
Alt Text Pro API Request: POST https://www.alt-text.pro/.netlify/functions/auth-validate | Endpoint: auth-validate
```

**OLD (Wrong - what you're seeing now):**
```
[endpoint] => auth/validate  ❌
```

## 📋 What Changed in v1.0.1

- ✅ Fixed endpoint from `auth/validate` to `auth-validate`
- ✅ Enhanced debug logging to show exact URLs
- ✅ Better error handling for 404 responses

## ⚠️ Important Notes

1. **You MUST delete the old plugin** - Don't just deactivate it
2. **Clear WordPress cache** if you have caching enabled
3. **Check file timestamps** - New files should be from today (Nov 3, 2025)
4. **Version check**: New version is 1.0.1 (old was 1.0.0)

## 🧪 After Updating, Test Again

1. Go to Alt Text Pro → Settings
2. Enter your API key
3. Click "Test Connection"
4. Check debug log - should show `auth-validate` not `auth/validate`

## ❓ Still Having Issues?

If after updating you still see the old endpoint in logs:
1. Double-check you deleted the old files completely
2. Verify the new files are in place
3. Check file permissions
4. Clear all caches (browser, WordPress, server)

