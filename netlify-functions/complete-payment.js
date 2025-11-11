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
    const { paymentId, planId, isSubscription = false, subscriptionId } = JSON.parse(event.body);
    if (!paymentId || !planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'paymentId and planId are required' }),
      };
    }

    // Get plan details to determine billing cycle
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

    // Determine if this is actually a subscription based on billing_cycle
    const actualIsSubscription = plan.billing_cycle === 'monthly' || plan.billing_cycle === 'yearly';
    const finalSubscriptionId = subscriptionId || (actualIsSubscription ? paymentId : null);

    let paymentResult;
    let amount = 0;
    let subscriptionStatus = null;

    if (actualIsSubscription) {
      // Handle subscription - get subscription details
      paymentResult = await getPayPalSubscription(finalSubscriptionId || paymentId);
      
      console.log('PayPal subscription result:', JSON.stringify(paymentResult, null, 2));
      
      if (!paymentResult) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to retrieve subscription details',
            details: 'No response from PayPal'
          }),
        };
      }
      
      // Accept multiple states that indicate the subscription is valid
      const validStates = ['ACTIVE', 'APPROVAL_PENDING', 'APPROVED'];
      
      if (!validStates.includes(paymentResult.status)) {
        // Subscription might be in APPROVAL_PENDING state, check for approval
        if (paymentResult.status === 'APPROVAL_PENDING' || paymentResult.status === 'APPROVED') {
          // Subscription is approved but not yet active - webhook will activate it
          subscriptionStatus = paymentResult.status;
          amount = parseFloat(plan.price);
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: `Subscription not in valid state: ${paymentResult.status}`,
              status: paymentResult.status,
              subscriptionId: finalSubscriptionId || paymentId
            }),
          };
        }
      } else {
        subscriptionStatus = paymentResult.status;
        amount = parseFloat(plan.price);
      }
    } else {
      // Handle one-time payment
      paymentResult = await capturePayPalPayment(paymentId);
      
      if (paymentResult.status !== 'COMPLETED') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Payment not completed',
            status: paymentResult.status 
          }),
        };
      }

      // Extract amount from PayPal response
      if (paymentResult.purchase_units && paymentResult.purchase_units[0]) {
        amount = parseFloat(paymentResult.purchase_units[0].amount.value);
      }
    }

    // Update user subscription using the database function
    console.log('Calling upgrade_subscription with:', {
      user_uuid: authUser.id,
      new_plan: planId,
      payment_id: paymentId,
      subscription_id: finalSubscriptionId
    });
    
    const { data: upgradeResult, error: upgradeError } = await supabase
      .rpc('upgrade_subscription', {
        user_uuid: authUser.id,
        new_plan: planId,
        payment_id: paymentId,
        subscription_id: finalSubscriptionId
      });

    if (upgradeError) {
      console.error('Subscription upgrade error:', upgradeError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to upgrade subscription',
          details: upgradeError.message || JSON.stringify(upgradeError),
          upgradeResult: upgradeResult
        }),
      };
    }
    
    console.log('Upgrade subscription result:', upgradeResult);

    // Update payment record
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        amount: amount,
        status: 'completed',
        subscription_id: finalSubscriptionId,
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
        subscriptionId: finalSubscriptionId,
        isSubscription: actualIsSubscription,
        plan: profile?.subscription_plan,
        credits_remaining: profile?.credits_remaining,
        subscription_status: subscriptionStatus || profile?.subscription_status,
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
