// Netlify Function for PayPal Payment Creation
// File: netlify-functions/create-payment.js
// Supports both one-time payments and subscriptions

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase configuration missing:');
  console.error('- SUPABASE_URL:', supabaseUrl ? 'Set' : 'NOT SET');
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'NOT SET');
}

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
  console.log('- PAYPAL_CLIENT_ID:', PAYPAL_CLIENT_ID ? (PAYPAL_CLIENT_ID.substring(0, 20) + '...') : 'NOT SET');
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
    console.error('PayPal access token error response:', {
      status: response.status,
      statusText: response.statusText,
      error: data.error,
      error_description: data.error_description,
      full_response: data
    });
    throw new Error(`Failed to get PayPal access token: ${data.error_description || data.error || JSON.stringify(data)}`);
  }
  
  if (!data.access_token) {
    console.error('No access token in response:', data);
    throw new Error('PayPal access token not received in response');
  }
  
  console.log('PayPal access token obtained successfully');
  return data.access_token;
}

// Get PayPal Plan ID from environment variables (pre-created plans only)
function getPayPalPlanId(planId) {
  const planIds = {
    'tier1': process.env.PAYPAL_PLAN_TIER1,
    'tier2': process.env.PAYPAL_PLAN_TIER2,
    'tier3': process.env.PAYPAL_PLAN_TIER3
  };
  
  const paypalPlanId = planIds[planId];
  
  if (!paypalPlanId) {
    throw new Error(`PayPal Plan ID not configured for ${planId}. Please set PAYPAL_PLAN_${planId.toUpperCase()} environment variable.`);
  }
  
  console.log(`Using PayPal Plan ID for ${planId}: ${paypalPlanId}`);
  return paypalPlanId;
}

