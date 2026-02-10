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

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY RATE LIMITING
// See documentation above for limitations and production alternatives
// ═══════════════════════════════════════════════════════════════════════════════
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

// Track function instance for debugging
const INSTANCE_ID = Math.random().toString(36).substring(2, 8);
let instanceRequestCount = 0;

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

  // Check for Netlify preview deploys (*.netlify.app)
  if (origin.endsWith('.netlify.app')) {
    return origin;
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
 * Check rate limit for a client IP
 * 
 * NOTE: This is in-memory rate limiting with known limitations.
 * See documentation at the top of this file for production alternatives.
 * 
 * @param {string} clientIp - Client IP address
 * @param {number} maxRequests - Maximum requests allowed (default: 100)
 * @param {number} windowMs - Time window in ms (default: 60000)
 * @returns {Object} - { allowed: boolean, remaining: number, resetAt: Date, instanceId: string }
 */
function checkRateLimit(clientIp, maxRequests = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const key = clientIp;

  // Track total requests to this instance (for debugging/monitoring)
  instanceRequestCount++;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.windowStart + windowMs < now) {
    // New window - log when starting fresh (helps identify cold starts)
    if (!entry) {
      // First time seeing this IP on this instance
      // This could be normal traffic or a cold start scenario
    }
    entry = {
      windowStart: now,
      count: 0,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, maxRequests - entry.count);
  const resetAt = new Date(entry.windowStart + windowMs);
  const allowed = entry.count <= maxRequests;

  // Log rate limit violations (helps identify attacks)
  if (!allowed) {
    console.warn(`[RATE_LIMIT] IP ${clientIp} exceeded limit (${entry.count}/${maxRequests}) on instance ${INSTANCE_ID}`);
  }

  // Clean up old entries periodically (every 1000 entries or when store gets large)
  if (rateLimitStore.size > 5000 || (instanceRequestCount % 1000 === 0 && rateLimitStore.size > 100)) {
    const cutoff = now - windowMs;
    let cleaned = 0;
    for (const [k, v] of rateLimitStore) {
      if (v.windowStart < cutoff) {
        rateLimitStore.delete(k);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[RATE_LIMIT] Cleaned ${cleaned} expired entries, ${rateLimitStore.size} remaining`);
    }
  }

  return {
    allowed,
    remaining,
    resetAt,
    count: entry.count,
    instanceId: INSTANCE_ID, // Include for debugging distributed rate limiting issues
    instanceRequests: instanceRequestCount,
  };
}

/**
 * Create rate limit exceeded response
 * @param {Object} headers - CORS headers
 * @param {Object} rateLimitInfo - Rate limit info from checkRateLimit
 * @returns {Object} - Response object
 */
function rateLimitExceededResponse(headers, rateLimitInfo) {
  const retryAfter = Math.max(1, Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000));

  return {
    statusCode: 429,
    headers: {
      ...headers,
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
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
  return {
    instanceId: INSTANCE_ID,
    instanceRequests: instanceRequestCount,
    trackedIPs: rateLimitStore.size,
    windowMs: RATE_LIMIT_WINDOW_MS,
    defaultMaxRequests: RATE_LIMIT_MAX_REQUESTS,
    // Note: This is per-instance, not global
    warning: 'Rate limiting is in-memory and per-instance. See docs for production alternatives.',
  };
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

