// Diagnostic script to test PayPal subscription creation end-to-end
// Run with: node test-paypal-subscription-flow.js [tier1|tier2|tier3]
// Note: Environment variables should be loaded from .env file or set in environment

const fetch = require('node-fetch');

// Try to load dotenv if available, otherwise use process.env directly
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, use process.env directly (assumes env vars are already set)
  console.log('Note: dotenv not available, using process.env directly');
}

// PayPal configuration from environment
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'production';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

// Plan IDs from environment
const PLAN_IDS = {
  tier1: process.env.PAYPAL_PLAN_TIER1,
  tier2: process.env.PAYPAL_PLAN_TIER2,
  tier3: process.env.PAYPAL_PLAN_TIER3
};

// Get PayPal access token
async function getAccessToken() {
  console.log('\n🔑 Step 1: Getting PayPal access token...');
  console.log(`   Environment: ${PAYPAL_ENVIRONMENT}`);
  console.log(`   Base URL: ${PAYPAL_BASE_URL}`);
  
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not found in environment variables');
  }
  
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to get access token:', data);
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }
  
  console.log('✅ Access token obtained');
  return data.access_token;
}

// Verify plan is ACTIVE
async function verifyPlan(accessToken, planId, tierName) {
  console.log(`\n🔍 Step 2: Verifying plan status for ${tierName}...`);
  console.log(`   Plan ID: ${planId}`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Failed to fetch plan:', errorData);
    throw new Error(`Failed to fetch plan: ${errorData.message || errorData.error_description}`);
  }
  
  const plan = await response.json();
  
  console.log(`   Plan Name: ${plan.name}`);
  console.log(`   Plan Status: ${plan.status}`);
  console.log(`   Product ID: ${plan.product_id}`);
  
  if (plan.status !== 'ACTIVE') {
    console.error(`❌ Plan is not ACTIVE! Status: ${plan.status}`);
    console.error(`   Full plan object:`, JSON.stringify(plan, null, 2));
    throw new Error(`Plan ${planId} is not ACTIVE. Current status: ${plan.status}`);
  }
  
  console.log('✅ Plan is ACTIVE');
  return plan;
}

// Create a test subscription
async function createTestSubscription(accessToken, planId, tierName) {
  console.log(`\n📝 Step 3: Creating test subscription for ${tierName}...`);
  
  const subscriptionData = {
    plan_id: planId,
    subscriber: {
      email_address: 'test@example.com'
    },
    application_context: {
      brand_name: 'Alt Text Pro',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: 'https://www.alt-text.pro/payment-success?plan=' + tierName,
      cancel_url: 'https://www.alt-text.pro/payment-cancelled'
    },
    custom_id: `TEST_${tierName}_${Date.now()}`
  };
  
  console.log('   Subscription data:', JSON.stringify(subscriptionData, null, 2));
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `TEST_${tierName}_${Date.now()}`
    },
    body: JSON.stringify(subscriptionData)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('❌ Subscription creation failed:', JSON.stringify(result, null, 2));
    throw new Error(`Failed to create subscription: ${result.message || result.error_description || JSON.stringify(result)}`);
  }
  
  console.log('✅ Subscription created successfully');
  console.log(`   Subscription ID: ${result.id}`);
  console.log(`   Status: ${result.status}`);
  
  return result;
}

