# Plugin Connection Fixes Applied

## 🔧 Issues Fixed

### 1. **Endpoint Path Resolution**
- **Problem**: URL construction could create double slashes or incorrect paths
- **Fix**: Added proper URL normalization:
  ```php
  $api_base = rtrim($this->api_base, '/');
  $endpoint = ltrim($endpoint, '/');
  $url = $api_base . '/' . $endpoint;
  ```

### 2. **Dual Endpoint Support**
- **Problem**: Netlify functions can be deployed as either `auth/validate` (nested) or `auth-validate` (flat)
- **Fix**: Plugin now tries both endpoints automatically:
  - Primary: `auth/validate`
  - Fallback: `auth-validate` (if primary returns 404)

### 3. **Enhanced Error Logging**
- **Problem**: Hard to debug connection issues
- **Fix**: Added comprehensive logging:
  - Logs full URL being called
  - Logs HTTP status codes
  - Logs response body preview
  - Logs JSON parsing errors

### 4. **Better Error Messages**
- **Problem**: Generic "Endpoint not found" error
- **Fix**: Error messages now include:
  - The exact URL that was attempted
  - The API base URL for verification
  - Response body preview for debugging

## 📝 Changes Made

### Files Modified:
1. `includes/class-api-client.php`
   - Improved URL construction
   - Added dual endpoint fallback
   - Enhanced error logging
   - Better error messages

### New Files:
1. `TROUBLESHOOTING.md` - Complete debugging guide

## ✅ Testing Steps

1. **Enable Debug Logging:**
   ```php
   // In wp-config.php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   ```

2. **Test API Connection:**
   - Go to Alt Text Pro → Settings
   - Enter your API key
   - Click "Test Connection"

3. **Check Debug Log:**
   - View `/wp-content/debug.log`
   - Look for "Alt Text Pro API Request:" entries
   - Verify the URL being called is correct

4. **Manual Endpoint Test:**
   ```bash
   curl -X POST "https://www.alt-text.pro/.netlify/functions/auth/validate" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json"
   ```

## 🎯 Expected Behavior

1. Plugin tries `auth/validate` first
2. If 404, automatically tries `auth-validate`
3. Logs all attempts to debug log
4. Shows detailed error messages

## 🔍 Debugging

If you still get errors:

1. Check `/wp-content/debug.log` for:
   - Exact URL being called
   - HTTP status code
   - Response body

2. Verify in Netlify Dashboard:
   - Functions are deployed
   - Function names match expected format

3. Test endpoints directly with curl (see TROUBLESHOOTING.md)

## 📦 Updated Plugin

The plugin ZIP has been rebuilt with all fixes:
- Location: `wordpress-plugin/alt-text-ai-plugin.zip`
- Also copied to: `frontend/public/wordpress-plugin/alt-text-ai-plugin.zip`

Users can download the updated version from the dashboard.

