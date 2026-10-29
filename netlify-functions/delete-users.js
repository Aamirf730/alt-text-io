// Netlify Function: admin account deletion
// File: netlify-functions/delete-users.js
//
// POST { emails?: string[], user_ids?: string[], reason: string }
// Each account goes through utils/account-deletion.js: audit row, delete
// (payments are kept with the email stamped on them, marketing data is
// scrubbed), then the Polar subscription is cancelled.

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
const { deleteAccount } = require('./utils/account-deletion');
const { withErrorReporting } = require('./utils/error-reporter');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ADMIN_RATE_LIMIT = 10;
const MAX_ACCOUNTS_PER_REQUEST = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDevelopmentErrorDetails(error) {
  if (process.env.NODE_ENV !== 'development' || !error?.message) {
    return {};
  }

  return { details: String(error.message) };
}

async function fetchAllAuthUsers(authAdmin, { perPage = 1000, maxPages = 100 } = {}) {
  const users = [];

  for (let page = 1; page <= maxPages + 1; page += 1) {
    const { data, error } = await authAdmin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const batch = data?.users || [];
    if (page > maxPages) {
      if (batch.length === 0) return users;
      throw new Error('Auth user pagination limit reached');
    }

    users.push(...batch);
    if (batch.length < perPage) return users;
  }

  return users;
}

function validateUserIds(value) {
  if (value === undefined || value === null) return { value: [] };
  if (!Array.isArray(value)) return { error: 'user_ids must be an array' };
  const ids = [...new Set(value.map(id => String(id || '').trim().toLowerCase()))];
  if (ids.some(id => !UUID_PATTERN.test(id))) return { error: 'user_ids must be UUIDs' };
  return { value: ids };
}

const OUTCOME_MESSAGES = {
  deleted: 'Account deleted. Payment records were kept.',
  not_found: 'User not found',
  protected: 'Admin accounts cannot be deleted from the admin portal',
};

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-delete:${clientIp}`, ADMIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    const { user: admin, response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const { parseJsonBody, validateEmailArray, badRequest } = require('./utils/input-validator');
    const { data: requestBody, error: parseError } = parseJsonBody(event.body);
    if (parseError) return badRequest(headers, parseError);

    const reason = String(requestBody.reason || '').trim();
    if (reason.length < 3 || reason.length > 500) {
      return badRequest(headers, 'A reason (3-500 characters) is required');
    }

    const hasEmails = Array.isArray(requestBody.emails) && requestBody.emails.length > 0;
    let emailsToDelete = [];
    if (hasEmails) {
      const { value, error: emailsError } = validateEmailArray(requestBody.emails, { maxItems: MAX_ACCOUNTS_PER_REQUEST });
      if (emailsError) return badRequest(headers, emailsError);
      emailsToDelete = value;
    }

    const { value: userIds, error: idsError } = validateUserIds(requestBody.user_ids);
    if (idsError) return badRequest(headers, idsError);

    if (emailsToDelete.length + userIds.length === 0) {
      return badRequest(headers, 'Provide emails or user_ids');
    }
    if (emailsToDelete.length + userIds.length > MAX_ACCOUNTS_PER_REQUEST) {
      return badRequest(headers, `At most ${MAX_ACCOUNTS_PER_REQUEST} accounts per request`);
    }

    // Resolve emails to auth user IDs (auth emails are unique; profile
    // emails are not).
    const targets = userIds.map(id => ({ label: id, userId: id }));
    if (emailsToDelete.length > 0) {
      let allUsers;
      try {
        allUsers = await fetchAllAuthUsers(supabase.auth.admin);
      } catch (listError) {
        console.error('Error listing users for admin deletion');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to list users',
            ...getDevelopmentErrorDetails(listError),
          }),
        };
      }

      for (const email of emailsToDelete) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const authUser = allUsers.find(u => String(u.email || '').trim().toLowerCase() === normalizedEmail);
        targets.push({ label: email, userId: authUser?.id || null });
      }
    }

    const results = [];
    const errors = [];

    for (const target of targets) {
      if (!target.userId) {
        results.push({ email: target.label, status: 'not_found', message: OUTCOME_MESSAGES.not_found });
        continue;
      }

      try {
        const outcome = await deleteAccount({
          supabase,
          userId: target.userId,
          actor: admin,
          actorType: 'admin',
          reason,
          event,
        });

        if (outcome.ok || outcome.status === 'not_found' || outcome.status === 'protected') {
          results.push({
            email: outcome.email || target.label,
            user_id: target.userId,
            status: outcome.status,
            subscription_cancellation: outcome.subscriptionCancellation,
            message: outcome.status === 'deleted' && outcome.subscriptionCancellation === 'pending'
              ? 'Account deleted. The Polar subscription cancellation failed and will be retried automatically; check Polar.'
              : OUTCOME_MESSAGES[outcome.status] || outcome.message,
          });
        } else {
          errors.push({
            email: outcome.email || target.label,
            user_id: target.userId,
            code: outcome.code,
            error: outcome.message,
          });
        }
      } catch (error) {
        console.error('Unexpected admin account-deletion error');
        errors.push({
          email: target.label,
          user_id: target.userId,
          error: 'Failed to process user deletion',
          ...getDevelopmentErrorDetails(error),
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: errors.length === 0,
        message: `Processed ${targets.length} account(s)`,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'delete-users' });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        ...getDevelopmentErrorDetails(error),
      }),
    };
  }
}

exports.handler = withErrorReporting('delete-users', handler);

exports._private = {
  getDevelopmentErrorDetails,
  fetchAllAuthUsers,
  validateUserIds,
};
