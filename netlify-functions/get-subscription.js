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

    const token = authHeader.replace('Bearer ', '');

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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        subscription_plan,
        credits_remaining,
        total_processed,
        subscription_status,
        subscription_id,
        polar_customer_id,
        next_billing_date,
        created_at,
        updated_at
      `)
      .eq('id', authUser.id)
      .single();

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
          credits_remaining: profile.credits_remaining,
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
