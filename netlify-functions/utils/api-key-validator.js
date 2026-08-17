// Utility module for API key validation
// File: netlify/functions/utils/api-key-validator.js
// 
// IMPORTANT: All credit data is stored in the `profiles` table (single source of truth)
// API keys are stored in the `api_keys` table and linked to profiles via user_id

const { createClient } = require('@supabase/supabase-js');
const { encryptApiKey, hashApiKey } = require('./api-key-secrets');
const { fetchAllRows } = require('./paginated-query');
const {
  DEFAULT_SUBSCRIPTION_PLAN,
  getPlanCredits,
} = require('./subscription-plans');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Supabase credentials not configured');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function getMonthlyCreditState(profile, planCredits = null) {
  const creditsRemaining = Number(profile?.credits_remaining || 0);
  const bonusCreditsRemaining = Number(profile?.bonus_credits_remaining || 0);
  const creditsUsed = Number(profile?.total_processed || 0);
  const purchasedCreditsRemaining = Number(profile?.purchased_credits_remaining || 0);
  const plan = profile?.subscription_plan || profile?.plan || DEFAULT_SUBSCRIPTION_PLAN;
  const explicitAllowance = Number(profile?.monthly_credit_allowance || 0);
  const resolvedPlanCredits = Number(planCredits || 0) || getPlanCredits(plan, 0);
  const monthlyCreditLimit = explicitAllowance > 0 ? explicitAllowance : resolvedPlanCredits;
  const isMonthlyLimited = Boolean(getPlanCredits(plan, 0) && monthlyCreditLimit > 0);
  const monthlyCreditsRemaining = isMonthlyLimited
    ? Math.max(
      0,
      Math.min(
        creditsRemaining,
        Math.max(0, monthlyCreditLimit - creditsUsed)
          + bonusCreditsRemaining
          + purchasedCreditsRemaining
      )
    )
    : creditsRemaining;

  return {
    monthly_credit_limit: monthlyCreditLimit,
    monthly_credits_used: isMonthlyLimited ? creditsUsed : null,
    monthly_credits_remaining: monthlyCreditsRemaining,
    bonus_credits_remaining: bonusCreditsRemaining,
    purchased_credits_remaining: purchasedCreditsRemaining,
    is_monthly_limited: isMonthlyLimited,
  };
}

