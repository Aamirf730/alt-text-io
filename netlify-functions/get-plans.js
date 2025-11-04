// Netlify Function for Getting Subscription Plans
// File: netlify/functions/get-plans.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Can use anon key for public data
const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Fetch plans from database
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
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
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
