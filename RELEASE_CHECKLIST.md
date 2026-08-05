# Release Checklist

**Last updated:** 2026-08-05
**Status:** HOLD — local fixes are being accumulated; no production deployment, Supabase migration, or WordPress.org release is authorized by this file.

## Purpose

This file is the release queue for the current round of SaaS and plugin fixes. Add each newly confirmed issue here before implementation is considered release-ready. Do not apply the database migration or deploy the application until all release-blocking issues are fixed, tested, and explicitly approved.

## Pending changes to release

| Item | Change | Target | Current state | Dependency |
| --- | --- | --- | --- | --- |
| C1/N1–N5 | Harden the `/connect` flow, support opener loss, require acknowledgements only for compatible plugins, use the longer acknowledgement window, and correct legacy success wording. | Netlify Next.js app and WordPress plugin | Implemented locally; not deployed | Release the compatible plugin alongside or before relying on acknowledgement behavior. |
| C2/O1–O4/P1/P2/P3/P4/P5/Q1/Q2 | Move one-time credit packs into an idempotent paid ledger, classify discounted packs using product/discount identity before legacy amount fallbacks, preserve balances on renewal, make webhook bookkeeping retry-safe, archive duplicate payment rows before deduplication, scope reconciliation to paid-ledger owners, consume promotional credits before purchased credits, and reserve the Polar webhook event source. | Supabase migration `20260805001030_fix_purchased_credit_pack_ledger.sql`, Polar webhook, and public event endpoint | Implemented locally; migration/app not deployed | Apply the migration before deploying the webhook. Review archive and backfill counts in staging, verify discounted-pack classification, then verify the public endpoint cannot claim `polar_webhook`. |
| O5 | Keep purchased and WPGeared promotional balances separate in the profile/API response so the dashboard uses accurate copy. | Supabase profile field, usage API, SaaS dashboard | Implemented locally; migration/app not deployed | Deploy only with the migration that creates `purchased_credits_remaining`. |
| C3 | Require verified identity for lifecycle-capable public events, reserve server-only event sources, trust only verified lifecycle triggers, and match every recipient's user ID/email against Supabase Auth before sending. | Netlify `track-event`, Next.js analytics client, and scheduled lifecycle automation | Implemented locally; not deployed | Deploy the browser token-forwarding change, event endpoint, and lifecycle scheduler together; verify anonymous, authenticated, forged-source, and Auth-directory failure paths in staging before enabling sends. |
| R1 | Record `signup_created` only after email confirmation establishes a verified session, including the WordPress-connect confirmation return. | Next.js `/email-confirmed`, homepage signup, and `/connect` | Implemented locally; not deployed | Confirm a new email signup, verify one authenticated event is stored, and confirm the four-hour lifecycle candidate appears in a scheduled dry-run. |
| R2 | Record the expected transition for pre-fix `marketing_events` rows: legacy rows without verified provenance no longer create lifecycle candidates. | Lifecycle automation operations | Expected and documented | Capture the first post-deploy dry-run candidate/rejection counts; do not treat the initial near-zero legacy candidate count as a runtime failure. |
| R3 | Require `email_confirmed_at` in addition to matching Auth user ID and normalized email before lifecycle delivery. | Lifecycle recipient filter | Implemented locally; not deployed | Staging test must reject an unconfirmed Auth user and allow a confirmed matching user. |
| S1 | Cover cross-device `/connect` email confirmation with a server-side first-signup check instead of relying only on browser storage. | Next.js `/connect` and Netlify `track-event` | Implemented locally; not deployed | Confirm `/connect` with no local marker stores one signup event for an authenticated user with no prior signup event; repeat visits must return duplicate/no-op. |
| T1 | Make per-user `signup_created` deduplication atomic so concurrent authenticated submissions cannot double-count the funnel. | Supabase `marketing_events` and Netlify `track-event` | Implemented locally; migration/app not deployed | Run the migration's deterministic signup dedup pass before creating the partial unique index; verify a concurrent `23505` is returned as an idempotent duplicate. |
| T2 | Record the expected temporary funnel-count transition caused by historical Google-OAuth signups and legacy rows lacking verified provenance. | Lifecycle automation operations and funnel reporting | Expected transition documented | Segment `signup_method=authenticated_connect_visit`, record the first dry-run's legacy rejections and candidate counts, and do not compare that baseline to pre-fix totals without this context. |
| U1 | Remove any signup duplicates that arrive between preflight and migration execution so the full migration cannot abort at the new index. | Supabase migration `20260805001030_fix_purchased_credit_pack_ledger.sql` | Implemented locally; migration not applied | Review the ranked delete count in staging/production logs before accepting the migration; the earliest `(occurred_at, created_at, id)` row is retained. |
| Plugin candidate | Package the current local plugin changes with aligned metadata. Current local candidate is `1.7.12`; re-check the published version and increment by `0.0.1` if any further plugin change is made before release. | WordPress test site, WordPress.org, and website download ZIPs | Local source/package only; not released | Finish all plugin changes, rebuild, test on the test site, then publish the package. |

