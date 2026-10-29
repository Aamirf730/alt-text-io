// Netlify Function: self-service account deletion
// File: netlify-functions/delete-account.js
//
// POST, Authorization: Bearer <Supabase access token>
// Body: { "confirm_email": "<the account's email>" } (case-insensitive)
// 200 { success: true, subscription_cancellation }
// 4xx/5xx { error, message }
//
// The dashboard calls this. Deletion itself is utils/account-deletion.js,
// shared with the admin endpoint.

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
} = require('./utils/cors');
const { getBearerToken, isSuperuserEmail, normalizeEmail } = require('./utils/admin-auth');
const { deleteAccount } = require('./utils/account-deletion');
const { withErrorReporting } = require('./utils/error-reporter');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Per IP and per account; deletion is rare and irreversible.
const IP_RATE_LIMIT = 5;
const USER_RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function errorResponse(statusCode, headers, error, message) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({ error, message }),
  };
}

function parseBody(event) {
  if (!event?.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    if (raw.length > 2048) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

const FAILURE_STATUS = {
  not_found: 404,
  protected_account: 403,
  subscription_cancel_unavailable: 503,
  audit_failed: 503,
  delete_failed: 500,
  lookup_failed: 503,
};

function createHandler({
  supabaseClient = supabase,
  checkRateLimitFn = checkRateLimit,
  deleteAccountFn = deleteAccount,
} = {}) {
  return async (event) => {
    const requestHeaders = event.headers || {};
    const headers = getCorsHeaders(requestHeaders, ['POST', 'OPTIONS']);

    const preflightResponse = handlePreflight(event);
    if (preflightResponse) return preflightResponse;

    if (event.httpMethod !== 'POST') {
      return errorResponse(405, headers, 'method_not_allowed', 'Use POST.');
    }

    const ipLimit = await checkRateLimitFn(`delete-account:ip:${getClientIp({ ...event, headers: requestHeaders })}`, IP_RATE_LIMIT, RATE_WINDOW_MS);
    if (!ipLimit.allowed) return rateLimitExceededResponse(headers, ipLimit);

    if (!supabaseClient) {
      return errorResponse(500, headers, 'server_configuration', 'Account deletion is temporarily unavailable.');
    }

    const token = getBearerToken({ headers: requestHeaders });
    if (!token) {
      return errorResponse(401, headers, 'unauthorized', 'Sign in again to delete your account.');
    }

    let user = null;
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (!error) user = data?.user || null;
    } catch (_error) {
      return errorResponse(503, headers, 'auth_unavailable', 'Sign-in could not be checked. Try again shortly.');
    }
    if (!user?.id) {
      return errorResponse(401, headers, 'unauthorized', 'Your session has expired. Sign in again to delete your account.');
    }

    const userLimit = await checkRateLimitFn(`delete-account:user:${user.id}`, USER_RATE_LIMIT, RATE_WINDOW_MS);
    if (!userLimit.allowed) return rateLimitExceededResponse(headers, userLimit);

    const body = parseBody(event);
    if (!body) {
      return errorResponse(400, headers, 'invalid_request', 'Send {"confirm_email": "<your email>"}.');
    }

    const accountEmail = normalizeEmail(user.email);
    const confirmEmail = normalizeEmail(body.confirm_email);
    if (!confirmEmail || !accountEmail || confirmEmail !== accountEmail) {
      return errorResponse(400, headers, 'email_mismatch', 'The email you typed does not match this account.');
    }

    if (isSuperuserEmail(accountEmail)) {
      return errorResponse(403, headers, 'protected_account', 'Admin accounts cannot be deleted here.');
    }

    let outcome;
    try {
      outcome = await deleteAccountFn({
        supabase: supabaseClient,
        userId: user.id,
        actor: { id: user.id, email: accountEmail },
        actorType: 'self',
        reason: 'Self-service deletion from the dashboard',
        event,
      });
    } catch (error) {
      const { reportError } = require('./utils/error-reporter');
      reportError(error, { functionName: 'delete-account' });
      return errorResponse(500, headers, 'delete_failed', 'Your account could not be deleted. Try again or contact support.');
    }

    if (!outcome.ok) {
      const code = outcome.code || 'delete_failed';
      return errorResponse(FAILURE_STATUS[code] || 500, headers, code, outcome.message || 'Your account could not be deleted. Try again or contact support.');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        subscription_cancellation: outcome.subscriptionCancellation || 'not_needed',
      }),
    };
  };
}

exports.handler = withErrorReporting('delete-account', createHandler());
exports._private = { createHandler, parseBody };
