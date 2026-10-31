// Every account should have a profile: handle_new_user creates one when the
// account is created. Two accounts from late 2025 had none, and the dashboard
// could not load for them. These values match handle_new_user
// (supabase/migrations/20260809120000_apply_2026_08_pricing_packages.sql);
// keep the two in step.
function buildNewProfile(authUser, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    id: authUser.id,
    email: authUser.email || '',
    subscription_plan: 'free',
    subscription_status: 'active',
    credits_remaining: 165,
    bonus_credits_remaining: 150,
    total_processed: 0,
    credits_last_renewed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

// PostgREST answers .single() with PGRST116 when no row matched. Any other
// error is an outage, not a missing profile, and must not create one.
function isMissingProfile(profile, error) {
  return !profile && (!error || error.code === 'PGRST116');
}

/**
 * Creates the profile for an account that has none. An existing profile is
 * never changed (a concurrent request may have just created it).
 * Returns true when the profile now exists.
 */
async function createMissingProfile(supabase, authUser) {
  if (!authUser?.id) return false;

  const { error } = await supabase
    .from('profiles')
    .upsert(buildNewProfile(authUser), { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error('[ensure-profile] Could not create a missing profile:', error.message);
    return false;
  }

  console.warn('[ensure-profile] Created a missing profile for user', String(authUser.id).slice(0, 8));
  return true;
}

module.exports = {
  buildNewProfile,
  createMissingProfile,
  isMissingProfile,
};
