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
    // Return hardcoded pay-as-you-go pricing plans
    const plans = [
      {
        id: "free_trial",
        name: "Free Trial",
        price: 0,
        credits: 30,
        billing_cycle: "one-time",
        features: ["30 AI-generated alt-texts", "Basic support", "WordPress plugin", "No credit card required"]
      },
      {
        id: "starter_pack",
        name: "Starter Pack",
        price: 5,
        credits: 1000,
        billing_cycle: "one-time",
        features: ["1000 AI alt-texts", "No expiration", "Priority support", "SEO optimization", "Bulk processing"]
      },
      {
        id: "growth_pack",
        name: "Growth Pack",
        price: 10,
        credits: 2500,
        billing_cycle: "one-time",
        features: ["2500 AI alt-texts", "No expiration", "Premium support", "Advanced analytics", "API access"]
      },
      {
        id: "pro_pack",
        name: "Pro Pack",
        price: 20,
        credits: 5000,
        billing_cycle: "one-time",
        features: ["5000 AI alt-texts", "No expiration", "Premium support", "Advanced API access", "Custom integrations"]
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ plans }),
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
