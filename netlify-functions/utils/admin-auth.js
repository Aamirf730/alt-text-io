// Shared admin authorization for every admin Netlify function.
//
// An admin is a Supabase user whose email is listed in SUPERUSER_EMAILS AND
// whose email address is confirmed (email_confirmed_at set). Without the
// confirmation check, anyone who registers a listed address on a project that
// allows unconfirmed sign-in would become an admin. The Next.js routes use the
// same rule in frontend-next/src/lib/admin-auth.ts.

const {
  forbiddenResponse,
  getClientIp,
  unauthorizedResponse,
} = require('./cors');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getSuperuserEmails(env = process.env) {
  return String(env.SUPERUSER_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

function isSuperuserEmail(email, env = process.env) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && getSuperuserEmails(env).includes(normalized);
}

/**
 * True only for a confirmed account whose email is a configured superuser.
 */
function isAdminUser(user, env = process.env) {
  if (!user || !user.id) return false;
  if (!user.email_confirmed_at) return false;
  return isSuperuserEmail(user.email, env);
}

function getBearerToken(event) {
  const headers = event?.headers || {};
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader) return null;
  const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function jsonResponse(statusCode, headers, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

/**
 * Resolve the calling admin.
 *
 * Returns { user } on success, otherwise { response } holding the 401/403/500
 * to return unchanged.
 */
async function authenticateAdmin(event, { supabase, headers = {}, env = process.env } = {}) {
  const token = getBearerToken(event);
  if (!token) {
    return { response: unauthorizedResponse(headers, 'Authorization header required') };
  }

  if (!supabase) {
    return { response: jsonResponse(500, headers, { error: 'Server configuration error' }) };
  }

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error) user = data?.user || null;
  } catch (_error) {
    console.error('Admin authentication service error');
    return { response: jsonResponse(503, headers, { error: 'Authentication service unavailable' }) };
  }

  if (!user) {
    return { response: unauthorizedResponse(headers, 'Invalid or expired token') };
  }

  if (!isAdminUser(user, env)) {
    console.warn('Admin access denied');
    return { response: forbiddenResponse(headers, 'Access denied. Superuser privileges required.') };
  }

  return { user };
}

/**
 * Write one audit_logs row for an admin action. Read actions are logged once
 * per deliberate action (opening a user, a lookup), not per list page load.
 *
 * Returns true when the row was written. A failed write is logged but does
 * not throw unless `required` is set, in which case the caller must not go
 * ahead with the action.
 */
async function recordAdminAction(supabase, {
  actor,
  action,
  resourceType = null,
  resourceId = null,
  details = {},
  severity = 'info',
  event = null,
  required = false,
} = {}) {
  const headers = event?.headers || {};
  const row = {
    actor_id: actor?.id || null,
    actor_email: actor?.email ? normalizeEmail(actor.email) : null,
    action,
    resource_type: resourceType,
    resource_id: resourceId === null || resourceId === undefined ? null : String(resourceId),
    details: details || {},
    severity,
    ip_address: event ? getClientIp({ ...event, headers }) : null,
    user_agent: headers['user-agent'] ? String(headers['user-agent']).slice(0, 500) : null,
  };

  try {
    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) throw error;
    return true;
  } catch (_error) {
    console.error('Admin audit log insert failed', { action });
    if (required) {
      throw new Error(`Failed to record audit log for ${action}`);
    }
    return false;
  }
}

module.exports = {
  authenticateAdmin,
  getBearerToken,
  getSuperuserEmails,
  isAdminUser,
  isSuperuserEmail,
  normalizeEmail,
  recordAdminAction,
};
