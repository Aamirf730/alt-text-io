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

/**
 * True for a usage row paid from the plan allowance. Bonus and credit-pack
 * generations do not count against it; rows logged before
 * usage_logs.credit_source existed are NULL and count as plan usage, matching
 * reserve_credit.
 */
function isPlanCreditRow(row) {
  return !row?.credit_source || row.credit_source === 'plan';
}

function isMissingCreditSourceError(error) {
  return /credit_source/i.test(String(error?.message || error || ''));
}

/**
 * Sum this cycle's usage rows: plan-allowance credits (creditsUsed, used for
 * the monthly allowance) and every generation (imagesProcessed). Before the
 * credit_source column exists every row counts as plan usage.
 */
async function loadCycleUsageRows(client, userId, cycleStart, { label = 'current-cycle usage', ascending = true } = {}) {
  const cycleStartIso = cycleStart.toISOString();
  const buildQuery = (columns) => (from, to) => client
    .from('usage_logs')
    .select(columns)
    .eq('user_id', userId)
    .gte('created_at', cycleStartIso)
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(from, to);

  let rows;
  try {
    rows = await fetchAllRows(buildQuery('credits_used, credit_source, created_at, id'), { label });
  } catch (error) {
    if (!isMissingCreditSourceError(error)) throw error;
    rows = await fetchAllRows(buildQuery('credits_used, created_at, id'), { label });
  }

  return {
    creditsUsed: rows
      .filter(isPlanCreditRow)
      .reduce((sum, log) => sum + Number(log.credits_used || 1), 0),
    imagesProcessed: rows.reduce((sum, log) => sum + Number(log.credits_used || 1), 0),
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
    // creditsUsed is plan-allowance usage only; imagesProcessed counts every
    // generation this cycle.
    const usage = await loadCycleUsageRows(supabase, userId, cycleStart);

    return {
      success: true,
      creditsUsed: usage.creditsUsed,
      imagesProcessed: usage.imagesProcessed,
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

const API_KEY_PROFILE_COLUMNS = 'id, email, credits_remaining, bonus_credits_remaining, purchased_credits_remaining, total_processed, subscription_plan, subscription_status, billing_cycle, monthly_credit_allowance, credits_last_renewed_at, updated_at';
const PROFILE_BLOCK_COLUMNS = 'blocked_at, blocked_reason';

const ACCOUNT_SUSPENDED_MESSAGE = 'This Alt Text Pro account is suspended, so it cannot generate alt text. Contact help@alt-text.pro if you think this is a mistake.';
const AUTH_UNAVAILABLE_RETRY_SECONDS = 30;

// Outcomes of an API-key lookup. Only "invalid" means the key itself is bad;
// "unavailable" is a lookup failure the caller should report as retryable.
const API_KEY_STATUS = Object.freeze({
  VALID: 'valid',
  INVALID: 'invalid',
  SUSPENDED: 'suspended',
  UNAVAILABLE: 'unavailable',
});

/**
 * True when PostgREST rejected the query because the block columns do not
 * exist yet (their migration has not been applied to this database).
 */
function isMissingBlockColumnError(error) {
  if (!error) return false;
  const message = String(error.message || '');
  return error.code === '42703' || error.code === 'PGRST204' || /blocked_(at|reason)/i.test(message);
}

function isAccountBlocked(profile) {
  return Boolean(profile && profile.blocked_at);
}

/**
 * Read one profile with its block state. Before the block columns exist the
 * profile is read without them, so deploying ahead of that migration does not
 * break authentication.
 *
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
async function fetchProfileWithBlockState(userId, columns = API_KEY_PROFILE_COLUMNS, client = supabase) {
  if (!client || !userId) {
    return { data: null, error: { message: 'Supabase credentials or user ID is missing' } };
  }

  const withBlock = await client
    .from('profiles')
    .select(`${columns}, ${PROFILE_BLOCK_COLUMNS}`)
    .eq('id', userId)
    .maybeSingle();

  if (!withBlock.error || !isMissingBlockColumnError(withBlock.error)) {
    return { data: withBlock.data || null, error: withBlock.error || null };
  }

  const withoutBlock = await client
    .from('profiles')
    .select(columns)
    .eq('id', userId)
    .maybeSingle();

  return { data: withoutBlock.data || null, error: withoutBlock.error || null };
}

/**
 * Validate an API key and say why it failed.
 *
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<{ status: string, user?: Object, error?: string }>}
 *   status "valid" (user set), "suspended" (user set, account blocked),
 *   "invalid" (unknown, inactive or orphaned key) or "unavailable" (the
 *   lookup itself failed; retry later).
 */
async function validateApiKeyResult(apiKey) {
  if (!supabase) {
    console.error('❌ [validateApiKey] Supabase credentials not configured');
    return { status: API_KEY_STATUS.UNAVAILABLE, error: 'Supabase credentials not configured' };
  }

  // Validate API key format (accepts both altai_ and alt_ formats)
  if (!apiKey || typeof apiKey !== 'string' || (!apiKey.startsWith('altai_') && !apiKey.startsWith('alt_'))) {
    return { status: API_KEY_STATUS.INVALID };
  }

  try {
    const apiKeyHash = hashApiKey(apiKey);

    // Validate against the one-way hash. The legacy lookup is retained only
    // for rows not yet migrated by an authorized request.
    const hashLookup = await supabase
      .from('api_keys')
      .select('id, user_id, api_key_hash, is_active, created_at')
      .eq('api_key_hash', apiKeyHash)
      .eq('is_active', true)
      .maybeSingle();

    if (hashLookup.error) {
      console.error('[validateApiKey] Hash lookup failed:', hashLookup.error.message);
      return { status: API_KEY_STATUS.UNAVAILABLE, error: 'API key lookup failed' };
    }

    let apiKeyRecord = hashLookup.data;

    if (!apiKeyRecord) {
      const legacyLookup = await supabase
        .from('api_keys')
        .select('id, user_id, api_key, is_active, created_at')
        .eq('api_key', apiKey)
        .eq('is_active', true)
        .maybeSingle();

      if (legacyLookup.error) {
        console.error('[validateApiKey] Legacy lookup failed:', legacyLookup.error.message);
        return { status: API_KEY_STATUS.UNAVAILABLE, error: 'API key lookup failed' };
      }

      apiKeyRecord = legacyLookup.data;

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
      return { status: API_KEY_STATUS.INVALID };
    }

    // Get user profile from profiles table (single source of truth)
    const { data: profile, error: profileError } = await fetchProfileWithBlockState(apiKeyRecord.user_id);

    if (profileError) {
      console.error('[validateApiKey] Profile lookup failed:', profileError.message);
      return { status: API_KEY_STATUS.UNAVAILABLE, error: 'Profile lookup failed' };
    }

    if (!profile) {
      // Do NOT fall back - if profile doesn't exist, the API key is orphaned
      console.error('[validateApiKey] Profile lookup failed: Profile not found');
      return { status: API_KEY_STATUS.INVALID };
    }

    const cycleUsageResult = await getCurrentCycleCreditsUsedResult(profile.id, profile.credits_last_renewed_at);

    const user = {
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
      blocked_at: profile.blocked_at || null,
      created_at: apiKeyRecord.created_at,
      updated_at: profile.updated_at
    };

    if (isAccountBlocked(profile)) {
      return { status: API_KEY_STATUS.SUSPENDED, user };
    }

    return { status: API_KEY_STATUS.VALID, user };
  } catch (error) {
    console.error('[validateApiKey] Unexpected validation error:', error instanceof Error ? error.message : 'Unknown error');
    return { status: API_KEY_STATUS.UNAVAILABLE, error: 'Unexpected validation error' };
  }
}

/**
 * Validate API key and return user information from profiles table.
 * Kept for callers that only need "usable or not": any failure, including
 * a suspended account or a lookup outage, returns null.
 *
 * @param {string} apiKey - The API key to validate
 * @returns {Object|null} - User object if valid, null otherwise
 */
async function validateApiKey(apiKey) {
  const result = await validateApiKeyResult(apiKey);
  return result.status === API_KEY_STATUS.VALID ? result.user : null;
}

/**
 * HTTP response for an API-key result that is not "valid":
 * 403 account_suspended, 503 retryable lookup failure, or 401 invalid key.
 */
function apiKeyFailureResponse(headers, result) {
  if (result?.status === API_KEY_STATUS.SUSPENDED) {
    return accountSuspendedResponse(headers);
  }

  if (result?.status === API_KEY_STATUS.UNAVAILABLE) {
    return {
      statusCode: 503,
      headers: {
        ...headers,
        'Retry-After': String(AUTH_UNAVAILABLE_RETRY_SECONDS),
      },
      body: JSON.stringify({
        success: false,
        code: 'auth_unavailable',
        retryable: true,
        retry_after_seconds: AUTH_UNAVAILABLE_RETRY_SECONDS,
        error: 'Your API key could not be checked right now. Please try again shortly.',
        message: 'Your API key could not be checked right now. Please try again shortly.',
      }),
    };
  }

  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({
      success: false,
      code: 'invalid_api_key',
      error: 'Invalid or expired API key',
    }),
  };
}

function accountSuspendedResponse(headers) {
  return {
    statusCode: 403,
    headers,
    body: JSON.stringify({
      success: false,
      code: 'account_suspended',
      error: 'account_suspended',
      message: ACCOUNT_SUSPENDED_MESSAGE,
    }),
  };
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
  API_KEY_STATUS,
  ACCOUNT_SUSPENDED_MESSAGE,
  validateApiKey,
  validateApiKeyResult,
  apiKeyFailureResponse,
  accountSuspendedResponse,
  fetchProfileWithBlockState,
  isAccountBlocked,
  reserveUserCredit,
  finalizeUserCreditReservation,
  releaseUserCreditReservation,
  getMonthlyCreditState,
  getCurrentCycleCreditsUsed,
  getCurrentCycleCreditsUsedResult,
  loadCycleUsageRows,
  isPlanCreditRow,
  isSupabaseConfigured
};
