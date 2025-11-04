// Utility module for API key validation
// File: netlify/functions/utils/api-key-validator.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Validate API key and return user information
 * @param {string} apiKey - The API key to validate
 * @returns {Object} - User object if valid, null if invalid
 */
async function validateApiKey(apiKey) {
  try {
    // Check if API key format is correct (accepts both altai_ and alt_ formats)
    if (!apiKey || (!apiKey.startsWith('altai_') && !apiKey.startsWith('alt_'))) {
      console.log('API key format invalid:', apiKey ? apiKey.substring(0, 10) + '...' : 'empty');
      return null;
    }

      // Try to find API key in api_keys table (new system)
      try {
        const { data: apiKeyRecord, error: apiKeyError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('api_key', apiKey)
          .eq('is_active', true)
          .single();

        if (!apiKeyError && apiKeyRecord && apiKeyRecord.user_id) {
          console.log('🔑 Found API key in api_keys table, user_id:', apiKeyRecord.user_id);
          
          // Get user profile separately
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', apiKeyRecord.user_id)
            .single();
          
          // If profile not found, try to get from auth.users
          let userEmail = `user_${apiKeyRecord.user_id}@example.com`;
          if (profileError) {
            try {
              const { data: authUser } = await supabase.auth.admin.getUserById(apiKeyRecord.user_id);
              if (authUser?.user?.email) {
                userEmail = authUser.user.email;
              }
            } catch (e) {
              console.log('Could not get user email from auth');
            }
          }
          
          return {
            id: apiKeyRecord.user_id,
            email: profile?.email || userEmail,
            apiKey: apiKeyRecord.api_key,
            credits_remaining: profile?.credits_remaining || 100,
            total_processed: profile?.total_processed || 0,
            plan: profile?.subscription_plan || 'free',
            created_at: apiKeyRecord.created_at,
            updated_at: apiKeyRecord.updated_at
          };
        }

      // Fallback: Try old users table (for backward compatibility)
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('api_key', apiKey)
        .single();

      if (!error && users) {
        console.log('🔑 Found user in users table (legacy)');
        return {
          id: users.id,
          email: users.email,
          apiKey: users.api_key,
          credits_remaining: users.credits_remaining || 100,
          total_processed: users.total_processed || 0,
          plan: users.plan || 'Free Trial',
          created_at: users.created_at,
          updated_at: users.updated_at
        };
      }

      console.log('API key not found in any table');
      return null;
    } catch (error) {
      console.error('API key validation error:', error);
      return null;
    }
    
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

/**
 * Create users table and user if they don't exist
 */
async function createUserAndTable(apiKey) {
  try {
    // First, try to create the users table
    const { error: tableError } = await supabase.rpc('create_users_table_if_not_exists');
    
    if (tableError) {
      console.log('Could not create table via RPC, trying direct SQL');
      // If RPC fails, we'll create the user directly and let Supabase handle the table
    }

    // Create a new user
    const newUser = {
      api_key: apiKey,
      email: `user_${Math.random().toString(36).substring(2, 8)}@example.com`,
      credits_remaining: 100,
      total_processed: 0,
      plan: 'Free Trial',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (createError) {
      console.error('Failed to create user:', createError);
      // Fallback to in-memory storage if Supabase fails
      return createFallbackUser(apiKey);
    }

    console.log('🔑 Created new user in Supabase:', createdUser.email, 'Credits:', createdUser.credits_remaining);
    
    return {
      id: createdUser.id,
      email: createdUser.email,
      apiKey: createdUser.api_key,
      credits_remaining: createdUser.credits_remaining,
      total_processed: createdUser.total_processed,
      plan: createdUser.plan,
      created_at: createdUser.created_at,
      updated_at: createdUser.updated_at
    };

  } catch (error) {
    console.error('Error creating user and table:', error);
    // Fallback to in-memory storage
    return createFallbackUser(apiKey);
  }
}

/**
 * Fallback user creation if Supabase fails
 */
function createFallbackUser(apiKey) {
  console.log('⚠️ Using fallback in-memory user storage');
  return {
    id: `fallback_${Date.now()}`,
    email: `fallback_${Math.random().toString(36).substring(2, 8)}@example.com`,
    apiKey: apiKey,
    credits_remaining: 100,
    total_processed: 0,
    plan: 'Free Trial',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Check if user has sufficient credits
 * @param {Object} user - User object
 * @param {number} requiredCredits - Number of credits required
 * @returns {boolean} - True if user has sufficient credits
 */
function hasSufficientCredits(user, requiredCredits = 1) {
  return user && user.credits_remaining >= requiredCredits;
}

/**
 * Deduct credits from user
 * @param {Object} user - User object
 * @param {number} creditsToDeduct - Number of credits to deduct
 * @returns {Object} - Updated user object
 */
function deductCredits(user, creditsToDeduct = 1) {
  if (!user) return null;
  
  const updatedUser = {
    ...user,
    credits_remaining: Math.max(0, user.credits_remaining - creditsToDeduct),
    total_processed: user.total_processed + 1,
    updated_at: new Date().toISOString()
  };

  return updatedUser;
}

/**
 * Update user credits in Supabase database
 * @param {string} userId - User ID
 * @param {number} newCredits - New credit count
 * @param {number} newTotalProcessed - New total processed count
 */
async function updateUserCredits(userId, newCredits, newTotalProcessed) {
  try {
    // Skip update for fallback users
    if (userId.startsWith('fallback_')) {
      console.log('⚠️ Skipping database update for fallback user');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({
        credits_remaining: newCredits,
        total_processed: newTotalProcessed,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Failed to update user credits in Supabase:', error);
      throw error;
    }

    console.log('✅ Successfully updated user credits in Supabase:', {
      userId,
      newCredits,
      newTotalProcessed
    });

  } catch (error) {
    console.error('❌ Error updating user credits:', error);
    throw error;
  }
}

/**
 * Get all users from Supabase (for debugging)
 */
async function getAllUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch users:', error);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Get credit store statistics (for debugging)
 */
async function getCreditStoreStats() {
  try {
    const users = await getAllUsers();
    
    return {
      total_users: users.length,
      storage_type: 'Supabase Database',
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        credits_remaining: user.credits_remaining,
        total_processed: user.total_processed,
        plan: user.plan,
        created_at: user.created_at,
        updated_at: user.updated_at
      }))
    };
  } catch (error) {
    console.error('Error getting credit store stats:', error);
    return {
      total_users: 0,
      storage_type: 'Error fetching data',
      users: []
    };
  }
}

module.exports = {
  validateApiKey,
  hasSufficientCredits,
  deductCredits,
  updateUserCredits,
  getCreditStoreStats,
  getAllUsers
}; 