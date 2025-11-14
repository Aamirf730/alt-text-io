/**
 * Script to Delete Test User Accounts
 * Run this script locally to delete the specified test accounts
 * 
 * Usage: node delete-test-users.js
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://qurbdtzrngzfzevgoolp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('Please set it before running this script');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Emails to delete
const emailsToDelete = [
  'aamirfaizpaypal@gmail.com',
  'faizmfaiz80@gmail.com',
  'alfaazfaizkhan@gmail.com',
  'aamirf730@gmail.com'
];

async function deleteUsers() {
  console.log('🗑️  Starting user deletion process...\n');

  // Get all users from auth
  const { data: { users: allUsers }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError);
    process.exit(1);
  }

  console.log(`📋 Found ${allUsers.length} total users in database\n`);

  const results = [];
  const errors = [];

  for (const email of emailsToDelete) {
    try {
      console.log(`\n🔍 Processing: ${email}`);
      
      // Find user by email
      const authUser = allUsers.find(u => u.email === email);
      
      if (!authUser) {
        console.log(`   ⚠️  User not found: ${email}`);
        results.push({
          email,
          status: 'not_found',
          message: 'User not found in auth.users'
        });
        continue;
      }

      const userId = authUser.id;
      console.log(`   ✅ Found user (ID: ${userId})`);

      // Delete related data first
      console.log(`   🗑️  Deleting related data...`);
      
      // Delete usage logs
      const { error: usageError } = await supabase
        .from('usage_logs')
        .delete()
        .eq('user_id', userId);
      
      if (usageError) {
        console.error(`   ⚠️  Error deleting usage logs:`, usageError.message);
      } else {
        console.log(`   ✅ Deleted usage logs`);
      }

      // Delete payments
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('user_id', userId);
      
      if (paymentsError) {
        console.error(`   ⚠️  Error deleting payments:`, paymentsError.message);
      } else {
        console.log(`   ✅ Deleted payments`);
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        console.error(`   ⚠️  Error deleting profile:`, profileError.message);
      } else {
        console.log(`   ✅ Deleted profile`);
      }

      // Finally, delete the auth user
      console.log(`   🗑️  Deleting auth user...`);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error(`   ❌ Error deleting auth user:`, deleteError.message);
        errors.push({
          email,
          error: deleteError.message
        });
      } else {
        console.log(`   ✅ Successfully deleted user: ${email}`);
        results.push({
          email,
          status: 'deleted',
          message: 'User and all associated data deleted successfully'
        });
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${email}:`, error.message);
      errors.push({
        email,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DELETION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Successfully deleted: ${results.filter(r => r.status === 'deleted').length} user(s)`);
  results.filter(r => r.status === 'deleted').forEach(r => {
    console.log(`   - ${r.email}`);
  });

  if (results.filter(r => r.status === 'not_found').length > 0) {
    console.log(`\n⚠️  Not found: ${results.filter(r => r.status === 'not_found').length} user(s)`);
    results.filter(r => r.status === 'not_found').forEach(r => {
      console.log(`   - ${r.email}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors: ${errors.length} user(s)`);
    errors.forEach(e => {
      console.log(`   - ${e.email}: ${e.error}`);
    });
  }

  console.log('\n✨ Process completed!\n');
}

// Run the deletion
deleteUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