## How to add future issues

For every newly confirmed issue, add a row to the table above and record:

- the issue ID and a short description;
- the exact code, migration, package, or live target affected;
- whether it is verified, fixed locally, staged, or released;
- its release dependency and the test that must pass;
- the date, environment, and evidence in the release log.

An issue is not release-ready merely because its code is fixed locally; its migration, application, plugin, and production compatibility checks must also be recorded.

## Required release order

1. Finish and record verification for every remaining issue in this release cycle.
2. Run the complete local checks for the affected app, migration, webhook, and plugin. Confirm that the working tree changes intended for release are clearly separated from unrelated existing dirty files.
3. Apply the migration to a staging/test Supabase database first, if available. Verify the migration, security grants, backfill counts, balance invariants, and RPC idempotency.
4. Deploy the matching Next.js/Netlify application and webhook code to staging/test. Exercise a new one-time purchase, webhook retry, usage beyond the monthly allowance, renewal preservation, and the `/connect` compatibility paths.
5. Take the production backup/preflight required by the project release procedure.
6. Apply `20260805001030_fix_purchased_credit_pack_ledger.sql` to production **before** deploying the matching Netlify webhook. The old webhook does not call the new RPC, so migration-first is safe; the new webhook must never go first.
7. Immediately deploy the matching application/webhook release. Do not leave the new webhook deployed before its database RPC exists, and avoid a long gap between migration and application deploy.
8. Release the tested WordPress plugin package through the approved channel. Keep the plugin version metadata aligned across the PHP header, `ALT_TEXT_PRO_VERSION`, `readme.txt` stable tag/changelog, generated ZIPs, and frontend download metadata.
9. Verify production after release and record the evidence below. If any gate fails, stop and do not announce the release as complete.

## Production verification gates

### Credit-pack accounting

- A completed one-time purchase creates exactly one `credit_pack_grants` row for its payment ID.
- Replaying the same Polar webhook does not add credits a second time.
- The purchase increases both the aggregate balance and persistent paid ledger consistently.
- A user can spend purchased credits after the normal monthly allowance is exhausted.
- A free-plan renewal never lowers an unspent purchased or bonus balance.
- Historical completed pack payments are backfilled once and reconciled without changing unrelated users.
- Reconcile Polar's completed one-time orders against both `payments` and `credit_pack_grants`; purchases that never created a `payments` row cannot be recovered from this table alone and require a reviewed provider-order export or manual remediation.
- The migration does not guess unknown historical pack sizes: it uses the recorded plan/product and amount, including the known legacy `$3/350` and `$5/550` catalog values.
- Discounted current packs are classified by `polar_product_id` or positive `discount_amount` before legacy amount thresholds; an empty current production backfill does not waive this safety requirement.
- Subscription monthly renewal behavior remains unchanged.
- Failed, incomplete, or unrecognized payments do not grant credits.
- `payments.payment_id` is unique after the migration's deterministic duplicate cleanup; a duplicate webhook records no second payment row and does not double-grant.
- Polar purchase-completed marketing events are unique by webhook source and order ID; duplicate-event conflicts are treated as already recorded.
- For one-time orders, credit fulfillment happens before payment/event bookkeeping. A bookkeeping failure is rethrown so Polar retries, while the idempotent grant prevents duplicate credits.
- The historical profile reconciliation updates only profiles with a purchased-pack grant or existing purchased ledger balance; unrelated profiles are not recalculated.
- `profiles.purchased_credits_remaining` has a non-negative check constraint, and `use_credit` spends promotional credits before purchased credits.
- Duplicate payment rows are copied to the service-role-only archive before the migration deletes losing rows; the archive insert is retry-safe by source payment-row ID.
- The public event tracker rejects the reserved `polar_webhook` source; authoritative purchase events continue to be written by the verified webhook handler.
- `marketing_events_signup_per_user_uidx` exists on `(user_id)` for verified `signup_created` rows, and the public tracker treats a signup insert `23505` as an idempotent duplicate.
- The migration ranks and removes duplicate per-user `signup_created` rows immediately before creating `marketing_events_signup_per_user_uidx`; the retained row is deterministic.

