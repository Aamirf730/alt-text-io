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
const {
  decryptApiKey,
  encryptApiKey,
  generateApiKey,
  hashApiKey,
} = require('./utils/api-key-secrets');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function parseJsonBody(event) {
  if (!event?.body) return {};
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(rawBody);
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Rate limiting
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`get-api-key:ip:${clientIp}`);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Get authorization token (user's session)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Verify user authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    let rotateRequested = false;
    if (event.httpMethod === 'POST' && event.body) {
      try {
        rotateRequested = parseJsonBody(event).rotate === true;
      } catch (_error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request body' }),
        };
      }
    }

    // Read the encrypted value only with the service-role client. The raw
    // api_key column is selected solely to migrate legacy rows once, then is
    // cleared in the same authorized request.
    let apiKeyRecord = null;
    if (!rotateRequested) {
      const { data, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('id, api_key, api_key_hash, api_key_encrypted, is_active')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (apiKeyError) {
        console.error('Error querying API key metadata:', apiKeyError.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to get API key' }),
        };
      }

      apiKeyRecord = data;
    }

    let apiKey = null;

    if (!apiKeyRecord) {
      const generatedApiKey = generateApiKey();
      const { data: issuedData, error: issueError } = await supabase.rpc('issue_api_key', {
        p_user_id: authUser.id,
        p_api_key_hash: hashApiKey(generatedApiKey),
        p_api_key_encrypted: encryptApiKey(generatedApiKey),
        p_api_key_last4: generatedApiKey.slice(-4),
        p_rotate: rotateRequested,
      });

      if (issueError || !issuedData?.success) {
        console.error('Error issuing API key:', issueError?.message || issuedData?.error || 'Unknown error');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create API key' }),
        };
      }

      if (issuedData.created) {
        apiKey = generatedApiKey;
      } else {
        apiKeyRecord = issuedData;
      }
    }

    if (!apiKey && apiKeyRecord?.api_key_encrypted) {
      apiKey = decryptApiKey(apiKeyRecord.api_key_encrypted);
      if (!apiKey) {
        console.error('Stored API key decryption failed');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Stored API key could not be recovered' }),
        };
      }
    } else if (!apiKey && apiKeyRecord?.api_key) {
      // Migrate a legacy plaintext key during an authorized retrieval. The
      // plaintext is never returned from the database after this update.
      apiKey = apiKeyRecord.api_key;
      const apiKeyEncrypted = encryptApiKey(apiKey);
      const { error: migrateError } = await supabase
        .from('api_keys')
        .update({
          api_key: null,
          api_key_hash: hashApiKey(apiKey),
          api_key_encrypted: apiKeyEncrypted,
          api_key_last4: apiKey.slice(-4),
        })
        .eq('id', apiKeyRecord.id)
        .eq('user_id', authUser.id);

      if (migrateError) {
        console.error('Error migrating legacy API key:', migrateError.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to secure API key' }),
        };
      }
    } else if (!apiKey && apiKeyRecord?.api_key_hash) {
      // A one-way hash can validate a key but cannot reveal it. Require an
      // explicit rotation rather than silently invalidating a live plugin key.
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          code: 'api_key_rotation_required',
          error: 'Generate a new API key to continue.',
        }),
      };
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
    reportError(error, { functionName: 'get-api-key' });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
