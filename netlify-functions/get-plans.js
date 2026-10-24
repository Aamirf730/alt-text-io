// Netlify Function for Getting Subscription Plans
// File: netlify/functions/get-plans.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Can use anon key for public data
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  const rateLimit = await checkRateLimit(`get-plans:ip:${clientIp}`);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Fetch plans from database
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      // Retired plans stay in the table for legacy profiles and payments.
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch plans' }),
      };
    }

    // Transform plans to include annual pricing and format features
    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: parseFloat(plan.price),
      annual_price: plan.annual_price ? parseFloat(plan.annual_price) : null,
      credits: plan.credits,
      billing_cycle: plan.billing_cycle,
      features: Array.isArray(plan.features) ? plan.features : (plan.features ? JSON.parse(plan.features) : []),
      is_popular: plan.is_popular || false,
      per_credit_cost: plan.per_credit_cost ? parseFloat(plan.per_credit_cost) : null
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ plans: formattedPlans }),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'get-plans', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
