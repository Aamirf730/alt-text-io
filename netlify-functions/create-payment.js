// Netlify Function for PayPal Payment Creation
// File: netlify-functions/create-payment.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = 'https://api-m.paypal.com'; // Production PayPal API

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// Create PayPal payment
async function createPayPalPayment(planId, returnUrl, cancelUrl) {
  const accessToken = await getPayPalAccessToken();
  
  // Get plan details from Supabase
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    throw new Error('Invalid plan');
  }

  // Skip free plan
  if (plan.price === 0) {
    throw new Error('Free plan does not require payment');
  }

  // Create one-time payment for all plans (simplified approach)
  const paymentData = {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: `ALTTEXT_${planId}_${Date.now()}`,
      amount: {
        currency_code: "USD",
        value: plan.price.toString()
      },
      description: `${plan.name} - ${plan.credits} Credits`
    }],
    application_context: {
      brand_name: "Alt Text Pro",
      landing_page: "NO_PREFERENCE",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `ALTTEXT_${Date.now()}`
    },
    body: JSON.stringify(paymentData)
  });

  const result = await response.json();
  
  // Log the response for debugging
  console.log('PayPal API Response:', JSON.stringify(result, null, 2));
  
  return result;
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
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

    // Parse request body
    const { planId } = JSON.parse(event.body);
    if (!planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'planId is required' }),
      };
    }

    // Create return and cancel URLs
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://www.alt-text.pro' 
      : 'http://localhost:3000';
    
    const returnUrl = `${baseUrl}/payment-success?plan=${planId}`;
    const cancelUrl = `${baseUrl}/payment-cancelled`;

    // Create PayPal payment
    const paymentResult = await createPayPalPayment(planId, returnUrl, cancelUrl);

    if (paymentResult.error || !paymentResult.id) {
      console.error('PayPal payment creation failed:', paymentResult);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Payment creation failed',
          details: paymentResult.error || 'Unknown error'
        }),
      };
    }

    // Store payment record in database
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: authUser.id,
        payment_id: paymentResult.id,
        subscription_id: paymentResult.id, // For subscriptions, this is the subscription ID
        plan_id: planId,
        amount: 0, // Will be updated after successful payment
        status: 'pending'
      });

    if (paymentError) {
      console.error('Error storing payment record:', paymentError);
    }

    // Extract approval URL
    let approvalUrl = null;
    if (paymentResult.links) {
      const approvalLink = paymentResult.links.find(link => link.rel === 'approve');
      approvalUrl = approvalLink ? approvalLink.href : null;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paymentId: paymentResult.id,
        approvalUrl: approvalUrl,
        status: paymentResult.status
      }),
    };

  } catch (error) {
    console.error('Payment creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
