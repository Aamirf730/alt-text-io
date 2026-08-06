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
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['GET', 'POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

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

    let rotateRequested = false;
    if (event.httpMethod === 'POST' && event.body) {
      try {
        rotateRequested = JSON.parse(event.body).rotate === true;
      } catch (_error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request body' }),
        };
      }
    }

    if (rotateRequested) {
      const { error: deactivateError } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('user_id', authUser.id)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error rotating API key:', deactivateError.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to rotate API key' }),
        };
      }
    }

    // Read the encrypted value only with the service-role client. The raw
    // api_key column is selected solely to migrate legacy rows once, then is
    // cleared in the same authorized request.
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
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

    let apiKey = null;

    if (apiKeyRecord?.api_key_encrypted) {
      apiKey = decryptApiKey(apiKeyRecord.api_key_encrypted);
      if (!apiKey) {
        console.error('API key decryption failed for user:', authUser.id);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Stored API key could not be recovered' }),
        };
      }
    } else if (apiKeyRecord?.api_key) {
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
    } else if (apiKeyRecord?.api_key_hash) {
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
    } else {
      apiKey = generateApiKey();
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: authUser.id,
          api_key: null,
          api_key_hash: hashApiKey(apiKey),
          api_key_encrypted: encryptApiKey(apiKey),
          api_key_last4: apiKey.slice(-4),
          name: 'WordPress Plugin',
          is_active: true,
        });

      if (insertError) {
        console.error('Error creating API key:', insertError.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create API key' }),
        };
      }
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

