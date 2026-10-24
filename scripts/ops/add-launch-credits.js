/**
 * Add Trial Program Credits Script
 * Adds 5000 free credits to user "travelbunny@live.co.uk" as part of trial program
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

async function addLaunchCredits() {
  const userEmail = 'travelbunny@live.co.uk';
  const creditsToAdd = 5000;
  
  console.log('🎁 Trial Program: Adding Free Credits');
  console.log('=====================================');
  console.log(`User Email: ${userEmail}`);
  console.log(`Credits to Add: ${creditsToAdd}`);
  console.log('');
  
  try {
    // Step 1: Find user by email in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const authUser = authUsers.users.find(u => u.email === userEmail);
    
    if (!authUser) {
      console.error(`❌ User not found in auth.users: ${userEmail}`);
      console.error('   Please ensure the user has signed up first.');
      return;
    }
    
    console.log('✅ Found user in auth.users:', {
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at
    });
    
    // Step 2: Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }
    
    if (!profile) {
      console.error('❌ Profile not found for user:', userEmail);
      return;
    }
    
    console.log('\n📊 Current User State:');
    console.log('  Credits Remaining:', profile.credits_remaining);
    console.log('  Total Processed:', profile.total_processed);
    console.log('  Subscription Plan:', profile.subscription_plan);
    console.log('  Subscription Status:', profile.subscription_status);
    
    // Step 3: Calculate new credits (add to existing)
    const currentCredits = profile.credits_remaining || 0;
    const newCredits = currentCredits + creditsToAdd;
    
    console.log('\n💰 Credit Update:');
    console.log(`  Current Credits: ${currentCredits}`);
    console.log(`  Credits to Add: ${creditsToAdd}`);
    console.log(`  New Total Credits: ${newCredits}`);
    
    // Step 4: Update user credits
    console.log('\n🔄 Updating user credits...');
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        credits_remaining: newCredits,
        updated_at: new Date().toISOString()
      })
      .eq('id', authUser.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return;
    }
    
    console.log('✅ Successfully updated user credits!');
    
    // Step 5: Verify update
    console.log('\n✅ Credit Update Complete!');
    console.log('\n📊 Updated User State:');
    console.log('  Credits Remaining:', updatedProfile.credits_remaining);
    console.log('  Total Processed:', updatedProfile.total_processed);
    console.log('  Subscription Plan:', updatedProfile.subscription_plan);
    console.log('  Subscription Status:', updatedProfile.subscription_status);
    console.log('  Updated At:', updatedProfile.updated_at);
    
    console.log('\n🎉 Trial program credits successfully added!');
    console.log(`   User ${userEmail} now has ${updatedProfile.credits_remaining} credits.`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
addLaunchCredits()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

