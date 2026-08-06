// Utility module for API key validation
// File: netlify/functions/utils/api-key-validator.js
// 
// IMPORTANT: All credit data is stored in the `profiles` table (single source of truth)
// API keys are stored in the `api_keys` table and linked to profiles via user_id

const { createClient } = require('@supabase/supabase-js');
const { encryptApiKey, hashApiKey } = require('./api-key-secrets');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Supabase credentials not configured');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const SUBSCRIPTION_PLAN_CREDITS = {
  free: 30,
  tier1: 150,
  tier2: 400,
  tier3: 1000,
  lite: 150,
  standard: 400,
  pro: 1000,
};

function getMonthlyCreditState(profile, planCredits = null) {
  const creditsRemaining = Number(profile?.credits_remaining || 0);
  const bonusCreditsRemaining = Number(profile?.bonus_credits_remaining || 0);
  const creditsUsed = Number(profile?.total_processed || 0);
  const purchasedCreditsRemaining = Number(profile?.purchased_credits_remaining || 0);
  const plan = profile?.subscription_plan || profile?.plan || 'free';
  const explicitAllowance = Number(profile?.monthly_credit_allowance || 0);
  const resolvedPlanCredits = Number(planCredits || 0) || SUBSCRIPTION_PLAN_CREDITS[plan] || 0;
  const monthlyCreditLimit = explicitAllowance > 0 ? explicitAllowance : resolvedPlanCredits;
  const isMonthlyLimited = Boolean(SUBSCRIPTION_PLAN_CREDITS[plan] && monthlyCreditLimit > 0);
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

async function getCurrentCycleCreditsUsed(userId, creditsLastRenewedAt = null) {
  if (!supabase || !userId) return null;

  const cycleStart = creditsLastRenewedAt
    ? new Date(creditsLastRenewedAt)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const { data: usageLogs, error } = await supabase
    .from('usage_logs')
    .select('credits_used, created_at')
    .eq('user_id', userId)
    .gte('created_at', cycleStart.toISOString());

  if (error) {
    console.error('Failed to calculate current-cycle usage:', error.message);
    return null;
  }

  return (usageLogs || []).reduce((sum, log) => sum + Number(log.credits_used || 1), 0);
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
    console.log('❌ [validateApiKey] API key format invalid');
    return null;
  }

  console.log('🔑 [validateApiKey] Validating API key');

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
      console.error('❌ [validateApiKey] Query error:', apiKeyError.message, apiKeyError.details || '');
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
            console.error('⚠️ [validateApiKey] Legacy key migration failed:', migrationError.message);
          }
        } catch (migrationError) {
          // Validation remains available if a deployment is missing the
          // encryption secret; the next authorized request can retry migration.
          console.error('⚠️ [validateApiKey] Legacy key encryption failed:', migrationError.message);
        }
      }
    }

    if (!apiKeyRecord) {
      console.log('❌ [validateApiKey] API key not found or inactive');
      return null;
    }

    console.log('✅ [validateApiKey] Found API key in api_keys table, user_id:', apiKeyRecord.user_id);

    // Get user profile from profiles table (single source of truth)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, bonus_credits_remaining, purchased_credits_remaining, total_processed, subscription_plan, subscription_status, billing_cycle, monthly_credit_allowance, credits_last_renewed_at, updated_at')
      .eq('id', apiKeyRecord.user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found for user_id:', apiKeyRecord.user_id, profileError);
      // Do NOT fall back - if profile doesn't exist, the API key is orphaned
      return null;
    }

    const cycleCreditsUsed = await getCurrentCycleCreditsUsed(profile.id, profile.credits_last_renewed_at);

    return {
      id: profile.id,
      email: profile.email,
      apiKey,
      credits_remaining: profile.credits_remaining ?? 0,
      bonus_credits_remaining: profile.bonus_credits_remaining ?? 0,
      purchased_credits_remaining: profile.purchased_credits_remaining ?? 0,
      total_processed: cycleCreditsUsed ?? profile.total_processed ?? 0,
      plan: profile.subscription_plan || 'free',
      billing_cycle: profile.billing_cycle || null,
      monthly_credit_allowance: profile.monthly_credit_allowance ?? null,
      credits_last_renewed_at: profile.credits_last_renewed_at || null,
      subscription_status: profile.subscription_status,
      created_at: apiKeyRecord.created_at,
      updated_at: profile.updated_at
    };

  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

/**
 * Check if user has sufficient credits
 * @param {Object} user - User object
 * @param {number} requiredCredits - Number of credits required (default: 1)
 * @returns {boolean} - True if user has sufficient credits
 */
function hasSufficientCredits(user, requiredCredits = 1) {
  if (!user) return false;
  const credits = user.credits_remaining ?? 0;
  return credits >= requiredCredits;
}

/**
 * Deduct credits from user (in-memory only - must call updateUserCredits to persist)
 * @param {Object} user - User object
 * @param {number} creditsToDeduct - Number of credits to deduct (default: 1)
 * @returns {Object} - Updated user object with new credit values
 */
function deductCredits(user, creditsToDeduct = 1) {
  if (!user) return null;

  return {
    ...user,
    credits_remaining: Math.max(0, (user.credits_remaining ?? 0) - creditsToDeduct),
    total_processed: (user.total_processed ?? 0) + 1,
    updated_at: new Date().toISOString()
  };
}