### Connect compatibility

- A plugin at or below `1.7.10` still receives the key and gets the legacy “Key sent to WordPress.” outcome.
- Plugin `1.7.11` or newer receives the key and the SaaS reports success only after the plugin acknowledgement.
- A lost opener shows the copyable recovery screen instead of failing without an escape hatch.
- A mismatched callback origin does not silently appear as confirmed success.
- No raw API key is placed in a redirect URL, and no wildcard `postMessage` target is used.

### Event and lifecycle-email security

- Anonymous event requests can store only page/demo/download/connect-start activity, require an anonymous ID, and cannot attach `user_id` or `user_email`.
- Lifecycle-capable events without a valid Supabase session return `401` and create no row.
- Authenticated events derive identity from `supabase.auth.getUser(token)`; forged identity fields and caller-supplied `identity_verified` values are ignored.
- The public endpoint cannot claim `polar_webhook`, `wordpress_plugin_auth`, or `wordpress_plugin_usage` in any letter case.
- The public endpoint rejects `purchase_completed` even for authenticated browsers; only the verified Polar webhook writes purchase completion.
- Public event timestamps are assigned by the server so a client cannot backdate a delayed lifecycle trigger.
- `purchase_onboarding` is generated only from an authoritative `polar_webhook` purchase event.
- Every lifecycle candidate must have a user ID and normalized email matching the same Supabase Auth user before reservation or delivery.
- A Supabase Auth directory error fails the lifecycle run closed and sends no email.
- The original unauthenticated `purchase_completed` attack produces neither a stored lifecycle event nor an outbound candidate.
- A normal email signup records `signup_created` only after `/email-confirmed` establishes a verified session; the WordPress-connect confirmation return records the same event once, after matching the pending signup email.
- The first post-deploy dry run reports legacy-row rejections separately; a low legacy candidate count is expected until new verified events accumulate.
- An Auth user without `email_confirmed_at` cannot receive a lifecycle email even if the candidate ID and email match.
- A cross-device `/connect` confirmation with no local marker still records one authenticated signup event; repeated authenticated connect visits are no-ops when a signup event already exists.
- The first post-deploy funnel report explicitly separates `authenticated_connect_visit` signups, historical legacy-row rejections, and ordinary confirmed signups; Google-OAuth historical gaps are documented before interpreting count changes.

### Operational checks

- Production health, plans, homepage, customer dashboard, and plugin download endpoints return expected responses.
- The production webhook route is reachable and logs no unexpected RPC, authorization, or schema errors.
- The released plugin ZIP passes integrity and metadata checks and installs/activates on the test WordPress site.
- Existing users can generate alt text and view usage normally.
- No live-system mutation is performed during preflight or verification beyond the explicitly approved release actions.

## Rollback and incident notes

- Do not roll back only the application while continuing to accept one-time purchases without checking the webhook/database compatibility. The old direct balance update path can reintroduce the C2 defect after the new migration is present.
- If the migration has been applied and the app deploy fails, pause one-time purchase processing or use a tested compatible application version before accepting new pack payments.
- Do not delete `credit_pack_grants` or reverse historical grants as an ad hoc rollback. Investigate and reconcile through an audited, reviewed migration or administrative procedure.
- Record production migration identifiers, deployment identifiers, verification timestamps, and any customer-impacting remediation here before closing the release.

## Release evidence log

