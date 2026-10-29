// Netlify Function: admin Users tab
// File: netlify-functions/admin-get-users.js
//
// GET ?q=&plan=&status=&limit=&offset=&stats=1
//
// Search, filtering, paging and the per-user aggregates (net revenue, usage,
// connected sites) run in SQL (public.admin_list_users), so the function no
// longer loads every profile, payment and usage row. q matches email, user
// ID, Polar customer ID, Polar subscription ID and connected site URL.
// Plugin versions come from public.plugin_sites (written by the plugin API),
// not from client-reported connect_completed events.

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { authenticateAdmin, recordAdminAction } = require('./utils/admin-auth');
const { withErrorReporting } = require('./utils/error-reporter');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ADMIN_RATE_LIMIT = 60;
const ALLOWED_PLANS = new Set(['all', 'free', 'tier1', 'tier2', 'tier3', 'tier4', 'pay_as_go', 'small_pack', 'credit_pack', 'bulk_pack']);
const ALLOWED_STATUSES = new Set(['all', 'active', 'past_due', 'cancelled', 'expired', 'pending']);

const REVENUE_STATUSES = new Set(['completed', 'partially_refunded', 'refunded']);
const PAID_SUBSCRIPTION_PLANS = new Set(['tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency']);
// past_due: a renewal charge failed and Polar is retrying; still a subscriber.
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due', 'cancelled', 'canceled']);

function toAmount(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Revenue a payment row contributes, net of tax and refunds:
 *   net = amount - tax_amount - refunded_amount
 * amount is the gross Polar order total (tax included) and tax_amount its
 * tax. refunded_amount is pre-tax, like Polar's order refundedAmount (the
 * refunded tax is stored separately in refunded_tax_amount, see
 * record_payment_refund in 20261029110000), so it comes straight off the
 * pre-tax net. Older fully refunded rows have no stored refund amount, so
 * their status alone makes them zero. public.payment_net_revenue implements
 * the same rule in SQL.
 */
function getNetPaymentRevenue(payment) {
  const status = String(payment?.status || '');
  if (!REVENUE_STATUSES.has(status)) return 0;

  const hasRefundAmount = payment?.refunded_amount !== null && payment?.refunded_amount !== undefined;
  if (status === 'refunded' && !hasRefundAmount) return 0;

  const net = toAmount(payment.amount)
    - toAmount(payment.tax_amount)
    - toAmount(payment.refunded_amount);

  return Math.max(0, Math.round(net * 100) / 100);
}

function isPayingSubscriber(profile) {
  return PAID_SUBSCRIPTION_PLANS.has(String(profile?.subscription_plan || '').toLowerCase())
    && LIVE_SUBSCRIPTION_STATUSES.has(String(profile?.subscription_status || '').toLowerCase());
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseListQuery(params = {}) {
  const q = String(params.q || '').trim().slice(0, 200);
  const plan = ALLOWED_PLANS.has(String(params.plan || 'all')) ? String(params.plan || 'all') : 'all';
  const status = ALLOWED_STATUSES.has(String(params.status || 'all')) ? String(params.status || 'all') : 'all';
  return {
    q,
    plan,
    status,
    limit: parseInteger(params.limit, 50, 1, 200),
    offset: parseInteger(params.offset, 0, 0, 1000000),
    includeStats: !['0', 'false', 'no'].includes(String(params.stats ?? '1').toLowerCase()),
  };
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);

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
  const rateLimit = await checkRateLimit(`admin:${clientIp}`, ADMIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    console.warn('Admin endpoint request quota exceeded');
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  try {
    const { user: admin, response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const query = parseListQuery(event.queryStringParameters || {});

    const [listResult, statsResult] = await Promise.all([
      supabase.rpc('admin_list_users', {
        p_search: query.q || null,
        p_plan: query.plan,
        p_status: query.status,
        p_limit: query.limit,
        p_offset: query.offset,
      }),
      query.includeStats ? supabase.rpc('admin_dashboard_stats') : Promise.resolve({ data: null, error: null }),
    ]);

    if (listResult.error) {
      throw new Error(`admin_list_users failed: ${listResult.error.message}`);
    }
    if (statsResult.error) {
      throw new Error(`admin_dashboard_stats failed: ${statsResult.error.message}`);
    }

    // A lookup is a deliberate admin read; log it once (first page only).
    if (query.q && query.offset === 0) {
      await recordAdminAction(supabase, {
        actor: admin,
        action: 'admin.user_lookup',
        resourceType: 'user',
        details: { query: query.q, plan: query.plan, status: query.status, matches: listResult.data?.total ?? null },
        event,
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          users: listResult.data?.users || [],
          total: Number(listResult.data?.total || 0),
          limit: query.limit,
          offset: query.offset,
          stats: statsResult.data || null,
        },
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-get-users' });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

exports.handler = withErrorReporting('admin-get-users', handler);

exports._private = {
  getNetPaymentRevenue,
  isPayingSubscriber,
  parseListQuery,
};