// Verify subscription details
async function verifySubscription(accessToken, subscriptionId) {
  console.log(`\n🔍 Step 4: Verifying subscription details...`);
  console.log(`   Subscription ID: ${subscriptionId}`);
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Failed to fetch subscription:', errorData);
    throw new Error(`Failed to fetch subscription: ${errorData.message || errorData.error_description}`);
  }
  
  const subscription = await response.json();
  
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Plan ID: ${subscription.plan_id}`);
  console.log(`   Has Links: ${!!subscription.links}`);
  console.log(`   Links Count: ${subscription.links?.length || 0}`);
  
  // Validate status
  const validStatuses = ['APPROVAL_PENDING', 'APPROVED', 'ACTIVE'];
  if (!validStatuses.includes(subscription.status)) {
    console.error(`❌ Invalid subscription status: ${subscription.status}`);
    console.error(`   Expected one of: ${validStatuses.join(', ')}`);
    throw new Error(`Subscription has invalid status: ${subscription.status}`);
  }
  
  console.log('✅ Subscription status is valid');
  
  // Validate approval link
  if (!subscription.links || !Array.isArray(subscription.links)) {
    console.error('❌ Subscription has no links array');
    throw new Error('Subscription has no links array');
  }
  
  const approveLink = subscription.links.find(link => link.rel === 'approve');
  if (!approveLink) {
    console.error('❌ No approval link found');
    console.error('   Available links:', subscription.links.map(l => ({ rel: l.rel, href: l.href })));
    throw new Error('Subscription has no approval link');
  }
  
  console.log('✅ Approval link found');
  console.log(`   Approval URL: ${approveLink.href}`);
  
  // Validate URL format
  try {
    const urlObj = new URL(approveLink.href);
    const baToken = urlObj.searchParams.get('ba_token');
    
    if (!approveLink.href.includes('/billing/subscriptions')) {
      console.error('❌ Approval URL is not for subscriptions');
      throw new Error('Invalid approval URL format - not a subscription URL');
    }
    
    if (!baToken) {
      console.error('❌ Approval URL missing ba_token');
      throw new Error('Approval URL missing ba_token parameter');
    }
    
    console.log('✅ Approval URL format is correct');
    console.log(`   ba_token length: ${baToken.length}`);
    console.log(`   ba_token preview: ${baToken.substring(0, 10)}...${baToken.substring(baToken.length - 10)}`);
    
  } catch (err) {
    console.error('❌ URL validation failed:', err.message);
    throw err;
  }
  
  return subscription;
}

// Main test function
async function testSubscriptionFlow(tierName) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🧪 Testing PayPal Subscription Flow for ${tierName.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  const planId = PLAN_IDS[tierName];
  
  if (!planId) {
    console.error(`❌ Plan ID not found for ${tierName}`);
    console.error('   Available tiers:', Object.keys(PLAN_IDS).filter(k => PLAN_IDS[k]));
    process.exit(1);
  }
  
  try {
    // Step 1: Get access token
    const accessToken = await getAccessToken();
    
    // Step 2: Verify plan is ACTIVE
    await verifyPlan(accessToken, planId, tierName);
    
    // Step 3: Create test subscription
    const subscription = await createTestSubscription(accessToken, planId, tierName);
    
    // Step 4: Verify subscription details
    const verifiedSubscription = await verifySubscription(accessToken, subscription.id);
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   Tier: ${tierName}`);
    console.log(`   Plan ID: ${planId}`);
    console.log(`   Plan Status: ACTIVE`);
    console.log(`   Subscription ID: ${verifiedSubscription.id}`);
    console.log(`   Subscription Status: ${verifiedSubscription.status}`);
    
    const approveLink = verifiedSubscription.links.find(link => link.rel === 'approve');
    if (approveLink) {
      console.log(`   Approval URL: ${approveLink.href}`);
      console.log('\n⚠️  IMPORTANT:');
      console.log('   - This is a test subscription');
      console.log('   - You should cancel it in PayPal dashboard');
      console.log('   - The approval URL format is correct');
      console.log('   - If production subscriptions fail, check:');
      console.log('     1. Plan status in PayPal dashboard');
      console.log('     2. PayPal environment (sandbox vs production)');
      console.log('     3. Return/cancel URLs match your domain');
    }
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(`\nError: ${error.message}`);
    console.error(`\nStack: ${error.stack}`);
    process.exit(1);
  }
}

// Run the test
const tierName = process.argv[2] || 'tier1';

if (!['tier1', 'tier2', 'tier3'].includes(tierName)) {
  console.error('Usage: node test-paypal-subscription-flow.js [tier1|tier2|tier3]');
  process.exit(1);
}

testSubscriptionFlow(tierName);