| Date/time | Environment | Action or check | Result/evidence | Status |
| --- | --- | --- | --- | --- |
| 2026-08-05 | Local | C2 migration and webhook implementation | Local migration file created; webhook calls the idempotent grant RPC. No production database change. | Passed locally; pending database execution |
| 2026-08-05 | Local | Frontend tests/build and diff checks | 21 frontend tests passed; production Next build passed; `git diff --check` passed. | Passed |
| 2026-08-05 | Local | Supabase SQL lint/test attempt | Local Supabase database was unavailable at `127.0.0.1:54322`; no remote fallback or production mutation was attempted. | Blocked locally; staging/production preflight required |
| 2026-08-05 | Production read-only | Pack payment and catalog inspection | Found 1 old `small_pack` row, status `pending`, amount `0`; found no completed `small_pack`/`credit_pack` payment rows. Production currently has valid `small_pack` (100), `credit_pack` (250), and `pay_as_go` (550) catalog rows, so the reported FK condition is not active for those current IDs. | Recorded; provider-order reconciliation still required |
| 2026-08-05 | Local | O1–O5 implementation | Migration now creates the separate paid ledger, ensures pack catalog rows without overwriting existing pricing, uses idempotent/amount-aware backfill, preserves both ledgers on renewal/subscription updates, makes order failures retryable, and labels purchased credits correctly in the dashboard. | Passed static review; database execution pending |
| 2026-08-05 | Production read-only | P1 duplicate inspection | One non-null payment ID currently has 3 `completed` rows with the same `tier1` plan and amount, meaning 2 losing rows must be archived before deduplication; `marketing_events` currently has no duplicate Polar `purchase_completed` order IDs. No production cleanup or index creation was performed. | Migration archive/cleanup/index gate required |
| 2026-08-05 | Local | P1/P2 implementation and application checks | Added deterministic duplicate cleanup plus unique payment/event indexes to the unapplied migration. The webhook now treats `23505` as already recorded, grants one-time credits before payment/event inserts, and rethrows non-duplicate bookkeeping failures for Polar retry. 21 frontend tests passed, the production Next build passed, static ordering/idempotency assertions passed, and `git diff --check` passed. | Implemented locally; staging SQL and webhook retry test pending |
| 2026-08-05 | Local | Supabase SQL lint attempt after P1/P2 changes | `supabase db lint --local --level error --fail-on error` could not connect to `127.0.0.1:54322`; no remote fallback or production mutation was attempted. | Blocked locally; staging verification required |
| 2026-08-05 | Production read-only | O5/P3/P5 schema check | Production currently has `bonus_credits_remaining` and its non-negative constraint, but not `purchased_credits_remaining` because the pending migration is unapplied. No production schema or data was changed. | Migration and staging verification required |
| 2026-08-05 | Local | P3/P5 implementation and application checks | Scoped the backfill reconciliation to profiles with paid-credit state, added an idempotent non-negative purchased-ledger constraint, and changed `use_credit` to spend promotional credits before paid credits. 21 frontend tests, the production Next build, static assertions, and `git diff --check` passed. | Implemented locally; staging RPC/invariant test pending |
| 2026-08-05 | Local | Supabase SQL lint attempt after P3/P5 changes | `supabase db lint --local --level error --fail-on error` could not connect to `127.0.0.1:54322`; no remote fallback or production mutation was attempted. | Blocked locally; staging verification required |
| 2026-08-05 | Local | Q1/Q2 implementation and tests | Added archive-first payment deduplication and reserved-source rejection in `track-event`. Netlify syntax passed, 15 files/115 tests passed, static archive/order checks passed, and `git diff --check` passed. | Implemented locally; staging archive and endpoint tests pending |
| 2026-08-05 | Local | Supabase SQL lint attempt after Q1 changes | `supabase db lint --local --level error --fail-on error` remains blocked because local Postgres is unavailable at `127.0.0.1:54322`; no remote fallback or production mutation was attempted. | Blocked locally; staging verification required |
| 2026-08-05 | Production read-only | P4 backfill data inspection | `payments` contains no completed pack rows; the only current `small_pack`/`pay_as_go` rows are pending amount-0 records with no Polar product or discount metadata. The migration is therefore currently inert in production, but the classification fix is required for future discounted history. | Recorded; staging classification test required |
| 2026-08-05 | Local | P4 implementation | Historical pack classification now checks `polar_product_id` and positive `discount_amount` before falling back to legacy net-amount thresholds, preventing discounted current packs from being granted legacy amounts. | Implemented locally; staging backfill test pending |
| 2026-08-05 | Local | P4 static verification | Discount/product precedence assertions and `git diff --check` passed. | Passed locally; SQL execution pending |
| 2026-08-05 | Local | Supabase SQL lint attempt after P4 changes | `supabase db lint --local --level error --fail-on error` remains blocked because local Postgres is unavailable at `127.0.0.1:54322`; no remote fallback or production mutation was attempted. | Blocked locally; staging verification required |
| 2026-08-05 | Local | C3 implementation and full verification | Public identity is server-derived, anonymous events are identity-free/non-lifecycle, purchase events/sources are server-only, timestamps are server-assigned, trusted trigger provenance is enforced, and lifecycle recipients are checked against paginated Supabase Auth users. All function syntax checks, 16 Netlify files/139 tests, 4 frontend files/22 tests, the production Next build, and `git diff --check` passed. | Implemented locally; staging endpoint and scheduled dry-run checks pending |
| 2026-08-05 | Local | R1–R3 follow-up implementation | Confirmed signup tracking now occurs after email confirmation for the homepage and WordPress-connect return; pre-session signup calls were removed. Lifecycle recipients now require `email_confirmed_at`. R2's expected legacy-row transition is recorded as a post-deploy dry-run observation. | Implemented locally; staging confirmation-flow and dry-run checks pending |
| 2026-08-05 | Local | S1 cross-device connect follow-up | Authenticated `/connect` visits in a real WordPress-connect context now submit `signup_created` even without the browser marker; the server checks for an existing per-user signup event and returns a no-op for repeats. Final verification passed: 16 Netlify files/140 tests, 4 frontend files/22 tests, all Netlify syntax checks, TypeScript, Next build, and `git diff --check`. | Implemented locally; staging cross-device confirmation check pending |
| 2026-08-05 | Production read-only | T1 signup-event duplicate preflight | `marketing_events` has 0 extra `signup_created` rows across 0 users with duplicate groups; no signup-specific unique index exists yet. No production schema or data was changed. | Safe to add index; migration still pending |
| 2026-08-05 | Local | T1/T2 implementation and release notes | Added the partial per-user signup unique index to the pending migration, handled concurrent signup `23505` conflicts as idempotent duplicates, added a race-regression test, and documented the expected Google-OAuth/connect revisit and legacy-row funnel transition. Full local verification passed: 16 Netlify files/141 tests, 4 frontend files/22 tests, all Netlify syntax checks, Next build, and `git diff --check`. | Implemented locally; staging migration test pending; local SQL lint blocked by unavailable Postgres |
| 2026-08-05 | Local | U1 migration safety follow-up | Added a deterministic ranked delete immediately before the signup unique index, retaining the earliest `(occurred_at, created_at, id)` row. The current read-only production count remains 0 duplicate rows; no production data or schema was changed. | Implemented locally; staging migration execution and delete-count review pending |

