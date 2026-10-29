// Netlify Function: admin operator actions on one account
// File: netlify-functions/admin-user-action.js
//
// POST { user_id, action, reason, credits?, idempotency_key? }
//   grant_credits   credits > 0, via admin_adjust_credits -> grant_promotional_credits
//   remove_credits  credits > 0, removes bonus credits (admin_adjust_credits)
//   block           sets profiles.blocked_at / blocked_reason; the generation
//                   API then answers 403 account_suspended
//   unblock         clears both
//   revoke_api_key  deactivates every active key (the plugin disconnects; a
//                   new key is issued when the user next opens the dashboard,
//                   so block the account to keep it out)
//   rotate_api_key  issues a fresh key through issue_api_key (old key stops
//                   working); the admin never sees the key
// Every action writes an audit_logs row naming the operator and the reason.
// There is deliberately no impersonation and no in-app refund (use Polar).

const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { authenticateAdmin, isSuperuserEmail, recordAdminAction } = require('./utils/admin-auth');
const { withErrorReporting } = require('./utils/error-reporter');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set([
  'grant_credits',
  'remove_credits',
  'block',
  'unblock',
  'revoke_api_key',
  'rotate_api_key',
]);
const MAX_CREDIT_ADJUSTMENT = 1000000;

function json(statusCode, headers, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseActionRequest(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch (_error) {
    return { error: 'Invalid JSON body' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid JSON body' };

  const userId = String(body.user_id || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(userId)) return { error: 'A valid user_id is required' };

  const action = String(body.action || '').trim();
  if (!ACTIONS.has(action)) return { error: 'Unsupported action' };

  const reason = String(body.reason || '').trim();
  if (reason.length < 3 || reason.length > 500) return { error: 'A reason (3-500 characters) is required' };

  const request = { userId, action, reason };

  if (action === 'grant_credits' || action === 'remove_credits') {
    const credits = Number(body.credits);
    if (!Number.isInteger(credits) || credits <= 0 || credits > MAX_CREDIT_ADJUSTMENT) {
      return { error: `credits must be a whole number between 1 and ${MAX_CREDIT_ADJUSTMENT}` };
    }
    const key = String(body.idempotency_key || '').trim();
    if (key && !/^[A-Za-z0-9:_-]{8,120}$/.test(key)) return { error: 'Invalid idempotency_key' };
    request.credits = credits;
    // The UI sends one key per form submission so a double click or retry
    // cannot apply the adjustment twice.
    request.idempotencyKey = `admin:${action}:${userId}:${key || crypto.randomUUID()}`;
  }

  return { request };
}

async function adjustCredits(admin, request) {
  const delta = request.action === 'grant_credits' ? request.credits : -request.credits;
  const { data, error } = await supabase.rpc('admin_adjust_credits', {
    p_user_id: request.userId,
    p_delta: delta,
    p_reason: request.reason,
    p_idempotency_key: request.idempotencyKey,
    p_actor_id: admin.id,
    p_actor_email: String(admin.email || '').toLowerCase(),
  });
  if (error) throw new Error(`admin_adjust_credits failed: ${error.message}`);
  if (!data?.success) return { status: 400, body: { error: data?.error || 'Credit adjustment failed' } };
  return { status: 200, body: { success: true, result: data } };
}

async function setBlocked(admin, request, event) {
  const blocked = request.action === 'block';
  const { data, error } = await supabase
    .from('profiles')
    .update({
      blocked_at: blocked ? new Date().toISOString() : null,
      blocked_reason: blocked ? request.reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.userId)
    .select('id,blocked_at,blocked_reason');
  if (error) throw new Error(`Failed to update block state: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) return { status: 404, body: { error: 'User not found' } };

  await recordAdminAction(supabase, {
    actor: admin,
    action: blocked ? 'admin.user_blocked' : 'admin.user_unblocked',
    resourceType: 'user',
    resourceId: request.userId,
    details: { reason: request.reason },
    severity: 'warning',
    event,
  });

  return { status: 200, body: { success: true, result: data[0] } };
}

async function revokeApiKeys(admin, request, event) {
  const { data, error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('user_id', request.userId)
    .eq('is_active', true)
    .select('id,api_key_last4');
  if (error) throw new Error(`Failed to revoke API keys: ${error.message}`);

  await recordAdminAction(supabase, {
    actor: admin,
    action: 'admin.api_key_revoked',
    resourceType: 'user',
    resourceId: request.userId,
    details: { reason: request.reason, revoked_keys: (data || []).map(row => row.api_key_last4 || row.id) },
    severity: 'warning',
    event,
  });

  return { status: 200, body: { success: true, result: { revoked: (data || []).length } } };
}

async function rotateApiKey(admin, request, event) {
  const { encryptApiKey, generateApiKey, hashApiKey } = require('./utils/api-key-secrets');
  let material;
  try {
    const apiKey = generateApiKey();
    material = {
      p_api_key_hash: hashApiKey(apiKey),
      p_api_key_encrypted: encryptApiKey(apiKey),
      p_api_key_last4: apiKey.slice(-4),
    };
  } catch (error) {
    if (error?.code === 'API_KEY_ENCRYPTION_SECRET_MISSING') {
      return { status: 500, body: { error: 'API key encryption is not configured' } };
    }
    throw error;
  }

  const { data, error } = await supabase.rpc('issue_api_key', {
    p_user_id: request.userId,
    ...material,
    p_rotate: true,
  });
  if (error) throw new Error(`issue_api_key failed: ${error.message}`);
  if (!data?.success) return { status: 400, body: { error: data?.error || 'Key rotation failed' } };

  await recordAdminAction(supabase, {
    actor: admin,
    action: 'admin.api_key_rotated',
    resourceType: 'user',
    resourceId: request.userId,
    details: { reason: request.reason, new_key_last4: data.api_key_last4 || null },
    severity: 'warning',
    event,
  });

  return { status: 200, body: { success: true, result: { rotated: true, api_key_last4: data.api_key_last4 || null } } };
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'POST') return methodNotAllowedResponse(headers);

  const rateLimit = await checkRateLimit(`admin-user-action:${getClientIp(event)}`, 20, 60000);
  if (!rateLimit.allowed) return rateLimitExceededResponse(headers, rateLimit);

  try {
    const { user: admin, response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const { request, error: requestError } = parseActionRequest(event.body);
    if (requestError) return json(400, headers, { error: requestError });

    if (request.action === 'block' || request.action === 'remove_credits') {
      const { data: target, error: targetError } = await supabase
        .from('profiles')
        .select('id,email')
        .eq('id', request.userId)
        .maybeSingle();
      if (targetError) throw new Error(`Failed to read target profile: ${targetError.message}`);
      if (!target) return json(404, headers, { error: 'User not found' });
      if (request.action === 'block' && (target.id === admin.id || isSuperuserEmail(target.email))) {
        return json(403, headers, { error: 'Admin accounts cannot be blocked' });
      }
    }

    let outcome;
    switch (request.action) {
      case 'grant_credits':
      case 'remove_credits':
        outcome = await adjustCredits(admin, request);
        break;
      case 'block':
      case 'unblock':
        outcome = await setBlocked(admin, request, event);
        break;
      case 'revoke_api_key':
        outcome = await revokeApiKeys(admin, request, event);
        break;
      case 'rotate_api_key':
        outcome = await rotateApiKey(admin, request, event);
        break;
      default:
        return json(400, headers, { error: 'Unsupported action' });
    }

    return json(outcome.status, headers, outcome.body);
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-user-action' });
    return json(500, headers, {
      error: 'Admin action failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

exports.handler = withErrorReporting('admin-user-action', handler);
exports._private = { parseActionRequest };
