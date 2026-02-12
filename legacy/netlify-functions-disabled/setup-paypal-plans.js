// Script to create PayPal Product and Subscription Plans
// Run this once to set up PayPal products and plans
// File: netlify-functions/setup-paypal-plans.js

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = 'https://api-m.paypal.com'; // Use 'https://api-m.sandbox.paypal.com' for sandbox

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
    throw new Error('Failed to create PayPal Product');
  }
}

// Create PayPal Subscription Plan
// According to PayPal API docs: https://developer.paypal.com/docs/api/subscriptions/v1/
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
      total_cycles: 0, // 0 = infinite (recurring)
      pricing_scheme: {
        fixed_price: {
          value: planDetails.price.toString(),
          currency_code: 'USD'
        }
      }
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
        currency_code: 'USD'
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
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
  
  if (!response.ok) {
    console.error(`❌ Error creating PayPal Plan for ${planDetails.name}:`, result);
    throw new Error(`Failed to create PayPal Plan for ${planDetails.name}`);
  }

  const planId = result.id;
  console.log(`✅ Plan created: ${planId}`);
  console.log(`   Status: ${result.status || 'CREATED'}`);

  // IMPORTANT: Activate the plan using the guidance format
  // Note: PayPal API typically uses 'status' not 'state', but following guidance format
  const activateResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify([
      {
        op: 'replace',
        path: '/',
        value: {
          state: 'ACTIVE'
        }
      }
    ])
  });

  if (!activateResponse.ok) {
    const errorText = await activateResponse.text();
    console.warn(`   ⚠️  Warning: Could not activate plan: ${errorText}`);
    // Try alternative format (status instead of state)
    const altActivateResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify([
        {
          op: 'replace',
          path: '/status',
          value: 'ACTIVE'
        }
      ])
    });
    
    if (!altActivateResponse.ok) {
      const altErrorText = await altActivateResponse.text();
      console.warn(`   ⚠️  Alternative activation also failed: ${altErrorText}`);
    } else {
      console.log(`   ✅ Plan activated using alternative format!`);
    }
  } else {
    console.log(`   ✅ Plan activated!`);
  }

  return planId;
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
    console.log(`PAYPAL_PRODUCT_ID=${productId}`);
    for (const [planId, paypalPlanId] of Object.entries(planIds)) {
      console.log(`PAYPAL_PLAN_${planId.toUpperCase()}=${paypalPlanId}`);
    }

    return { productId, planIds };

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Export for use as Netlify function
exports.handler = async (event, context) => {
  // This should only be run by admin/authorized users
  // Add authentication check here
  
  try {
    const result = await setupPayPalPlans();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        productId: result.productId,
        planIds: result.planIds
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      }),
    };
  }
};

// For local testing
if (require.main === module) {
  setupPayPalPlans()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

