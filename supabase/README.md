# Database migrations

`supabase/migrations/` is the canonical, replayable schema history for Alt Text Pro.

## Bootstrap order

1. `20260625140000_bootstrap_schema.sql` creates the foundational public schema that was previously maintained through hand-applied SQL: profiles, plans, usage, payments, API keys, audit logs, marketing tables, the usage view, renewal prerequisites, and the renewal schedules.
2. Every later `.sql` file runs in timestamp order.
3. `20260806182541_repair_renew_monthly_credits_signature.sql` is a forward repair for databases that already recorded the old renewal function before its output column was renamed.

The first migration intentionally preserves the historical `user_ids` output name. The WPGeared migration drops that function before creating the `renewed_user_ids` version because PostgreSQL cannot rename an OUT parameter with `CREATE OR REPLACE FUNCTION`. The first security migration also guards its old `public.users` policy block because that retired table is not recreated by the bootstrap.

## Local verification

The checked-in `config.toml` makes the project usable with the Supabase CLI. After Docker/Supabase local services are available, `supabase db reset` should rebuild the database from the tracked migration chain. The migration-chain test can be run without a database with:

```text
node --test supabase/migrations/migration-chain.test.js
```

`supabase-migration/` is retained as a historical archive. Do not apply those scripts in addition to the tracked migrations; doing so can duplicate data, overwrite functions out of order, or recreate the retired public `users` table.

## Existing environments

The new bootstrap migration is ordered before the historical tracked migrations, so an existing database needs a reviewed migration-history reconciliation before this chain is pushed to it. This change does not apply anything to Supabase production. Confirm the remote migration ledger and schema first, then approve the migration-history operation separately.
