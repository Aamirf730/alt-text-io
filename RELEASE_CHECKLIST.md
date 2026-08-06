# Release Checklist

**Last updated:** 2026-08-06
**Status:** RELEASED — the approved C1/C2/C3 fix set is live; production evidence and follow-up observations are recorded below.

## Newly queued high-priority fixes — SaaS release remains local

The H1/H2/H3 SaaS fixes below are complete locally but intentionally remain unreleased until the user explicitly resumes the release step. The independent WordPress plugin 1.7.14 release is recorded as live in the plugin rows and release log.

| Item | Change | Target | Current state | Dependency |
| --- | --- | --- | --- | --- |
| H1 | Bind Polar checkouts and webhook events to the authenticated `user_id`, normalize the email fallback, paginate Auth lookup, and retain unmatched payments/subscriptions/refunds in a service-role-only reconciliation queue. | Next.js checkout/webhook, Supabase migration `20260806051721_payment_reconciliation_h1.sql` | Fixed locally; not deployed | Apply the H1 and H2/H3 migrations before the matching app/webhook deploy; review the first queued-event alert and resolution flow. |
| H3 | Treat `subscription.canceled` as non-renewal, preserve annual drip metadata through the paid period, and downgrade only on `subscription.revoked`. | Supabase migration and Next.js Polar webhook | Fixed locally; not deployed | Apply `20260805202418_fix_subscription_lifecycle_refunds.sql` before the matching webhook. |
| H2 | Add subscription revocation/uncancellation, order-refund, refund-created, and refund-updated handling with idempotent benefit/credit revocation, plus an audited RPC that writes promotional grants to both credit ledgers. | Supabase migration and Next.js Polar webhook | Fixed locally; not deployed | Reconcile existing cancelled paid profiles and verify Polar refund state after migration. |
| API-key persistence | Preserve validated encrypted keys through the WordPress settings sanitizer. | WordPress plugin 1.7.14 and website ZIPs | Released and live | WordPress.org trunk/tag `3636397`/`3636399`; live archives verified at SHA-256 `28490170b60c9765f36a8a59764ffc8cbdd30d6d9b2e0ee3f72d26c7a737db25`. |
| Checkbox setting preservation | Preserve all four checkbox settings during partial connection saves, while hidden form values keep unchecked settings disableable. | WordPress plugin 1.7.14 and website ZIPs | Released and live | Real local `options.php` round-trips passed; WordPress.org and site downloads are live and verified. |
| Connection UX | Fix raw automatic-connect fallback styling, mask recovery keys, center the connect logo, and replace stale purple actions with Alt Text Pro teal. | Next.js `/connect` and WordPress onboarding modal | `/connect` fixed locally; plugin modal released in 1.7.14 | Deploy the separate website `/connect` changes, then repeat automatic and manual connection on the released plugin. |

### H2/H3 pre-deploy data decisions

- The live annual profile whose subscription ID is `bcd55991-6e2e-468e-bd8b-1997638af67d` had a null `profiles.next_billing_date`; it was backfilled in production to Polar's confirmed period end `2027-07-01T08:27:01.737Z`.
- The second live annual profile has a database end date of `2027-07-23T16:10:49.335Z`, but its stored `subscription_id` and `polar_customer_id` are null. H1 now gives new checkouts a durable `metadata.user_id` binding and retains any future unmatched event for review; the legacy profile remains covered by the subscription/customer/email fallback until its next provider event is observed.
- Two cancelled paid profiles match Polar subscriptions that ended on 2026-03-28 and 2026-05-17. Because the new RPC is not deployed yet, the migration-equivalent guarded update was applied: both now have `subscription_plan = free`, `subscription_status = active`, null paid metadata, and 30 credits.
- One legacy cancelled paid profile had no provider subscription/customer ID and held 900 aggregate credits with no bonus or purchased-ledger balance. A direct Polar customer search returned no exact-email or domain match; the database record is a completed legacy/manual payment, and the user confirmed the 900-credit grant was intentional. A guarded production repair preserved the 900 aggregate balance, mirrored it into `bonus_credits_remaining`, moved the profile to active `free`, and reset its renewal timestamp. Post-repair calculation returns 900 usable credits; do not revoke this grant.
- Revocation now grants `30 + bonus_credits_remaining + purchased_credits_remaining` immediately and sets the renewal timestamp, preventing a 30-day free-tier lockout.
- Future promotional grants now have one service-role-only `grant_promotional_credits(user_id, credits, reason)` path that atomically updates `credits_remaining` and `bonus_credits_remaining` and records an audit entry; manual writes to only `credits_remaining` are no longer an accepted grant procedure.
- Production schema verification confirms `audit_logs.actor_id` and `audit_logs.actor_email` are nullable, so the RPC's null system actor fields are valid and its audit insert will not fail for that reason.
- Partial refunds intentionally mark payment status and record the event without clawing back credits; a future policy change would require a separate reviewed ledger rule.

