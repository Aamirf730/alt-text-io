// Netlify Function for PayPal Webhook Events
// File: netlify-functions/paypal-webhook.js
// Handles subscription events: renewals, cancellations, payments, etc.

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

// Verify webhook signature (optional but recommended for production)
async function verifyWebhookSignature(headers, body, webhookId) {
  // For production, implement PayPal webhook signature verification
  // See: https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
  return true; // Simplified for now
}

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

// Get subscription details from PayPal
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

// Handle subscription renewal (BILLING.SUBSCRIPTION.CREATED or PAYMENT.SALE.COMPLETED)
async function handleSubscriptionRenewal(subscriptionId, amount) {
  // Find user by subscription_id
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('user_id, plan_id')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (paymentError || !payment) {
    console.error('Could not find payment record for subscription:', subscriptionId);
    return;
  }

  // Get plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('credits')
    .eq('id', payment.plan_id)
    .single();

  if (planError || !plan) {
    console.error('Could not find plan:', payment.plan_id);
    return;
  }

  // Update user credits and next billing date
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credits_remaining: plan.credits, // Reset to plan credits
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.user_id);

  if (updateError) {
    console.error('Error updating user profile:', updateError);
    return;
  }

  // Record payment
  await supabase
    .from('payments')
    .insert({
      user_id: payment.user_id,
      payment_id: `renewal_${subscriptionId}_${Date.now()}`,
      subscription_id: subscriptionId,
      plan_id: payment.plan_id,
      amount: amount,
      status: 'completed'
    });

  console.log('Subscription renewed successfully for user:', payment.user_id);
}

// Handle subscription cancellation
async function handleSubscriptionCancellation(subscriptionId) {
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('user_id, plan_id')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (paymentError || !payment) {
    console.error('Could not find payment record for subscription:', subscriptionId);
    return;
  }

  // Update user subscription status
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.user_id);

  if (updateError) {
    console.error('Error updating subscription status:', updateError);
  }

  console.log('Subscription cancelled for user:', payment.user_id);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    // Parse webhook event
    const webhookEvent = JSON.parse(event.body);
    
    console.log('PayPal Webhook Event:', JSON.stringify(webhookEvent, null, 2));

    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    // Handle different event types
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        // Subscription created (initial payment)
        console.log('Subscription created:', resource.id);
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Subscription activated
        console.log('Subscription activated:', resource.id);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        // Recurring payment completed (renewal)
        if (resource.billing_agreement_id) {
          const subscriptionId = resource.billing_agreement_id;
          const amount = parseFloat(resource.amount.total);
          await handleSubscriptionRenewal(subscriptionId, amount);
        }
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        // Subscription cancelled or expired
        if (resource.id) {
          await handleSubscriptionCancellation(resource.id);
        }
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        // Subscription suspended
        console.log('Subscription suspended:', resource.id);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        // Payment failed
        console.log('Subscription payment failed:', resource.id);
        break;

      default:
        console.log('Unhandled webhook event type:', eventType);
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

