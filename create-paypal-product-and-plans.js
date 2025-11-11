// Script to create PayPal Product and Subscription Plans using API
// Run this with: node create-paypal-product-and-plans.js

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'; // Sandbox API

// Get PayPal access token
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables');
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
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Create PayPal Product
async function createPayPalProduct(accessToken) {
  const productData = {
    name: 'Alt Text Pro',
    description: 'AI-powered alt-text generation service for WordPress and websites',
    type: 'SERVICE',
    category: 'SOFTWARE',
    image_url: 'https://www.alt-text.pro/logo-alt-text-pro.png',
    home_url: 'https://www.alt-text.pro'
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `PROD_${Date.now()}`
    },
    body: JSON.stringify(productData)
  });

  const result = await response.json();
  
  if (response.ok && result.id) {
    console.log('✅ PayPal Product created:', result.id);
    return result.id;
  } else {
    console.error('❌ Error creating PayPal Product:', result);
    throw new Error(`Failed to create PayPal Product: ${JSON.stringify(result)}`);
  }
}

// Create PayPal Subscription Plan
async function createPayPalPlan(accessToken, productId, planDetails) {
  const billingPlan = {
    product_id: productId,
    name: `Alt Text Pro - ${planDetails.name}`,
    description: `${planDetails.credits} credits per month - ${planDetails.name}`,
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
      total_cycles: 0 // 0 = infinite (recurring)
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
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
      'PayPal-Request-Id': `PLAN_${planDetails.id}_${Date.now()}`
    },
    body: JSON.stringify(billingPlan)
  });

  const result = await response.json();
  
  if (response.ok && result.id) {
    console.log(`✅ PayPal Plan created for ${planDetails.name}:`, result.id);
    return result.id;
  } else {
    console.error(`❌ Error creating PayPal Plan for ${planDetails.name}:`, result);
    throw new Error(`Failed to create PayPal Plan for ${planDetails.name}: ${JSON.stringify(result)}`);
  }
}

// Main setup function
async function setupPayPalPlans() {
  try {
    console.log('🚀 Starting PayPal Product and Plans setup...\n');
    
    const accessToken = await getPayPalAccessToken();
    console.log('✅ Access token obtained\n');

    // Create Product
    const productId = await createPayPalProduct(accessToken);
    console.log(`\n📦 Product ID: ${productId}\n`);

    // Define subscription plans
    const plans = [
      { id: 'tier1', name: 'Tier 1', price: 12.00, credits: 1000 },
      { id: 'tier2', name: 'Tier 2', price: 20.00, credits: 2500 },
      { id: 'tier3', name: 'Tier 3', price: 40.00, credits: 5000 }
    ];

    const planIds = {};
    
    // Create Plans
    for (const plan of plans) {
      const paypalPlanId = await createPayPalPlan(accessToken, productId, plan);
      planIds[plan.id] = paypalPlanId;
      console.log(`   ${plan.name}: ${paypalPlanId}\n`);
    }

    console.log('\n✅ Setup complete!\n');
    console.log('📋 Add these to your Netlify environment variables:\n');
    console.log(`PAYPAL_ENVIRONMENT=sandbox`);
    console.log(`PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}`);
    console.log(`PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}`);
    console.log(`PAYPAL_PRODUCT_ID=${productId}`);
    for (const [planId, paypalPlanId] of Object.entries(planIds)) {
      console.log(`PAYPAL_PLAN_${planId.toUpperCase()}=${paypalPlanId}`);
    }
    console.log(`\nREACT_APP_PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}`);

    return { productId, planIds };

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  setupPayPalPlans()
    .then(() => {
      console.log('\n✨ All done! Copy the environment variables above to Netlify.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error:', error.message);
      process.exit(1);
    });
}

module.exports = { setupPayPalPlans, createPayPalProduct, createPayPalPlan };

