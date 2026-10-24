// Netlify Function for Getting User Usage Statistics
// File: netlify-functions/get-usage.js

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
const {
  recordPluginConnectCompleted,
  getPluginConnectionStatus,
} = require('./utils/plugin-connect-event');
const { extractPluginVersion } = require('./utils/plugin-version');
const { fetchAllRows } = require('./utils/paginated-query');
const { getPlanCredits, getPlanDisplayName } = require('./utils/subscription-plans');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Reads only what the response needs, so the cost no longer grows with an
 * account's lifetime history: an exact count for the lifetime total, this
 * cycle's credit rows (bounded by the cycle's allowance and packs), and the
 * ten most recent generations.
 */
async function loadUsageSummary(client, userId, cycleStart) {
  const cycleStartIso = cycleStart.toISOString();

  const [totalResult, cycleRows, recentResult] = await Promise.all([
    client
      .from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    fetchAllRows(
      (from, to) => client
        .from('usage_logs')
        .select('id,credits_used,created_at')
        .eq('user_id', userId)
        .gte('created_at', cycleStartIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
      { label: 'cycle usage logs' }
    ),
    client
      .from('usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(10),
  ]);

  if (totalResult.error) {
    throw new Error(`Failed to count usage logs: ${totalResult.error.message || totalResult.error}`);
  }
  if (recentResult.error) {
    throw new Error(`Failed to fetch recent usage: ${recentResult.error.message || recentResult.error}`);
  }

  return {
    totalGenerated: Number(totalResult.count || 0),
    creditsUsed: cycleRows.reduce((sum, log) => sum + Number(log.credits_used || 1), 0),
    recentUsage: recentResult.data || [],
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
  const rateLimit = await checkRateLimit(`get-usage:ip:${clientIp}`);
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
    const pluginVersion = extractPluginVersion(event);

    let authUser = null;
    let userId = null;
    let isApiKeyAuth = false;

    // Check if this is an API key (starts with 'alt_' or legacy 'altai_')
    if (token.startsWith('alt_') || token.startsWith('altai_')) {
      isApiKeyAuth = true;

      // Validate through the hash-aware security-definer RPC. Never fall back
      // to querying the legacy plain-text key column.
      const { data: userIdData, error: apiKeyError } = await supabase
        .rpc('validate_api_key', { p_api_key: token });

      if (apiKeyError) {
        console.error('[get-usage] API-key validation service failed');
      }

      if (!apiKeyError && userIdData) {
        userId = userIdData;
      }

      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired API key' }),
        };
      }

      // Get user info using service role
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      authUser = userData.user;
    } else {
      // Legacy: Validate as JWT token (for dashboard)
      const { data: { user: jwtUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !jwtUser) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired token' }),
        };
      }
      authUser = jwtUser;
      userId = jwtUser.id;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId || authUser.id)
      .single();

    if (profileError || !profile) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    if (isApiKeyAuth) {
      await recordPluginConnectCompleted(supabase, {
        userId: authUser.id,
        userEmail: authUser.email,
        endpointName: 'get-usage',
        pluginVersion,
      });
    }

    const pluginConnection = await getPluginConnectionStatus(
      supabase,
      userId || authUser.id,
    );

    const cycleStart = profile.credits_last_renewed_at
      ? new Date(profile.credits_last_renewed_at)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    let usageSummary;
    try {
      usageSummary = await loadUsageSummary(supabase, userId || authUser.id, cycleStart);
    } catch (usageError) {
      console.error('Error fetching usage logs:', usageError.message || usageError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch usage statistics' }),
      };
    }

    const { totalGenerated, creditsUsed, recentUsage } = usageSummary;

    // Get subscription plan details
    const { data: planDetails, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', profile.subscription_plan)
      .single();

    const totalCredits = planDetails?.credits ?? getPlanCredits(profile.subscription_plan);
    const monthlyCreditState = getMonthlyCreditState(
      { ...profile, total_processed: creditsUsed },
      totalCredits
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          // Report the spendable balance for this cycle rather than exposing
          // an aggregate that may include future subscription allowances.
          credits_remaining: monthlyCreditState.monthly_credits_remaining,
          bonus_credits_remaining: monthlyCreditState.bonus_credits_remaining,
          purchased_credits_remaining: monthlyCreditState.purchased_credits_remaining,
          credits_used: creditsUsed,
          total_processed: creditsUsed,
          total_credits: totalCredits,
          monthly_credit_limit: monthlyCreditState.monthly_credit_limit,
          monthly_credits_remaining: monthlyCreditState.monthly_credits_remaining,
          monthly_credits_used: monthlyCreditState.monthly_credits_used,
          // Plan allowance left this cycle, separate from bonus and pack credits.
          plan_credits_remaining: monthlyCreditState.is_monthly_limited
            ? Math.max(0, monthlyCreditState.monthly_credit_limit - Number(monthlyCreditState.monthly_credits_used || 0))
            : null,
          is_monthly_limited: monthlyCreditState.is_monthly_limited,
          total_generated: totalGenerated,
          subscription_plan: profile.subscription_plan || 'free',
          plan_name: getPlanDisplayName(profile.subscription_plan, profile.monthly_credit_allowance),
          subscription_status: profile.subscription_status || 'active',
          billing_cycle: profile.billing_cycle || null,
          monthly_credit_allowance: profile.monthly_credit_allowance || null,
          plugin_connected: pluginConnection.connected,
          plugin_connected_at: pluginConnection.connectedAt,
          plugin_connection_source: pluginConnection.source,
          recent_usage: recentUsage // Last 10 generations
        }
      }),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'get-usage', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

exports._private = {
  loadUsageSummary,
};
