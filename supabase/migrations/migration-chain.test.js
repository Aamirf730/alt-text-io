const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = __dirname;

function sqlMigrations() {
  return fs.readdirSync(migrationsDirectory)
    .filter((file) => /^\d{14}_.+\.sql$/.test(file))
    .sort();
}

test('tracked migrations have one ordered, canonical history', () => {
  const files = sqlMigrations();
  const versions = files.map((file) => file.slice(0, 14));

  assert.ok(files.length > 1);
  assert.equal(new Set(versions).size, versions.length);
  assert.equal(files[0], '20260625140000_bootstrap_schema.sql');
  assert.equal(files.at(-1), '20260817120000_harden_credit_and_profile_integrity.sql');
});

test('bootstrap defines every foundational table and reporting view', () => {
  const bootstrap = fs.readFileSync(
    path.join(migrationsDirectory, '20260625140000_bootstrap_schema.sql'),
    'utf8',
  ).toLowerCase();

  for (const table of [
    'subscription_plans',
    'profiles',
    'usage_logs',
    'payments',
    'api_keys',
    'audit_logs',
    'marketing_events',
    'marketing_automation_sends',
  ]) {
    assert.match(
      bootstrap,
      new RegExp(`create table if not exists public\\.${table}\\b`),
      `bootstrap is missing public.${table}`,
    );
  }

  assert.match(bootstrap, /create or replace view public\.user_usage_stats\b/);
});

