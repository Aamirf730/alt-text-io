// Netlify Function to Get User Subscription Details
// File: netlify-functions/get-subscription.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { getMonthlyCreditState } = require('./utils/api-key-validator');
const { fetchAllRows } = require('./utils/paginated-query');
const { createMissingProfile, isMissingProfile } = require('./utils/ensure-profile');
const { getPlanCredits } = require('./utils/subscription-plans');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function getCycleStart(profile, now = new Date()) {
  return profile?.credits_last_renewed_at
    ? new Date(profile.credits_last_renewed_at)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Plan-allowance credits used this cycle. Generations paid from the bonus or
 * credit-pack ledgers do not count against the plan allowance. Rows logged
 * before usage_logs.credit_source existed are NULL and count as plan usage,
 * matching reserve_credit. If the column is not deployed yet, every row this
 * cycle counts (the previous behaviour).
 */
async function loadCyclePlanCreditsUsed(client, userId, cycleStart) {
  const cycleStartIso = cycleStart.toISOString();
  const buildQuery = (columns) => (from, to) => client
    .from('usage_logs')
    .select(columns)
    .eq('user_id', userId)
    .gte('created_at', cycleStartIso)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  let rows;
  try {
    rows = await fetchAllRows(buildQuery('id,credits_used,credit_source'), { label: 'cycle plan usage' });
  } catch (error) {
    if (!/credit_source/i.test(String(error?.message || ''))) throw error;
    rows = await fetchAllRows(buildQuery('id,credits_used'), { label: 'cycle usage' });
  }

  return rows
    .filter((row) => !row.credit_source || row.credit_source === 'plan')
    .reduce((sum, row) => sum + Number(row.credits_used || 1), 0);
}

/**
 * Credits reported the same way get-usage reports them: the plan allowance
 * left this cycle plus the bonus and purchased (pack) ledgers.
 */
function buildSubscriptionCredits(profile, planCredits, planCreditsUsed) {
  const totalCredits = planCredits ?? getPlanCredits(profile?.subscription_plan);
  const state = getMonthlyCreditState(
    { ...profile, total_processed: planCreditsUsed },
    totalCredits
  );

  return {
    credits_remaining: state.monthly_credits_remaining,
    monthly_credits_remaining: state.monthly_credits_remaining,
    monthly_credit_limit: state.monthly_credit_limit,
    monthly_credits_used: state.monthly_credits_used,
    plan_credits_remaining: state.is_monthly_limited
      ? Math.max(0, state.monthly_credit_limit - Number(state.monthly_credits_used || 0))
      : null,
    bonus_credits_remaining: state.bonus_credits_remaining,
    purchased_credits_remaining: state.purchased_credits_remaining,
    is_monthly_limited: state.is_monthly_limited,
  };
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

  // Rate limiting
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`get-subscription:ip:${clientIp}`);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Get authorization token
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Verify user authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Get user profile with subscription details
    const fetchProfile = () => supabase
      .from('profiles')
      .select(`
        subscription_plan,
        credits_remaining,
        bonus_credits_remaining,
        purchased_credits_remaining,
        credits_last_renewed_at,
        total_processed,
        subscription_status,
        subscription_id,
        polar_customer_id,
        next_billing_date,
        billing_cycle,
        monthly_credit_allowance,
        created_at,
        updated_at
      `)
      .eq('id', authUser.id)
      .single();
    let { data: profile, error: profileError } = await fetchProfile();

    if (isMissingProfile(profile, profileError) && await createMissingProfile(supabase, authUser)) {
      ({ data: profile, error: profileError } = await fetchProfile());
    }

    if (profileError || !profile) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    // Get subscription plan details
    const { data: planDetails, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', profile.subscription_plan)
      .single();

    if (planError) {
      console.error('Plan details error:', planError);
    }

    let planCreditsUsed;
    try {
      planCreditsUsed = await loadCyclePlanCreditsUsed(supabase, authUser.id, getCycleStart(profile));
    } catch (usageError) {
      console.error('Error fetching cycle usage:', usageError.message || usageError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch usage statistics' }),
      };
    }

    const credits = buildSubscriptionCredits(profile, planDetails?.credits, planCreditsUsed);

    // Get recent payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (paymentsError) {
      console.error('Payments error:', paymentsError);
    }

    // Get usage history
    const { data: usageHistory, error: usageError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (usageError) {
      console.error('Usage history error:', usageError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        user: {
          id: authUser.id,
          email: authUser.email
        },
        subscription: {
          plan: profile.subscription_plan,
          status: profile.subscription_status,
          subscription_id: profile.subscription_id,
          polar_customer_id: profile.polar_customer_id,
          next_billing_date: profile.next_billing_date,
          billing_cycle: profile.billing_cycle,
          monthly_credit_allowance: profile.monthly_credit_allowance,
          // past_due: a renewal charge failed and Polar is retrying it.
          // The plan stays until Polar sends active (recovered) or revoked.
          is_past_due: profile.subscription_status === 'past_due',
          ...credits,
          total_processed: profile.total_processed,
          created_at: profile.created_at,
          updated_at: profile.updated_at
        },
        plan_details: planDetails || null,
        recent_payments: payments || [],
        usage_history: usageHistory || []
      }),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'get-subscription', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

exports._private = {
  buildSubscriptionCredits,
  getCycleStart,
  loadCyclePlanCreditsUsed,
};
