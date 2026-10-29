// Netlify Function for marking a WordPress site as disconnected
// File: netlify-functions/site-disconnect.js
//
// Called by the plugin, best effort, when a site disconnects its account or
// uninstalls the plugin. The API key is shared by every site of the account,
// so it is NOT revoked here; the site only stops counting as connected.

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const {
  API_KEY_STATUS,
  apiKeyFailureResponse,
  validateApiKeyResult,
} = require('./utils/api-key-validator');
const {
  extractPluginSite,
  markPluginSiteDisconnected,
  normalizeSiteUrl,
} = require('./utils/plugin-connect-event');
const { parseJsonBody } = require('./utils/input-validator');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function readSiteUrl(event) {
  const fromHeaders = extractPluginSite(event);
  if (fromHeaders) return fromHeaders.siteUrl;

  if (!event.body) return null;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  const { data } = parseJsonBody(rawBody);
  return normalizeSiteUrl(data?.site_url);
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server configuration error' }),
    };
  }

  // Rate limiting
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`site-disconnect:ip:${clientIp}`, 30);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Same API-key check as generation. A suspended account may still
    // disconnect its sites.
    const validation = await validateApiKeyResult(token);
    if (validation.status !== API_KEY_STATUS.VALID && validation.status !== API_KEY_STATUS.SUSPENDED) {
      return apiKeyFailureResponse(headers, validation);
    }

    const siteUrl = readSiteUrl(event);
    if (!siteUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'A valid site URL is required' }),
      };
    }

    const result = await markPluginSiteDisconnected(supabase, {
      userId: validation.user.id,
      siteUrl,
    });

    if (!result.success) {
      return {
        statusCode: 503,
        headers: { ...headers, 'Retry-After': '30' },
        body: JSON.stringify({
          success: false,
          retryable: true,
          error: 'The site could not be marked as disconnected. Please try again.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        site_url: result.siteUrl,
        disconnected: result.disconnected,
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'site-disconnect', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
};
