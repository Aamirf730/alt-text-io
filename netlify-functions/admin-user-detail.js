// Netlify Function: admin user detail
// File: netlify-functions/admin-user-detail.js
//
// GET ?user_id=<uuid>
// Profile, sign-in state, payments, connected sites (plugin_sites), API key
// metadata (never the key), recent audit rows and Polar dashboard links.
// Refunds happen in Polar; this endpoint only links there.

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
const { _private: userListing } = require('./admin-get-users');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILE_COLUMNS = [
  'id', 'email', 'subscription_plan', 'subscription_status', 'billing_cycle',
  'credits_remaining', 'bonus_credits_remaining', 'purchased_credits_remaining',
  'monthly_credit_allowance', 'total_processed', 'subscription_id', 'polar_customer_id',
  'next_billing_date', 'expires_at', 'credits_last_renewed_at', 'blocked_at', 'blocked_reason',
  'marketing_unsubscribed_at', 'created_at', 'updated_at',
].join(',');

/**
 * Polar dashboard links. POLAR_ORGANIZATION_SLUG is the organization slug in
 * the dashboard URL (https://polar.sh/dashboard/<slug>/...). Without it the
 * UI shows the raw IDs.
 */
function buildPolarLinks({ customerId, subscriptionId, orderId }, env = process.env) {
  const slug = String(env.POLAR_ORGANIZATION_SLUG || '').trim();
  if (!slug) return { customer: null, subscription: null, latest_order: null };

  const host = env.POLAR_ENVIRONMENT === 'sandbox' ? 'https://sandbox.polar.sh' : 'https://polar.sh';
  const base = `${host}/dashboard/${encodeURIComponent(slug)}`;
  return {
    customer: customerId ? `${base}/customers/${encodeURIComponent(customerId)}` : null,
    subscription: subscriptionId ? `${base}/sales/subscriptions/${encodeURIComponent(subscriptionId)}` : null,
    latest_order: orderId ? `${base}/sales/${encodeURIComponent(orderId)}` : null,
  };
}

async function optionalRows(promise) {
  const { data, error } = await promise;
  if (error) return { rows: [], unavailable: true };
  return { rows: data || [], unavailable: false };
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'GET') return methodNotAllowedResponse(headers);

  const rateLimit = await checkRateLimit(`admin-user-detail:${getClientIp(event)}`, 60, 60000);
  if (!rateLimit.allowed) return rateLimitExceededResponse(headers, rateLimit);

  try {
    const { user: admin, response } = await authenticateAdmin(event, { supabase, headers });
    if (response) return response;

    const userId = String(event.queryStringParameters?.user_id || '').trim().toLowerCase();
    if (!UUID_PATTERN.test(userId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid user_id is required' }) };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw new Error(`Failed to read profile: ${profileError.message}`);
    if (!profile) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
    }

    const [authResult, payments, sites, apiKeys, audit, usage] = await Promise.all([
      supabase.auth.admin.getUserById(userId).catch(() => ({ data: null, error: true })),
      supabase
        .from('payments')
        .select('id,payment_id,subscription_id,plan_id,product_name,amount,tax_amount,refunded_amount,refunded_tax_amount,currency,status,discount_code,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25),
      optionalRows(supabase
        .from('plugin_sites')
        .select('id,site_url,plugin_version,wp_locale,first_seen_at,last_seen_at,disconnected_at')
        .eq('user_id', userId)
        .order('last_seen_at', { ascending: false })
        .limit(100)),
      supabase
        .from('api_keys')
        .select('id,name,api_key_last4,is_active,created_at,last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('audit_logs')
        .select('id,action,actor_email,details,severity,created_at')
        .eq('resource_type', 'user')
        .eq('resource_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('user_usage_stats')
        .select('total_usage_count,total_credits_used,last_usage_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (payments.error) throw new Error(`Failed to read payments: ${payments.error.message}`);
    if (apiKeys.error) throw new Error(`Failed to read API keys: ${apiKeys.error.message}`);
    if (audit.error) throw new Error(`Failed to read audit rows: ${audit.error.message}`);

    const paymentRows = (payments.data || []).map(payment => ({
      ...payment,
      net_revenue: userListing.getNetPaymentRevenue(payment),
    }));
    const latestOrder = paymentRows.find(payment => payment.payment_id);
    const authUser = authResult?.data?.user || null;

    await recordAdminAction(supabase, {
      actor: admin,
      action: 'admin.user_viewed',
      resourceType: 'user',
      resourceId: userId,
      event,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          profile,
          auth: authUser ? {
            email: authUser.email || null,
            email_confirmed_at: authUser.email_confirmed_at || null,
            last_sign_in_at: authUser.last_sign_in_at || null,
            created_at: authUser.created_at || null,
            providers: authUser.app_metadata?.providers || [],
          } : null,
          usage: usage.data || { total_usage_count: 0, total_credits_used: 0, last_usage_at: null },
          payments: paymentRows,
          plugin_sites: sites.rows,
          plugin_sites_unavailable: sites.unavailable,
          api_keys: apiKeys.data || [],
          audit: audit.data || [],
          polar_links: buildPolarLinks({
            customerId: profile.polar_customer_id,
            subscriptionId: profile.subscription_id,
            orderId: latestOrder?.payment_id || null,
          }),
        },
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-user-detail' });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to load user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

exports.handler = withErrorReporting('admin-user-detail', handler);
exports._private = { buildPolarLinks };
