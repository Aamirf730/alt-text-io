// Diagnostic script to verify PayPal plan and product configuration
// Run this to check if your PayPal setup is correct

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

async function getAccessToken() {
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

async function verifyPlan(planId) {
  const accessToken = await getAccessToken();
  
  console.log(`\n=== Verifying Plan: ${planId} ===`);
  const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!planResponse.ok) {
    const error = await planResponse.json();
    console.error('❌ Plan fetch failed:', error);
    return;
  }
  
  const plan = await planResponse.json();
  console.log('Plan Status:', plan.status);
  console.log('Plan ID:', plan.id);
  console.log('Product ID:', plan.product_id);
  console.log('Plan Name:', plan.name);
  console.log('Billing Cycles:', JSON.stringify(plan.billing_cycles, null, 2));
  
  // Verify product
  if (plan.product_id) {
    console.log(`\n=== Verifying Product: ${plan.product_id} ===`);
    const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalog/products/${plan.product_id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (productResponse.ok) {
      const product = await productResponse.json();
      console.log('Product ID:', product.id);
      console.log('Product Name:', product.name);
      console.log('Product Type:', product.type);
      console.log('✅ Product is valid');
    } else {
      const error = await productResponse.json();
      console.error('❌ Product fetch failed:', error);
    }
  }
  
  // Try creating a test subscription to see what happens
  console.log(`\n=== Testing Subscription Creation ===`);
  const subscriptionData = {
    plan_id: planId,
    application_context: {
      brand_name: 'Alt Text Pro Test',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: 'https://www.alt-text.pro/payment-success?plan=tier1',
      cancel_url: 'https://www.alt-text.pro/payment-cancelled'
    }
  };
  
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
  
  if (subResponse.ok) {
    console.log('✅ Subscription created successfully');
    console.log('Subscription ID:', subscription.id);
    console.log('Subscription Status:', subscription.status);
    
    const approveLink = subscription.links?.find(l => l.rel === 'approve');
    if (approveLink) {
      console.log('Approval URL:', approveLink.href);
      
      // Parse the URL
      const url = new URL(approveLink.href);
      const baToken = url.searchParams.get('ba_token');
      console.log('BA Token present:', !!baToken);
      console.log('BA Token length:', baToken?.length);
      console.log('URL path:', url.pathname);
      
      if (!approveLink.href.includes('/billing/subscriptions')) {
        console.error('❌ WARNING: Approval URL is not for subscriptions!');
      } else {
        console.log('✅ Approval URL format is correct');
      }
    } else {
      console.error('❌ No approval link found');
    }
  } else {
    console.error('❌ Subscription creation failed:', subscription);
  }
}

// Run verification
const planId = process.argv[2] || process.env.PAYPAL_PLAN_TIER1;
if (!planId) {
  console.error('Please provide a plan ID as argument or set PAYPAL_PLAN_TIER1');
  process.exit(1);
}

verifyPlan(planId).catch(console.error);

