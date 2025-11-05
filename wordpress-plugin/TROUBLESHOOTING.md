# Alt Text Pro Plugin - Troubleshooting Guide

## 🔍 Debugging API Connection Issues

### Step 1: Enable WordPress Debug Logging

Add to your `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

### Step 2: Check Error Logs

After testing the API connection, check:
- `/wp-content/debug.log` - WordPress debug log
- Your hosting error logs

Look for entries starting with:
- `Alt Text Pro API Request:`
- `Alt Text Pro API Response:`

### Step 3: Verify API Base URL

In WordPress Admin → Alt Text Pro → Settings, verify:
- API Base URL: `https://www.alt-text.pro/.netlify/functions`
- The URL should NOT end with a trailing slash

### Step 4: Test Endpoints Directly

Use these curl commands to test endpoints:

**Test Validate Endpoint:**
```bash
curl -X POST "https://www.alt-text.pro/.netlify/functions/auth/validate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -v
```

**Alternative (if nested doesn't work):**
```bash
curl -X POST "https://www.alt-text.pro/.netlify/functions/auth-validate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -v
```

**Test Usage Endpoint:**
```bash
curl -X GET "https://www.alt-text.pro/.netlify/functions/get-usage" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -v
```

### Common Issues and Solutions

#### Issue: "Endpoint not found (404)"

**Possible Causes:**
1. Netlify function not deployed
2. Wrong endpoint path
3. Functions directory mismatch

**Solutions:**
1. Verify Netlify functions are deployed:
   - Check Netlify dashboard → Functions tab
   - Should see `auth/validate` or `auth-validate`

2. The plugin now tries both endpoints automatically:
   - First: `auth/validate` (nested)
   - Fallback: `auth-validate` (flat)

3. Check `netlify.toml`:
   ```toml
   [build]
   functions = "netlify-functions"
   ```

#### Issue: "Invalid API key"

**Check:**
1. API key format: Should start with `alt_` or `altai_`
2. API key is copied correctly (no extra spaces)
3. API key is active in your dashboard

#### Issue: Connection timeout

**Solutions:**
1. Check server firewall allows outbound HTTPS
2. Verify SSL certificates are valid
3. Try increasing timeout in plugin settings

### Expected API Response Format

**Validate Endpoint Success:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "plan": "Free Plan",
      "credits_remaining": 100
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Plugin Logging

The plugin logs all API requests and responses. Check your debug log for:
- Full URL being called
- HTTP status code
- Response body preview
- Any JSON parsing errors

### Still Having Issues?

1. Check Netlify function logs in Netlify dashboard
2. Verify environment variables are set in Netlify
3. Test endpoints directly with curl (see above)
4. Check WordPress debug log for detailed error messages

