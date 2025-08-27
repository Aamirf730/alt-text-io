// Netlify Function for Getting User Usage Stats
// File: netlify/functions/get-usage.js

const { createClient } = require('@supabase/supabase-js');
const { validateApiKey, getCreditStoreStats } = require('./utils/api-key-validator');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key and get user info
    const user = await validateApiKey(apiKey);
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid API key' }),
      };
    }

    // Return user usage stats
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        current_plan: user.plan,
        credits_remaining: user.credits_remaining,
        total_processed: user.total_processed,
        plan_expires: null, // For now, no expiration
        last_used: user.last_used || null
      }),
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