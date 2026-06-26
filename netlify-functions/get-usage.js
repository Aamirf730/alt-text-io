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

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(clientIp);
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

    const token = authHeader.replace('Bearer ', '').trim();

    let authUser = null;
    let userId = null;

    // Check if this is an API key (starts with 'alt_' or legacy 'altai_')
    if (token.startsWith('alt_') || token.startsWith('altai_')) {
      console.log('🔑 [get-usage] Validating API key:', token.substring(0, 20) + '...');

      // First try RPC function
      let userId = null;
      const { data: userIdData, error: apiKeyError } = await supabase
        .rpc('validate_api_key', { p_api_key: token });

      if (apiKeyError) {
        console.error('❌ [get-usage] RPC validate_api_key error:', apiKeyError.message);
      }

      if (!apiKeyError && userIdData) {
        userId = userIdData;
        console.log('✅ [get-usage] RPC validation successful, user_id:', userId);
      } else {
        // Fallback: Direct table query if RPC fails
        console.log('⚠️ [get-usage] RPC failed, trying direct table query...');
        const { data: apiKeyRecord, error: directError } = await supabase
          .from('api_keys')
          .select('user_id')
          .eq('api_key', token)
          .eq('is_active', true)
          .single();

        if (directError) {
          console.error('❌ [get-usage] Direct query error:', directError.message);
        }

        if (apiKeyRecord?.user_id) {
          userId = apiKeyRecord.user_id;
          console.log('✅ [get-usage] Direct query successful, user_id:', userId);
        }
      }

      if (!userId) {
        console.error('❌ [get-usage] API key validation failed completely');
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

    // Get usage statistics
    const { data: usageLogs, error: usageError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', userId || authUser.id)
      .order('created_at', { ascending: false });

    if (usageError) {
      console.error('Error fetching usage logs:', usageError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch usage statistics' }),
      };
    }

    // Calculate statistics
    const totalGenerated = usageLogs ? usageLogs.length : 0;

    // Use total_processed from profile instead of summing all usage_logs
    // This ensures we only show usage from the current plan period
    // (total_processed is reset to 0 when upgrading to a subscription plan)
    const creditsUsed = profile.total_processed || 0;

    // Get subscription plan details
    const { data: planDetails, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', profile.subscription_plan)
      .single();

    const totalCredits = planDetails ? planDetails.credits : 100; // Default to 100 if plan not found

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          credits_remaining: profile.credits_remaining || 0,
          credits_used: creditsUsed,
          total_credits: totalCredits,
          total_generated: totalGenerated,
          subscription_plan: profile.subscription_plan || 'free',
          subscription_status: profile.subscription_status || 'active',
          recent_usage: usageLogs ? usageLogs.slice(0, 10) : [] // Last 10 generations
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