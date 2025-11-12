#!/usr/bin/env node

/**
 * Get PayPal Access Token
 * Fetches the full PayPal access token from Netlify function
 */

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'production';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error('❌ PayPal credentials not found in environment variables.');
    console.error('Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
    console.error('\nOr use the Netlify function:');
    console.error('curl https://www.alt-text.pro/.netlify/functions/check-paypal-account');
    process.exit(1);
  }

  console.log('🔑 Getting PayPal Access Token...\n');
  console.log(`Environment: ${PAYPAL_ENVIRONMENT}`);
  console.log(`Base URL: ${PAYPAL_BASE_URL}`);
  console.log(`Client ID: ${PAYPAL_CLIENT_ID.substring(0, 20)}...\n`);

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
    console.error('❌ Failed to get access token:');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  
  if (!data.access_token) {
    console.error('❌ No access token in response');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  
  console.log('✅ Access Token Obtained Successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ACCESS TOKEN:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(data.access_token);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Token Details:');
  console.log(`  Type: ${data.token_type}`);
  console.log(`  Expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 60)} minutes)`);
  console.log(`  Scope: ${data.scope || 'N/A'}`);
  
  // Decode token to see payload (if it's a JWT)
  if (data.access_token.includes('.')) {
    try {
      const parts = data.access_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('\nToken Payload (decoded):');
        console.log(JSON.stringify(payload, null, 2));
      }
    } catch (e) {
      // Not a JWT or can't decode
    }
  }
  
  return data.access_token;
}

// Run
getAccessToken().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