// Verify PayPal plan is ACTIVE before creating subscription
async function verifyPayPalPlan(planId, accessToken) {
  try {
    console.log(`\n🔍 Verifying PayPal plan status for ${planId}...`);
    const paypalPlanId = getPayPalPlanId(planId);
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${paypalPlanId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Failed to fetch plan details:`, JSON.stringify(errorData, null, 2));
      throw new Error(`Failed to verify plan: ${errorData.message || errorData.error_description || 'Plan not found'}`);
    }
    
    const plan = await response.json();
    console.log(`Plan details:`, {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      product_id: plan.product_id
    });
    
    if (plan.status !== 'ACTIVE') {
      console.error(`❌ Plan is not ACTIVE. Current status: ${plan.status}`);
      console.error(`Full plan object:`, JSON.stringify(plan, null, 2));
      throw new Error(`PayPal plan ${paypalPlanId} is not ACTIVE. Current status: ${plan.status}. Please activate the plan in PayPal dashboard.`);
    }
    
    console.log(`✅ Plan ${paypalPlanId} is ACTIVE and ready for subscriptions`);
    return plan;
  } catch (error) {
    console.error(`❌ Plan verification failed:`, error.message);
    throw error;
  }
}

// Verify subscription was created successfully and has valid status
async function verifyPayPalSubscription(subscriptionId, accessToken) {
  try {
    console.log(`\n🔍 Verifying subscription status for ${subscriptionId}...`);
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Failed to fetch subscription details:`, JSON.stringify(errorData, null, 2));
      throw new Error(`Failed to verify subscription: ${errorData.message || errorData.error_description || 'Subscription not found'}`);
    }
    
    const subscription = await response.json();
    console.log(`Subscription details:`, {
      id: subscription.id,
      status: subscription.status,
      plan_id: subscription.plan_id,
      has_links: !!subscription.links,
      links_count: subscription.links?.length || 0
    });
    
    // Valid statuses for a newly created subscription
    const validStatuses = ['APPROVAL_PENDING', 'APPROVED', 'ACTIVE'];
    if (!validStatuses.includes(subscription.status)) {
      console.error(`❌ Subscription has invalid status: ${subscription.status}`);
      console.error(`Full subscription object:`, JSON.stringify(subscription, null, 2));
      throw new Error(`Subscription ${subscriptionId} has invalid status: ${subscription.status}. Expected: ${validStatuses.join(', ')}`);
    }
    
    // Verify approval link exists
    if (!subscription.links || !Array.isArray(subscription.links)) {
      console.error(`❌ Subscription has no links array`);
      throw new Error(`Subscription ${subscriptionId} has no links array`);
    }
    
    const approveLink = subscription.links.find(link => link.rel === 'approve');
    if (!approveLink) {
      console.error(`❌ Subscription has no approval link`);
      console.error(`Available links:`, subscription.links.map(l => ({ rel: l.rel, href: l.href })));
      throw new Error(`Subscription ${subscriptionId} has no approval link`);
    }
    
    console.log(`✅ Subscription ${subscriptionId} is valid:`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Approval URL: ${approveLink.href}`);
    
    return subscription;
  } catch (error) {
    console.error(`❌ Subscription verification failed:`, error.message);
    throw error;
  }
}

// Create PayPal subscription
async function createPayPalSubscription(planId, planDetails, returnUrl, cancelUrl, accessToken, userEmail, userName = null, userId = null) {
  try {
    // Get the PayPal billing plan ID from environment variables (pre-created plans only)
    console.log(`Getting PayPal Plan ID for ${planId}...`);
    const paypalPlanId = getPayPalPlanId(planId);
    console.log(`Using PayPal Plan ID: ${paypalPlanId}`);
    
    // STEP 1: Verify plan is ACTIVE before creating subscription
    await verifyPayPalPlan(planId, accessToken);
    
    // Build subscriber object if we have user information
    // According to PayPal API docs: subscriber is optional but recommended
    const subscriber = userEmail ? {
      email_address: userEmail,
      ...(userName && { name: { full_name: userName } })
    } : undefined;
    
    // Calculate start_time to be at least 10 minutes in the future
    // PayPal requires start_time to be at least 10 minutes ahead to avoid "Something went wrong" errors
    // But we also need to ensure it's set to prevent PayPal from redirecting to one-time payment flow
    const now = new Date();
    const startTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now (safe buffer)
    const startTimeISO = startTime.toISOString();
    
    console.log('Subscription start time calculated:', startTimeISO);
    console.log('Current time:', now.toISOString());
    console.log('Time difference (minutes):', (startTime - now) / 60000);
    
    // According to PayPal API docs: https://developer.paypal.com/docs/api/subscriptions/v1/
    const subscriptionData = {
      plan_id: paypalPlanId,
      ...(subscriber && { subscriber }),
      start_time: startTimeISO, // Explicitly set start_time to ensure subscription flow
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
      },
      // Add custom_id for tracking - use userId if available, otherwise use planId
      custom_id: userId || `ALTTEXT_${planId}_${Date.now()}`
    };
    console.log('Subscription creation requested at:', now.toISOString());

    console.log('Creating PayPal subscription with data:', JSON.stringify(subscriptionData, null, 2));

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Prefer': 'return=representation',
        'PayPal-Request-Id': `SUB_${planId}_${Date.now()}`
      },
      body: JSON.stringify(subscriptionData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PayPal subscription creation failed:', JSON.stringify(result, null, 2));
      console.error('Response status:', response.status);
      throw new Error(result.message || result.error_description || JSON.stringify(result) || 'Failed to create subscription');
    }

    console.log('PayPal subscription created successfully:', result.id);
    console.log('Subscription status:', result.status);
    console.log('Full subscription response:', JSON.stringify(result, null, 2));
    console.log('Subscription links:', result.links ? JSON.stringify(result.links, null, 2) : 'No links');
    
    // STEP 2: Verify subscription was created successfully and has valid status
    const verifiedSubscription = await verifyPayPalSubscription(result.id, accessToken);
    
    // Use verified subscription data (may have more complete information)
    const subscriptionToUse = verifiedSubscription || result;
    
    // Validate that we have an approval URL with ba_token
    // Use links from verified subscription if available, otherwise use result
    const linksToCheck = subscriptionToUse.links || result.links;
    if (linksToCheck && linksToCheck.length > 0) {
      const approveLink = linksToCheck.find(link => link.rel === 'approve');
      if (approveLink) {
        console.log('Approval URL found:', approveLink.href);
        // Validate the ba_token is present and URL format is correct
        try {
          const urlObj = new URL(approveLink.href);
          const baToken = urlObj.searchParams.get('ba_token');
          
          // Ensure the URL is for subscription approval, not one-time payment
          if (!approveLink.href.includes('/billing/subscriptions')) {
            console.error('⚠️ Approval URL is not for subscriptions:', approveLink.href);
            throw new Error('Invalid approval URL format - not a subscription URL');
          }
          
          if (!baToken) {
            console.error('⚠️ Approval URL does not contain ba_token parameter');
            throw new Error('Approval URL missing ba_token parameter');
          } else {
            console.log('✅ ba_token found in approval URL (length:', baToken.length, ')');
            console.log('✅ Approval URL is correct format for subscriptions');
            console.log(`✅ ba_token format: ${baToken.substring(0, 10)}...${baToken.substring(baToken.length - 10)}`);
          }
        } catch (err) {
          console.error('⚠️ Error validating approval URL:', err.message);
          throw err;
        }
      } else {
        console.error('⚠️ No approval link found in subscription response');
        console.error('Available links:', linksToCheck.map(l => ({ rel: l.rel, href: l.href })));
        throw new Error('No approval URL returned from PayPal');
      }
    } else {
      console.error('⚠️ No links found in subscription response');
      throw new Error('No links returned from PayPal subscription creation');
    }
    
    // Return the verified subscription result (with validated status and links)
    return subscriptionToUse;
  } catch (error) {
    console.error('Error in createPayPalSubscription:', error);
    throw error;
  }
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
  // Log function invocation
  console.log('=== CREATE-PAYMENT FUNCTION CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('HTTP Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Body:', event.body);
  
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
    console.log('Processing request...');
    
    // Get authorization token
    const authHeader = event.headers.authorization;
    console.log('Authorization header present:', !!authHeader);
    if (!authHeader) {
      console.error('ERROR: No authorization header');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    // Verify Supabase is configured
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase not configured properly');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Supabase credentials not configured'
        }),
      };
    }
    
    // Verify user authentication
    console.log('Verifying user token...');
    console.log('Supabase URL being used:', supabaseUrl);
    console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
    
    // Try to verify token - if it fails, try alternative method
    let authUser = null;
    let authError = null;
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      authUser = user;
      authError = error;
    } catch (err) {
      console.error('Exception during token verification:', err);
      authError = err;
    }
    
    // If getUser fails, try to decode JWT and use admin.getUserById
    if (authError || !authUser) {
      console.log('Standard token verification failed, trying alternative method...');
      try {
        // Decode JWT to get user ID (basic decode without verification)
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          const userId = payload.sub || payload.user_id;
          
          if (userId) {
            console.log('Extracted user ID from token:', userId);
            // Use admin API to get user
            const { data: userData, error: adminError } = await supabase.auth.admin.getUserById(userId);
            if (!adminError && userData?.user) {
              authUser = userData.user;
              console.log('User authenticated via admin API:', authUser.id);
            } else {
              console.error('Admin getUserById error:', adminError);
            }
          }
        }
      } catch (decodeError) {
        console.error('Error decoding token:', decodeError);
      }
    }
    
    if (authError && !authUser) {
      console.error('Token verification error:', authError);
      console.error('Error message:', authError.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Token signature verification failed',
          details: authError.message || 'Invalid or expired token'
        }),
      };
    }
    
    if (!authUser) {
      console.error('No user returned from token verification');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }
    
    console.log('User authenticated:', authUser.id);

    // Parse request body - following guidance pattern
    const { planId, userId } = JSON.parse(event.body);
    if (!planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'planId is required' }),
      };
    }
    
    // Use userId from request body if provided, otherwise extract from token
    const finalUserId = userId || authUser?.id;
    console.log('User ID for subscription:', finalUserId);

    // Get plan details from Supabase
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Plan fetch error:', planError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan' }),
      };
    }

    // Log full plan object for debugging
    console.log('Plan fetched from database:', JSON.stringify(plan, null, 2));
    console.log('Plan billing_cycle value:', plan.billing_cycle);
    console.log('Plan billing_cycle type:', typeof plan.billing_cycle);
    console.log('Plan billing_cycle === "monthly":', plan.billing_cycle === 'monthly');

    // Skip free plan
    if (plan.price === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Free plan does not require payment' }),
      };
    }

    // Create return and cancel URLs
    // Use process.env.URL if available (Netlify provides this), otherwise use dynamic detection
    let baseUrl;
    if (process.env.URL) {
      // Netlify provides process.env.URL automatically
      baseUrl = process.env.URL;
    } else {
      // Fallback: Get the origin from the request headers, or default to production URL
      const origin = event.headers.origin || event.headers.referer?.split('/').slice(0, 3).join('/') || 'https://www.alt-text.pro';
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        // Extract port from origin, default to 8888 (Netlify Dev default)
        const urlMatch = origin.match(/http:\/\/[^:]+:(\d+)/);
        const port = urlMatch ? urlMatch[1] : '8888';
        baseUrl = `http://localhost:${port}`;
      } else {
        baseUrl = 'https://www.alt-text.pro';
      }
    }
    
    // Include subscription ID in return URL if it's a subscription
    // We'll set this after creating the subscription
    let returnUrl = `${baseUrl}/payment-success?plan=${planId}`;
    const cancelUrl = `${baseUrl}/payment-cancelled`;

    // Verify PayPal environment variables
    console.log('PayPal Configuration Check:');
    console.log('- PAYPAL_ENVIRONMENT:', process.env.PAYPAL_ENVIRONMENT);
    console.log('- PAYPAL_BASE_URL:', PAYPAL_BASE_URL);
    console.log('- PAYPAL_CLIENT_ID:', PAYPAL_CLIENT_ID ? 'Set' : 'NOT SET');
    console.log('- PAYPAL_CLIENT_SECRET:', PAYPAL_CLIENT_SECRET ? 'Set' : 'NOT SET');
    console.log('- PAYPAL_PRODUCT_ID:', process.env.PAYPAL_PRODUCT_ID || 'NOT SET');
    console.log('- PAYPAL_PLAN_TIER1:', process.env.PAYPAL_PLAN_TIER1 || 'NOT SET');
    console.log('- PAYPAL_PLAN_TIER2:', process.env.PAYPAL_PLAN_TIER2 || 'NOT SET');
    console.log('- PAYPAL_PLAN_TIER3:', process.env.PAYPAL_PLAN_TIER3 || 'NOT SET');

    // Get PayPal access token
    console.log('Getting PayPal access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('Access token obtained successfully');

    let paymentResult;
    let isSubscription = false;

    // Get user email for subscriber object
    const userEmail = authUser.email || authUser.user_metadata?.email;
    const userName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;
    
    console.log('User email for subscription:', userEmail);
    console.log('User name for subscription:', userName || 'Not provided');

    // Determine if this is a subscription or one-time payment
    console.log('Plan billing cycle:', plan.billing_cycle);
    console.log('Plan ID:', planId);
    
    // Check billing cycle - with fallback for tier plans
    // Tier plans (tier1, tier2, tier3) should always be subscriptions
    const isTierPlan = ['tier1', 'tier2', 'tier3'].includes(planId);
    const hasMonthlyBilling = plan.billing_cycle === 'monthly' || plan.billing_cycle === 'yearly';
    
    console.log('Is tier plan:', isTierPlan);
    console.log('Has monthly billing:', hasMonthlyBilling);
    
    if (hasMonthlyBilling || isTierPlan) {
      // Create PayPal subscription
      if (!hasMonthlyBilling && isTierPlan) {
        console.warn('⚠️ Tier plan missing billing_cycle, defaulting to subscription');
      }
      console.log('Creating PayPal subscription...');
      isSubscription = true;
      paymentResult = await createPayPalSubscription(planId, plan, returnUrl, cancelUrl, accessToken, userEmail, userName, finalUserId);
    } else {
      // Create one-time payment
      console.log('Creating one-time PayPal payment...');
      console.log('Reason: billing_cycle is not monthly/yearly and not a tier plan');
      isSubscription = false;
      paymentResult = await createPayPalOneTimePayment(planId, plan, returnUrl, cancelUrl, accessToken);
    }

    console.log('Payment result received:', JSON.stringify(paymentResult, null, 2));
    console.log('Payment result has ID:', !!paymentResult.id);
    console.log('Payment result has links:', !!paymentResult.links);
    
    if (paymentResult.error || (!paymentResult.id && !paymentResult.links)) {
      console.error('=== PAYPAL PAYMENT CREATION FAILED ===');
      console.error('Payment result:', JSON.stringify(paymentResult, null, 2));
      console.error('Error:', paymentResult.error);
      console.error('Message:', paymentResult.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Payment creation failed',
          details: paymentResult.error || paymentResult.message || 'Unknown error',
          full_error: paymentResult
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
    console.log('Extracting approval URL from payment result...');
    console.log('Payment result links:', paymentResult.links ? JSON.stringify(paymentResult.links, null, 2) : 'No links array');
    
    if (paymentResult.links && Array.isArray(paymentResult.links)) {
      // PayPal Subscriptions API uses 'approve' as the rel value
      const approvalLink = paymentResult.links.find(link => 
        link.rel === 'approve' || 
        link.rel === 'approve_url' ||
        link.rel === 'approval_url'
      );
      approvalUrl = approvalLink ? approvalLink.href : null;
      console.log('Found approval link:', approvalLink ? JSON.stringify(approvalLink, null, 2) : 'Not found');
    } else if (isSubscription && paymentResult.id) {
      // For subscriptions, if no links, construct the approval URL
      // PayPal subscription approval URLs follow this pattern:
      // https://www.paypal.com/webapps/billing/subscriptions?ba_token=XXXXX
      // But we need to get it from the subscription details
      console.log('No links found, subscription ID:', paymentResult.id);
      // Try to get subscription details to find approval URL
      try {
        const subResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${paymentResult.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        const subDetails = await subResponse.json();
        console.log('Subscription details:', JSON.stringify(subDetails, null, 2));
        if (subDetails.links) {
          const approveLink = subDetails.links.find(link => link.rel === 'approve');
          approvalUrl = approveLink ? approveLink.href : null;
        }
      } catch (err) {
        console.error('Error fetching subscription details:', err);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ APPROVAL URL READY TO RETURN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Final approval URL:', approvalUrl || 'NOT FOUND');
    
    if (approvalUrl) {
      try {
        const urlObj = new URL(approvalUrl);
        console.log('URL Breakdown:');
        console.log('  - Protocol:', urlObj.protocol);
        console.log('  - Host:', urlObj.host);
        console.log('  - Pathname:', urlObj.pathname);
        console.log('  - Full Search:', urlObj.search);
        
        const baToken = urlObj.searchParams.get('ba_token');
        if (baToken) {
          console.log('  - ba_token: PRESENT');
          console.log('  - ba_token length:', baToken.length);
          console.log('  - ba_token format:', baToken.substring(0, 10) + '...' + baToken.substring(baToken.length - 5));
        } else {
          console.error('  - ba_token: MISSING!');
        }
        
        // Log all query parameters
        const allParams = {};
        urlObj.searchParams.forEach((value, key) => {
          allParams[key] = key === 'ba_token' ? value.substring(0, 10) + '...' + value.substring(value.length - 5) : value;
        });
        console.log('  - All query params:', allParams);
        
        // Validate URL format
        if (!approvalUrl.includes('/billing/subscriptions')) {
          console.error('⚠️ WARNING: URL does not contain /billing/subscriptions');
        }
        if (!baToken) {
          console.error('⚠️ WARNING: URL does not contain ba_token');
        }
      } catch (urlError) {
        console.error('Error parsing approval URL:', urlError);
      }
    }
    
    console.log('Subscription Details:');
    console.log('  - Subscription ID:', subscriptionId);
    console.log('  - Payment ID:', paymentResult.id || paymentId);
    console.log('  - Status:', paymentResult.status || 'CREATED');
    console.log('  - Is Subscription:', isSubscription);
    console.log('═══════════════════════════════════════════════════════════');

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
    console.error('❌ Payment creation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log more details for debugging
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Return detailed error for debugging
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString(),
        errorName: error.name,
        // Include stack trace in production for now to debug
        stack: error.stack
      }),
    };
  }
};
