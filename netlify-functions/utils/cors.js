/**
 * CORS and Security Utilities
 * File: netlify-functions/utils/cors.js
 * 
 * Provides secure CORS handling with origin validation and rate limiting.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * RATE LIMITING LIMITATIONS (IMPORTANT!)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * The current in-memory rate limiting has these limitations:
 * 
 * 1. RESETS ON COLD STARTS: When a function instance spins down due to inactivity
 *    (typically after 10-15 minutes), the rate limit counters reset to zero.
 * 
 * 2. NOT SHARED ACROSS INSTANCES: Under load, Netlify spins up multiple function
 *    instances. Each has its own rate limit store, so an attacker hitting
 *    different instances won't be rate limited effectively.
 * 
 * 3. MEMORY CONCERNS: Under sustained attack, the Map could grow large.
 *    We mitigate this with periodic cleanup, but it's not perfect.
 * 
 * FOR PRODUCTION HARDENING, CONSIDER:
 * 
 * Option A: Upstash Redis (Recommended for serverless)
 *   - Add @upstash/redis package
 *   - Use Upstash's built-in rate limiting: @upstash/ratelimit
 *   - Provides persistent, distributed rate limiting
 *   - Free tier available: https://upstash.com/
 * 
 * Option B: Netlify WAF / Edge Rules
 *   - Configure rate limiting at the edge (before functions)
 *   - No code changes needed
 *   - Available on Pro/Business plans
 * 
 * Option C: Cloudflare (if using as CDN)
 *   - Configure Rate Limiting rules in Cloudflare dashboard
 *   - Blocks attacks before they reach Netlify
 * 
 * The current implementation still provides value:
 *   ✓ Protects against casual abuse within a single function instance
 *   ✓ Adds 429 responses that may discourage simple scripts
 *   ✓ Provides rate limit headers for legitimate clients
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Allowed origins - production and development
const ALLOWED_ORIGINS = [
  'https://www.alt-text.pro',
  'https://alt-text.pro',
  'https://alt-text-ai.netlify.app',
  // Development origins
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:9999',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:9999',
];

// Allowed Netlify preview deploy prefixes.
// Only these specific deploy prefixes (e.g., "deploy-preview-42--alt-text-ai")
// will be accepted. Set ALLOWED_PREVIEW_DOMAINS in Netlify env vars as a
// comma-separated list to add more (e.g., "alt-text-ai,alt-text-staging").
// Falls back to the main deploy name if not configured.
const ALLOWED_PREVIEW_PREFIXES = (
  process.env.ALLOWED_PREVIEW_DOMAINS || 'alt-text-ai'
).split(',').map(d => d.trim()).filter(Boolean);

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING — delegated to rate-limiter.js
// Uses Upstash Redis when configured, falls back to in-memory.
// See rate-limiter.js for setup instructions.
// ═══════════════════════════════════════════════════════════════════════════════
const { checkRateLimit: distributedRateLimit, checkStrictRateLimit, getRateLimitInfo, INSTANCE_ID } = require('./rate-limiter');

/**
 * Check rate limit for a client IP.
 * NOW ASYNC — delegates to distributed rate limiter (Upstash Redis)
 * with in-memory fallback.
 *
 * @param {string} clientIp - Client IP address
 * @param {number} maxRequests - Maximum requests allowed (default: 60)
 * @param {number} windowMs - Time window in ms (default: 60000)
 * @returns {Promise<Object>} - { allowed, remaining, resetAt, backend }
 */
async function checkRateLimit(clientIp, maxRequests = 60, windowMs = 60000) {
  return distributedRateLimit(clientIp, maxRequests, windowMs);
}

/**
 * Get the validated origin or null if not allowed
 * @param {Object} headers - Request headers
 * @returns {string|null} - Validated origin or null
 */
