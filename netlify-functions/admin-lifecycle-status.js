// Protected admin endpoint for per-user lifecycle visibility.

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { authenticateAdmin } = require('./utils/admin-auth');
const { withErrorReporting } = require('./utils/error-reporter');
const { fetchLifecycleStatusReport, parsePositiveInt } = require('./utils/lifecycle-status');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-lifecycle-status:${clientIp}`, 30, 60000);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  try {
    const { response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const days = parsePositiveInt(event.queryStringParameters?.days, 30, 1, 180);
    const report = await fetchLifecycleStatusReport(supabase, { days });

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
}

exports.handler = withErrorReporting('admin-lifecycle-status', handler);
