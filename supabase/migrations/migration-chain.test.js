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
  assert.equal(files.at(-1), '20260809211033_activate_tier4_catalogue.sql');
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
