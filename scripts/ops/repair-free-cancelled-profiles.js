/**
 * Repair Free profiles stuck as `cancelled` (flow audit 2026-10-29, §2.3).
 *
 * A Polar `subscription.canceled` that arrived after `subscription.revoked`
 * used to match a revoked (Free) profile because its subscription_id was
 * null, and set subscription_status = 'cancelled'. renew_monthly_credits()
 * only renews Free + active profiles, so these users stopped receiving
 * their 15 monthly credits. The webhook no longer does this; this script
 * repairs the rows it already wrote.
 *
 * Usage (from the repository root; loads .env from the working directory):
 *   node scripts/ops/repair-free-cancelled-profiles.js           # dry run: list only
 *   node scripts/ops/repair-free-cancelled-profiles.js --apply   # write
 *
 * --apply sets subscription_status = 'active' on every listed profile that
 * still has plan 'free', status 'cancelled' and no subscription ID. That
 * makes it eligible for the daily 'renew-free-credits' cron again: a profile
 * last renewed 30+ days ago is renewed on the next 02:00 UTC run (15 monthly
 * credits plus its bonus and purchased ledgers). Nothing else changes.
 *
 * Free + cancelled profiles that still have a subscription ID are listed for
 * manual review and never written.
 *
 * Writes to production with the service-role key. Run only with explicit,
 * scoped approval.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const APPLY = process.argv.includes('--apply');
const RENEWAL_INTERVAL_DAYS = 30;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function maskEmail(email) {
  const value = String(email || '');
  const [local, domain] = value.split('@');
  if (!domain) return '(no email)';
  return `${local.slice(0, 2)}***@${domain}`;
}

function renewalEligibility(profile, now = new Date()) {
  if (!profile.credits_last_renewed_at) return 'next cron run (never renewed)';
  const last = new Date(profile.credits_last_renewed_at);
  const due = new Date(last.getTime() + RENEWAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
  return due <= now ? 'next cron run (overdue)' : `on or after ${due.toISOString().slice(0, 10)}`;
}

async function repairFreeCancelledProfiles() {
  console.log('🔧 Repair: Free profiles stuck as cancelled');
  console.log('===========================================');
  console.log(`Mode: ${APPLY ? 'APPLY (writes to the database)' : 'dry run (no writes)'}`);
  console.log('');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, subscription_plan, subscription_status, subscription_id, credits_remaining, bonus_credits_remaining, purchased_credits_remaining, credits_last_renewed_at, updated_at')
    .eq('subscription_plan', 'free')
    .eq('subscription_status', 'cancelled')
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching profiles:', error.message || error);
    process.exitCode = 1;
    return;
  }

  const repairable = (profiles || []).filter((profile) => !profile.subscription_id);
  const manualReview = (profiles || []).filter((profile) => profile.subscription_id);

  console.log(`Found ${profiles.length} Free + cancelled profile(s): ${repairable.length} repairable, ${manualReview.length} for manual review.`);
  console.log('');

  for (const profile of repairable) {
    console.log(`  • ${profile.id} ${maskEmail(profile.email)}`);
    console.log(`      credits ${profile.credits_remaining} (bonus ${profile.bonus_credits_remaining}, purchased ${profile.purchased_credits_remaining})`);
    console.log(`      last renewed ${profile.credits_last_renewed_at || 'never'}; renewal ${renewalEligibility(profile)}`);
  }

  if (manualReview.length > 0) {
    console.log('');
    console.log('⚠️  Not touched (still carry a subscription ID; check Polar first):');
    for (const profile of manualReview) {
      console.log(`  • ${profile.id} ${maskEmail(profile.email)} subscription ${profile.subscription_id}`);
    }
  }

  if (!APPLY) {
    console.log('');
    console.log('Dry run complete. Re-run with --apply to set these profiles to active.');
    return;
  }

  if (repairable.length === 0) {
    console.log('');
    console.log('Nothing to repair.');
    return;
  }

  console.log('');
  let repaired = 0;
  for (const profile of repairable) {
    // Re-check every condition in the write so a profile that changed since
    // the read (for example a new subscription) is left alone.
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .eq('subscription_plan', 'free')
      .eq('subscription_status', 'cancelled')
      .is('subscription_id', null)
      .select('id');

    if (updateError) {
      console.error(`❌ ${profile.id}: ${updateError.message || updateError}`);
      process.exitCode = 1;
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`↷ ${profile.id}: changed since it was read; skipped`);
      continue;
    }

    repaired += 1;
    console.log(`✅ ${profile.id}: active; renewal ${renewalEligibility(profile)}`);
  }

  console.log('');
  console.log(`Repaired ${repaired} of ${repairable.length} profile(s).`);
}

repairFreeCancelledProfiles().catch((error) => {
  console.error('❌ Unexpected error:', error.message || error);
  process.exit(1);
});
