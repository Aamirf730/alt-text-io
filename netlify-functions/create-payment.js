// Netlify Function for PayPal Payment Creation
// File: netlify-functions/create-payment.js
// Supports both one-time payments and subscriptions

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
// Use sandbox if PAYPAL_ENVIRONMENT is set to 'sandbox', otherwise use production
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

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

// Get PayPal Plan ID (from environment variable or create if needed)
async function getPayPalPlanId(planId, planDetails, accessToken) {
  // First, check if we have a pre-created plan ID in environment variables
  const envPlanId = process.env[`PAYPAL_PLAN_${planId.toUpperCase()}`];
  if (envPlanId) {
    console.log(`Using pre-created PayPal plan for ${planId}: ${envPlanId}`);
    return envPlanId;
  }

  // If no pre-created plan, try to create one (requires PAYPAL_PRODUCT_ID)
  const productId = process.env.PAYPAL_PRODUCT_ID;
  if (!productId) {
    throw new Error(`PayPal Plan ID for ${planId} not found in environment variables. Please create the plan in PayPal Dashboard and add PAYPAL_PLAN_${planId.toUpperCase()} to Netlify environment variables, or set PAYPAL_PRODUCT_ID to create plans automatically.`);
  }

  console.log(`Creating PayPal plan for ${planId}...`);
  const planName = `Alt Text Pro - ${planDetails.name}`;
  const planDescription = `${planDetails.credits} credits per month`;
  
  // Create a billing plan
  const billingPlan = {
    product_id: productId,
    name: planName,
    description: planDescription,
    billing_cycles: [{
      frequency: {
        interval_unit: 'MONTH',
        interval_count: 1
      },
      tenure_type: 'REGULAR',
      sequence: 1,
      pricing_scheme: {
        fixed_price: {
          value: planDetails.price.toString(),
          currency_code: 'USD'
        }
      },
      total_cycles: 0 // 0 = infinite
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: planDetails.price.toString(),
        currency_code: 'USD'
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    },
    taxes: {
      percentage: '0',
      inclusive: false
    }
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `PLAN_${planId}_${Date.now()}`
    },
    body: JSON.stringify(billingPlan)
  });

  const result = await response.json();
  
  if (response.ok && result.id) {
    console.log(`✅ Created PayPal plan for ${planId}: ${result.id}`);
    console.log(`⚠️ Add this to Netlify environment variables: PAYPAL_PLAN_${planId.toUpperCase()}=${result.id}`);
    return result.id; // Return the PayPal plan ID
  } else {
    console.error('Error creating PayPal plan:', result);
    throw new Error(`Failed to create PayPal subscription plan: ${result.message || JSON.stringify(result)}`);
  }
}

// Create PayPal subscription
async function createPayPalSubscription(planId, planDetails, returnUrl, cancelUrl, accessToken) {
  // First, get the PayPal billing plan ID (from env or create)
  const paypalPlanId = await getPayPalPlanId(planId, planDetails, accessToken);
  
  // Create subscription
  const subscriptionData = {
    plan_id: paypalPlanId,
    start_time: new Date(Date.now() + 60000).toISOString(), // Start 1 minute from now
    subscriber: {
      name: {
        given_name: 'Customer',
        surname: 'Alt Text Pro'
      }
    },
    application_context: {
      brand_name: 'Alt Text Pro',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
      },
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `SUB_${planId}_${Date.now()}`
    },
    body: JSON.stringify(subscriptionData)
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('PayPal subscription creation failed:', result);
    throw new Error(result.message || 'Failed to create subscription');
  }

  return result;
}

// Create one-time PayPal payment
async function createPayPalOneTimePayment(planId, planDetails, returnUrl, cancelUrl, accessToken) {
  const paymentData = {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: `ALTTEXT_${planId}_${Date.now()}`,
      amount: {
        currency_code: "USD",
        value: planDetails.price.toString()
      },
      description: `${planDetails.name} - ${planDetails.credits} Credits (One-time)`
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
  
  if (!response.ok) {
    console.error('PayPal payment creation failed:', result);
    throw new Error(result.message || 'Failed to create payment');
  }

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

    // Get plan details from Supabase
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan' }),
      };
    }

    // Skip free plan
    if (plan.price === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Free plan does not require payment' }),
      };
    }

    // Create return and cancel URLs
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://www.alt-text.pro' 
      : 'http://localhost:3000';
    
    const returnUrl = `${baseUrl}/payment-success?plan=${planId}`;
    const cancelUrl = `${baseUrl}/payment-cancelled`;

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    let paymentResult;
    let isSubscription = false;

    // Determine if this is a subscription or one-time payment
    if (plan.billing_cycle === 'monthly' || plan.billing_cycle === 'yearly') {
      // Create PayPal subscription
      isSubscription = true;
      paymentResult = await createPayPalSubscription(planId, plan, returnUrl, cancelUrl, accessToken);
    } else {
      // Create one-time payment
      isSubscription = false;
      paymentResult = await createPayPalOneTimePayment(planId, plan, returnUrl, cancelUrl, accessToken);
    }

    if (paymentResult.error || (!paymentResult.id && !paymentResult.links)) {
      console.error('PayPal payment creation failed:', paymentResult);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Payment creation failed',
          details: paymentResult.error || paymentResult.message || 'Unknown error'
        }),
      };
    }

    // Store payment record in database
    const paymentId = paymentResult.id || (paymentResult.links && paymentResult.links.find(l => l.rel === 'approve')?.href?.split('token=')[1]);
    const subscriptionId = isSubscription ? paymentResult.id : null;

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: authUser.id,
        payment_id: paymentId,
        subscription_id: subscriptionId,
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
      const approvalLink = paymentResult.links.find(link => link.rel === 'approve' || link.rel === 'approve_url');
      approvalUrl = approvalLink ? approvalLink.href : null;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paymentId: paymentResult.id || paymentId,
        subscriptionId: subscriptionId,
        approvalUrl: approvalUrl,
        status: paymentResult.status || 'CREATED',
        isSubscription: isSubscription
      }),
    };

  } catch (error) {
    console.error('Payment creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
    };
  }
};
