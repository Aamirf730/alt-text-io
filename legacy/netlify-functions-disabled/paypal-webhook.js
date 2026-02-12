// Netlify Function for PayPal Webhook Events
// File: netlify-functions/paypal-webhook.js
// Handles subscription events: renewals, cancellations, payments, etc.
// SECURITY: Implements PayPal signature verification

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID; // Required for signature verification

// Use sandbox if PAYPAL_ENVIRONMENT is set to 'sandbox', otherwise use production
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

// Allowed webhook event types - reject any event not in this list
const ALLOWED_EVENT_TYPES = [
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
];

// Get PayPal access token
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get PayPal access token: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Verify PayPal webhook signature using PayPal's verification API
 * This is REQUIRED for production security - prevents forged webhook events
 * 
 * @param {Object} headers - Request headers from the webhook
 * @param {string} body - Raw request body (JSON string)
 * @returns {Promise<boolean>} - True if signature is valid
 */
async function verifyWebhookSignature(headers, body) {
  // Require webhook ID to be configured
  if (!PAYPAL_WEBHOOK_ID) {
    console.error('PAYPAL_WEBHOOK_ID is not configured - webhook verification will fail');
    return false;
  }

  // Extract PayPal signature headers (case-insensitive)
  const transmissionId = headers['paypal-transmission-id'] || headers['PAYPAL-TRANSMISSION-ID'];
  const transmissionTime = headers['paypal-transmission-time'] || headers['PAYPAL-TRANSMISSION-TIME'];
  const certUrl = headers['paypal-cert-url'] || headers['PAYPAL-CERT-URL'];
  const authAlgo = headers['paypal-auth-algo'] || headers['PAYPAL-AUTH-ALGO'];
  const transmissionSig = headers['paypal-transmission-sig'] || headers['PAYPAL-TRANSMISSION-SIG'];

  // All signature headers are required
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error('Missing PayPal signature headers:', {
      hasTransmissionId: !!transmissionId,
      hasTransmissionTime: !!transmissionTime,
      hasCertUrl: !!certUrl,
      hasAuthAlgo: !!authAlgo,
      hasTransmissionSig: !!transmissionSig,
    });
    return false;
  }

  // Validate cert URL is from PayPal (prevent SSRF)
  try {
    const certUrlParsed = new URL(certUrl);
    if (!certUrlParsed.hostname.endsWith('.paypal.com')) {
      console.error('Invalid cert URL - not from PayPal domain:', certUrl);
      return false;
    }
  } catch (e) {
    console.error('Invalid cert URL format:', certUrl);
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();

    // Call PayPal's webhook signature verification API
    const verificationResponse = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(body),
      }),
    });

    const verificationResult = await verificationResponse.json();

    if (!verificationResponse.ok) {
      console.error('PayPal signature verification API error:', verificationResult);
      return false;
    }

    // PayPal returns verification_status: "SUCCESS" if valid
    const isValid = verificationResult.verification_status === 'SUCCESS';
    
    if (!isValid) {
      console.error('PayPal signature verification failed:', verificationResult.verification_status);
    }

    return isValid;

  } catch (error) {
    console.error('Error verifying PayPal webhook signature:', error);
    return false;
  }
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
    return false;
  }

  // Get plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('credits')
    .eq('id', payment.plan_id)
    .single();

  if (planError || !plan) {
    console.error('Could not find plan:', payment.plan_id);
    return false;
  }

  // Update user credits and next billing date
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credits_remaining: plan.credits, // Reset to plan credits
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      subscription_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.user_id);

  if (updateError) {
    console.error('Error updating user profile:', updateError);
    return false;
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
  return true;
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
    return false;
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
    return false;
  }

  console.log('Subscription cancelled for user:', payment.user_id);
  return true;
}

// Handle subscription suspension
async function handleSubscriptionSuspension(subscriptionId) {
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('user_id')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (paymentError || !payment) {
    console.error('Could not find payment record for subscription:', subscriptionId);
    return false;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'suspended',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.user_id);

  if (updateError) {
    console.error('Error updating subscription status:', updateError);
    return false;
  }

  console.log('Subscription suspended for user:', payment.user_id);
  return true;
}

// Handle payment failure
async function handlePaymentFailure(subscriptionId) {
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('user_id')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (paymentError || !payment) {
    console.error('Could not find payment record for subscription:', subscriptionId);
    return false;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'payment_failed',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.user_id);

  if (updateError) {
    console.error('Error updating subscription status:', updateError);
    return false;
  }

  console.log('Payment failure recorded for user:', payment.user_id);
  return true;
}