async function getCurrentCycleCreditsUsedResult(userId, creditsLastRenewedAt = null) {
  if (!supabase || !userId) {
    return { success: false, error: 'Supabase credentials or user ID is missing' };
  }

  const cycleStart = creditsLastRenewedAt
    ? new Date(creditsLastRenewedAt)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  try {
    const usageLogs = await fetchAllRows(
      (from, to) => supabase
        .from('usage_logs')
        .select('credits_used, created_at, id')
        .eq('user_id', userId)
        .gte('created_at', cycleStart.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      { label: 'current-cycle usage' }
    );

    return {
      success: true,
      creditsUsed: usageLogs.reduce((sum, log) => sum + Number(log.credits_used || 1), 0),
    };
  } catch (error) {
    console.error('Failed to calculate current-cycle usage:', error.message || error);
    return {
      success: false,
      error: error.message || 'Current-cycle usage query failed',
    };
  }
}

async function getCurrentCycleCreditsUsed(userId, creditsLastRenewedAt = null) {
  const result = await getCurrentCycleCreditsUsedResult(userId, creditsLastRenewedAt);
  return result.success ? result.creditsUsed : null;
}

function isSupabaseConfigured() {
  return Boolean(supabase);
}

/**
 * Validate API key and return user information from profiles table
 * @param {string} apiKey - The API key to validate
 * @returns {Object|null} - User object if valid, null if invalid
 */
async function validateApiKey(apiKey) {
  if (!supabase) {
    console.error('❌ [validateApiKey] Supabase credentials not configured');
    return null;
  }

  // Validate API key format (accepts both altai_ and alt_ formats)
  if (!apiKey || (!apiKey.startsWith('altai_') && !apiKey.startsWith('alt_'))) {
    return null;
  }

  try {
    const apiKeyHash = hashApiKey(apiKey);

    // Validate against the one-way hash. The legacy lookup is retained only
    // for rows not yet migrated by an authorized request.
    let { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, user_id, api_key_hash, is_active, created_at')
      .eq('api_key_hash', apiKeyHash)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyError) {
      console.error('[validateApiKey] Hash lookup failed:', apiKeyError.message);
    }

    if (!apiKeyRecord) {
      const legacyLookup = await supabase
        .from('api_keys')
        .select('id, user_id, api_key, is_active, created_at')
        .eq('api_key', apiKey)
        .eq('is_active', true)
        .maybeSingle();

      apiKeyRecord = legacyLookup.data;
      apiKeyError = legacyLookup.error;

      if (apiKeyRecord) {
        try {
          const { error: migrationError } = await supabase
            .from('api_keys')
            .update({
              api_key: null,
              api_key_hash: apiKeyHash,
              api_key_encrypted: encryptApiKey(apiKey),
              api_key_last4: apiKey.slice(-4),
            })
            .eq('id', apiKeyRecord.id)
            .eq('user_id', apiKeyRecord.user_id);

          if (migrationError) {
            console.error('[validateApiKey] Legacy key migration failed:', migrationError.message);
          }
        } catch (migrationError) {
          // Validation remains available if a deployment is missing the
          // encryption secret; the next authorized request can retry migration.
          console.error('[validateApiKey] Legacy key encryption failed:', migrationError.message);
        }
      }
    }

    if (!apiKeyRecord) {
      return null;
    }

    // Get user profile from profiles table (single source of truth)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, bonus_credits_remaining, purchased_credits_remaining, total_processed, subscription_plan, subscription_status, billing_cycle, monthly_credit_allowance, credits_last_renewed_at, updated_at')
      .eq('id', apiKeyRecord.user_id)
      .single();

    if (profileError || !profile) {
      console.error('[validateApiKey] Profile lookup failed:', profileError?.message || 'Profile not found');
      // Do NOT fall back - if profile doesn't exist, the API key is orphaned
      return null;
    }

    const cycleUsageResult = await getCurrentCycleCreditsUsedResult(profile.id, profile.credits_last_renewed_at);

    return {
      id: profile.id,
      email: profile.email,
      credits_remaining: profile.credits_remaining ?? 0,
      bonus_credits_remaining: profile.bonus_credits_remaining ?? 0,
      purchased_credits_remaining: profile.purchased_credits_remaining ?? 0,
      total_processed: cycleUsageResult.success
        ? cycleUsageResult.creditsUsed
        : profile.total_processed ?? 0,
      usage_unavailable: !cycleUsageResult.success,
      plan: profile.subscription_plan || 'free',
      billing_cycle: profile.billing_cycle || null,
      monthly_credit_allowance: profile.monthly_credit_allowance ?? null,
      credits_last_renewed_at: profile.credits_last_renewed_at || null,
      subscription_status: profile.subscription_status,
      created_at: apiKeyRecord.created_at,
      updated_at: profile.updated_at
    };

  } catch (error) {
    console.error('[validateApiKey] Unexpected validation error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Check if user has sufficient credits
 * @param {Object} user - User object
 * @param {number} requiredCredits - Number of credits required (default: 1)
 * @returns {boolean} - True if user has sufficient credits
 */
function normalizeCreditRpcResult(rpcResult, operation) {
  if (!rpcResult) {
    console.error(`❌ CRITICAL: ${operation} RPC returned null/undefined`);
    return {
      success: false,
      error: 'Credit system temporarily unavailable. Please contact support.',
      requiresDatabaseFix: true,
    };
  }

  let result = rpcResult;

  if (Array.isArray(result)) {
    if (result.length === 0) {
      console.error(`❌ CRITICAL: ${operation} RPC returned an empty array`);
      return {
        success: false,
        error: 'Credit system temporarily unavailable. Please contact support.',
        requiresDatabaseFix: true,
      };
    }
    result = result[0];
  }

  if (typeof result === 'string') {
    try {
      result = JSON.parse(result);
    } catch (_parseError) {
      console.error(`${operation} RPC returned invalid JSON`);
      return {
        success: false,
        error: 'Invalid credit system response. Please contact support.',
        requiresDatabaseFix: true,
      };
    }
  }

  if (!result || typeof result !== 'object') {
    console.error(`❌ CRITICAL: Unexpected ${operation} RPC result format:`, typeof result);
    return {
      success: false,
      error: 'Invalid credit system response. Please contact support.',
      requiresDatabaseFix: true,
    };
  }

  if (result.error || result.success === false) {
    return {
      success: false,
      error: result.error || `${operation} failed`,
      ...result,
    };
  }

  return {
    success: true,
    ...result,
  };
}

async function callCreditLifecycleRpc(functionName, params) {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase credentials not configured',
      requiresConfiguration: true,
    };
  }

  try {
    const { data, error } = await supabase.rpc(functionName, params);

    if (error) {
      console.error(`${functionName} RPC failed`, { code: error.code || 'unknown' });
      return {
        success: false,
        error: 'Credit system temporarily unavailable. Please contact support if this persists.',
        requiresDatabaseFix: true,
        rpcError: error.message,
      };
    }

    return normalizeCreditRpcResult(data, functionName);
  } catch (_error) {
    console.error(`Unexpected ${functionName} RPC failure`);
    return {
      success: false,
      error: 'Database error during credit operation',
      requiresDatabaseFix: true,
    };
  }
}

/**
 * Reserve one credit before spending money on an external AI request.
 * The reservation is finalized after a successful response or released when
 * generation fails.
 */
async function reserveUserCredit(userId, creditsToReserve = 1) {
  if (!userId) return { success: false, error: 'User ID is required' };

  const result = await callCreditLifecycleRpc('reserve_credit', {
    user_uuid: userId,
    credits_to_reserve: creditsToReserve,
  });

  if (result.success && !result.reservation_id) {
    console.error('❌ CRITICAL: reserve_credit RPC omitted reservation_id');
    return {
      success: false,
      error: 'Invalid credit reservation response. Please contact support.',
      requiresDatabaseFix: true,
    };
  }

  return result;
}

/**
 * Convert a successful AI generation into a durable usage log.
 */
async function finalizeUserCreditReservation(reservationId, altText = null, context = null) {
  if (!reservationId) return { success: false, error: 'Reservation ID is required' };

  return callCreditLifecycleRpc('finalize_credit_reservation', {
    p_reservation_id: reservationId,
    p_alt_text: altText,
    p_context: context,
  });
}

/**
 * Return a reserved credit when the external AI request fails.
 */
async function releaseUserCreditReservation(reservationId) {
  if (!reservationId) return { success: false, error: 'Reservation ID is required' };

  return callCreditLifecycleRpc('release_credit_reservation', {
    p_reservation_id: reservationId,
  });
}

module.exports = {
  validateApiKey,
  reserveUserCredit,
  finalizeUserCreditReservation,
  releaseUserCreditReservation,
  getMonthlyCreditState,
  getCurrentCycleCreditsUsed,
  getCurrentCycleCreditsUsedResult,
  isSupabaseConfigured
};
