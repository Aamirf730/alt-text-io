# WordPress Plugin Integration - Netlify Functions

This directory contains the Netlify functions that power the WordPress plugin integration for Alt-Text AI.

## 🚀 Available Endpoints

### 1. Generate Alt-Text
**Endpoint:** `/.netlify/functions/generate-alt-text`  
**Method:** POST  
**Purpose:** Generate alt-text for a single image using Gemini AI

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

- **Free Trial:** 30 credits
- **Starter Plan:** 500 credits/month
- **Pro Plan:** 2000 credits/month
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
$api_base_url = 'https://alt-text-ai.netlify.app/.netlify/functions';

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
curl -X POST https://alt-text-ai.netlify.app/.netlify/functions/generate-alt-text \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "test_image_data", "context": "test"}'
```

**Get Usage:**
```bash
curl -X GET https://alt-text-ai.netlify.app/.netlify/functions/get-usage \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Validate Token:**
```bash
curl -X POST https://alt-text-ai.netlify.app/.netlify/functions/auth/validate \
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
- `GEMINI_API_KEY` - Google Gemini API key

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
- Update Gemini AI models as needed
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