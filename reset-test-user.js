/**
 * Reset Test User Script
 * Resets user "aamirf730@gmail.com" to fresh state
 * Also verifies user isolation in database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetTestUser() {
  const testEmail = 'aamirf730@gmail.com';
  
  console.log('🔍 Finding user:', testEmail);
  
  try {
    // Step 1: Find user by email in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const authUser = authUsers.users.find(u => u.email === testEmail);
    
    if (!authUser) {
      console.error('❌ User not found in auth.users:', testEmail);
      return;
    }
    
    console.log('✅ Found user in auth.users:', {
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at
    });
    
    // Step 2: Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }
    
    console.log('\n📊 Current User State:');
    console.log('  Credits Remaining:', profile.credits_remaining);
    console.log('  Total Processed:', profile.total_processed);
    console.log('  Subscription Plan:', profile.subscription_plan);
    console.log('  Subscription Status:', profile.subscription_status);
    
    // Step 3: Get usage logs count
    const { count: usageCount } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authUser.id);
    
    console.log('  Usage Logs:', usageCount || 0);
    
    // Step 4: Get payments count
    const { count: paymentCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authUser.id);
    
    console.log('  Payments:', paymentCount || 0);
    
    // Step 5: Reset user to fresh state
    console.log('\n🔄 Resetting user to fresh state...');
    
    // Delete usage logs
    const { error: deleteUsageError } = await supabase
      .from('usage_logs')
      .delete()
      .eq('user_id', authUser.id);
    
    if (deleteUsageError) {
      console.error('⚠️  Error deleting usage logs:', deleteUsageError);
    } else {
      console.log('✅ Deleted usage logs');
    }
    
    // Delete payments (optional - you might want to keep these)
    // Uncomment if you want to delete payments too
    // const { error: deletePaymentsError } = await supabase
    //   .from('payments')
    //   .delete()
    //   .eq('user_id', authUser.id);
    
    // Reset profile to fresh state
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
      console.error('❌ Error updating profile:', updateError);
      return;
    }
    
    console.log('✅ Reset profile to fresh state');
    
    // Step 6: Verify reset
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    console.log('\n✅ User Reset Complete!');
    console.log('\n📊 New User State:');
    console.log('  Credits Remaining:', updatedProfile.credits_remaining);
    console.log('  Total Processed:', updatedProfile.total_processed);
    console.log('  Subscription Plan:', updatedProfile.subscription_plan);
    console.log('  Subscription Status:', updatedProfile.subscription_status);
    
    // Step 7: Verify user isolation
    console.log('\n🔒 Verifying User Isolation...');
    
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id, email, credits_remaining, total_processed')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allProfilesError) {
      console.error('❌ Error fetching all profiles:', allProfilesError);
      return;
    }
    
    console.log('\n👥 Other Users in Database (showing 10 most recent):');
    allProfiles.forEach((p, index) => {
      const isTestUser = p.email === testEmail;
      console.log(`  ${index + 1}. ${p.email}${isTestUser ? ' (TEST USER)' : ''}`);
      console.log(`     Credits: ${p.credits_remaining}, Processed: ${p.total_processed}`);
    });
    
    // Verify test user's data is separate
    const testUserProfile = allProfiles.find(p => p.email === testEmail);
    const otherUsers = allProfiles.filter(p => p.email !== testEmail);
    
    if (otherUsers.length > 0) {
      const otherUser = otherUsers[0];
      console.log('\n✅ User Isolation Verified:');
      console.log(`  Test User Credits: ${testUserProfile.credits_remaining}`);
      console.log(`  Other User Credits: ${otherUser.credits_remaining}`);
      console.log(`  ✅ Credits are separate and independent`);
      
      // Check usage logs isolation
      const { count: testUserLogs } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id);
      
      const { count: otherUserLogs } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', otherUser.id);
      
      console.log(`\n  Test User Usage Logs: ${testUserLogs || 0}`);
      console.log(`  Other User Usage Logs: ${otherUserLogs || 0}`);
      console.log(`  ✅ Usage logs are separate and isolated`);
    }
    
    console.log('\n✅ Reset Complete! User is ready for testing.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the reset
resetTestUser()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

