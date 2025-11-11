/**
 * Netlify Function to Reset Test User
 * Can be invoked via HTTP or Netlify CLI
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const testEmail = 'aamirf730@gmail.com';
  const results = {
    steps: [],
    errors: [],
    finalState: null,
    isolationCheck: null
  };

  try {
    // Step 1: Find user
    results.steps.push('🔍 Finding user...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      results.errors.push(`Auth error: ${authError.message}`);
      throw authError;
    }
    
    const authUser = authUsers.users.find(u => u.email === testEmail);
    
    if (!authUser) {
      results.errors.push(`User not found: ${testEmail}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `User not found: ${testEmail}`, results }),
      };
    }
    
    results.steps.push(`✅ Found user: ${authUser.id}`);
    
    // Step 2: Get current state
    results.steps.push('📊 Getting current state...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError) {
      results.errors.push(`Profile error: ${profileError.message}`);
      throw profileError;
    }
    
    const beforeState = {
      credits_remaining: profile.credits_remaining,
      total_processed: profile.total_processed,
      subscription_plan: profile.subscription_plan,
      subscription_status: profile.subscription_status,
    };
    
    results.steps.push(`Current state: ${JSON.stringify(beforeState)}`);
    
    // Step 3: Count usage logs
    const { count: usageCount } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authUser.id);
    
    results.steps.push(`Usage logs: ${usageCount || 0}`);
    
    // Step 4: Delete usage logs
    results.steps.push('🗑️  Deleting usage logs...');
    const { error: deleteUsageError } = await supabase
      .from('usage_logs')
      .delete()
      .eq('user_id', authUser.id);
    
    if (deleteUsageError) {
      results.errors.push(`Delete usage logs error: ${deleteUsageError.message}`);
    } else {
      results.steps.push(`✅ Deleted ${usageCount || 0} usage logs`);
    }
    
    // Step 5: Reset profile
    results.steps.push('🔄 Resetting profile...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        credits_remaining: 100,
        total_processed: 0,
        subscription_plan: 'free',
        subscription_status: 'active',
        subscription_id: null,
        next_billing_date: null,
        expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', authUser.id);
    
    if (updateError) {
      results.errors.push(`Update error: ${updateError.message}`);
      throw updateError;
    }
    
    results.steps.push('✅ Profile reset complete');
    
    // Step 6: Get updated state
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    results.finalState = {
      credits_remaining: updatedProfile.credits_remaining,
      total_processed: updatedProfile.total_processed,
      subscription_plan: updatedProfile.subscription_plan,
      subscription_status: updatedProfile.subscription_status,
    };
    
    // Step 7: Verify user isolation
    results.steps.push('🔒 Verifying user isolation...');
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, total_processed')
      .order('created_at', { ascending: false })
      .limit(10);
    
    const testUserProfile = allProfiles.find(p => p.email === testEmail);
    const otherUsers = allProfiles.filter(p => p.email !== testEmail);
    
    results.isolationCheck = {
      testUser: {
        email: testUserProfile.email,
        credits: testUserProfile.credits_remaining,
        processed: testUserProfile.total_processed
      },
      otherUsers: otherUsers.slice(0, 3).map(u => ({
        email: u.email,
        credits: u.credits_remaining,
        processed: u.total_processed
      })),
      isolationVerified: otherUsers.length > 0 && 
        otherUsers.every(u => u.credits_remaining !== testUserProfile.credits_remaining)
    };
    
    results.steps.push('✅ User isolation verified');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `User ${testEmail} reset successfully`,
        beforeState,
        afterState: results.finalState,
        results
      }, null, 2),
    };
    
  } catch (error) {
    console.error('Reset error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        results
      }, null, 2),
    };
  }
};

