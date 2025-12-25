// Netlify Function to check PayPal account information
// This will show the PayPal account email and identity details

const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

// Get PayPal access token
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
  
  return data.access_token;
}

// Get PayPal account information
async function getPayPalAccountInfo(accessToken) {
  // Get user info (account details)
  const userInfoResponse = await fetch(`${PAYPAL_BASE_URL}/v1/identity/openidconnect/userinfo?schema=openid`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  let userInfo = null;
  if (userInfoResponse.ok) {
    try {
      userInfo = await userInfoResponse.json();
    } catch (e) {
      console.warn('Could not parse user info:', e.message);
    }
  }

  // Get merchant account details (if available)
  // Note: This requires different scopes, so it might not work with client credentials
  // But we can try to get account info from other endpoints

  return {
    userInfo,
    accessTokenPreview: accessToken.substring(0, 30) + '...',
    tokenType: 'Bearer',
    environment: process.env.PAYPAL_ENVIRONMENT || 'production'
  };
}

// Get PayPal merchant account information
async function getMerchantAccountInfo(accessToken) {
  // Try to get merchant account details
  // Note: Some endpoints require different authentication
  const merchantResponse = await fetch(`${PAYPAL_BASE_URL}/v1/customer/partners`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  let merchantInfo = null;
  if (merchantResponse.ok) {
    try {
      merchantInfo = await merchantResponse.json();
    } catch (e) {
      console.warn('Could not parse merchant info:', e.message);
    }
  }

  return merchantInfo;
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting (admin check endpoint - stricter)
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(`admin:${clientIp}`, 30);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowedResponse(headers);
  }

  try {
    console.log('=== PAYPAL ACCOUNT CHECK ===');
    console.log('Environment:', process.env.PAYPAL_ENVIRONMENT || 'production');
    console.log('Base URL:', PAYPAL_BASE_URL);
    console.log('Client ID:', PAYPAL_CLIENT_ID ? (PAYPAL_CLIENT_ID.substring(0, 20) + '...') : 'NOT SET');
    console.log('Client Secret:', PAYPAL_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET');

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'PayPal credentials not configured',
          details: {
            clientIdSet: !!PAYPAL_CLIENT_ID,
            clientSecretSet: !!PAYPAL_CLIENT_SECRET
          }
        }),
      };
    }

    // Get access token
    console.log('Getting PayPal access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('Access token obtained');

    // Get account information
    console.log('Getting PayPal account information...');
    const accountInfo = await getPayPalAccountInfo(accessToken);
    
    // Try to get merchant info
    const merchantInfo = await getMerchantAccountInfo(accessToken);

    // Get product and plan info to see what account they're linked to
    const productId = process.env.PAYPAL_PRODUCT_ID;
    let productInfo = null;
    if (productId) {
      try {
        const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalog/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (productResponse.ok) {
          productInfo = await productResponse.json();
        }
      } catch (e) {
        console.warn('Could not fetch product info:', e.message);
      }
    }

    // Get plan info
    const planId = process.env.PAYPAL_PLAN_TIER1;
    let planInfo = null;
    if (planId) {
      try {
        const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (planResponse.ok) {
          planInfo = await planResponse.json();
        }
      } catch (e) {
        console.warn('Could not fetch plan info:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        environment: process.env.PAYPAL_ENVIRONMENT || 'production',
        baseUrl: PAYPAL_BASE_URL,
        clientId: PAYPAL_CLIENT_ID ? (PAYPAL_CLIENT_ID.substring(0, 20) + '...') : 'NOT SET',
        clientIdFull: PAYPAL_CLIENT_ID, // Include full client ID for verification
        accountInfo: {
          userInfo: accountInfo.userInfo,
          accessTokenPreview: accountInfo.accessTokenPreview,
          accessTokenFull: accessToken, // Include full token
          tokenType: accountInfo.tokenType
        },
        merchantInfo: merchantInfo,
        productInfo: productInfo ? {
          id: productInfo.id,
          name: productInfo.name,
          type: productInfo.type,
          category: productInfo.category
        } : null,
        planInfo: planInfo ? {
          id: planInfo.id,
          name: planInfo.name,
          status: planInfo.status,
          productId: planInfo.product_id
        } : null,
        note: 'User info requires OAuth scopes. Client credentials grant may not return email. Check PayPal Dashboard for account email.'
      }, null, 2),
    };

  } catch (error) {
    console.error('PayPal account check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to check PayPal account',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};

