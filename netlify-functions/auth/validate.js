// Netlify Function for Validating API Token
// File: netlify-functions/auth/validate.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('../utils/cors');
const { recordPluginConnectCompleted } = require('../utils/plugin-connect-event');
const { getMonthlyCreditState } = require('../utils/api-key-validator');

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseAnonKey) {
  console.error('SUPABASE_ANON_KEY is not set in environment variables');
}

// Client with service role key for database operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting for auth endpoints
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`auth:${clientIp}`, 60);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Get authorization token
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Authorization header required'
        }),
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Validate token format (basic check)
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Authorization token required'
        }),
      };
    }

    let authUser = null;
    let userId = null;

    // Check if this is an API key (starts with 'alt_')
    if (token.startsWith('alt_')) {
      console.log('Validating API key format');

      // Validate API key
      const { data: userIdData, error: apiKeyError } = await supabase
        .rpc('validate_api_key', { p_api_key: token });

      console.log('API key validation result:', { userIdData, apiKeyError, hasUserId: !!userIdData });

      if (apiKeyError) {
        console.error('API key validation RPC error:', apiKeyError);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: `API key validation failed: ${apiKeyError.message || 'Unknown error'}`
          }),
        };
      }

      if (!userIdData) {
        console.error('API key not found or inactive');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid or expired API key'
          }),
        };
      }

      userId = userIdData;
      console.log('Found user ID from API key:', userId);

      // Get user info using service role
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError) {
        console.error('User lookup error:', userError);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: `User lookup failed: ${userError.message}`
          }),
        };
      }

      if (!userData?.user) {
        console.error('User not found for ID:', userId);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User not found'
          }),
        };
      }

      authUser = userData.user;
      console.log('Successfully validated API key for user:', authUser.email);
    } else {
      // Legacy: Validate as JWT token (for backward compatibility)
      // Check if anon key is available
      if (!supabaseAnonKey) {
        console.error('SUPABASE_ANON_KEY is missing');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Server configuration error'
          }),
        };
      }

      try {
        // Try using Supabase REST API to get user info
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          authUser = await response.json();
          userId = authUser.id;
        } else {
          const errorData = await response.json();
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: errorData.message || errorData.error_description || 'Invalid token'
            }),
          };
        }
      } catch (fetchError) {
        console.error('Token validation fetch error:', fetchError);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Token validation failed'
          }),
        };
      }
    }

    if (!authUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        }),
      };
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
        body: JSON.stringify({
          success: false,
          error: 'User profile not found'
        }),
      };
    }

    // Get subscription plan details
    const { data: planDetails, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', profile.subscription_plan)
      .single();

    const monthlyCreditState = getMonthlyCreditState(profile, planDetails?.credits);
    const displayCreditsRemaining = monthlyCreditState.monthly_credits_remaining;

    await recordPluginConnectCompleted(supabase, {
      userId: authUser.id,
      userEmail: authUser.email,
      endpointName: 'auth/validate',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: authUser.id,
            email: authUser.email,
            plan: planDetails ? planDetails.name : 'Free Plan',
            credits_remaining: displayCreditsRemaining,
            monthly_credits_remaining: displayCreditsRemaining,
            subscription_plan: profile.subscription_plan || 'free',
            subscription_status: profile.subscription_status || 'active',
            total_credits: planDetails ? planDetails.credits : 100
          },
          // Also include flat structure for backward compatibility
          user_id: authUser.id,
          email: authUser.email,
          credits_remaining: displayCreditsRemaining,
          monthly_credits_remaining: displayCreditsRemaining,
          subscription_plan: profile.subscription_plan || 'free',
          subscription_status: profile.subscription_status || 'active',
          plan_name: planDetails ? planDetails.name : 'Free Plan',
          total_credits: planDetails ? planDetails.credits : 100
        }
      }),
    };

  } catch (error) {
    const { reportError } = require('../utils/error-reporter');
    reportError(error, { functionName: 'auth/validate', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};
