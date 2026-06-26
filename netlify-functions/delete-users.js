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
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Superuser emails (comma-separated list from environment variable)
const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);

// Stricter rate limit for admin endpoints
const ADMIN_RATE_LIMIT = 10;

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

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

    const token = authHeader.replace('Bearer ', '').trim();

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
    if (!SUPERUSER_EMAILS.includes(user.email)) {
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

    console.log('Emails to delete:', emailsToDelete);

    const results = [];
    const errors = [];

    // Get all users from auth
    const { data: { users: allUsers }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to list users', details: listError.message }),
      };
    }

    // Process each email
    for (const email of emailsToDelete) {
      try {
        console.log(`Processing deletion for: ${email}`);

        // Find user by email
        const authUser = allUsers.find(u => u.email === email);

        if (!authUser) {
          console.log(`User not found: ${email}`);
          results.push({
            email,
            status: 'not_found',
            message: 'User not found in auth.users'
          });
          continue;
        }

        const userId = authUser.id;
        console.log(`Found user: ${email} (ID: ${userId})`);

        // Delete related data first (profiles, payments, usage_logs)
        // Note: These should cascade delete, but we'll delete them explicitly to be safe

        // Delete usage logs
        const { error: usageError } = await supabase
          .from('usage_logs')
          .delete()
          .eq('user_id', userId);

        if (usageError) {
          console.error(`Error deleting usage logs for ${email}:`, usageError);
        } else {
          console.log(`Deleted usage logs for ${email}`);
        }

        // Delete payments
        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .eq('user_id', userId);

        if (paymentsError) {
          console.error(`Error deleting payments for ${email}:`, paymentsError);
        } else {
          console.log(`Deleted payments for ${email}`);
        }

        // Delete profile
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          console.error(`Error deleting profile for ${email}:`, profileError);
        } else {
          console.log(`Deleted profile for ${email}`);
        }

        // Finally, delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error(`Error deleting auth user for ${email}:`, deleteError);
          errors.push({
            email,
            error: deleteError.message
          });
        } else {
          console.log(`Successfully deleted user: ${email}`);
          results.push({
            email,
            status: 'deleted',
            message: 'User and all associated data deleted successfully'
          });
        }

      } catch (error) {
        console.error(`Error processing ${email}:`, error);
        errors.push({
          email,
          error: error.message
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
        details: error.message
      }),
    };
  }
};

