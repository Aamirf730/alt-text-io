// Netlify Function to Delete User Accounts
// File: netlify-functions/delete-users.js
// Requires superuser authentication

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Superuser emails (comma-separated list from environment variable)
const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);

exports.handler = async (event, context) => {
  console.log('=== DELETE-USERS FUNCTION CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('HTTP Method:', event.httpMethod);
  
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check environment variables
    console.log('=== ENVIRONMENT VARIABLES CHECK ===');
    console.log('SUPABASE_URL:', supabaseUrl ? (supabaseUrl.substring(0, 30) + '...') : 'NOT SET');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET (hidden)' : 'NOT SET');
    console.log('SUPERUSER_EMAILS:', SUPERUSER_EMAILS.length > 0 ? SUPERUSER_EMAILS.join(', ') : 'NOT SET');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('CRITICAL: Supabase configuration missing!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Supabase credentials not configured'
        }),
      };
    }

    // Get authorization token
    console.log('=== AUTHENTICATION CHECK ===');
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log('Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('ERROR: No authorization header');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    console.log('Token preview:', token ? (token.substring(0, 20) + '...') : 'NO TOKEN');
    
    // Validate JWT token and get user
    console.log('Validating JWT token with Supabase...');
    let user = null;
    let authError = null;
    
    try {
      const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser(token);
      user = authUser;
      authError = getUserError;
      
      if (authError) {
        console.error('Supabase getUser error:', authError);
      } else if (user) {
        console.log('User authenticated successfully');
        console.log('User email:', user.email);
      }
    } catch (err) {
      console.error('Exception during token validation:', err);
      authError = err;
    }
    
    if (authError || !user) {
      console.error('Authentication failed');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid or expired token',
          details: authError?.message || 'User not found'
        }),
      };
    }

    // Check if user is a superuser
    console.log('=== SUPERUSER CHECK ===');
    console.log('User email:', user.email);
    console.log('Superuser emails list:', SUPERUSER_EMAILS);
    console.log('Is superuser?', SUPERUSER_EMAILS.includes(user.email));
    
    if (!SUPERUSER_EMAILS.includes(user.email)) {
      console.error('Access denied - user is not a superuser');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'Access denied. Superuser privileges required.'
        }),
      };
    }

    // Parse request body to get emails to delete
    console.log('=== PARSING REQUEST ===');
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (err) {
      console.error('Error parsing request body:', err);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const emailsToDelete = requestBody.emails || [];
    if (!Array.isArray(emailsToDelete) || emailsToDelete.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'emails array is required and must not be empty' }),
      };
    }

    console.log('Emails to delete:', emailsToDelete);

    const results = {
      deleted: [],
      notFound: [],
      errors: []
    };

    // Delete each user
    for (const email of emailsToDelete) {
      console.log(`\n=== DELETING USER: ${email} ===`);
      
      try {
        // Step 1: Find user by email
        const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          console.error(`Error listing users for ${email}:`, listError);
          results.errors.push({ email, error: listError.message });
          continue;
        }

        const authUser = authUsers.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!authUser) {
          console.log(`User not found: ${email}`);
          results.notFound.push(email);
          continue;
        }

        console.log(`Found user: ${authUser.id} (${authUser.email})`);

        // Step 2: Delete related data from profiles table
        console.log('Deleting profile data...');
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', authUser.id);

        if (profileDeleteError) {
          console.error(`Error deleting profile for ${email}:`, profileDeleteError);
          // Continue anyway - might not have a profile
        } else {
          console.log('Profile deleted');
        }

        // Step 3: Delete usage logs (should cascade, but doing explicitly)
        console.log('Deleting usage logs...');
        const { error: usageDeleteError } = await supabase
          .from('usage_logs')
          .delete()
          .eq('user_id', authUser.id);

        if (usageDeleteError) {
          console.error(`Error deleting usage logs for ${email}:`, usageDeleteError);
        } else {
          console.log('Usage logs deleted');
        }

        // Step 4: Delete payments (should cascade, but doing explicitly)
        console.log('Deleting payments...');
        const { error: paymentsDeleteError } = await supabase
          .from('payments')
          .delete()
          .eq('user_id', authUser.id);

        if (paymentsDeleteError) {
          console.error(`Error deleting payments for ${email}:`, paymentsDeleteError);
        } else {
          console.log('Payments deleted');
        }

        // Step 5: Delete from auth.users (this is the main deletion)
        console.log('Deleting auth user...');
        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);

        if (deleteError) {
          console.error(`Error deleting auth user for ${email}:`, deleteError);
          results.errors.push({ email, error: deleteError.message });
        } else {
          console.log(`✅ Successfully deleted user: ${email}`);
          results.deleted.push(email);
        }

      } catch (err) {
        console.error(`Exception deleting user ${email}:`, err);
        results.errors.push({ email, error: err.message });
      }
    }

    console.log('\n=== DELETION SUMMARY ===');
    console.log('Deleted:', results.deleted.length);
    console.log('Not found:', results.notFound.length);
    console.log('Errors:', results.errors.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Processed ${emailsToDelete.length} user(s)`,
        results: {
          deleted: results.deleted,
          notFound: results.notFound,
          errors: results.errors
        }
      }),
    };

  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString()
      }),
    };
  }
};

