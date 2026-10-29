# Ops scripts

One-off scripts that write to the production Supabase database with the service-role key. Run them from the repository root (they load `.env` from the working directory) and only with explicit, scoped approval.

- `add-launch-credits.js`: grants 5,000 trial-program credits to one hard-coded customer profile.
- `reset-test-user.js`: deletes usage rows and resets credits for the owner's hard-coded test account.
- `check-billing-cycle.sql`: inspects `subscription_plans.billing_cycle` for tier1–tier3; the commented-out `UPDATE` is a write.
- `repair-free-cancelled-profiles.js`: lists Free profiles stuck as `cancelled` with no subscription ID (flow audit 2026-10-29, §2.3). Dry run by default (read-only). `--apply` sets them back to `active` so the daily free-credit renewal picks them up again; it needs explicit approval and has not been run yet. Free + cancelled rows that still have a subscription ID are only listed for manual review.