## Change log

- 2026-08-05: created the release queue for the pending C1/N1–N5 and C2 fixes. The migration, application deployment, and plugin release remain on hold until the full issue set is complete and explicitly approved.
- 2026-08-05: added O1–O5 to the queue. Migration-first ordering, retryable webhook failures, plan-row protection, idempotent/amount-aware historical recovery, separate paid-credit accounting, and accurate dashboard labels are implemented locally; staging/database verification and provider-order reconciliation remain release gates.
- 2026-08-05: added P1/P2 to the queue. The unapplied migration now deduplicates existing payment/event records before enforcing webhook idempotency keys, and the order-paid handler grants one-time credits before retryable bookkeeping.
- 2026-08-05: added P3/P5 to the queue. The backfill no longer recalculates unrelated profiles, the paid ledger receives a non-negative constraint, and promotional credits are consumed before purchased credits.
- 2026-08-05: added Q1/Q2 to the queue. Duplicate payment rows are now archived before deletion, and the public tracker cannot claim the reserved Polar webhook source used by the purchase-event uniqueness key.
- 2026-08-05: added P4 to the queue. Discounted current packs now use product/discount identity before legacy amount-based classification; the empty production result is recorded as evidence, not treated as the fix.
- 2026-08-05: added C3 to the queue. Public event identity is now verified and server-derived, anonymous events cannot supply recipient identity, server sources and lifecycle triggers are constrained, and every scheduled recipient must match Supabase Auth before send. Production remains unchanged.
- 2026-08-05: added R1–R3 to the queue. Confirmed signup events now originate after email confirmation, confirmed WordPress-connect returns are tracked once, legacy unverified rows are documented as an expected transition, and lifecycle sends require `email_confirmed_at`. Production remains unchanged.
- 2026-08-05: added S1 to the queue. WordPress-connect confirmation no longer depends solely on same-browser storage; authenticated connect visits can recover the signup event server-side with a repeat no-op. Production remains unchanged.
- 2026-08-05: added T1/T2 to the queue. Signup-event deduplication is now race-safe locally through a partial unique index and `23505` handling; the expected temporary funnel-count transition from historical Google-OAuth gaps, cross-device connect revisits, and legacy-row rejection is documented. Production remains unchanged.
- 2026-08-05: added U1 to the queue. The pending migration now removes duplicate per-user signup events deterministically before creating the unique index, eliminating the preflight-to-apply timing dependency. Production remains unchanged.
