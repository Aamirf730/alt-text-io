// Netlify Function for Admin to Get All Users
// File: netlify-functions/admin-get-users.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Superuser emails (comma-separated list from environment variable)
// Current superuser: help@wpgeared.com
// Set SUPERUSER_EMAILS environment variable in Netlify: help@wpgeared.com
const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);

exports.handler = async (event, context) => {
  // Log function invocation
  console.log('=== ADMIN-GET-USERS FUNCTION CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('HTTP Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('Request ID:', context.requestId || 'N/A');
  
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    console.log('OPTIONS preflight request - returning 200');
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    console.error('Invalid HTTP method:', event.httpMethod);
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
    console.log('SUPERUSER_EMAILS (raw):', process.env.SUPERUSER_EMAILS || 'NOT SET');
    
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
        console.error('Error message:', authError.message);
        console.error('Error status:', authError.status);
      } else if (user) {
        console.log('User authenticated successfully');
        console.log('User ID:', user.id);
        console.log('User email:', user.email);
      } else {
        console.error('No user returned from getUser');
      }
    } catch (err) {
      console.error('Exception during token validation:', err);
      console.error('Exception message:', err.message);
      console.error('Exception stack:', err.stack);
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
          error: 'Access denied. Superuser privileges required.',
          details: `User email ${user.email} is not in the superuser list.`
        }),
      };
    }

    console.log('User is a superuser - proceeding with data fetch');

    // Get all profiles with related data
    console.log('=== FETCHING PROFILES ===');
    let profiles = [];
    let profilesError = null;
    
    try {
      const { data: profilesData, error: profilesErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
      profiles = profilesData || [];
      profilesError = profilesErr;
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        console.error('Error code:', profilesError.code);
        console.error('Error message:', profilesError.message);
        console.error('Error details:', profilesError.details);
        console.error('Error hint:', profilesError.hint);
      } else {
        console.log('Profiles fetched successfully');
        console.log('Number of profiles:', profiles.length);
      }
    } catch (err) {
      console.error('Exception fetching profiles:', err);
      profilesError = err;
    }

    if (profilesError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch user profiles',
          details: profilesError.message || JSON.stringify(profilesError)
        }),
      };
    }

    // Get all payments for all users
    console.log('=== FETCHING PAYMENTS ===');
    let payments = [];
    let paymentsError = null;
    
    try {
      const { data: paymentsData, error: paymentsErr } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

      payments = paymentsData || [];
      paymentsError = paymentsErr;
      
    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      } else {
        console.log('Payments fetched successfully');
        console.log('Number of payments:', payments.length);
      }
    } catch (err) {
      console.error('Exception fetching payments:', err);
      paymentsError = err;
    }

    // Get usage statistics for all users
    console.log('=== FETCHING USAGE LOGS ===');
    let usageLogs = [];
    let usageError = null;
    
    try {
      const { data: usageData, error: usageErr } = await supabase
      .from('usage_logs')
      .select('user_id, credits_used, created_at')
      .order('created_at', { ascending: false });

      usageLogs = usageData || [];
      usageError = usageErr;
      
    if (usageError) {
      console.error('Error fetching usage logs:', usageError);
      } else {
        console.log('Usage logs fetched successfully');
        console.log('Number of usage logs:', usageLogs.length);
      }
    } catch (err) {
      console.error('Exception fetching usage logs:', err);
      usageError = err;
    }

    // Enrich profiles with additional data
    console.log('=== ENRICHING PROFILES ===');
    const enrichedProfiles = profiles.map(profile => {
      // Get payments for this user
      const userPayments = payments?.filter(p => p.user_id === profile.id) || [];
      const totalPaid = userPayments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      // Get usage stats for this user
      const userUsageLogs = usageLogs?.filter(u => u.user_id === profile.id) || [];
      const totalUsageCount = userUsageLogs.length;
      const totalCreditsUsed = userUsageLogs.reduce((sum, u) => sum + (u.credits_used || 0), 0);

      // Get latest payment
      const latestPayment = userPayments.length > 0 
        ? userPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;

      return {
        ...profile,
        total_paid: totalPaid,
        total_usage_count: totalUsageCount,
        total_credits_used: totalCreditsUsed,
        payment_count: userPayments.length,
        latest_payment: latestPayment ? {
          amount: latestPayment.amount,
          status: latestPayment.status,
          created_at: latestPayment.created_at,
          plan_id: latestPayment.plan_id
        } : null
      };
    });

    console.log('=== PREPARING RESPONSE ===');
    console.log('Enriched profiles count:', enrichedProfiles.length);
    
    const response = {
        success: true,
        data: {
          users: enrichedProfiles,
          total_users: enrichedProfiles.length,
          stats: {
            total_revenue: enrichedProfiles.reduce((sum, p) => sum + (p.total_paid || 0), 0),
            active_users: enrichedProfiles.filter(p => p.subscription_status === 'active').length,
            total_credits_used: enrichedProfiles.reduce((sum, p) => sum + (p.total_credits_used || 0), 0),
            total_credits_remaining: enrichedProfiles.reduce((sum, p) => sum + (p.credits_remaining || 0), 0),
          }
        }
    };

    console.log('Response prepared successfully');
    console.log('Total users:', response.data.total_users);
    console.log('Total revenue:', response.data.stats.total_revenue);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};

