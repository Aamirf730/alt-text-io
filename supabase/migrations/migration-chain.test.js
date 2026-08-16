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
  assert.equal(files.at(-1), '20260816092527_activate_subscription_atomically.sql');
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

  assert.match(activation, /update public\.subscription_plans/);
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
