// Utility module for API key validation
// File: netlify/functions/utils/api-key-validator.js
// 
// IMPORTANT: All credit data is stored in the `profiles` table (single source of truth)
// API keys are stored in the `api_keys` table and linked to profiles via user_id

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Supabase credentials not configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Validate API key and return user information from profiles table
 * @param {string} apiKey - The API key to validate
 * @returns {Object|null} - User object if valid, null if invalid
 */
async function validateApiKey(apiKey) {
  // Validate API key format (accepts both altai_ and alt_ formats)
  if (!apiKey || (!apiKey.startsWith('altai_') && !apiKey.startsWith('alt_'))) {
    console.log('API key format invalid:', apiKey ? apiKey.substring(0, 10) + '...' : 'empty');
    return null;
  }

  try {
    // Find API key in api_keys table
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, api_key, is_active, created_at')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (apiKeyError || !apiKeyRecord) {
      console.log('API key not found or inactive:', apiKey.substring(0, 15) + '...');
      return null;
    }

    console.log('🔑 Found API key in api_keys table, user_id:', apiKeyRecord.user_id);

    // Get user profile from profiles table (single source of truth)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, total_processed, subscription_plan, subscription_status, updated_at')
      .eq('id', apiKeyRecord.user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found for user_id:', apiKeyRecord.user_id, profileError);
      // Do NOT fall back - if profile doesn't exist, the API key is orphaned
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      apiKey: apiKeyRecord.api_key,
      credits_remaining: profile.credits_remaining ?? 0,
      total_processed: profile.total_processed ?? 0,
      plan: profile.subscription_plan || 'free',
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
  getCreditStoreStats
};
