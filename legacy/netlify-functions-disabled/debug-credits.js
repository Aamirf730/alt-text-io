// Debug endpoint for monitoring credit store
// File: netlify/functions/debug-credits.js

const { getCreditStoreStats } = require('./utils/api-key-validator');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);

  // Handle preflight
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting for debug endpoints (20 per minute)
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(`debug:${clientIp}`, 20);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Get credit store statistics
    const stats = await getCreditStoreStats();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      credit_store_status: 'Active',
      storage_type: stats.storage_type,
      total_users: stats.total_users,
      users: stats.users,
      system_info: {
        environment: process.env.NODE_ENV || 'development',
        function_name: 'debug-credits',
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debugInfo, null, 2),
    };

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}; 