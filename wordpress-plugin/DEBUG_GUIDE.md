# Debugging Guide - Plugin Not Working

## Issues Fixed

### 1. Auto-Generation on Upload
- **Problem**: Relied on WordPress cron which may not run immediately
- **Fix**: Now generates alt-text immediately when image is uploaded
- **Backup**: Still schedules cron as fallback

### 2. Manual Generation
- **Problem**: May have AJAX errors
- **Fix**: Added console logging for debugging
- **Check**: Open browser console (F12) to see error messages

### 3. Bulk Processing
- **Problem**: JavaScript may not be loading on bulk page
- **Fix**: Enhanced script loading detection for plugin pages
- **Check**: Verify scripts are loading in browser dev tools

## How to Debug

### Step 1: Check Browser Console
1. Open WordPress Admin
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Try to generate alt-text manually
5. Look for any red error messages

### Step 2: Check Network Tab
1. In Developer Tools, go to Network tab
2. Try to generate alt-text
3. Look for AJAX requests to `admin-ajax.php`
4. Check if requests are:
   - ✅ Status 200 (success)
   - ❌ Status 403/500 (error)
   - ❌ Blocked/CORS error

### Step 3: Check WordPress Debug Log
Enable debug logging in `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Then check `/wp-content/debug.log` for errors.

### Step 4: Verify API Key
1. Go to Alt Text Pro → Settings
2. Verify API key is saved (not blank)
3. Click "Test Connection" button
4. Should show success message

### Step 5: Check PHP Errors
Look for these in debug.log:
- "Alt Text Pro API Request:" - shows what endpoint is called
- "Alt Text Pro API Response:" - shows API response
- Any PHP errors or warnings

## Common Issues

### Issue: AJAX returns 0 or -1
**Cause**: Nonce verification failed or action not registered
**Fix**: Clear WordPress cache, reload page, try again

### Issue: "Unauthorized" or 403 error
**Cause**: User doesn't have `upload_files` capability
**Fix**: Ensure you're logged in as Administrator

### Issue: API returns 404
**Cause**: Wrong endpoint URL
**Fix**: Verify API base URL in settings matches: `https://www.alt-text.pro/.netlify/functions`

### Issue: Nothing happens when clicking button
**Cause**: JavaScript not loaded or jQuery conflict
**Fix**: 
1. Check browser console for errors
2. Verify jQuery is loaded: `console.log(typeof jQuery)`
3. Disable other plugins to check for conflicts

## Testing Checklist

- [ ] API key is configured and saved
- [ ] Test Connection button works
- [ ] Auto-generation enabled in settings
- [ ] Upload a test image
- [ ] Check if alt-text appears after upload
- [ ] Try manual generation from media library
- [ ] Try bulk processing with 1-2 images
- [ ] Check browser console for errors
- [ ] Check WordPress debug.log

## Report Issues

If still not working, provide:
1. Browser console errors (screenshot)
2. Network tab - AJAX request details
3. WordPress debug.log entries
4. WordPress version
5. PHP version

