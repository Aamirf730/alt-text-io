// Netlify Function for Getting or Creating User API Key
// File: netlify-functions/get-api-key.js

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Get authorization token (user's session)
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify user authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Get or create API key for the user
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .rpc('get_or_create_api_key', { p_user_id: authUser.id });

    let apiKey = null;

    if (apiKeyError) {
      console.error('Error calling RPC function:', apiKeyError);
      // Fallback: try to query the table directly
      const { data: apiKeys, error: keysError } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (keysError) {
        console.error('Error querying api_keys table:', keysError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to get API key',
            details: apiKeyError.message || keysError.message
          }),
        };
      }

      apiKey = apiKeys && apiKeys[0]?.api_key;
    } else {
      // RPC function returns the key directly as TEXT
      apiKey = apiKeyData;
    }

    // If still no key, try to create one manually
    if (!apiKey) {
      // Generate a simple API key
      const generatedKey = `alt_${authUser.id.substring(0, 8)}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

      const { data: newKeyData, error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: authUser.id,
          api_key: generatedKey,
          name: 'WordPress Plugin',
          is_active: true
        })
        .select('api_key')
        .single();

      if (insertError) {
        console.error('Error creating API key:', insertError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to create API key',
            details: insertError.message
          }),
        };
      }

      apiKey = newKeyData?.api_key || generatedKey;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        api_key: apiKey,
        user_id: authUser.id
      }),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'get-api-key', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

