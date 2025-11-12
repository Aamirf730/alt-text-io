// Netlify Function to get PayPal access token
// Simple endpoint that returns the access token

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
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
    throw new Error(`Failed to get PayPal access token: ${data.error_description || data.error || JSON.stringify(data)}`);
  }
  
  if (!data.access_token) {
    throw new Error('PayPal access token not received in response');
  }
  
  return data;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const tokenData = await getPayPalAccessToken();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        environment: process.env.PAYPAL_ENVIRONMENT || 'production',
        baseUrl: PAYPAL_BASE_URL,
        clientId: PAYPAL_CLIENT_ID ? (PAYPAL_CLIENT_ID.substring(0, 20) + '...') : 'NOT SET',
        clientIdFull: PAYPAL_CLIENT_ID,
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope || 'N/A'
      }, null, 2),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get PayPal access token',
        details: error.message
      }),
    };
  }
};

