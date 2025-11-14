#!/usr/bin/env node

/**
 * Test PayPal Subscription Creation Directly
 * This tests if PayPal subscription creation works when called directly
 * without going through our Netlify function
 */

// Get credentials from environment
// Client ID from Netlify: AVn67qyfxlOpoaBx6nR-IRj7AnJhzBzet90iovgp_hdQEbUNommj_PJZx48Ye8Ua3GLZ1RtOphXJyXW0
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AVn67qyfxlOpoaBx6nR-IRj7AnJhzBzet90iovgp_hdQEbUNommj_PJZx48Ye8Ua3GLZ1RtOphXJyXW0';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'production';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

const PLAN_ID = process.env.PAYPAL_PLAN_TIER1 || 'P-10836440LT044463FNEJT6IA';

async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials required. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
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

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }
  
  return data.access_token;
}

async function testSubscriptionCreation() {
  try {
    console.log('🧪 Testing PayPal Subscription Creation Directly\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Configuration:');
    console.log(`  Environment: ${PAYPAL_ENVIRONMENT}`);
    console.log(`  Base URL: ${PAYPAL_BASE_URL}`);
    console.log(`  Plan ID: ${PLAN_ID}`);
    console.log(`  Client ID: ${PAYPAL_CLIENT_ID.substring(0, 20)}...\n`);
    
    // Get access token
    console.log('1. Getting access token...');
    const accessToken = await getAccessToken();
    console.log('   ✅ Access token obtained\n');
    
    // Verify plan first
    console.log('2. Verifying plan exists and is ACTIVE...');
    const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${PLAN_ID}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!planResponse.ok) {
      const error = await planResponse.json();
      throw new Error(`Plan verification failed: ${error.message || planResponse.statusText}`);
    }
    
    const plan = await planResponse.json();
    console.log(`   Plan Name: ${plan.name}`);
    console.log(`   Plan Status: ${plan.status}`);
    console.log(`   Product ID: ${plan.product_id}`);
    
    if (plan.status !== 'ACTIVE') {
      throw new Error(`Plan is not ACTIVE. Current status: ${plan.status}`);
    }
    console.log('   ✅ Plan is ACTIVE\n');
    
    // Create subscription
    console.log('3. Creating subscription...');
    const subscriptionData = {
      plan_id: PLAN_ID,
      application_context: {
        brand_name: 'Alt Text Pro',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: 'https://www.alt-text.pro/payment-success?plan=tier1',
        cancel_url: 'https://www.alt-text.pro/payment-cancelled'
      },
      custom_id: `TEST_${Date.now()}`
    };
    
    console.log('   Subscription payload:');
    console.log(JSON.stringify(subscriptionData, null, 2));
    console.log('');
    
    const subResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `TEST_${Date.now()}`
      },
      body: JSON.stringify(subscriptionData)
    });
    
    const subscription = await subResponse.json();
    
    if (!subResponse.ok) {
      console.error('   ❌ Subscription creation failed:');
      console.error(JSON.stringify(subscription, null, 2));
      throw new Error(`Subscription creation failed: ${subscription.message || JSON.stringify(subscription)}`);
    }
    
    console.log('   ✅ Subscription created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Subscription Details:');
    console.log(`  Subscription ID: ${subscription.id}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Plan ID: ${subscription.plan_id}`);
    console.log(`  Create Time: ${subscription.create_time}\n`);
    
    // Check approval URL
    const approveLink = subscription.links?.find(l => l.rel === 'approve');
    if (approveLink) {
      console.log('Approval URL:');
      console.log(`  ${approveLink.href}\n`);
      
      // Analyze the URL
      const url = new URL(approveLink.href);
      const baToken = url.searchParams.get('ba_token');
      const path = url.pathname;
      
      console.log('URL Analysis:');
      console.log(`  Path: ${path}`);
      console.log(`  Has ba_token: ${!!baToken}`);
      console.log(`  ba_token length: ${baToken?.length || 0}`);
      
      if (path.includes('/billing/subscriptions')) {
        console.log('  ✅ URL is for subscriptions (correct)');
      } else if (path.includes('/webapps/hermes') || path.includes('/checkout')) {
        console.log('  ❌ WARNING: URL appears to be for one-time payment!');
        console.log('  This is the problem - PayPal is returning wrong URL type');
      }
      
      if (baToken) {
        console.log('  ✅ Has ba_token (subscription token)');
      } else {
        const orderToken = url.searchParams.get('token');
        if (orderToken) {
          console.log('  ❌ ERROR: Has order token instead of ba_token!');
          console.log('  This means PayPal is creating an order, not a subscription');
        } else {
          console.log('  ⚠️  No token found in URL');
        }
      }
    } else {
      console.log('  ❌ No approval link found!');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Full Subscription Response:');
    console.log(JSON.stringify(subscription, null, 2));
    
    return subscription;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testSubscriptionCreation();

