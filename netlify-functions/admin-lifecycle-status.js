// Protected admin endpoint for per-user lifecycle visibility.

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  methodNotAllowedResponse,
  unauthorizedResponse,
  forbiddenResponse,
} = require('./utils/cors');
const { fetchLifecycleStatusReport, parsePositiveInt } = require('./utils/lifecycle-status');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

async function getAdminUser(event, headers) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      response: unauthorizedResponse(headers, 'Authorization header required'),
    };
  }

  if (!supabase) {
    return {
      response: {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Supabase is not configured' }),
      },
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return {
      response: unauthorizedResponse(headers, 'Invalid or expired token'),
    };
  }

  if (!SUPERUSER_EMAILS.includes(String(user.email || '').toLowerCase())) {
    return {
      response: forbiddenResponse(headers, 'Superuser privileges required'),
    };
  }

  return { user };
}

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-lifecycle-status:${clientIp}`, 30, 60000);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...headers,
        'Retry-After': Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)).toString(),
      },
      body: JSON.stringify({ error: 'Too many requests' }),
    };
  }

  try {
    const { response } = await getAdminUser(event, headers);
    if (response) return response;

    const days = parsePositiveInt(event.queryStringParameters?.days, 30, 1, 180);
    const limit = parsePositiveInt(event.queryStringParameters?.limit, 500, 1, 1000);
    const report = await fetchLifecycleStatusReport(supabase, { days, limit });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: report,
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-lifecycle-status', ip: getClientIp(event) });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to load lifecycle status report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