### Post-release carry-forwards

- `audit_logs` is a pre-existing production table; the H2/H3 migration chain does not create or define it. Its nullable actor columns were verified in production, so this is not a release blocker, but it prevents the migration from being testable against a self-contained staging schema until the table's DDL is captured.
- The real one-time pack-purchase path and the 30-day renewal branches have not yet executed in production. Treat the first post-release run of each as an observation gate.
- H4 remains the post-release reporting/robustness item. H1 is fixed locally but remains a release gate because its reconciliation table must exist before the matching webhook is deployed.

## Purpose

This file is the release queue for the current round of SaaS and plugin fixes. Add each newly confirmed issue here before implementation is considered release-ready. Do not apply the database migration or deploy the application until all release-blocking issues are fixed, tested, and explicitly approved.

## Pending changes to release

| Item | Change | Target | Current state | Dependency |
| --- | --- | --- | --- | --- |
| C1/N1–N5 | Harden the `/connect` flow, support opener loss, require acknowledgements only for compatible plugins, use the longer acknowledgement window, and correct legacy success wording. | Netlify Next.js app and WordPress plugin | Released to production with plugin 1.7.12 | Netlify deploy `6a730485df0401d83198e2dd`; WordPress.org tag `1.7.12`. |
| C2/O1–O4/P1/P2/P3/P4/P5/Q1/Q2 | Move one-time credit packs into an idempotent paid ledger, classify discounted packs using product/discount identity before legacy amount fallbacks, preserve balances on renewal, make webhook bookkeeping retry-safe, archive duplicate payment rows before deduplication, scope reconciliation to paid-ledger owners, consume promotional credits before purchased credits, and reserve the Polar webhook event source. | Supabase migration `20260805094230_fix_purchased_credit_pack_ledger.sql`, Polar webhook, and public event endpoint | Released; migration applied before the matching app/webhook deploy | Supabase migration `20260805094230`; archive count 2; remaining duplicate payment/event groups 0. |
| O5 | Keep purchased and WPGeared promotional balances separate in the profile/API response so the dashboard uses accurate copy. | Supabase profile field, usage API, SaaS dashboard | Released to production | `purchased_credits_remaining`, grant/use/renew RPCs, and dashboard paths verified in production. |
| C3 | Require verified identity for lifecycle-capable public events, reserve server-only event sources, trust only verified lifecycle triggers, and match every recipient's user ID/email against Supabase Auth before sending. | Netlify `track-event`, Next.js analytics client, and scheduled lifecycle automation | Released to production | Live smoke checks returned `401` for unauthenticated lifecycle events and `403` for unsigned Polar webhooks. |
| R1 | Record `signup_created` only after email confirmation establishes a verified session, including the WordPress-connect confirmation return. | Next.js `/email-confirmed`, homepage signup, and `/connect` | Released to production | Confirmed-session tracking code is in the deployed Next.js build. |
| R2 | Record the expected transition for pre-fix `marketing_events` rows: legacy rows without verified provenance no longer create lifecycle candidates. | Lifecycle automation operations | Released; first post-deploy dry-run observation remains pending | The transition remains an expected operational observation, not a release failure. |
| R3 | Require `email_confirmed_at` in addition to matching Auth user ID and normalized email before lifecycle delivery. | Lifecycle recipient filter | Released to production | Included in the deployed lifecycle candidate filter. |
| S1 | Cover cross-device `/connect` email confirmation with a server-side first-signup check instead of relying only on browser storage. | Next.js `/connect` and Netlify `track-event` | Released to production | Included in the deployed `/connect` and `track-event` code. |
| T1 | Make per-user `signup_created` deduplication atomic so concurrent authenticated submissions cannot double-count the funnel. | Supabase `marketing_events` and Netlify `track-event` | Released to production | Signup dedup pass and partial unique index applied; endpoint handles `23505` as a duplicate no-op. |
| T2 | Record the expected temporary funnel-count transition caused by historical Google-OAuth signups and legacy rows lacking verified provenance. | Lifecycle automation operations and funnel reporting | Expected transition documented | Segment `signup_method=authenticated_connect_visit`, record the first dry-run's legacy rejections and candidate counts, and do not compare that baseline to pre-fix totals without this context. |
| U1 | Remove any signup duplicates that arrive between preflight and migration execution so the full migration cannot abort at the new index. | Supabase migration `20260805094230_fix_purchased_credit_pack_ledger.sql` | Released to production | Ranked delete ran immediately before index creation; duplicate signup count was 0. |
| Plugin candidate | Package the current local plugin changes with aligned metadata. | WordPress test site, WordPress.org, and website download ZIPs | Released as 1.7.14 | Commit `5ffee10`; SVN trunk revision `3636397`; tag `1.7.14` revision `3636399`; Netlify deploy `6a745aa7b7442d42f0e7231f`; all three website ZIP URLs return HTTP 200. |

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
3. Apply the migration to a staging/test Supabase database first, if available. No staging branch was available, so the production read-only preflight and archive-first migration safeguard were used.
4. Deploy the matching Next.js/Netlify application and webhook code to staging/test. Staging was unavailable; local tests/build plus production endpoint smoke checks were completed.
5. Complete the production backup/preflight required by the project release procedure. The configured tooling did not expose a separate database snapshot artifact; the preflight counts and archive-first migration were recorded.
6. Apply `20260805094230_fix_purchased_credit_pack_ledger.sql` to production **before** deploying the matching Netlify webhook. The old webhook does not call the new RPC, so migration-first is safe; the new webhook must never go first.
7. Immediately deploy the matching application/webhook release. Netlify deploy `6a730485df0401d83198e2dd` is live on `www.alt-text.pro`.
8. Release the tested WordPress plugin package through the approved channel. Keep the plugin version metadata aligned across the PHP header, `ALT_TEXT_PRO_VERSION`, `readme.txt` stable tag/changelog, generated ZIPs, and frontend download metadata. Completed as 1.7.14; the SaaS H1/H2/H3 release remains separate and unreleased.
9. Verify production after release and record the evidence below. All available production gates passed; post-deploy lifecycle dry-run counts remain an operational follow-up for R2/T2.

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
| 2026-08-05 09:38 UTC | Production | Netlify production deployment | Built commit `889f68f`; Next.js type/lint/build checks passed, 17 functions packaged, and deploy `6a730485df0401d83198e2dd` went live at `https://www.alt-text.pro`. | Passed |
| 2026-08-05 09:42 UTC | Production | Supabase migration and post-migration verification | Applied `20260805094230_fix_purchased_credit_pack_ledger`; 2 duplicate payment rows were archived, remaining duplicate payment rows/events are 0, pack grants are 0, negative paid balances are 0, and the paid-ledger column/RPCs/constraints/indexes exist. | Passed |
| 2026-08-05 09:50 UTC | Production | Polar order reconciliation | Production Polar API returned 13 orders, all subscription products; the one-time order query returned 0. Database had 0 completed pack rows and 0 credit-pack grants, so there were no unmatched one-time purchases to remediate. | Passed; no manual credit mutation required |
| 2026-08-05 | WordPress.org | Plugin 1.7.12 release | SVN trunk committed at revision `3635163`; tag `1.7.12` committed at revision `3635165`. Remote tag metadata and the directory API confirm `Alt Text Pro`, version `1.7.12`, `ALT_TEXT_PRO_VERSION` `1.7.12`, stable tag `1.7.12`, and the official download URL. | Passed; official download returned HTTP 200 |
| 2026-08-05 | Production | Post-release smoke verification | Health endpoint returned 200/healthy, plugin ZIP returned HTTP 200 with the verified build hash, unauthenticated lifecycle event returned 401, and unsigned Polar webhook returned 403. | Passed |
| 2026-08-05 | Local | Final release verification | Netlify function tests: 16 files/141 tests passed. Frontend tests: 4 files/22 tests passed with the package Vitest/jsdom configuration. | Passed |
| 2026-08-06 | WordPress.org + Production | WordPress plugin 1.7.14 release | Focused commit `5ffee10` was published to WordPress.org trunk revision `3636397` and tag revision `3636399`; Netlify deploy `6a745aa7b7442d42f0e7231f` published the versioned, stable, and legacy download URLs. All three live archives returned HTTP 200, passed `unzip -t`, reported version `1.7.14`, and matched SHA-256 `28490170b60c9765f36a8a59764ffc8cbdd30d6d9b2e0ee3f72d26c7a737db25`. | Passed |

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
- 2026-08-05: completed the approved release. Netlify deploy `6a730485df0401d83198e2dd` is live, Supabase migration `20260805094230_fix_purchased_credit_pack_ledger` applied successfully with archive-first cleanup, Polar reconciliation found no one-time orders, and WordPress.org trunk/tag 1.7.12 were committed at revisions `3635163`/`3635165`.
- 2026-08-06: published WordPress plugin 1.7.14 independently of the unreleased SaaS H1/H2/H3 changes. The reviewed package is in commit `5ffee10`, WordPress.org trunk/tag revisions are `3636397`/`3636399`, and Netlify deploy `6a745aa7b7442d42f0e7231f` serves all three verified download URLs.
