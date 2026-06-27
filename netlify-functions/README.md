# WordPress Plugin Integration - Netlify Functions

This directory contains the Netlify functions that power the WordPress plugin integration for Alt Text Pro.

## 🚀 Available Endpoints

### 1. Generate Alt-Text
**Endpoint:** `/.netlify/functions/generate-alt-text`
**Method:** POST
**Purpose:** Generate alt-text for a single image using our AI service

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "image_base64": "base64_encoded_image_data",
  "context": "optional_context_information"
}
```

**Response:**
```json
{
  "alt_text": "Generated alt-text description",
  "credits_used": 1,
  "credits_remaining": 29,
  "total_processed": 1
}
```

### 2. Get Usage Statistics
**Endpoint:** `/.netlify/functions/get-usage`
**Method:** GET
**Purpose:** Retrieve user usage statistics and plan information

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "current_plan": "Free Trial",
  "credits_remaining": 29,
  "total_processed": 1,
  "plan_expires": null
}
```

### 3. Validate API Token
**Endpoint:** `/.netlify/functions/auth/validate`
**Method:** POST
**Purpose:** Validate API token and return user information

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "plan": "Free Trial",
    "credits_remaining": 29
  }
}
```

## 🔑 API Key Format

All API keys must follow this format:
```
altai_[hash]_[random]_[timestamp]
```

Example: `altai_abc123_def456_xyz789`

## 💳 Credit System

- **Free Trial:** 50 credits
- **Tier 1:** $12/month - 1,000 credits/month
- **Tier 2:** $20/month - 2,400 credits/month
- **Tier 3:** $40/month - 5,000 credits/month
- **Pay-as-you-go:** $5 for 300 credits (never expire)
- **Pay-as-you-go:** $3 for 50 credits

Each alt-text generation consumes 1 credit.

## 🛡️ Security Features

- **API Key Validation:** All requests require valid API keys
- **CORS Support:** Proper CORS headers for cross-origin requests
- **Rate Limiting:** Built-in credit system prevents abuse
- **Error Handling:** Comprehensive error responses with proper HTTP status codes

## 📱 WordPress Plugin Integration

### WordPress AJAX Endpoints

The WordPress plugin will handle these internal endpoints:

1. **`wp_ajax_alttext_ai_generate`** - Single image processing
2. **`wp_ajax_alttext_ai_bulk_generate`** - Bulk processing
3. **`wp_ajax_alttext_ai_validate_token`** - Token validation
4. **`wp_ajax_alttext_ai_get_usage`** - Usage statistics

### Plugin Configuration

In your WordPress plugin settings, configure:

```php
// API Base URL
$api_base_url = 'https://www.alt-text.pro/.netlify/functions';

// Endpoints
$endpoints = [
    'generate' => $api_base_url . '/generate-alt-text',
    'usage' => $api_base_url . '/get-usage',
    'validate' => $api_base_url . '/auth/validate'
];
```

## 🧪 Testing

### Test Endpoint
Visit `/.netlify/functions/test-endpoints` to verify all endpoints are working correctly.

### Manual Testing
You can test the endpoints using tools like:
- **Postman**
- **cURL**
- **Insomnia**

### Example cURL Commands

**Generate Alt-Text:**
```bash
curl -X POST https://www.alt-text.pro/.netlify/functions/generate-alt-text \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "test_image_data", "context": "test"}'
```

**Get Usage:**
```bash
curl -X GET https://www.alt-text.pro/.netlify/functions/get-usage \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Validate Token:**
```bash
curl -X POST https://www.alt-text.pro/.netlify/functions/auth/validate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## 🔧 Development

### Local Development
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run locally: `netlify dev`
3. Test endpoints at `http://localhost:8888/.netlify/functions/[function-name]`

### Environment Variables
Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `AI_API_KEY` - Our core AI service API key
- `SUPERUSER_EMAILS` - Comma-separated admin emails allowed to open admin reports
- `MARKETING_REPORT_EMAILS` - Optional comma-separated recipients for the daily funnel email; falls back to `SUPERUSER_EMAILS`
- `EMAIL_USER` / `EMAIL_PASSWORD` - SMTP credentials used by contact emails and the scheduled funnel report
- `LIFECYCLE_AUTOMATION_SECRET` - Optional secret for manually invoking or dry-running the lifecycle automation endpoint. Public HTTP calls that only spoof Netlify's scheduled `next_run` body are blocked.
- `LIFECYCLE_AUTOMATION_LOOKBACK_DAYS` - Optional event lookback window for lifecycle automation, defaults to `30`
- `LIFECYCLE_AUTOMATION_MAX_SENDS` - Optional per-run send cap for lifecycle automation, defaults to `25`

### Lifecycle Automation Manual Test
Manual tests must use `LIFECYCLE_AUTOMATION_SECRET`. Do not use a public scheduled-style request as authorization.

Lifecycle automation uses website/account events and server-side plugin connection events only. The WordPress plugin does not send non-essential wp-admin marketing or funnel telemetry.

The admin dashboard's Lifecycle tab uses the read-only `admin-lifecycle-status` function. It requires a signed-in Supabase session whose email is listed in `SUPERUSER_EMAILS`, then summarizes profiles, plugin connection events, usage stats, checkout/purchase events, low-credit events, and `marketing_automation_sends` follow-up history.

Active lifecycle rules:
- `signup_no_connect`: `signup_created` without a later `connect_completed` after 4 hours. Successful plugin API-key validation records `connect_completed` server-side with source `wordpress_plugin_auth`.
- `connect_no_first_image`: `connect_completed` without a later web app `first_image_processed` after 6 hours.
- `checkout_no_purchase`: `checkout_started` without a later `purchase_completed` after 1 hour.
- `purchase_onboarding`: `purchase_completed`.
- `credits_low_no_purchase`: `credits_low` without a later `purchase_completed`.

```bash
curl -sS -X POST "https://www.alt-text.pro/.netlify/functions/lifecycle-automation?dry_run=1" \
  -H "x-lifecycle-automation-secret: YOUR_SECRET"
```

### File Structure
```
netlify-functions/
├── generate-alt-text.js    # Main alt-text generation
├── get-usage.js            # Usage statistics
├── auth/
│   └── validate.js         # API token validation
├── utils/
│   └── api-key-validator.js # Shared validation logic
├── test-endpoints.js       # Testing endpoint
└── README.md               # This file
```

## 🚨 Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Invalid API key"
}
```

**402 Payment Required:**
```json
{
  "error": "No credits remaining. Please upgrade your plan."
}
```

**400 Bad Request:**
```json
{
  "error": "image_base64 is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## 📈 Monitoring

### Logs
All function logs are available in the Netlify dashboard:
- **Function logs:** `https://app.netlify.com/projects/[project-id]/logs/functions`
- **Edge function logs:** `https://app.netlify.com/projects/[project-id]/logs/edge-functions`

### Metrics
Monitor usage and performance through:
- Netlify Analytics
- Supabase Dashboard
- Custom logging in functions

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor credit usage and limits
- Update AI models as needed
- Review and optimize function performance
- Monitor error rates and user feedback

### Scaling Considerations
- Implement proper database storage for production
- Add Redis caching for frequently accessed data
- Implement proper user management system
- Add analytics and monitoring tools

---

**Status:** ✅ Ready for WordPress Plugin Integration
**Last Updated:** January 2025
**Version:** 1.0.0
