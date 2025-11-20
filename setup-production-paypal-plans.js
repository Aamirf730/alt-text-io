// Run this ONCE to create your 3 production plans properly
// This ensures plans are fully activated before use

const fetch = require('node-fetch');

// Your Production Credentials
const PAYPAL_CLIENT_ID = 'AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v';
const PAYPAL_SECRET = 'EMffXHKQEzrsWqYgjzvqnXCLodaYY2RBibpf0wTAqqYwRdA8tvrai8GFJoozyfl6d9GY355p5w0l9rFT';
const PAYPAL_PRODUCT_ID = 'PROD-89T43770P6349820G'; // From your logs
const BASE_URL = 'https://api-m.paypal.com';

// Get Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

// Create and Activate a Billing Plan
async function createBillingPlan(accessToken, planConfig) {
  console.log(`\n🔨 Creating ${planConfig.name}...`);
  
  // Step 1: Create the plan
  const createResponse = await fetch(`${BASE_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      product_id: PAYPAL_PRODUCT_ID,
      name: planConfig.name,
      description: planConfig.description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite recurring
          pricing_scheme: {
            fixed_price: {
              value: planConfig.price,
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create plan: ${error}`);
  }

  const plan = await createResponse.json();
  console.log(`✅ Plan created: ${plan.id}`);
  console.log(`   Status: ${plan.status}`);
  
  // Step 2: Activate the plan using guidance format
  // IMPORTANT: Activate the plan (following guidance format)
  console.log(`   Activating plan...`);
  
  const activateResponse = await fetch(`${BASE_URL}/v1/billing/plans/${plan.id}`, {
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
    console.warn(`   ⚠️  Warning: Could not activate using guidance format: ${errorText}`);
    // Try alternative format (status instead of state)
    const altActivateResponse = await fetch(`${BASE_URL}/v1/billing/plans/${plan.id}`, {
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
  
  // Step 3: Verify the plan is active
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  const verifyResponse = await fetch(`${BASE_URL}/v1/billing/plans/${plan.id}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const verifiedPlan = await verifyResponse.json();
  console.log(`   Final status: ${verifiedPlan.status}`);
  
  if (verifiedPlan.status !== 'ACTIVE') {
    console.error(`   ❌ ERROR: Plan is not active! Status: ${verifiedPlan.status}`);
    console.error(`   This plan will NOT work for subscriptions!`);
  }
  
  return {
    planId: plan.id,
    status: verifiedPlan.status,
    name: planConfig.name
  };
}

// Main function
async function setupProductionPlans() {
  console.log('🚀 Setting up Production PayPal Plans...\n');
  console.log('Environment: PRODUCTION');
  console.log(`Product ID: ${PAYPAL_PRODUCT_ID}\n`);
  
  try {
    // Get access token
    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');
    
    // Define your 3 plans (UPDATED WITH ACTUAL PRICES AND CREDITS)
    const plans = [
      {
        name: 'Alt Text Pro - Tier 1',
        description: 'Monthly subscription for Alt Text Pro Tier 1 - 1,000 credits per month',
        price: '12.00' // Actual price from database
      },
      {
        name: 'Alt Text Pro - Tier 2',
        description: 'Monthly subscription for Alt Text Pro Tier 2 - 2,500 credits per month',
        price: '20.00' // Actual price from database
      },
      {
        name: 'Alt Text Pro - Tier 3',
        description: 'Monthly subscription for Alt Text Pro Tier 3 - 5,000 credits per month',
        price: '40.00' // Actual price from database
      }
    ];
    
    const results = [];
    
    // Create each plan
    for (let i = 0; i < plans.length; i++) {
      const result = await createBillingPlan(accessToken, plans[i]);
      results.push(result);
      
      // Wait between creations
      if (i < plans.length - 1) {
        console.log('\n⏱️  Waiting 3 seconds before next plan...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL PLANS CREATED SUCCESSFULLY!\n');
    console.log('📋 Add these to your Netlify Environment Variables:\n');
    
    results.forEach((result, index) => {
      const tierNum = index + 1;
      console.log(`PAYPAL_PLAN_TIER${tierNum}=${result.planId}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  IMPORTANT STEPS:\n');
    console.log('1. Copy the environment variables above');
    console.log('2. Go to Netlify Dashboard → Site Settings → Environment Variables');
    console.log('3. Add all three PAYPAL_PLAN_TIER variables');
    console.log('4. Redeploy your site or restart your dev server');
    console.log('5. Wait 5-10 minutes before testing (for PayPal propagation)');
    console.log('6. Test with a real PayPal account (not sandbox)\n');
    
    // Verify all plans are active
    const allActive = results.every(r => r.status === 'ACTIVE');
    if (allActive) {
      console.log('✅ All plans are ACTIVE and ready to use!');
    } else {
      console.log('⚠️  WARNING: Some plans are not active:');
      results.forEach(r => {
        if (r.status !== 'ACTIVE') {
          console.log(`   - ${r.name}: ${r.status}`);
        }
      });
      console.log('\nPlans must be ACTIVE to work properly!');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', await error.response.text());
    }
    process.exit(1);
  }
}

// Run it
setupProductionPlans();