exports.handler = async (event, context) => {
  // Minimal CORS headers - webhooks don't need CORS but Netlify may require it
  const headers = {
    'Content-Type': 'application/json',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL: Check required environment variables BEFORE processing any events
  // This prevents silent failures where all webhooks are rejected with 401
  // ═══════════════════════════════════════════════════════════════════════════
  const missingEnvVars = [];
  if (!PAYPAL_WEBHOOK_ID) missingEnvVars.push('PAYPAL_WEBHOOK_ID');
  if (!PAYPAL_CLIENT_ID) missingEnvVars.push('PAYPAL_CLIENT_ID');
  if (!PAYPAL_CLIENT_SECRET) missingEnvVars.push('PAYPAL_CLIENT_SECRET');
  if (!supabaseUrl) missingEnvVars.push('SUPABASE_URL');
  if (!supabaseServiceKey) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
  
  if (missingEnvVars.length > 0) {
    console.error('═══════════════════════════════════════════════════════════════════════');
    console.error('CRITICAL CONFIGURATION ERROR: PayPal webhook cannot function!');
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    console.error('');
    console.error('To fix:');
    console.error('1. Go to Netlify Dashboard → Site → Site configuration → Environment variables');
    console.error('2. Add the missing variables for ALL deploy contexts (Production, Deploy previews, Branch deploys)');
    console.error('3. For PAYPAL_WEBHOOK_ID: Create a webhook in PayPal Developer Dashboard');
    console.error('   pointing to: https://YOUR-SITE/.netlify/functions/paypal-webhook');
    console.error('═══════════════════════════════════════════════════════════════════════');
    
    // Return 503 Service Unavailable - indicates temporary server issue
    // PayPal will retry the webhook later
    return {
      statusCode: 503,
      headers: {
        ...headers,
        'Retry-After': '3600', // Tell PayPal to retry in 1 hour
      },
      body: JSON.stringify({
        error: 'Webhook service not configured',
        message: 'Required environment variables are missing. Check server logs for details.',
        missing: missingEnvVars,
      }),
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.warn('Webhook received non-POST request:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Validate request body exists
  if (!event.body) {
    console.error('Webhook received empty body');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Empty request body' }),
    };
  }

  try {
    // CRITICAL: Verify webhook signature BEFORE processing any data
    const isSignatureValid = await verifyWebhookSignature(event.headers, event.body);
    
    if (!isSignatureValid) {
      console.error('Webhook signature verification FAILED - rejecting request');
      // Return 401 Unauthorized for invalid signatures
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid webhook signature' }),
      };
    }

    console.log('Webhook signature verified successfully');

    // Parse webhook event only after signature is verified
    let webhookEvent;
    try {
      webhookEvent = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    // Validate event type is in allowed list
    if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      console.warn('Received unknown or disallowed event type:', eventType);
      // Return 400 Bad Request for unknown event types
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unknown event type', event_type: eventType }),
      };
    }

    // Validate resource exists
    if (!resource) {
      console.error('Webhook event missing resource:', eventType);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing resource in event' }),
      };
    }

    console.log('Processing PayPal webhook event:', eventType, 'Resource ID:', resource.id);

    let processed = false;

    // Handle different event types
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        // Subscription created - log only, activation happens separately
        console.log('Subscription created:', resource.id);
        processed = true;
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Subscription activated - user can now use the service
        console.log('Subscription activated:', resource.id);
        processed = true;
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        // Subscription updated (plan change, etc.)
        console.log('Subscription updated:', resource.id);
        processed = true;
        break;

      case 'PAYMENT.SALE.COMPLETED':
        // Recurring payment completed (renewal)
        if (resource.billing_agreement_id) {
          const subscriptionId = resource.billing_agreement_id;
          const amount = parseFloat(resource.amount?.total || 0);
          processed = await handleSubscriptionRenewal(subscriptionId, amount);
        } else {
          console.warn('PAYMENT.SALE.COMPLETED missing billing_agreement_id');
          processed = true; // Still acknowledge the event
        }
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        // Subscription cancelled or expired
        if (resource.id) {
          processed = await handleSubscriptionCancellation(resource.id);
        }
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        // Subscription suspended (e.g., payment issues)
        if (resource.id) {
          processed = await handleSubscriptionSuspension(resource.id);
        }
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        // Payment failed
        if (resource.id) {
          processed = await handlePaymentFailure(resource.id);
        }
        break;

      case 'PAYMENT.SALE.REFUNDED':
      case 'PAYMENT.SALE.REVERSED':
        // Payment refunded or reversed - log for now
        console.log('Payment refunded/reversed:', resource.id);
        processed = true;
        break;

      default:
        // This shouldn't happen due to ALLOWED_EVENT_TYPES check above
        console.error('Unhandled event type slipped through:', eventType);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Unhandled event type' }),
        };
    }

    // Return 200 only for successfully processed events
    if (processed) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          received: true, 
          event_type: eventType,
          processed: true 
        }),
      };
    } else {
      // Processing failed but signature was valid - return 500
      console.error('Event processing failed:', eventType);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Event processing failed',
          event_type: eventType 
        }),
      };
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Don't expose internal error details
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
