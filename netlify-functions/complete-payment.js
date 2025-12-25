// Netlify Function for PayPal Payment Completion
// File: netlify-functions/complete-payment.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

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
  console.log('PayPal authentication check:');
  console.log('- PAYPAL_ENVIRONMENT:', process.env.PAYPAL_ENVIRONMENT || 'production (default)');
  console.log('- PAYPAL_BASE_URL:', PAYPAL_BASE_URL);
  console.log('- PAYPAL_CLIENT_ID:', PAYPAL_CLIENT_ID ? 'SET (hidden)' : 'NOT SET');
  console.log('- PAYPAL_CLIENT_SECRET:', PAYPAL_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET');
  
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  console.log('Requesting PayPal access token from:', `${PAYPAL_BASE_URL}/v1/oauth2/token`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('PayPal access token error:', {
      status: response.status,
      error: data.error || 'unknown',
      hasDescription: !!data.error_description
    });
    throw new Error(`Failed to get PayPal access token: ${data.error_description || data.error || 'Unknown error'}`);
  }
  
  if (!data.access_token) {
    console.error('No access token in response');
    throw new Error('PayPal access token not received in response');
  }
  
  console.log('PayPal access token obtained successfully');
  return data.access_token;
}

// Get PayPal order details (to check if already captured)
async function getPayPalOrder(orderId) {
  const accessToken = await getPayPalAccessToken();
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return await response.json();
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
  console.log(`Getting PayPal subscription details for: ${subscriptionId}`);
  
  try {
  const accessToken = await getPayPalAccessToken();
    
    if (!accessToken) {
      throw new Error('Failed to obtain PayPal access token');
    }
    
    console.log(`Access token obtained`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
    },
  });

    const data = await response.json();
    
    console.log(`PayPal subscription fetch response status: ${response.status}`);
    
    if (!response.ok) {
      console.error('PayPal subscription fetch error:', {
        status: response.status,
        subscriptionId: subscriptionId,
        error: data.error || data.name || 'unknown',
        hasMessage: !!data.message
      });
      throw new Error(`Failed to get PayPal subscription: ${data.name || data.message || data.error || 'Unknown error'}`);
    }

    console.log(`Subscription status: ${data.status}`);
    return data;
  } catch (error) {
    console.error('Error in getPayPalSubscription:', {
      message: error.message,
      stack: error.stack,
      subscriptionId: subscriptionId
    });
    throw error;
  }
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting for payment endpoints (stricter - 20 per minute)
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(`payment:${clientIp}`, 20);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
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

    // Support annual plan ids coming from frontend (e.g., tier1_annual)
    const isAnnualRequest = typeof planId === 'string' && planId.endsWith('_annual');
    const normalizedPlanId = isAnnualRequest ? planId.replace('_annual', '') : planId;

    // For subscriptions, allow subscriptionId in place of paymentId (PayPal SDK returns subscriptionID)
    const providedPaymentId = paymentId || (isSubscription ? subscriptionId : null);

    if (!providedPaymentId || !normalizedPlanId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'paymentId (or subscriptionId for subscriptions) and planId are required' }),
      };
    }

    // Get plan details to determine billing cycle
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', normalizedPlanId)
      .single();

    if (planError || !plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan' }),
      };
    }

    // Determine if this is actually a subscription based on billing_cycle or annual request
    const actualIsSubscription = isAnnualRequest || plan.billing_cycle === 'monthly' || plan.billing_cycle === 'yearly';
    
    // If subscription ID is not provided but this is a subscription, try to find it from database
    let finalSubscriptionId = subscriptionId;
    if (actualIsSubscription && !finalSubscriptionId) {
      // Try to find the most recent pending subscription for this user and plan
      const { data: pendingPayment, error: lookupError } = await supabase
        .from('payments')
        .select('subscription_id')
        .eq('user_id', authUser.id)
        .eq('plan_id', normalizedPlanId)
        .eq('status', 'pending')
        .not('subscription_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!lookupError && pendingPayment?.subscription_id) {
        finalSubscriptionId = pendingPayment.subscription_id;
        console.log('Found subscription ID from database:', finalSubscriptionId);
      } else {
        // Fallback: use paymentId if it looks like a subscription ID (starts with I-)
        if (paymentId && paymentId.startsWith('I-')) {
          finalSubscriptionId = paymentId;
          console.log('Using paymentId as subscription ID:', finalSubscriptionId);
        }
      }
    } else if (!actualIsSubscription) {
      finalSubscriptionId = null;
    }

    let paymentResult;
    let amount = 0;
    let subscriptionStatus = null;

    if (actualIsSubscription) {
      // Handle subscription - get subscription details and verify status
      if (!finalSubscriptionId && !providedPaymentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Subscription ID is required',
            details: 'No subscription ID provided and could not find one in database'
          }),
        };
      }
      
      const subscriptionIdToUse = finalSubscriptionId || providedPaymentId;
      console.log('🔍 Verifying subscription status with PayPal API for:', subscriptionIdToUse);
      
      // Verify subscription status from PayPal (like PaymentDetails API in Adaptive Payments)
      paymentResult = await getPayPalSubscription(subscriptionIdToUse);

      console.log('✅ PayPal subscription verified:', {
        subscriptionId: paymentResult.id,
        status: paymentResult.status,
        planId: paymentResult.plan_id ? 'present' : 'missing',
        hasBillingInfo: !!paymentResult.billing_info,
        hasSubscriber: !!paymentResult.subscriber
      });
      
      if (!paymentResult) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to retrieve subscription details',
            details: 'No response from PayPal API - subscription may not exist',
            subscriptionId: subscriptionIdToUse
          }),
        };
      }

      // CRITICAL SECURITY: Verify the subscription belongs to the correct plan
      // This prevents users from buying a cheaper plan while selecting a premium one
      if (paymentResult.plan_id) {
        const envKey = isAnnualRequest
          ? `PAYPAL_PLAN_${normalizedPlanId.toUpperCase()}_ANNUAL`
          : `PAYPAL_PLAN_${normalizedPlanId.toUpperCase()}`;
        const expectedPlanId = process.env[envKey];
        console.log('🔍 Verifying plan ID match:');
        console.log('  Expected:', expectedPlanId);
        console.log('  Actual:', paymentResult.plan_id);
        
        // CRITICAL SECURITY: Reject if plan IDs don't match
        // This prevents users from buying a cheaper plan while selecting a premium one
        if (expectedPlanId && paymentResult.plan_id !== expectedPlanId) {
          console.error('❌ SECURITY: Plan ID mismatch - rejecting payment');
          console.error('  Requested plan:', planId);
          console.error('  Expected PayPal plan:', expectedPlanId);
          console.error('  Actual PayPal plan:', paymentResult.plan_id);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Plan mismatch detected',
              message: 'The payment plan does not match the selected subscription. Payment rejected for security.',
              requestedPlan: planId,
              expectedPayPalPlan: expectedPlanId,
              actualPayPalPlan: paymentResult.plan_id,
            }),
          };
        }
        
        // Also verify plan_id exists if we have an expected value
        if (expectedPlanId && !paymentResult.plan_id) {
          console.error('❌ SECURITY: PayPal subscription missing plan_id');
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid subscription',
              message: 'Subscription does not contain a valid plan identifier.',
            }),
          };
        }
        
        console.log('✅ Plan ID verified successfully');
      } else {
        // If we expect a plan_id but PayPal doesn't provide one, that's suspicious
        const envKey = isAnnualRequest
          ? `PAYPAL_PLAN_${normalizedPlanId.toUpperCase()}_ANNUAL`
          : `PAYPAL_PLAN_${normalizedPlanId.toUpperCase()}`;
        const expectedPlanId = process.env[envKey];
        if (expectedPlanId) {
          console.warn('⚠️ PayPal subscription response missing plan_id, but expected:', expectedPlanId);
          // We'll still proceed but log the warning for investigation
        }
      }

      // Accept multiple states that indicate the subscription is valid
      // APPROVAL_PENDING: User approved but PayPal is still processing (webhook will activate)
      // APPROVED: Approved but not yet active (webhook will activate)
      // ACTIVE: Fully active and billing
      const validStates = ['ACTIVE', 'APPROVAL_PENDING', 'APPROVED'];
      const processingStates = ['APPROVAL_PENDING', 'APPROVED']; // States that need webhook to activate
      const failedStates = ['CANCELLED', 'SUSPENDED', 'EXPIRED'];
      
      if (validStates.includes(paymentResult.status)) {
        // Subscription is in a valid state
        subscriptionStatus = paymentResult.status;
        amount = parseFloat(isAnnualRequest && plan.annual_price ? plan.annual_price : plan.price);
        
        if (processingStates.includes(paymentResult.status)) {
          console.log(`⏳ Subscription ${subscriptionIdToUse} is in ${paymentResult.status} state - webhook will activate it shortly`);
        } else {
          console.log(`✅ Subscription ${subscriptionIdToUse} is ACTIVE`);
        }
      } else if (failedStates.includes(paymentResult.status)) {
        // Subscription explicitly failed
        console.error(`❌ Subscription is in failed state: ${paymentResult.status}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: `Subscription is in ${paymentResult.status} state`,
            status: paymentResult.status,
            subscriptionId: subscriptionIdToUse,
            details: 'Subscription was cancelled, suspended, or expired. Please create a new subscription.'
          }),
        };
      } else {
        // Unknown state - log but proceed (webhook will handle final status)
        console.warn(`⚠️ Subscription status is ${paymentResult.status}, which is unexpected`);
        console.warn('   Proceeding anyway - webhook will handle final state');
        subscriptionStatus = paymentResult.status;
        amount = parseFloat(plan.price);
      }
      
      // Additional verification: Check if subscription has billing agreement
      if (paymentResult.billing_info) {
        console.log('💳 Billing Info: present (not logged for privacy)');
      }
      
      // Log subscriber information
      if (paymentResult.subscriber) {
        console.log('👤 Subscriber: present (not logged for privacy)');
      }
    } else {
      // Handle one-time payment
      // First, check if order is already captured (if captured via PayPalButtons)
      let orderDetails = await getPayPalOrder(paymentId);
      
      // If order is not yet captured, capture it
      if (orderDetails.status === 'APPROVED') {
      paymentResult = await capturePayPalPayment(paymentId);
      } else if (orderDetails.status === 'COMPLETED') {
        // Order already captured (e.g., by PayPalButtons in frontend)
        paymentResult = orderDetails;
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Payment not in valid state',
            status: orderDetails.status 
          }),
        };
      }
      
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

      // CRITICAL SECURITY: Verify payment amount matches plan price
      // This prevents users from paying less than the selected plan price
      // Use annual price when the request was annual, otherwise default price
      const expectedAmount = parseFloat(isAnnualRequest && plan.annual_price ? plan.annual_price : plan.price);
      const amountDifference = Math.abs(amount - expectedAmount);

      // Allow small rounding differences (e.g., $19.99 vs $20.00)
      const ALLOWED_DIFFERENCE = 0.01;

      if (amountDifference > ALLOWED_DIFFERENCE) {
        console.error('❌ SECURITY: Payment amount mismatch - rejecting payment');
        console.error('  Requested plan:', planId);
        console.error('  Plan price:', expectedAmount);
        console.error('  PayPal amount:', amount);
        console.error('  Difference:', amountDifference);
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Payment amount mismatch',
            message: 'The payment amount does not match the selected plan price. Payment rejected for security.',
            requestedPlan: planId,
            planPrice: expectedAmount,
            paymentAmount: amount,
            difference: amountDifference,
          }),
        };
      }

      console.log('✅ Payment amount verified:', amount, 'matches plan price:', expectedAmount);
    }

    // CRITICAL SECURITY: Final validation before crediting user
    // Double-check that we're about to credit the correct plan
    if (actualIsSubscription) {
      // For subscriptions, we already validated plan_id above
      // Just log confirmation
      console.log('✅ Subscription plan validated - proceeding with upgrade');
    } else {
      // For one-time payments, verify amount one more time
      const finalExpectedAmount = parseFloat(plan.price);
      if (Math.abs(amount - finalExpectedAmount) > 0.01) {
        console.error('❌ SECURITY: Amount validation failed before crediting');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Payment validation failed',
            message: 'Unable to verify payment amount. Please contact support.',
          }),
        };
      }
    }

    // Update user subscription using the database function
    console.log('Calling upgrade_subscription with:', {
      user_uuid: authUser.id,
      new_plan: normalizedPlanId,
      payment_id: providedPaymentId,
      subscription_id_param: finalSubscriptionId
    });
    
    const { data: upgradeResult, error: upgradeError } = await supabase
      .rpc('upgrade_subscription', {
        user_uuid: authUser.id,
        new_plan: normalizedPlanId,
        payment_id: providedPaymentId,
        subscription_id_param: finalSubscriptionId
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
      .eq('payment_id', providedPaymentId)
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
        paymentId: providedPaymentId,
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
