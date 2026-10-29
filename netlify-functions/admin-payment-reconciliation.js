// Netlify Function: unmatched Polar payments queue
// File: netlify-functions/admin-payment-reconciliation.js
//
// GET ?status=open|resolved|ignored&limit=&offset=
// Lists payment_reconciliation rows (default: unresolved). Assigning a row to
// an account is done by the Next route POST /api/admin/reconcile-payment.

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

const STATUSES = new Set(['open', 'resolved', 'ignored']);

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => (current == null ? undefined : current[part]), source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

/**
 * Pull the operator-facing facts out of a stored Polar payload. Polar amounts
 * are integer cents; the SDK payload is camelCase, raw webhooks snake_case.
 */
function summarizePayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const cents = firstValue(data, ['totalAmount', 'total_amount', 'amount', 'netAmount', 'net_amount']);
  const amount = Number.isFinite(Number(cents)) ? Math.round(Number(cents)) / 100 : null;

  return {
    amount,
    currency: String(firstValue(data, ['currency']) || 'usd').toUpperCase(),
    product: firstValue(data, ['product.name', 'productName', 'product_name', 'productId', 'product_id']),
    customer_name: firstValue(data, ['customer.name', 'customerName']),
    raw_summary: {
      id: firstValue(data, ['id']),
      status: firstValue(data, ['status']),
      billing_reason: firstValue(data, ['billingReason', 'billing_reason']),
      product_id: firstValue(data, ['productId', 'product_id', 'product.id']),
      subscription_id: firstValue(data, ['subscriptionId', 'subscription_id']),
      created_at: firstValue(data, ['createdAt', 'created_at']),
      metadata_user_id: firstValue(data, ['metadata.user_id', 'customer.metadata.user_id']),
    },
  };
}

function toRow(row) {
  const summary = summarizePayload(row.payload);
  return {
    id: row.id,
    created_at: row.created_at,
    event_type: row.event_name,
    status: row.status,
    reason: row.reason,
    customer_email: row.customer_email,
    customer_id: row.customer_id,
    subscription_id: row.subscription_id,
    payment_id: row.payment_id,
    candidate_user_id: row.candidate_user_id,
    resolved_user_id: row.resolved_user_id,
    resolved_by: row.resolved_by || null,
    resolved_at: row.resolved_at,
    resolution_notes: row.resolution_notes,
    amount: summary.amount,
    currency: summary.currency,
    product: summary.product,
    customer_name: summary.customer_name,
    raw_summary: summary.raw_summary,
  };
}

/**
 * Rows whose Polar customer or email belonged to an account that was deleted
 * (Polar keeps sending refunds and subscription ends after a deletion). The
 * admin tab warns before such a row is assigned to another account.
 */
async function findDeletedAccountMatches(rows) {
  const emails = [...new Set(rows.map(row => String(row.customer_email || '').trim().toLowerCase()).filter(Boolean))];
  const customerIds = [...new Set(rows.map(row => row.customer_id).filter(Boolean).map(String))];
  const matches = new Map();
  if (emails.length === 0 && customerIds.length === 0) return matches;

  const lookups = [];
  if (emails.length > 0) {
    lookups.push(supabase.from('audit_logs').select('created_at,details').eq('action', 'account.deleted').in('details->>email', emails));
  }
  if (customerIds.length > 0) {
    lookups.push(supabase.from('audit_logs').select('created_at,details').eq('action', 'account.deleted').in('details->>polar_customer_id', customerIds));
  }
  for (const { data, error } of await Promise.all(lookups)) {
    if (error) throw new Error(`Failed to check deleted accounts: ${error.message}`);
    for (const audit of data || []) {
      const email = String(audit.details?.email || '').toLowerCase();
      const customerId = audit.details?.polar_customer_id ? String(audit.details.polar_customer_id) : '';
      if (email) matches.set(`email:${email}`, audit.created_at);
      if (customerId) matches.set(`customer:${customerId}`, audit.created_at);
    }
  }
  return matches;
}

function deletedAccountMatch(row, matches) {
  return matches.get(`customer:${row.customer_id}`)
    || matches.get(`email:${String(row.customer_email || '').trim().toLowerCase()}`)
    || null;
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'GET') return methodNotAllowedResponse(headers);

  const rateLimit = await checkRateLimit(`admin-payment-reconciliation:${getClientIp(event)}`, 30, 60000);
  if (!rateLimit.allowed) return rateLimitExceededResponse(headers, rateLimit);

  try {
    const { response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const params = event.queryStringParameters || {};
    const status = STATUSES.has(String(params.status || 'open')) ? String(params.status || 'open') : 'open';
    const limit = parseInteger(params.limit, 50, 1, 200);
    const offset = parseInteger(params.offset, 0, 0, 100000);

    // A row claimed by a replay that died stays 'processing'; it is still
    // unresolved, and reconcile-payment reclaims it after its claim goes stale.
    const matchingStatuses = status === 'open' ? ['open', 'processing'] : [status];

    const { data, error, count } = await supabase
      .from('payment_reconciliation')
      .select('id,created_at,event_name,status,reason,customer_email,customer_id,subscription_id,payment_id,candidate_user_id,resolved_user_id,resolved_by,resolved_at,resolution_notes,payload', { count: 'exact' })
      .in('status', matchingStatuses)
      .order('created_at', { ascending: status !== 'open' ? false : true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to read payment reconciliation rows: ${error.message}`);
    const deletedMatches = await findDeletedAccountMatches(data || []);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          status,
          total: count ?? (data || []).length,
          limit,
          offset,
          rows: (data || []).map(row => ({
            ...toRow(row),
            from_deleted_account_at: deletedAccountMatch(row, deletedMatches),
          })),
        },
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-payment-reconciliation' });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to load unmatched payments',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

exports.handler = withErrorReporting('admin-payment-reconciliation', handler);
exports._private = { summarizePayload, toRow, deletedAccountMatch };
