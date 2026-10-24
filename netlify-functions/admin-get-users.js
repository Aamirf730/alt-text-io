// Netlify Function for Admin to Get All Users
// File: netlify-functions/admin-get-users.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { getEventPluginVersion } = require('./utils/plugin-version');
const { fetchAllRows } = require('./utils/paginated-query');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Superuser emails (comma-separated list from environment variable)
const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);

// Stricter rate limit for admin endpoints (30 requests per minute)
const ADMIN_RATE_LIMIT = 30;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildLatestPluginEventMaps(events = []) {
  const byUserId = new Map();
  const byEmail = new Map();

  for (const event of events) {
    if (event?.user_id && !byUserId.has(event.user_id)) {
      byUserId.set(event.user_id, event);
    }

    const email = normalizeEmail(event?.user_email);
    if (email && !byEmail.has(email)) {
      byEmail.set(email, event);
    }
  }

  return { byUserId, byEmail };
}

const REVENUE_STATUSES = new Set(['completed', 'partially_refunded', 'refunded']);
const PAID_SUBSCRIPTION_PLANS = new Set(['tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency']);
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'cancelled', 'canceled']);

function toAmount(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Revenue a payment row contributes, net of tax and refunds. amount is the
 * gross Polar order total (tax included). Older fully refunded rows have no
 * stored refund amount, so their status alone makes them zero.
 */
function getNetPaymentRevenue(payment) {
  const status = String(payment?.status || '');
  if (!REVENUE_STATUSES.has(status)) return 0;

  const hasRefundAmount = payment?.refunded_amount !== null && payment?.refunded_amount !== undefined;
  if (status === 'refunded' && !hasRefundAmount) return 0;

  const net = toAmount(payment.amount)
    - toAmount(payment.tax_amount)
    - (toAmount(payment.refunded_amount) - toAmount(payment.refunded_tax_amount));

  return Math.max(0, Math.round(net * 100) / 100);
}

function isPayingSubscriber(profile) {
  return PAID_SUBSCRIPTION_PLANS.has(String(profile?.subscription_plan || '').toLowerCase())
    && LIVE_SUBSCRIPTION_STATUSES.has(String(profile?.subscription_status || '').toLowerCase());
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Rate limiting for admin endpoint (stricter)
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
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('CRITICAL: Supabase configuration missing!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server configuration error',
          details: 'Supabase credentials not configured'
        }),
      };
    }

    // Get authorization token
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader) {
      console.error('ERROR: No authorization header');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Validate JWT token and get user
    let user = null;
    let authError = null;

    try {
      const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser(token);
      user = authUser;
      authError = getUserError;

      if (authError) {
        console.error('Admin authentication failed');
      }
    } catch (err) {
      console.error('Admin authentication service error');
      authError = err;
    }

    if (authError || !user) {
      console.error('Authentication failed');
      return {
        statusCode: 401,
        headers,
      body: JSON.stringify({
          error: 'Invalid or expired token'
        }),
      };
    }

    // Check if user is a superuser
    if (!SUPERUSER_EMAILS.includes(normalizeEmail(user.email))) {
      console.error('Access denied - user is not a superuser');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'Access denied. Superuser privileges required.'
        }),
      };
    }

    // Get all profiles with related data
    let profiles = [];
    let profilesError = null;

    try {
      profiles = await fetchAllRows(
        (from, to) => supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
        { label: 'admin profiles' }
      );
    } catch (err) {
      console.error('Admin profile query raised an exception');
      profilesError = err;
    }

    if (profilesError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to fetch user profiles'
        }),
      };
    }

    // Get all payments for all users
    let payments = [];
    let paymentsError = null;

    try {
      payments = await fetchAllRows(
        (from, to) => supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
        { label: 'admin payments' }
      );
    } catch (err) {
      console.error('Admin payment query raised an exception');
      paymentsError = err;
    }

    // Get usage statistics for all users from the aggregated view
    let usageStats = [];
    let usageError = null;

    try {
      usageStats = await fetchAllRows(
        (from, to) => supabase
          .from('user_usage_stats')
          .select('*')
          .order('user_id', { ascending: true })
          .range(from, to),
        { label: 'admin usage statistics' }
      );
    } catch (err) {
      console.error('Admin usage query raised an exception');
      usageError = err;
    }

    let pluginEvents = [];
    let pluginEventsError = null;

    try {
      pluginEvents = await fetchAllRows(
        (from, to) => supabase
          .from('marketing_events')
          .select('id,user_id,user_email,source,occurred_at,created_at,properties')
          .eq('event_name', 'connect_completed')
          .in('source', ['wordpress_plugin_auth', 'wordpress_connect'])
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
        { label: 'admin plugin events' }
      );
    } catch (err) {
      console.error('Admin plugin-event query raised an exception');
      pluginEventsError = err;
    }

    if (paymentsError || usageError || pluginEventsError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to fetch admin data'
        }),
      };
    }

    const latestPluginEvents = buildLatestPluginEventMaps(pluginEvents);

    // Enrich profiles with additional data
    const enrichedProfiles = profiles.map(profile => {
      // Get payments for this user
      const userPayments = payments?.filter(p => p.user_id === profile.id) || [];
      // Net of tax and refunds (partial refunds included).
      const totalPaid = Math.round(
        userPayments.reduce((sum, p) => sum + getNetPaymentRevenue(p), 0) * 100
      ) / 100;

      // Get usage stats for this user
      const userUsage = usageStats?.find(u => u.user_id === profile.id) || {};
      const totalUsageCount = parseInt(userUsage.total_usage_count || 0);
      const totalCreditsUsed = parseInt(userUsage.total_credits_used || 0);
      const pluginEvent = latestPluginEvents.byUserId.get(profile.id)
        || latestPluginEvents.byEmail.get(normalizeEmail(profile.email))
        || null;

      // Get latest payment
      const latestPayment = userPayments.length > 0
        ? userPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;

      return {
        ...profile,
        total_paid: totalPaid,
        total_usage_count: totalUsageCount,
        total_credits_used: totalCreditsUsed,
        latest_plugin_version: getEventPluginVersion(pluginEvent),
        plugin_connected_at: pluginEvent?.occurred_at || pluginEvent?.created_at || null,
        plugin_connection_source: pluginEvent?.source || null,
        payment_count: userPayments.length,
        latest_payment: latestPayment ? {
          amount: latestPayment.amount,
          status: latestPayment.status,
          created_at: latestPayment.created_at,
          plan_id: latestPayment.plan_id,
          product_name: latestPayment.product_name,
          discount_code: latestPayment.discount_code,
          discount_name: latestPayment.discount_name,
          discount_amount: latestPayment.discount_amount
        } : null
      };
    });

    const response = {
      success: true,
      data: {
        users: enrichedProfiles,
        total_users: enrichedProfiles.length,
        stats: {
          total_revenue: Math.round(enrichedProfiles.reduce((sum, p) => sum + (p.total_paid || 0), 0) * 100) / 100,
          // Every Free profile is "active", so count running paid subscriptions.
          active_users: enrichedProfiles.filter(isPayingSubscriber).length,
          total_credits_used: enrichedProfiles.reduce((sum, p) => sum + (p.total_credits_used || 0), 0),
          total_credits_remaining: enrichedProfiles.reduce((sum, p) => sum + (p.credits_remaining || 0), 0),
        }
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-get-users' });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};

exports._private = {
  getNetPaymentRevenue,
  isPayingSubscriber,
};
