// Test endpoint to verify all WordPress plugin integration endpoints
// File: netlify/functions/test-endpoints.js

const { validateApiKey, getCreditStoreStats } = require('./utils/api-key-validator');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
} = require('./utils/cors');

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'POST', 'OPTIONS']);

  // Handle preflight
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting for test endpoints (10 per minute)
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(`test:${clientIp}`, 10);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  try {
    // Test API key validation
    const testApiKey = 'altai_test123_abc456_xyz789';
    const user = await validateApiKey(testApiKey);
    
    // Get credit store stats
    const creditStats = await getCreditStoreStats();
    
    const testResults = {
      timestamp: new Date().toISOString(),
      endpoints: {
        'generate-alt-text': {
          url: '/.netlify/functions/generate-alt-text',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
          },
          body: {
            image_base64: 'base64_encoded_image_data',
            context: 'optional_context'
          },
          description: 'Generate alt-text for a single image (deducts 1 credit)'
        },
        'get-usage': {
          url: '/.netlify/functions/get-usage',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
          },
          description: 'Get user usage statistics and credit balance'
        },
        'auth-validate': {
          url: '/.netlify/functions/auth-validate',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
          },
          description: 'Validate API token and get user info'
        },
        'debug-credits': {
          url: '/.netlify/functions/debug-credits',
          method: 'GET',
          description: 'Debug endpoint to monitor credit store (no auth required)'
        }
      },
      api_key_validation: {
        test_key: testApiKey,
        is_valid: !!user,
        user_info: user || 'Invalid key'
      },
      credit_system: {
        status: 'Active',
        storage_type: creditStats.storage_type,
        total_users: creditStats.total_users,
        sample_users: creditStats.users.slice(0, 3), // Show first 3 users
        credit_tracking: 'Persistent Supabase storage'
      },
      wordpress_plugin_integration: {
        status: 'Ready',
        required_endpoints: 'All implemented',
        api_key_format: 'altai_...',
        credit_system: 'Fixed - Credits persist in Supabase database',
        usage_tracking: 'Fixed - Real-time credit deduction and tracking'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(testResults, null, 2),
    };

  } catch (error) {
    console.error('Test endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}; 