// Netlify Function for PayPal Payment Completion
// File: netlify-functions/complete-payment.js

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

// Capture PayPal payment
async function capturePayPalPayment(paymentId) {
  const accessToken = await getPayPalAccessToken();
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paymentId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return await response.json();
}

// Get PayPal subscription details
async function getPayPalSubscription(subscriptionId) {
  const accessToken = await getPayPalAccessToken();
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return await response.json();
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
    const { paymentId, planId, isSubscription = false } = JSON.parse(event.body);
    if (!paymentId || !planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'paymentId and planId are required' }),
      };
    }

    let paymentResult;
    let amount = 0;

    if (isSubscription) {
      // Handle subscription
      paymentResult = await getPayPalSubscription(paymentId);
      
      if (paymentResult.status !== 'ACTIVE') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Subscription not active' }),
        };
      }

      // Get plan details for amount
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('price')
        .eq('id', planId)
        .single();
      
      amount = plan ? plan.price : 0;
    } else {
      // Handle one-time payment
      paymentResult = await capturePayPalPayment(paymentId);
      
      if (paymentResult.status !== 'COMPLETED') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Payment not completed' }),
        };
      }

      // Extract amount from PayPal response
      if (paymentResult.purchase_units && paymentResult.purchase_units[0]) {
        amount = parseFloat(paymentResult.purchase_units[0].amount.value);
      }
    }

    // Update user subscription using the database function
    const { data: upgradeResult, error: upgradeError } = await supabase
      .rpc('upgrade_subscription', {
        user_uuid: authUser.id,
        new_plan: planId,
        payment_id: paymentId,
        subscription_id: isSubscription ? paymentId : null
      });

    if (upgradeError) {
      console.error('Subscription upgrade error:', upgradeError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to upgrade subscription' }),
      };
    }

    // Update payment record
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        amount: amount,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentId)
      .eq('user_id', authUser.id);

    if (paymentUpdateError) {
      console.error('Payment update error:', paymentUpdateError);
    }

    // Get updated user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan, credits_remaining, subscription_status, next_billing_date')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: paymentId,
        plan: profile?.subscription_plan,
        credits_remaining: profile?.credits_remaining,
        subscription_status: profile?.subscription_status,
        next_billing_date: profile?.next_billing_date
      }),
    };

  } catch (error) {
    console.error('Payment completion error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