test('the first security migration does not require the retired users table', () => {
  const securityMigration = fs.readFileSync(
    path.join(migrationsDirectory, '20260625150407_harden_database_security.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(securityMigration, /to_regclass\('public\.users'\)/);
});

test('renewal output rename is explicit and forward-replayable', () => {
  const historical = fs.readFileSync(
    path.join(migrationsDirectory, '20260728125159_add_wpgeared_customer_offer_claim.sql'),
    'utf8',
  ).toLowerCase();
  const repair = fs.readFileSync(
    path.join(migrationsDirectory, '20260806182541_repair_renew_monthly_credits_signature.sql'),
    'utf8',
  ).toLowerCase();

  const historicalDrop = historical.indexOf('drop function if exists public.renew_monthly_credits();');
  const historicalCreate = historical.indexOf('create or replace function public.renew_monthly_credits()');
  assert.ok(historicalDrop >= 0);
  assert.ok(historicalCreate > historicalDrop);
  assert.match(repair, /drop function if exists public\.renew_monthly_credits\(\);/);
  assert.match(repair, /renewed_user_ids uuid\[\]/);
});

test('legacy PayPal cleanup refuses to drop a populated users table', () => {
  const cleanup = fs.readFileSync(
    path.join(migrationsDirectory, '20260807100000_remove_legacy_paypal_objects.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(cleanup, /drop function if exists public\.upgrade_subscription\(uuid, text, text, text\);/);
  assert.match(cleanup, /drop function if exists public\.cancel_subscription\(uuid\);/);
  assert.match(cleanup, /to_regclass\('public\.users'\)/);
  assert.match(cleanup, /legacy_user_count > 0/);
  assert.match(cleanup, /drop table public\.users/);
});

test('pricing migration pins legacy allowances and supports Agency reservations', () => {
  const pricing = fs.readFileSync(
    path.join(migrationsDirectory, '20260809120000_apply_2026_08_pricing_packages.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(pricing, /monthly_credit_allowance = sp\.credits/);
  assert.match(pricing, /drop constraint if exists profiles_subscription_plan_check/);
  assert.match(pricing, /'tier4'/);
  assert.match(pricing, /if v_subscription_plan in \('free', 'tier1', 'tier2', 'tier3', 'tier4'/);
  assert.match(pricing, /credits_remaining = 15/);
  assert.match(pricing, /bonus_credits_remaining/);
  assert.match(pricing, /credits_remaining.*165/s);
});

test('Agency catalogue follow-up keeps tier4 active', () => {
  const activation = fs.readFileSync(
    path.join(migrationsDirectory, '20260809211033_activate_tier4_catalogue.sql'),
    'utf8',
  ).toLowerCase();

  const addColumn = activation.indexOf(
    'alter table public.subscription_plans\n  add column if not exists is_active boolean not null default true',
  );
  const updateColumn = activation.indexOf('update public.subscription_plans');

  assert.ok(addColumn >= 0, 'Tier 4 migration must create subscription_plans.is_active');
  assert.ok(updateColumn > addColumn, 'Tier 4 migration must add is_active before updating it');
  assert.match(activation, /set is_active = true/);
  assert.match(activation, /where id = 'tier4'/);
});

test('client-data hardening removes billing and ledger write privileges', () => {
  const hardening = fs.readFileSync(
    path.join(migrationsDirectory, '20260811110000_harden_client_data_boundaries.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(hardening, /revoke all on table public\.profiles from public, anon, authenticated/);
  assert.match(hardening, /grant select on table public\.profiles to authenticated/);
  assert.doesNotMatch(hardening, /grant select, update on table public\.profiles to authenticated/);
  assert.doesNotMatch(hardening, /create policy "users can update own profile"/);
  assert.doesNotMatch(hardening, /create policy "users can insert own payments"/);
  assert.doesNotMatch(hardening, /create policy "users can insert own usage logs"/);
  assert.match(hardening, /from pg_catalog\.pg_policies/);
  assert.match(hardening, /set search_path = ''/);
  assert.match(hardening, /payment_reconciliation_resolved_user_id_idx/);
});

test('public catalogue only advertises shipped plan capabilities', () => {
  const catalogue = fs.readFileSync(
    path.join(migrationsDirectory, '20260811113000_correct_public_plan_features.sql'),
    'utf8',
  ).toLowerCase();

  assert.doesNotMatch(catalogue, /130\+|24\/7|soc\s?2/);
  assert.match(catalogue, /custom post type support/);
});

test('customer offer exposes only an invoker wrapper around private privileged logic', () => {
  const isolation = fs.readFileSync(
    path.join(migrationsDirectory, '20260812090651_isolate_customer_offer_claim.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(isolation, /create schema if not exists private/);
  assert.match(isolation, /private\.claim_wpgeared_customer_offer_for_caller/);
  assert.match(isolation, /caller_user_id <> \(select auth\.uid\(\)\)/);
  assert.match(isolation, /create or replace function public\.claim_wpgeared_customer_offer\(\)/);
  assert.match(isolation, /security invoker/);
  assert.match(isolation, /grant usage on schema private to authenticated/);
});

test('customer offer schema usage repair restores authenticated traversal and execution', () => {
  const repair = fs.readFileSync(
    path.join(migrationsDirectory, '20260816183608_grant_customer_offer_schema_usage.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(repair, /grant usage on schema private to authenticated/);
  assert.match(repair, /grant execute on function private\.claim_wpgeared_customer_offer_for_caller\(uuid\)\s+to authenticated/);
});

test('subscription activation applies credits and billing metadata atomically', () => {
  const activation = fs.readFileSync(
    path.join(migrationsDirectory, '20260816092527_activate_subscription_atomically.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(activation, /create or replace function public\.activate_subscription_profile\(/);
  assert.match(activation, /security definer/);
  assert.match(activation, /set search_path = ''/);
  assert.match(activation, /where p\.id = p_user_id\s+for update/);
  assert.match(activation, /credits_remaining = v_allowance \+ v_bonus_credits \+ v_purchased_credits/);
  assert.match(activation, /subscription_plan = trim\(p_subscription_plan\)/);
  assert.match(activation, /subscription_id = trim\(p_subscription_id\)/);
  assert.match(activation, /monthly_credit_allowance = nullif\(v_allowance, 0\)/);
  assert.match(activation, /grant execute on function public\.activate_subscription_profile\(/);
  assert.match(activation, /to service_role/);
  assert.doesNotMatch(activation, /grant execute on function public\.activate_subscription_profile[\s\S]*to anon/);
  assert.doesNotMatch(activation, /grant execute on function public\.activate_subscription_profile[\s\S]*to authenticated/);
});

test('subscription activation skips an identical active period on webhook replay', () => {
  const idempotency = fs.readFileSync(
    path.join(migrationsDirectory, '20260816174327_make_subscription_activation_idempotent.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(idempotency, /v_existing_subscription_id = trim\(p_subscription_id\)/);
  assert.match(idempotency, /v_existing_next_billing_date is not distinct from p_next_billing_date/);
  assert.match(idempotency, /'already_processed', true/);
  assert.match(idempotency, /credits_remaining', v_current_credits/);
  assert.match(idempotency, /from public\.profiles p\s+where p\.id = p_user_id\s+for update/);
});

test('subscription renewal locks the profile and skips stale or duplicate periods', () => {
  const renewal = fs.readFileSync(
    path.join(migrationsDirectory, '20260816200907_renew_subscription_credits_atomically.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(renewal, /create or replace function public\.renew_subscription_credits\(/);
  assert.match(renewal, /security definer/);
  assert.match(renewal, /set search_path = ''/);
  assert.match(renewal, /from public\.profiles p\s+where p\.id = p_user_id\s+for update/);
  assert.match(renewal, /v_existing_subscription_id <> trim\(p_subscription_id\)/);
  assert.match(renewal, /p_current_period_start <= v_last_renewed_at/);
  assert.match(renewal, /'period_already_processed'/);
  assert.match(renewal, /credits_remaining = v_new_credits/);
  assert.match(renewal, /bonus_credits_remaining/);
  assert.match(renewal, /purchased_credits_remaining/);
  assert.match(renewal, /grant execute on function public\.renew_subscription_credits\(/);
  assert.match(renewal, /to service_role/);
  assert.doesNotMatch(renewal, /grant execute on function public\.renew_subscription_credits[\s\S]*to anon/);
  assert.doesNotMatch(renewal, /grant execute on function public\.renew_subscription_credits[\s\S]*to authenticated/);
});

test('API-key storage revokes table-level client access', () => {
  const storage = fs.readFileSync(
    path.join(migrationsDirectory, '20260806153415_secure_api_key_storage.sql'),
    'utf8',
  ).toLowerCase();
  const repair = fs.readFileSync(
    path.join(migrationsDirectory, '20260816202022_secure_api_key_table_access.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(storage, /revoke all on table public\.api_keys\s+from public, anon, authenticated/);
  assert.match(storage, /revoke select \(api_key, api_key_hash, api_key_encrypted\)/);
  assert.match(repair, /revoke all on table public\.api_keys\s+from public, anon, authenticated/);
  assert.match(repair, /revoke select \(api_key, api_key_hash, api_key_encrypted\)/);
  assert.doesNotMatch(repair, /grant .* on table public\.api_keys .*authenticated/);
});

test('API-key issuance is serialized per profile', () => {
  const issuance = fs.readFileSync(
    path.join(migrationsDirectory, '20260817100000_atomic_api_key_issuance.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(issuance, /drop function if exists public\.issue_api_key\(/);
  assert.match(issuance, /select id\s+into v_profile_id[\s\S]*from public\.profiles[\s\S]*for update/);
  assert.match(issuance, /where user_id = p_user_id\s+and is_active = true/);
  assert.match(issuance, /update public\.api_keys\s+set is_active = false/);
  assert.match(issuance, /grant execute on function public\.issue_api_key\(/);
  assert.match(issuance, /to service_role/);
  assert.doesNotMatch(issuance, /grant execute on function public\.issue_api_key[\s\S]*to authenticated/);
});

test('lifecycle unsubscribe state is durable', () => {
  const unsubscribe = fs.readFileSync(
    path.join(migrationsDirectory, '20260817110000_add_lifecycle_unsubscribe.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(unsubscribe, /alter table public\.profiles/);
  assert.match(unsubscribe, /add column if not exists marketing_unsubscribed_at timestamptz/);
  assert.match(unsubscribe, /profiles_marketing_unsubscribed_idx/);
});

test('legacy use_credit uses the reservation engine for every plan family', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /create or replace function public\.use_credit\(/);
  assert.match(integrity, /public\.reserve_credit\(user_uuid, 1\)/);
  assert.match(integrity, /public\.finalize_credit_reservation\(/);
  assert.match(integrity, /public\.release_credit_reservation\(/);
});

test('promotional grants require an explicit idempotency key', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /create table if not exists public\.promotional_credit_grants/);
  assert.match(integrity, /idempotency_key text primary key/);
  assert.match(integrity, /drop function if exists public\.grant_promotional_credits\(uuid, integer, text\)/);
  assert.match(integrity, /create or replace function public\.grant_promotional_credits\(\s*p_user_id uuid,\s*p_credits integer,\s*p_reason text,\s*p_idempotency_key text/s);
  assert.match(integrity, /on conflict \(idempotency_key\) do nothing/);
  assert.match(integrity, /'already_processed', true/);
  assert.match(integrity, /grant execute on function public\.grant_promotional_credits\(uuid, integer, text, text\)\s+to service_role/);
});

test('subscription revocation locks once and does not re-anchor a free retry', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /create or replace function public\.revoke_subscription_access\(/);
  assert.match(integrity, /from public\.profiles p[\s\S]*for update/);
  assert.match(integrity, /existing_subscription_plan = 'free'/);
  assert.match(integrity, /existing_subscription_id is null/);
  assert.doesNotMatch(integrity, /or subscription_id is null/);
});

test('paid-pack revocation follows profile then ledger lock ordering', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  const profileLock = integrity.indexOf('from public.profiles p\n  where p.id = grant_user_id\n  for update');
  const ledgerLock = integrity.indexOf('from public.credit_pack_grants g\n  where g.payment_id = normalized_payment_id\n  for update');

  assert.ok(profileLock >= 0, 'revocation must lock the profile');
  assert.ok(ledgerLock > profileLock, 'revocation must lock the grant after the profile');
});

test('expired reservations have a bounded cron-backed cleanup path', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /create or replace function public\.reap_expired_credit_reservations\(/);
  assert.match(integrity, /r\.status = 'reserved'/);
  assert.match(integrity, /r\.expires_at <= now\(\)/);
  assert.match(integrity, /public\.release_credit_reservation\(reservation_id\)/);
  assert.match(integrity, /delete from public\.credit_reservations/);
  assert.match(integrity, /cron\.schedule\(/);
  assert.match(integrity, /'reap-expired-credit-reservations'/);
});

test('accounting constraints reject invalid values and billing-cycle typos', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /usage_logs_credits_used_positive/);
  assert.match(integrity, /check \(credits_used > 0\)/);
  assert.match(integrity, /payments_amount_nonnegative/);
  assert.match(integrity, /check \(amount >= 0\)/);
  assert.match(integrity, /profiles_billing_cycle_check/);
  assert.match(integrity, /billing_cycle is null or billing_cycle in \('monthly', 'annual'\)/);
  assert.match(integrity, /validate constraint usage_logs_credits_used_positive/);
  assert.match(integrity, /validate constraint payments_amount_nonnegative/);
  assert.match(integrity, /validate constraint profiles_billing_cycle_check/);
});

test('subscription webhook lookup has a profile subscription index', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /create index if not exists profiles_subscription_id_idx/);
  assert.match(integrity, /on public\.profiles\(subscription_id\)/);
  assert.match(integrity, /where subscription_id is not null/);
});

test('profile email uniqueness no longer blocks duplicate auth identities', () => {
  const integrity = fs.readFileSync(
    path.join(migrationsDirectory, '20260817120000_harden_credit_and_profile_integrity.sql'),
    'utf8',
  ).toLowerCase();

  assert.match(integrity, /c\.contype = 'u'/);
  assert.match(integrity, /a\.attname = 'email'/);
  assert.match(integrity, /drop constraint %i/);
  assert.match(integrity, /user_id is the authoritative account binding/);
});
