// Netlify Function: admin audit log viewer
// File: netlify-functions/admin-audit-log.js
//
// GET ?limit=&offset=&action=&resource_id=&actor=
// Newest first, paged. Viewing the log is not itself logged.

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseAuditQuery(params = {}) {
  const action = String(params.action || '').trim();
  const resourceId = String(params.resource_id || '').trim();
  const actor = String(params.actor || '').trim().toLowerCase();
  return {
    limit: parseInteger(params.limit, 50, 1, 200),
    offset: parseInteger(params.offset, 0, 0, 1000000),
    // Prefix match on dotted action names, e.g. "admin." or "account.deleted".
    action: /^[a-z0-9_.]{1,80}$/i.test(action) ? action : null,
    resourceId: /^[A-Za-z0-9_.:@-]{1,200}$/.test(resourceId) ? resourceId : null,
    actor: /^[^\s,()]{1,200}$/.test(actor) ? actor : null,
  };
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'GET') return methodNotAllowedResponse(headers);

  const rateLimit = await checkRateLimit(`admin-audit-log:${getClientIp(event)}`, 60, 60000);
  if (!rateLimit.allowed) return rateLimitExceededResponse(headers, rateLimit);

  try {
    const { response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const query = parseAuditQuery(event.queryStringParameters || {});
    let request = supabase
      .from('audit_logs')
      .select('id,created_at,action,severity,actor_id,actor_email,resource_type,resource_id,details,ip_address', { count: 'exact' });

    if (query.action) request = request.like('action', `${query.action.replace(/_/g, '\\_')}%`);
    if (query.resourceId) request = request.eq('resource_id', query.resourceId);
    if (query.actor) request = request.eq('actor_email', query.actor);

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw new Error(`Failed to read audit log: ${error.message}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          total: count ?? (data || []).length,
          limit: query.limit,
          offset: query.offset,
          rows: data || [],
        },
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-audit-log' });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to load audit log',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

exports.handler = withErrorReporting('admin-audit-log', handler);
exports._private = { parseAuditQuery };