/**
 * Update user credits in profiles table (single source of truth)
 * Uses atomic update to prevent race conditions
 * 
 * @param {string} userId - User ID (UUID)
 * @param {number} creditsToDeduct - Number of credits to deduct (default: 1)
 * @param {string} altText - Generated alt text (for logging)
 * @param {string} context - Image context (for logging)
 * @returns {Object} - { success: boolean, credits_remaining: number, total_processed: number, error?: string }
 */
async function updateUserCredits(userId, creditsToDeduct = 1, altText = null, context = null) {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase credentials not configured',
      requiresConfiguration: true
    };
  }

  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    // CRITICAL: Use RPC function for atomic credit deduction
    // The use_credit RPC function uses FOR UPDATE locking to prevent race conditions
    // and performs both profile update and usage log insertion in a single transaction
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('use_credit', {
        user_uuid: userId,
        alt_text: altText,
        context: context
      });

    // Handle RPC errors (function doesn't exist, permission issues, etc.)
    if (rpcError) {
      console.error('❌ CRITICAL: use_credit RPC function error:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });
      return {
        success: false,
        error: 'Credit system temporarily unavailable. Please contact support if this persists.',
        requiresDatabaseFix: true,
        rpcError: rpcError.message
      };
    }

    // Parse RPC result - handle various return formats
    if (!rpcResult) {
      console.error('❌ CRITICAL: use_credit RPC returned null/undefined');
      return {
        success: false,
        error: 'Credit system temporarily unavailable. Please contact support.',
        requiresDatabaseFix: true
      };
    }

    let result = rpcResult;

    // Handle array response (some Supabase versions return arrays)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        console.error('❌ CRITICAL: use_credit RPC returned empty array');
        return {
          success: false,
          error: 'Credit system temporarily unavailable. Please contact support.',
          requiresDatabaseFix: true
        };
      }
      result = result[0];
    }

    // Handle string JSON response
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch (parseError) {
        console.error('❌ CRITICAL: Failed to parse RPC result as JSON:', parseError);
        console.error('Raw RPC result:', rpcResult);
        return {
          success: false,
          error: 'Invalid credit system response. Please contact support.',
          requiresDatabaseFix: true
        };
      }
    }

    // Validate result is an object
    if (!result || typeof result !== 'object') {
      console.error('❌ CRITICAL: Unexpected RPC result format:', typeof result, result);
      return {
        success: false,
        error: 'Invalid credit system response. Please contact support.',
        requiresDatabaseFix: true
      };
    }

    // Check for error in result
    if (result.error) {
      console.error('RPC use_credit returned error:', result.error);
      return {
        success: false,
        error: result.error || 'Credit deduction failed',
        credits_remaining: result.credits_remaining // May be included in error response
      };
    }

    // Check for explicit failure
    if (result.success === false) {
      console.error('RPC use_credit returned failure:', result);
      return {
        success: false,
        error: result.error || 'Credit deduction failed'
      };
    }

    // Validate success response has required fields
    if (result.credits_remaining === undefined || result.total_processed === undefined) {
      console.error('❌ CRITICAL: RPC result missing required fields:', result);
      return {
        success: false,
        error: 'Invalid credit system response. Please contact support.',
        requiresDatabaseFix: true
      };
    }

    // Success case - all validations passed
    console.log('✅ Credits updated atomically via RPC:', {
      userId,
      credits_remaining: result.credits_remaining,
      total_processed: result.total_processed
    });

    return {
      success: true,
      credits_remaining: result.credits_remaining,
      bonus_credits_remaining: result.bonus_credits_remaining,
      purchased_credits_remaining: result.purchased_credits_remaining,
      total_processed: result.total_processed
    };

  } catch (error) {
    console.error('❌ CRITICAL: Unexpected error in updateUserCredits:', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return {
      success: false,
      error: 'Database error during credit deduction',
      requiresDatabaseFix: true
    };
  }
}

/**
 * Get user profile by ID (for debugging/admin)
 * @param {string} userId - User ID
 * @returns {Object|null} - User profile or null
 */
async function getUserProfile(userId) {
  if (!supabase) {
    return null;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to get profile:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
}

/**
 * Get credit statistics (for debugging/admin)
 * @returns {Object} - Statistics about users and credits
 */
async function getCreditStoreStats() {
  if (!supabase) {
    return { error: 'Supabase credentials not configured' };
  }

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, total_processed, subscription_plan, subscription_status')
      .order('total_processed', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to get stats:', error);
      return { error: error.message };
    }

    const totalUsers = profiles?.length ?? 0;
    const totalCredits = profiles?.reduce((sum, p) => sum + (p.credits_remaining ?? 0), 0) ?? 0;
    const totalProcessed = profiles?.reduce((sum, p) => sum + (p.total_processed ?? 0), 0) ?? 0;

    return {
      total_users: totalUsers,
      total_credits_remaining: totalCredits,
      total_processed: totalProcessed,
      storage_type: 'Supabase profiles table',
      sample_users: profiles?.slice(0, 10).map(p => ({
        id: p.id,
        email: p.email,
        credits_remaining: p.credits_remaining,
        total_processed: p.total_processed,
        plan: p.subscription_plan
      }))
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { error: error.message };
  }
}

module.exports = {
  validateApiKey,
  hasSufficientCredits,
  deductCredits,
  updateUserCredits,
  getUserProfile,
  getCreditStoreStats,
  getMonthlyCreditState,
  getCurrentCycleCreditsUsed,
  isSupabaseConfigured
};
