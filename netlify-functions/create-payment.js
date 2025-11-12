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

// Get PayPal Plan ID (from environment variable or create if needed)
async function getPayPalPlanId(planId, planDetails, accessToken) {
  // First, check if we have a pre-created plan ID in environment variables
  const envVarName = `PAYPAL_PLAN_${planId.toUpperCase()}`;
  const envPlanId = process.env[envVarName];
  console.log(`Looking for ${envVarName}: ${envPlanId ? 'Found' : 'Not found'}`);
  
  if (envPlanId) {
    console.log(`Using pre-created PayPal plan for ${planId}: ${envPlanId}`);
    
    // Verify the plan exists and is active
    try {
      const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${envPlanId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (planResponse.ok) {
        const planData = await planResponse.json();
        console.log(`Plan ${envPlanId} status: ${planData.status}`);
        console.log(`Plan ${envPlanId} details:`, JSON.stringify(planData, null, 2));
        
        if (planData.status === 'ACTIVE') {
          // Double-check that the plan has all required fields
          if (!planData.id || !planData.product_id) {
            console.error(`Plan ${envPlanId} is missing required fields`);
            throw new Error(`Plan ${envPlanId} is missing required fields`);
          }
          
          // Verify the product exists and is active
          try {
            const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalog/products/${planData.product_id}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (productResponse.ok) {
              const contentType = productResponse.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                const text = await productResponse.text();
                console.warn(`Product response is not JSON. Status: ${productResponse.status}, Content-Type: ${contentType}, Body: ${text.substring(0, 200)}`);
                // Continue anyway - product might still be valid
              } else {
                try {
                  const productData = await productResponse.json();
                  console.log(`Product ${planData.product_id} details:`, JSON.stringify(productData, null, 2));
                  
                  if (!productData.id) {
                    console.warn(`Product ${planData.product_id} response missing ID field, but continuing`);
                  }
                } catch (jsonErr) {
                  console.warn(`Failed to parse product JSON: ${jsonErr.message}. Continuing anyway.`);
                }
              }
            } else {
              // Product fetch failed - log but don't fail subscription creation
              // PayPal might still process the subscription even if product fetch fails
              const status = productResponse.status;
              let errorMessage = `Product fetch returned status ${status}`;
              
              try {
                const contentType = productResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const productError = await productResponse.json();
                  errorMessage = productError.message || productError.error_description || JSON.stringify(productError);
                } else {
                  const text = await productResponse.text();
                  errorMessage = text.substring(0, 200);
                }
              } catch (parseErr) {
                // Ignore parse errors
              }
              
              console.warn(`Product ${planData.product_id} verification failed (status ${status}): ${errorMessage}`);
              console.warn('Continuing with subscription creation - PayPal may still process it');
              // Don't throw error - PayPal might still work even if product fetch fails
            }
          } catch (productErr) {
            // Network or other errors - log but don't fail
            console.warn(`Error verifying product ${planData.product_id}: ${productErr.message}`);
            console.warn('Continuing with subscription creation - product verification is optional');
            // Don't throw - PayPal subscription creation might still work
          }
          
          return envPlanId;
        } else {
          console.error(`Plan ${envPlanId} is not ACTIVE, status: ${planData.status}`);
          throw new Error(`Plan ${envPlanId} is not ACTIVE. Current status: ${planData.status}. Please activate the plan in PayPal dashboard.`);
        }
      } else {
        const errorData = await planResponse.json();
        console.error(`Plan ${envPlanId} verification failed:`, planResponse.status, errorData);
        throw new Error(`Failed to verify plan ${envPlanId}: ${errorData.message || planResponse.statusText}`);
      }
    } catch (err) {
      console.error(`Error verifying plan ${envPlanId}:`, err.message);
      throw err; // Don't continue if plan verification fails
    }
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
  // According to PayPal API docs: https://developer.paypal.com/docs/api/subscriptions/v1/
  const billingPlan = {
    product_id: productId,
    name: planName,
    description: planDescription,
    status: 'ACTIVE', // Explicitly set to ACTIVE as per documentation
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
      // Removed setup_fee since it's 0 and optional per PayPal docs
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
async function createPayPalSubscription(planId, planDetails, returnUrl, cancelUrl, accessToken, userEmail, userName = null) {
  try {
    // First, get the PayPal billing plan ID (from env or create)
    console.log(`Getting PayPal Plan ID for ${planId}...`);
    const paypalPlanId = await getPayPalPlanId(planId, planDetails, accessToken);
    console.log(`Using PayPal Plan ID: ${paypalPlanId}`);
    
    // Build subscriber object if we have user information
    // According to PayPal API docs: subscriber is optional but recommended
    const subscriber = userEmail ? {
      email_address: userEmail,
      ...(userName && { name: { full_name: userName } })
    } : undefined;
    
    // Let PayPal determine start_time during approval. Supplying a value that's too close causes
    // "Something went wrong" errors because PayPal requires it to be at least ~10 minutes ahead.
    // According to PayPal API docs: https://developer.paypal.com/docs/api/subscriptions/v1/
    const subscriptionData = {
      plan_id: paypalPlanId,
      ...(subscriber && { subscriber }),
      application_context: {
        brand_name: 'Alt Text Pro',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        // Removed payment_method.payer_selected as it's optional and restricting to 'PAYPAL' 
        // can cause issues - let PayPal handle payment method selection
        return_url: returnUrl,
        cancel_url: cancelUrl
      },
      // Add custom_id for tracking (optional but recommended)
      custom_id: `ALTTEXT_${planId}_${Date.now()}`
    };
    console.log('Subscription start will default to PayPal activation time');
    console.log('Subscription creation requested at:', new Date().toISOString());

    console.log('Creating PayPal subscription with data:', JSON.stringify(subscriptionData, null, 2));

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
      console.error('PayPal subscription creation failed:', JSON.stringify(result, null, 2));
      console.error('Response status:', response.status);
      throw new Error(result.message || result.error_description || JSON.stringify(result) || 'Failed to create subscription');
    }

    console.log('PayPal subscription created successfully:', result.id);
    console.log('Subscription status:', result.status);
    console.log('Full subscription response:', JSON.stringify(result, null, 2));
    console.log('Subscription links:', result.links ? JSON.stringify(result.links, null, 2) : 'No links');
    
    // Validate that we have an approval URL with ba_token
    if (result.links && result.links.length > 0) {
      const approveLink = result.links.find(link => link.rel === 'approve');
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
          }
        } catch (err) {
          console.error('⚠️ Error validating approval URL:', err.message);
          throw err;
        }
      } else {
        console.error('⚠️ No approval link found in subscription response');
        throw new Error('No approval URL returned from PayPal');
      }
    } else {
      console.error('⚠️ No links found in subscription response');
      throw new Error('No links returned from PayPal subscription creation');
    }
    
    return result;
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
    // Get the origin from the request headers, or default to production URL
    const origin = event.headers.origin || event.headers.referer?.split('/').slice(0, 3).join('/') || 'https://www.alt-text.pro';
    const baseUrl = origin.includes('localhost') 
      ? 'http://localhost:3000' 
      : 'https://www.alt-text.pro';
    
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
    if (plan.billing_cycle === 'monthly' || plan.billing_cycle === 'yearly') {
      // Create PayPal subscription
      console.log('Creating PayPal subscription...');
      isSubscription = true;
      paymentResult = await createPayPalSubscription(planId, plan, returnUrl, cancelUrl, accessToken, userEmail, userName);
    } else {
      // Create one-time payment
      console.log('Creating one-time PayPal payment...');
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
    
    console.log('Final approval URL:', approvalUrl || 'NOT FOUND');

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
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};