function getValidatedOrigin(headers) {
  const origin = headers.origin || headers.Origin;

  if (!origin) {
    // No origin header (e.g., server-to-server calls, mobile apps)
    // Allow but don't set Access-Control-Allow-Origin
    return null;
  }

  // Check if origin is in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Check for allowed Netlify preview deploys only (not any .netlify.app domain)
  if (origin.endsWith('.netlify.app')) {
    const isAllowedPreview = ALLOWED_PREVIEW_PREFIXES.some(prefix =>
      origin.includes(prefix)
    );
    if (isAllowedPreview) {
      return origin;
    }
    console.warn('CORS: Rejected unknown Netlify preview origin:', origin);
    return null;
  }

  console.warn('CORS: Rejected origin:', origin);
  return null;
}

/**
 * Get secure CORS headers based on the request origin
 * @param {Object} requestHeaders - Request headers
 * @param {Array} allowedMethods - Allowed HTTP methods (default: ['GET', 'POST', 'OPTIONS'])
 * @returns {Object} - CORS headers object
 */
function getCorsHeaders(requestHeaders, allowedMethods = ['GET', 'POST', 'OPTIONS']) {
  const validatedOrigin = getValidatedOrigin(requestHeaders);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };

  // Only set Allow-Origin if we have a validated origin
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle CORS preflight request
 * @param {Object} event - Netlify function event
 * @returns {Object|null} - Response object if preflight, null otherwise
 */
function handlePreflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    const headers = getCorsHeaders(event.headers);
    return {
      statusCode: 204, // No Content for preflight
      headers,
      body: '',
    };
  }
  return null;
}

/**
 * Get client IP from request
 * @param {Object} event - Netlify function event
 * @returns {string} - Client IP address
 */
function getClientIp(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    event.headers['client-ip'] ||
    'unknown';
}

/**
 * Create rate limit exceeded response
 * @param {Object} headers - CORS headers
 * @param {Object} rateLimitInfo - Rate limit info from checkRateLimit
 * @returns {Object} - Response object
 */
function rateLimitExceededResponse(headers, rateLimitInfo) {
  const retryAfter = Math.max(1, Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000));
  const limit = Number.isFinite(rateLimitInfo.limit)
    ? rateLimitInfo.limit
    : Math.max(rateLimitInfo.count || 0, (rateLimitInfo.count || 0) + (rateLimitInfo.remaining || 0), 1);

  return {
    statusCode: 429,
    headers: {
      ...headers,
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': rateLimitInfo.resetAt.toISOString(),
      // Include instance ID for debugging distributed rate limiting
      'X-RateLimit-Instance': rateLimitInfo.instanceId || 'unknown',
    },
    body: JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    }),
  };
}

/**
 * Validate authorization header and return token
 * @param {Object} event - Netlify function event
 * @returns {Object} - { valid: boolean, token: string|null, error: string|null }
 */
function validateAuthHeader(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      valid: false,
      token: null,
      error: 'Authorization header required',
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      valid: false,
      token: null,
      error: 'Invalid authorization token format',
    };
  }

  return {
    valid: true,
    token,
    error: null,
  };
}

/**
 * Create unauthorized response
 * @param {Object} headers - CORS headers
 * @param {string} message - Error message
 * @returns {Object} - Response object
 */
function unauthorizedResponse(headers, message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Create forbidden response
 * @param {Object} headers - CORS headers
 * @param {string} message - Error message
 * @returns {Object} - Response object
 */
function forbiddenResponse(headers, message = 'Forbidden') {
  return {
    statusCode: 403,
    headers,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Create method not allowed response
 * @param {Object} headers - CORS headers
 * @returns {Object} - Response object
 */
function methodNotAllowedResponse(headers) {
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

/**
 * Get rate limiting statistics for monitoring
 * Useful for health checks and debugging
 * @returns {Object} - Rate limiting stats
 */
function getRateLimitStats() {
  return getRateLimitInfo();
}

module.exports = {
  ALLOWED_ORIGINS,
  getValidatedOrigin,
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  validateAuthHeader,
  unauthorizedResponse,
  forbiddenResponse,
  methodNotAllowedResponse,
  getRateLimitStats,
  INSTANCE_ID,
};
