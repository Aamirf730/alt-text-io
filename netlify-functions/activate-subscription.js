// Netlify Function for PayPal Subscription Activation
// File: netlify-functions/activate-subscription.js
// Following guidance pattern - simpler function to check subscription status after PayPal redirect

const fetch = require('node-fetch');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET;
// Use PAYPAL_ENVIRONMENT (our convention) instead of PAYPAL_ENV
const BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Get PayPal access token
async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get PayPal access token: ${data.error_description || data.error || JSON.stringify(data)}`);
  }
  
  if (!data.access_token) {
    throw new Error('PayPal access token not received in response');
  }
  
  return data.access_token;
}

exports.handler = async (event) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting for payment endpoints
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(`payment:${clientIp}`, 20);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    const { subscriptionId } = JSON.parse(event.body);
    
    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'subscriptionId is required' })
      };
    }
    
    const accessToken = await getAccessToken();
    
    // Get subscription details
    const response = await fetch(
      `${BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const subscription = await response.json();
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: subscription.message || subscription.error_description || 'Failed to get subscription details',
          details: subscription
        })
      };
    }
    
    // Store in your database
    // Update user's subscription status
    // subscription.status should be 'ACTIVE'
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: subscription.status,
        subscription: subscription
      })
    };
    
  } catch (error) {
    console.error('Activation error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      })
    };
  }
};

