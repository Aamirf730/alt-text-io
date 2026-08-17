// Netlify Function to Delete Test User Accounts
// File: netlify-functions/delete-users.js
// This function deletes users and all their associated data from Supabase

const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Superuser emails (comma-separated list from environment variable)
const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);

// Stricter rate limit for admin endpoints
const ADMIN_RATE_LIMIT = 10;

function getDevelopmentErrorDetails(error) {
  if (process.env.NODE_ENV !== 'development' || !error?.message) {
    return {};
  }

  return { details: String(error.message) };
}

async function fetchAllAuthUsers(authAdmin, { perPage = 1000, maxPages = 100 } = {}) {
  const users = [];

  for (let page = 1; page <= maxPages + 1; page += 1) {
    const { data, error } = await authAdmin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const batch = data?.users || [];
    if (page > maxPages) {
      if (batch.length === 0) return users;
      throw new Error('Auth user pagination limit reached');
    }

    users.push(...batch);
    if (batch.length < perPage) return users;
  }

  return users;
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

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

  // Stricter rate limiting for delete endpoints
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-delete:${clientIp}`, ADMIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Validate JWT token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Check if user is a superuser
    if (!SUPERUSER_EMAILS.includes(String(user.email || '').trim().toLowerCase())) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied. Superuser privileges required.' }),
      };
    }

    // Safe JSON parse with validation
    const { parseJsonBody, validateEmailArray, badRequest } = require('./utils/input-validator');
    const { data: requestBody, error: parseError } = parseJsonBody(event.body);
    if (parseError) return badRequest(headers, parseError);

    const { value: emailsToDelete, error: emailsError } = validateEmailArray(
      requestBody.emails,
      { maxItems: 50 }
    );
    if (emailsError) return badRequest(headers, emailsError);

    const results = [];
    const errors = [];

    // Get all users from auth
    let allUsers;
    try {
      allUsers = await fetchAllAuthUsers(supabase.auth.admin);
    } catch (listError) {
      console.error('Error listing users:', listError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to list users',
          ...getDevelopmentErrorDetails(listError),
        }),
      };
    }

    // Process each email
    for (const email of emailsToDelete) {
      try {
        // Find user by email
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const authUser = allUsers.find(u => String(u.email || '').trim().toLowerCase() === normalizedEmail);

        if (!authUser) {
          results.push({
            email,
            status: 'not_found',
            message: 'User not found in auth.users'
          });
          continue;
        }

        const userId = authUser.id;
        // Delete related data first (profiles, payments, usage_logs)
        // Note: These should cascade delete, but we'll delete them explicitly to be safe

        // Delete usage logs
        const { error: usageError } = await supabase
          .from('usage_logs')
          .delete()
          .eq('user_id', userId);

        if (usageError) {
          throw new Error(`Failed to delete usage logs: ${usageError.message}`);
        }

        // Delete payments
        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .eq('user_id', userId);

        if (paymentsError) {
          throw new Error(`Failed to delete payments: ${paymentsError.message}`);
        }

        // Delete profile
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          throw new Error(`Failed to delete profile: ${profileError.message}`);
        }

        // Finally, delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error('Error deleting an auth user during an admin account deletion');
          errors.push({
            email,
            error: 'Failed to delete user',
            ...getDevelopmentErrorDetails(deleteError),
          });
        } else {
          results.push({
            email,
            status: 'deleted',
            message: 'User and all associated data deleted successfully'
          });
        }

      } catch (error) {
        console.error('Unexpected admin account-deletion error');
        errors.push({
          email,
          error: 'Failed to process user deletion',
          ...getDevelopmentErrorDetails(error),
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Processed ${emailsToDelete.length} user(s)`,
        results,
        errors: errors.length > 0 ? errors : undefined
      }),
    };

  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'delete-users', ip: getClientIp(event) });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        ...getDevelopmentErrorDetails(error),
      }),
    };
  }
};

exports._private = {
  getDevelopmentErrorDetails,
  fetchAllAuthUsers,
};
