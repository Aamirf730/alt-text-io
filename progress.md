# Progress

## 2026-08-05: Approved C1/C2/C3 release completed

- Status: the approved fix set is released and verified in production. The release sequence was migration first, matching Netlify app/webhook deploy second, and WordPress.org plugin release third.
- Netlify: production deploy `6a730485df0401d83198e2dd` is live at `https://www.alt-text.pro`; the production build passed TypeScript/lint/build checks and packaged 17 functions. The public health endpoint is healthy and the 1.7.12 plugin ZIP is available.
- Supabase: migration `20260805094230_fix_purchased_credit_pack_ledger` applied to project `qurbdtzrngzfzevgoolp`. The archive contains 2 losing payment rows; remaining duplicate payment rows and Polar/signup event groups are 0; paid-ledger column, grant/use/renew RPCs, indexes, and the non-negative constraint are present; no completed pack payments or grants were found.
- Polar reconciliation: the production API returned 13 orders, all subscription products; the one-time order query returned 0. There were therefore no unmatched one-time credit-pack orders and no manual credit remediation was performed.
- WordPress.org: trunk revision `3635163` and tag `1.7.12` revision `3635165` were committed. Remote tag metadata confirms the public name `Alt Text Pro` and version `1.7.12`. The directory API still reported cached 1.7.10 metadata at verification time; propagation is pending.
- Smoke checks: `/api/health` returned 200/healthy, `/api/track-event` rejected an unauthenticated lifecycle event with 401, the Polar webhook rejected an unsigned request with 403, and the plugin download returned HTTP 200 with the verified build hash.
- Release limitation: no Supabase staging branch or separate database snapshot artifact was available through the configured tooling. Production preflight counts and the archive-first migration safeguard were recorded. R2/T2 first post-deploy lifecycle dry-run counts remain an operational follow-up.

## 2026-08-05: Authorized all-fixes release preflight started

- Status: historical start-of-release snapshot; release work was authorized at this point, before the production actions recorded above.
- Production database preflight: Supabase project `qurbdtzrngzfzevgoolp` was healthy; applied migrations then ended at `20260728132319`; the pending credit-pack migration objects were absent; two duplicate payment rows were present and archived before deletion; Polar purchase events and per-user signup events had no duplicates.
- Environment gate: no Supabase staging branch or local DB password is available, so staging SQL execution and a local `pg_dump` are unavailable. The production migration's archive-first payment cleanup remains the recovery safeguard, and the production duplicate counts are recorded in `RELEASE_CHECKLIST.md`.
- Deployment path: the authenticated Netlify CLI account cannot resolve the configured site ID, but GitHub authentication has admin access to `Aamirf730/alt-text-io`; the clean release branch is being prepared from `origin/main` so the connected Netlify main-branch build can be used without bundling unrelated local artifacts.

## 2026-08-05: U1 signup-migration timing gap fixed locally

- Status: U1 is fixed locally; no Supabase migration, Netlify deployment, email send, or production data change was made.
- Verification: a fresh read-only production query found `0` extra `signup_created` rows across `0` duplicate user groups, but that point-in-time result did not protect the later migration window while the old code remains live.
- Fix: the pending credit-pack migration now performs a deterministic ranked delete immediately before `marketing_events_signup_per_user_uidx`, retaining the earliest `(occurred_at, created_at, id)` row for each non-null user ID. This removes the preflight-to-apply timing dependency and matches the migration's existing payment/event cleanup pattern.
- Release gate: review the ranked-delete count during staging/production migration execution before accepting the migration. No historical signup archive is needed because this is analytics data and the retained row is deterministic; the public endpoint's `23505` handling still protects concurrent requests after the index exists.
- Verification: static SQL/order review and `git diff --check` passed; the migration remains unapplied and local SQL lint is still blocked by unavailable Postgres at `127.0.0.1:54322`.

## 2026-08-05: T1/T2 signup-event follow-ups fixed and recorded locally

- Status: T1 is fixed locally and T2 is documented as an expected reporting transition. No Supabase migration, Netlify deployment, email send, or production data change was made.
- T1 verification: read-only production inspection found `0` extra `signup_created` rows across `0` duplicate user groups, and no existing per-user signup unique index. The previous endpoint check was therefore safe to constrain without a cleanup step, but it was not atomic under concurrent requests.
- T1 fix: the pending migration now adds the partial `marketing_events_signup_per_user_uidx` index for non-null `signup_created` rows. The endpoint keeps the fast read-before-insert path and treats a race-losing PostgreSQL `23505` insert as a successful duplicate no-op. A regression test covers this outcome.
- T2 decision: historical Google-OAuth signups that never created `signup_created` may create a correctly contextualized event when those users later revisit `/connect`; the `authenticated_connect_visit` property allows that segment to be separated. The first post-deploy dry run must also record R2 legacy-row rejections separately from runtime failures. No historical backfill is planned.
- Verification: 16 Netlify test files/141 tests passed; 4 frontend test files/22 tests passed; all Netlify JavaScript syntax checks passed; the production Next.js build passed with only pre-existing warnings; and `git diff --check` passed. `supabase db lint --local --level error --fail-on error` remains blocked because local Postgres is unavailable at `127.0.0.1:54322`; staging migration/race verification remains a release gate.

## 2026-08-05: C3 R1–R3 follow-up fixed locally

- Status: R1 and R3 are fixed locally; R2 is an expected post-deploy transition and is recorded as an operational release note. No Netlify deployment, Supabase mutation, email send, or production change has been made.
- Verification: the public signup calls occur before a confirmed session in the email-confirmation branch, so the hardened endpoint rejects them. The `/email-confirmed` route did not record the confirmed signup, and the WordPress-connect confirmation return had no authenticated signup event either. Recipient filtering matched Auth ID/email but did not require `email_confirmed_at`.
- Fix: homepage signup now records `signup_created` after `/email-confirmed` establishes the session; WordPress-connect signups use a short-lived, email-bound pending marker and record the event after the confirmed return. Pre-session attempts were removed. Lifecycle recipients must now have a non-null `email_confirmed_at` and matching ID/email.
- R2 decision: legacy rows lacking verified provenance remain excluded by design. The first post-deploy lifecycle dry run must record rejected legacy rows separately; a near-zero initial candidate count is expected until fresh verified events accumulate.
- Verification: all Netlify syntax checks passed; 16 Netlify test files/139 tests passed; 4 frontend test files/22 tests passed; the production Next.js build passed with only pre-existing warnings; and `git diff --check` passed. Staging confirmation-flow and scheduled dry-run checks remain release gates.

## 2026-08-05: C3 S1 cross-device connect follow-up fixed locally

- Status: completed locally; no Netlify deployment, Supabase mutation, email send, or production change was made.
- Finding: a `/connect` signup confirmed in another browser/device has no local pending-signup marker, so the prior client-only fallback cannot record `signup_created`.
- Fix: authenticated `/connect` visits in a verified WordPress-connect context now submit `signup_created` even without the marker. The hardened event endpoint checks for an existing signup event for that verified user and returns a duplicate no-op when one already exists, preventing normal repeat visits from creating another funnel record.
- Verification: targeted function tests passed (14 `track-event` tests and 10 lifecycle tests), TypeScript passed, and `git diff --check` passed. Final verification also passed: 16 Netlify test files/140 tests, 4 frontend test files/22 tests, all Netlify JavaScript syntax checks, and the production Next.js build with only pre-existing warnings. Staging cross-device confirmation remains the release gate.

## 2026-08-05: Square Meta ad creative generated for ALT Text Pro

- Status: completed. Created and saved `assets/ads/alt-text-pro-image-seo-square-v1.png` as a 1,254 × 1,254 RGB PNG.
- Creative: uses the ALT Text Pro branding and logo, the headline `Improve Image SEO on your blog`, WordPress image context, `Get 30 free credits every month`, and `Sign up now` CTA.
- Verification: visually reviewed the square composition for readable mobile-safe text, clear accessibility/image-SEO messaging, and no unsupported pricing or testimonial claims.

## 2026-08-05: C3 public analytics/lifecycle-email security fixed locally

- Status: completed and verified locally; no Netlify deployment, Supabase mutation, email send, or production change was made.
- Confirmed risk: the public `track-event` function accepts caller-provided identity and lifecycle-trigger events. In particular, an unauthenticated `purchase_completed` event can become an immediate `purchase_onboarding` email candidate on the next two-hour lifecycle run.
- Fix: the browser forwards its cached Supabase session token; `track-event` verifies it with Supabase Auth and derives identity server-side. Anonymous events are limited to page/demo/download/connect-start activity, require an anonymous ID, and store no user identity. Polar/WordPress sources are reserved, purchase completion is server-only, public timestamps are server-assigned, and unapproved origins are no longer echoed by CORS.
- Lifecycle defense: triggers must have verified identity or the rule's expected server-only source; purchase onboarding accepts only Polar-webhook events. Before reservation/send, the full paginated Auth directory is checked and each candidate's user ID and normalized email must match the same Auth user. Auth errors and pagination over-limit conditions fail closed with no email.
- Review follow-ups: an independent review identified caller-controlled event backdating, exact-full-page Auth pagination, and a redirect race before analytics fetch. All three were fixed and regression-tested. A final external re-review was unavailable because the free CodeRabbit CLI quota was exhausted; no manual result was represented as a clean CodeRabbit rerun.
- Verification: all Netlify JavaScript syntax checks passed; 16 Netlify test files/139 tests passed; 4 frontend test files/22 tests passed; the production Next.js build passed with only pre-existing warnings; and `git diff --check` passed. The exact unauthenticated `purchase_completed` attack is covered by a regression test and creates no stored event. Staging endpoint and scheduled dry-run checks remain release gates.

## 2026-08-05: P4 discounted-pack backfill follow-up fixed locally

- Status: P4 confirmed and fixed locally. No Supabase migration, Netlify deployment, billing mutation, or production data change was made.
- Verification: the backfill previously used only net `amount` thresholds. A current $5 Small Pack discounted by at least 30% could therefore look like the legacy $3 Small Pack and receive 350 instead of 100 credits. Read-only production inspection found no completed pack rows, so the defect is currently inert by circumstance only.
- Fix: pack classification now prefers `polar_product_id` or positive `discount_amount` before legacy amount fallbacks. This preserves the legacy `$3/350` and `$5/550` mappings while classifying discounted current Small/Credit Packs at their current 100/250 amounts.
- Decision: the empty production result is recorded as evidence, not accepted as a reason to leave the migration unsafe.
- Verification: discount/product precedence assertions and `git diff --check` passed. `supabase db lint --local --level error --fail-on error` remains blocked because Postgres is unavailable at `127.0.0.1:54322`. Staging migration execution and fixtures covering legacy undiscounted packs, discounted current packs, Polar product metadata, and ambiguous unknown rows remain required. No live system was mutated.

## 2026-08-05: Q1/Q2 payment archive and event-source follow-up fixed locally

- Status: Q1 and Q2 confirmed and fixed locally. No Supabase migration, Netlify deployment, billing mutation, or production data change was made.
- Q1 verification: the payment deduplication used a hard delete with no archive. Production read-only inspection found one duplicated non-null payment ID across 3 completed rows, so the migration would otherwise remove 2 rows without a recovery copy.
- Q1 fix: added `payments_duplicate_archive`, protected it with RLS and service-role-only grants, archive each losing payment row as JSON keyed by its original row ID, and use `on conflict (source_row_id) do nothing` before the existing deterministic delete/index sequence. The release gate now records the expected 2-row archive count for current production data and requires staging review of the archive contents.
- Q2 verification: public `netlify-functions/track-event.js` accepted caller-supplied `source`, including `polar_webhook`; because `purchase_completed` is public and the migration adds a Polar order-id uniqueness key, an attacker could squat that key before the real webhook.
- Q2 fix: the public tracker now rejects `polar_webhook` case-insensitively with HTTP 403. Authoritative Polar purchase events remain written directly by the verified webhook handler. Added regression tests for exact and case-variant source claims.
- Verification: `track-event.js` syntax passed; all 15 Netlify test files and 115 tests passed; static archive/source-guard assertions and `git diff --check` passed. Supabase local lint remains blocked by unavailable Postgres at `127.0.0.1:54322`; staging migration and endpoint verification remain required.

## 2026-08-05: P3/P5 purchased-ledger follow-up verified and fixed locally

- Status: P3 and P5 confirmed and fixed locally. No Supabase migration, Netlify deployment, billing mutation, or production data change was made.
- P3 verification: the backfill profile-state query uses a left join and its unrestricted update would recalculate every profile's aggregate balance, including unrelated manual adjustments. The release gate requiring no unrelated-user changes was therefore not satisfied.
- P3 fix: the update now requires `state.pack_credits > 0` or `state.current_purchased_credits > 0`, so only profiles with paid-credit state are reconciled.
- P5 verification: `purchased_credits_remaining` had no non-negative check, while the existing promotional ledger did. Production read-only schema inspection confirms the purchased column is not present yet because the migration remains unapplied.
- P5 fix: the migration adds an idempotent `profiles_purchased_credits_remaining_nonnegative` constraint, and `use_credit` now consumes promotional credits before purchased credits so future promotional expiry cannot cause paid credits to be spent first.
- Verification: 21 frontend tests passed; the production Next.js build passed with only existing project warnings; static assertions and `git diff --check` passed. `supabase db lint --local --level error --fail-on error` remains blocked because Postgres is unavailable at `127.0.0.1:54322`. Staging migration execution, advisor checks, profile-scope assertions, constraint validation, and a promotional-before-purchased RPC test remain required. No live system was mutated.

## 2026-08-05: P1/P2 payment retry follow-up verified and fixed locally

- Status: P1 confirmed and fixed locally; P2 confirmed and fixed locally. No Supabase migration, Netlify deployment, billing mutation, or production data change was made.
- P1 verification: the production read-only inspection found one non-null payment ID with 3 `completed` rows for the same `tier1` plan and amount. `marketing_events` currently has no duplicate Polar `purchase_completed` order IDs, but its schema had no order-id uniqueness constraint, so future retries could duplicate events.
- P1 fix: the unapplied migration deterministically retains the earliest `completed` payment row (with non-completed rows ranked after it), removes other rows for the same payment ID, then adds a unique `payments(payment_id)` index. It performs the same cleanup for Polar purchase events and adds a partial unique index keyed by `(event_name, source, properties->>'order_id')`.
- P1 webhook behavior: payment and marketing-event `23505` conflicts are treated as already recorded; other errors remain failures. This makes a replay safe without hiding a genuine bookkeeping error.
- P2 verification: the prior order-paid path inserted `payments` before calling the credit-pack grant RPC, so a permanent insert failure could prevent fulfillment even though Polar would retry.
- P2 fix: one-time orders now grant credits first through the idempotent RPC, then record the payment and marketing event; non-duplicate bookkeeping failures are rethrown so Polar retries and the grant is not duplicated. Subscription order bookkeeping remains separate from subscription credit allocation.
- Verification: 21 frontend tests passed; the production Next.js build passed with only existing project warnings; static ordering/idempotency assertions and `git diff --check` passed. `supabase db lint --local --level error --fail-on error` remains blocked because Postgres is unavailable at `127.0.0.1:54322`, so migration execution, advisor checks, duplicate-cleanup behavior, and an end-to-end webhook replay test remain staging gates. No live system was mutated.

## 2026-08-05: Release queue recorded for pending fixes

- Status: documentation completed; no production, Supabase, Netlify, WordPress.org, or live WordPress changes were made.
- Change: added [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) to record the pending C1/N1–N5 and C2 releases, required migration/deployment order, plugin candidate/version checks, production verification gates, rollback cautions, and evidence log. Updated `instructions.md` to require reading it before release work.
- Decision: keep the C2 migration unapplied and the matching app/webhook deployment unreleased until all current issues are fixed, locally/staging verified, and explicitly approved.

## 2026-08-05: O1–O5 credit-pack follow-up verified and fixed locally

- Status: completed locally; no Supabase migration, Netlify deployment, billing mutation, or production data change was made.
- Verification: the production read-only query found one old `small_pack` payment row with status `pending` and amount `0`, no completed `small_pack`/`credit_pack` payment rows, and valid current catalog rows for `small_pack` (100 credits), `credit_pack` (250), and `pay_as_go` (550). Therefore the specific current FK failure is not active for those production catalog IDs, but unrecorded historical orders cannot be recovered from `payments` alone.
- O1 fix: the release checklist now requires migration-first ordering, and the order-paid webhook rethrows payment/grant failures so a failed allocation is not acknowledged as a successful Polar webhook.
- O2/H7 fix: the migration ensures the one-time plan rows exist without overwriting existing pricing. Missing historical payment rows remain a provider-order reconciliation item before production application.
- O3 fix: historical backfill now uses `on conflict (payment_id) do nothing`.
- O4 fix: historical grants use the recorded plan/product and amount, including the known legacy `$3/350` Small Pack and `$5/550` Pay-as-you-go values, instead of a single hardcoded amount.
- O5 fix: added `purchased_credits_remaining` so paid packs remain distinct from WPGeared promotional credits; usage APIs, credit checks, subscription preservation, and dashboard copy now use both ledgers.
- Verification: all Netlify function syntax checks passed; 113 Netlify tests passed; 21 frontend tests passed; the production Next build passed; targeted static assertions and `git diff --check` passed. The local Supabase database is unavailable, so migration execution, SQL lint, advisor checks, and end-to-end RPC tests still require staging before release.

## 2026-08-05: Historical plugin-package cleanup

- Status: completed; no source or live-system changes were made.
- Change: removed 81 versioned plugin ZIP artifacts below 1.7.0 or above 1.7.11 from the local distribution mirrors. Versioned packages 1.7.0 through 1.7.10 remain, the current source metadata remains 1.7.11, and unversioned download packages were preserved. Two deleted package files were tracked and are recoverable from Git; the other 79 were untracked local artifacts.

## 2026-08-05: Local plugin-version artifact inventory

- Status: completed diagnostic; no code or live-system changes were made.
- Finding: the current source is 1.7.11, while historical packaged plugin ZIPs exist for 1.8.0, 1.9.0, 2.0.0, 2.1.0, 2.2.0, and 2.3.0. Each ZIP's embedded plugin header matches its filename, and each is duplicated in the local distribution mirrors.

## 2026-08-05: C1 SaaS connect-flow security verification

- Status: completed (diagnostic only); no application, plugin, production, or live-system changes were made.
- Finding: the `/connect` flow accepts an attacker-controlled callback URL, sends the raw API key to `window.opener` with wildcard `postMessage` origin, places the raw key in the callback URL query string, and automatically fetches/delivers the key when a session already exists.

## 2026-08-05: C1 SaaS connect-flow hardening implemented locally

- Status: completed locally; not deployed.
- Change: callback URLs are parsed and constrained to HTTP(S) destinations without embedded credentials; authenticated users must explicitly confirm the displayed WordPress host before the API key is fetched or sent; delivery uses the callback's concrete origin; raw API-key URL redirects and arbitrary-opener delivery were removed.
- Verification: 21 frontend tests passed; the production Next build completed successfully; static checks confirmed no `alt_text_pro_api_key` URL parameter or wildcard `postMessage` target remains in `/connect`. No live system was changed.

## 2026-08-05: N1/N2 follow-up verification

- Status: confirmed by read-only source review; no application or live-system changes were made.
- N1 confirmed: after the API key is fetched, a missing/closed `window.opener` throws an error and the connect page has no API-key display or copy escape hatch. The Google OAuth path returns to `/connect` and reaches the same opener-dependent code path. The live `/connect` response currently has no COOP header, but provider/redirect-chain opener loss remains a valid browser-dependent failure mode.
- N2 confirmed: `postMessage` is treated as successful immediately after the call; there is no acknowledgement message from the plugin. A target-origin mismatch can therefore be silently dropped while the SaaS shows success and closes the popup.
- Cleanup finding: the current SaaS no longer produces `alt_text_pro_api_key` URLs, but the plugin handler is still invoked on page load and remains manually reachable for legacy URLs. It is unused by the current flow, not literally unreachable.

## 2026-08-05: N1/N2 connect-flow fixes implemented locally

- Status: completed locally; not deployed.
- Change: the SaaS now shows a copyable API-key recovery screen when the popup opener is unavailable or WordPress does not acknowledge delivery. Successful popup connections now require a matching acknowledgement from the plugin after its save request succeeds; the popup does not report success or close before that acknowledgement.
- Plugin release metadata: incremented from `1.7.10` to `1.7.11` in the PHP header, `ALT_TEXT_PRO_VERSION`, readme stable tag/changelog, and generated frontend plugin version.
- Verification: PHP and JavaScript syntax checks passed, 21 frontend tests passed, and the production Next build completed successfully. No live system was changed.

## 2026-08-05: N3/N4 compatibility verification

- Status: confirmed by read-only review; no application or live-system changes were made.
- N3 confirmed: `/connect` resolves `plugin_version` but does not use it to choose the acknowledgement behavior. The current SaaS therefore waits for an acknowledgement even when an older installed plugin successfully saves the key without sending one. The local plugin is `1.7.11`; the published WordPress.org page currently shows `1.7.10` as the latest release.
- N4 confirmed: the SaaS acknowledgement timeout is hard-coded to 10 seconds. The plugin sends its acknowledgement only after the WordPress AJAX save request completes, so slow hosting or a cold serverless function can trigger the manual-recovery message despite a successful save.

## 2026-08-05: N3/N4 compatibility fix implemented locally

- Status: completed locally; not deployed.
- Change: acknowledgement is now required only when `plugin_version` is `1.7.11` or newer. Older, unknown, or missing plugin versions retain the concrete-origin post-and-assume-success path so existing installations continue connecting while they update. Newer-plugin acknowledgement waits now last 25 seconds and show a “Still waiting…” message after 4 seconds.
- Verification: PHP and JavaScript syntax checks passed, 21 frontend tests passed, the production Next build completed successfully, and `git diff --check` passed. No live system was changed.

## 2026-08-05: N5 success wording and plugin formatting fixed locally

- Status: completed locally; not deployed.
- Change: acknowledged connections retain the “WordPress confirmed the key was saved” message, while legacy delivery now says “Key sent to WordPress.” The connect-handler success/error indentation was normalized. Plugin metadata advanced from `1.7.11` to `1.7.12` to follow the project’s versioning rule.
- Verification: PHP and JavaScript syntax checks passed, 21 frontend tests passed, the production Next build completed successfully, and `git diff --check` passed. No live system was changed.

## 2026-08-05: C2 one-time credit-pack verification

- Status: confirmed by read-only source review; no database, billing, application, or live-system changes were made.
- Finding: Polar one-time purchases map to 100/250 credits and add them to `profiles.credits_remaining`, while `use_credit` blocks normal-plan users once the monthly allowance is exhausted unless `bonus_credits_remaining` is positive. Purchased pack credits therefore cannot be consumed past the monthly cap.
- Finding: the free renewal function sets `credits_remaining = 30 + bonus_credits_remaining`, which overwrites any unspent purchased-pack balance at the next free-plan renewal. The advertised Value Pack still says 250 credits and “Never Expires.”
- Additional defect: when `use_bonus_credit` is true, the same function still sets `credits_remaining = current_credits - 1` as well as decrementing the bonus ledger, so a bonus-credit generation can also burn one normal/purchased credit.
- Scope nuance: the overwrite statement is specifically in the free renewal function; paid renewal paths add monthly credits rather than using that exact overwrite, but paid users remain unable to use pack credits after their monthly allowance because the same `use_credit` cap applies.

## 2026-08-05: C2 credit-pack fix implemented locally

- Status: completed locally; not deployed or applied to Supabase production.
- Change: added `credit_pack_grants` with service-role-only access and an idempotent `grant_credit_pack_purchase` database function. One-time Polar webhooks now grant packs to both the aggregate balance and persistent bonus ledger atomically, preventing duplicate webhook allocations.
- Recovery: the migration backfills historical completed pack payments from `public.payments`, restores pack balances that a free renewal previously overwrote, preserves the aggregate/bonus invariant, and updates free renewal to never lower a persistent balance.
- Verification: PHP/JavaScript checks, 21 frontend tests, the production Next build, and `git diff --check` passed. SQL lint/test execution was attempted but could not connect because the local Supabase database is not running; no remote database was touched.

## 2026-08-04: WPGeared campaign prepared for launch without conversion-event wait

- Status: completed as an unpublished draft in ad account `391913201682729`; no spend was started.
- Change: replaced `Maximise number of conversions` with `Maximise number of landing page views`, so the campaign no longer depends on Meta exposing `CompleteRegistration` in the ad-set event picker.
- Evidence: all edits are saved; the ad set still uses `WPGeared Followers - 365d` and `Lookalike (1%) - WPGeared Followers - 365d`, Australia/Canada/United Kingdom/United States, `₹500.00` daily budget, and the `ALT Text Pro - WPGeared` dataset (`1038182865619573`). The ad uses the `Alt Text Pro` Facebook Page, `alt_text.pro` Instagram profile, `https://www.alt-text.pro/` destination, ALT Text Pro creative, and `Sign up` CTA.
- Placement note: Meta Advantage+ placements remain enabled and include WhatsApp Status; Facebook-only placement control was not available in this campaign format. The campaign remains `In draft`; `Publish` and `Pay Now` were not selected.

## 2026-08-04: Meta Pixel CSP fix deployed and verified

- Status: completed in production. The CSP now permits Meta's Pixel loader and tracking endpoint in `script-src`, `connect-src`, and `img-src` without changing the rest of the policy.
- Release: production commit `a9c2193` and Netlify deploy `6a7210af32a910b4ecb8336d` are live on `www.alt-text.pro`.
- Evidence: the public response header contains the required `https://connect.facebook.net` and `https://www.facebook.com` allowlist entries, the live page loads Meta's account-391 configuration script for Pixel `1038182865619573`, and Meta Test Events reports a browser `PageView` as `Processed` at 21:51:14 IST.
- Remaining verification: Meta Test Events now shows both browser `PageView` and browser `Complete registration` as `Processed`. Ads Manager's draft event picker still lists no active events immediately after the test, so event activation/propagation remains pending. The account-391 campaign remains unpublished with no spend.

## 2026-08-04: Production Pixel switched through the correct Netlify account

- Status: switched Netlify to `aamirf730@gmail.com`, updated production `NEXT_PUBLIC_META_PIXEL_ID` to `1038182865619573`, and triggered a production deploy for `www.alt-text.pro`.
- Evidence: Netlify deploy `6a71f848cfe2cc08f9586f88` is published to production. The live homepage HTML now contains the `1038182865619573` Meta Pixel initialization and `PageView` code. Meta Events Manager confirms that this ID is the `ALT Text Pro - WPGeared` dataset in ad account `391913201682729`.
- Remaining verification: `PageView` and `CompleteRegistration` are confirmed in Meta Test Events after the CSP production fix. Ads Manager has not yet exposed the event in the draft picker, so activation/propagation remains pending. The campaign remains an unpublished draft with no spend.
- Decision: keep the separate `WPGeared Pixel` asset shown in Business Settings out of the website configuration because it is connected to a different ad account and is not the account-391 campaign Pixel.

## 2026-08-04: WPGeared audience campaign draft finalized; live event and placement blockers remain

- Status: the unpublished draft in ad account `391913201682729` now has one clean ad set and one clean ad using only the WPGeared Page follower audience `WPGeared Followers - 365d` and the matching `Lookalike (1%) - WPGeared Followers - 365d`; the old ad set containing the unrelated `Lookalike (1%) - Facebook Page` was deleted.
- Evidence: the final ad set shows Website conversion location, dataset `ALT Text Pro - WPGeared`, Australia/Canada/United Kingdom/United States as locations, and the two exact WPGeared audience entries. The campaign budget is `₹500.00` daily, the start date is 4 August 2026, the ad identity is the ALT Text Pro Facebook Page with `alt_text.pro` on Instagram, the destination is `https://www.alt-text.pro/`, the ALT Text Pro Page creative and `Sign up` CTA are present, and the draft remains unpublished with no spend.
- Blockers: the production CSP issue is resolved and Meta processes both `PageView` and `CompleteRegistration` for Pixel `1038182865619573`. Ads Manager's draft event picker still shows no active events after the test, so optimization selection is waiting on Meta propagation. Meta's Advantage+ campaign also continues to include all placements; the draft has not been published.

## 2026-08-04: Meta account claim retried and web Pixel fallback blocked

- Status: Meta still refuses to add account `391913201682729` to WPGeared; direct web data-source creation in that account also closed without creating a Pixel.
- Evidence: after account `203521513` showed Active and `₹0.00` current balance, the claim flow again returned `Invalid existing account state` and said one or more business accounts are in bad standing or under review. Direct Events Manager for account `391913201682729` still lists only the existing app datasets; selecting Web and continuing produced no new dataset.
- Decision: do not change the live Pixel `1728570404806729`, deploy a new ID, spend money, or publish the campaign while Meta's account/business restriction prevents creation or connection of the required web Pixel.

## 2026-08-04: Meta billing status refreshed

- Status: account `203521513` now reports Active; no payment or billing action was performed by Codex.
- Evidence: Billing details show current balance `₹0.00`, funds `₹1,000.00`, one `₹1,000.00` manual payment marked Funded, and one `₹1,000.00` manual payment marked Failed on 2026-08-04. No payment method is listed.

## 2026-08-04: Meta WPGeared audience campaign blocked by ad-account standing

- Status: blocked pending Meta billing/account standing; no website, Pixel, campaign publication, or payment mutation completed.
- Task: verified the WPGeared Page engagement audience `WPGeared Followers - 365d` exists in ad account `391913201682729`, while audience creation is disabled in `203521513`. Meta required claiming account 391 into the WPGeared Business portfolio before creating a web Pixel, but rejected the claim because account `203521513` is in bad standing due to an unpaid payment restriction. The direct account-391 Events Manager route exposes only existing app datasets and did not complete web data-source creation. Existing live Pixel `1728570404806729` remains active on `www.alt-text.pro`; the ALT Text Pro campaign remains an unpublished draft.
- Decision: do not click Pay Now, publish the campaign, move the account, create a replacement Pixel, or deploy a Pixel-ID change until the business account restriction is resolved.

## Current work

- Status: WordPress.org release completed; Netlify production deployment blocked by unavailable site access
- Task: released Alt Text Pro 1.7.10 through WordPress.org trunk revision 3632676 and tag revision 3632678, then verified the public API, versioned ZIP, and listing icons. The authenticated Netlify account cannot access the configured production site, so no Netlify deploy was created; `www.alt-text.pro` still serves plugin 1.7.0.
- Status: completed diagnostic; no code or live processing changes
- Task: traced the short pause between successful bulk images on `totraveltoo.com`. Each one-image batch intentionally sleeps for 500 ms in PHP before returning, then the browser waits another 750 ms before sending the next batch, producing a minimum 1.25-second transition plus normal network/server overhead. A fresh read-only page confirmed 1.7.10 is installed; the user's older open tab still displayed cached 1.7.9 markup and script. No bulk run or credit-consuming request was started.
- Status: completed locally; no release scheduled
- Task: fixed the site-specific bulk failure reproduced on `totraveltoo.com`. The site uses persistent Redis/object caching, and the plugin's manual cache deletion removed the bulk process transient itself before the next batch read it. Version 1.7.10 now preserves WordPress-managed transient state and performs forced fresh reads for cancellation checks without deleting the Redis-backed run. A test ZIP is ready; nothing was scheduled or published.
- Status: completed locally; no release scheduled
- Task: incremented the unreleased Alt Text Pro package from 1.7.8 to 1.7.9 so it includes the oversized-image recovery and bulk-header cleanup fixes. Rebuilt and verified the 1.7.9 package, then cancelled the previously scheduled release at the user's request.
- Status: completed live-site diagnostic; 1.7.8 remains scheduled
- Task: verified the Traveling Terry page reports v1.7.7 and loads the 1.7.7 admin script, but its rendered markup places the "Needs attention 0" counter in the header and leaves only three counters in the hidden progress card. The official WordPress.org 1.7.7 source places that counter only inside the progress card, so this fresh installation is being altered by site-specific markup, customization, or server-side rendering outside the standard package; the earlier stale-update explanation is not sufficient. No live mutation was made.
- Status: scheduled for release tomorrow; local 1.7.8 package prepared
- Task: scheduled the authorized Alt Text Pro 1.7.8 release for 2026-08-03 at 1:57 PM IST. The scheduled task will run final checks, publish the WordPress.org package, deploy the matching Netlify production version, and verify both targets.
- Status: completed locally for 1.7.8; not released
- Task: fixed bulk-processing reliability after client-site reproductions. HTTP 413 responses now map to the short user-facing message "Image too large to process." The browser-side batch request path now shows a clear failure and ends the run when a request fails or times out instead of leaving it stuck on "Generating." The 1.7.8 package was rebuilt and locally verified.
- Status: diagnostic; client-site investigation pending
- Task: investigated a report that Alt Text Pro 1.7.6 bulk processing stays on the first image while single-image generation works. The 1.7.6 bulk UI enters `Generating` before the batch AJAX request, but its generic batch error handler does not surface HTTP errors, timeouts, or WordPress JSON errors; it can therefore remain stuck with zero results. Local 1.7.7 contains the same bulk-processing code, so its display-name update is not a fix. Exact server failure requires the client site's browser Network response or WordPress/PHP log.
- Status: completed diagnostic; fix not yet implemented
- Task: tested bulk processing on `travelingterry.xyz` with two selected images. The first image `Service-Option-2-fd-scaled.jpg` succeeded; the second image `Image-3-alternate-scaled.png` failed with `API error (Status: 413)`. The run correctly completed with 2 processed, 1 generated, 1 error, and 0 remaining, proving the bulk workflow works on another site and the reported failure is image/request-payload specific.
- Status: blocked pending Netlify site access
- Task: attempted to deploy the released Alt Text Pro 1.7.7 package to Netlify production. The authenticated Netlify account can log in, but the saved site ID `4e39d081-66eb-4ccf-92bc-a262641d7fc4` returns "Site not found" and the account's site list does not contain `alt-text-ai`; no deployment was created. The live site remains on package version 1.7.0.
- Status: completed and released to WordPress.org
- Task: released Alt Text Pro 1.7.7 with the corrected public display name and the previously published circular listing logo. SVN trunk revision `3631490` and tag revision `3631491` were created and publicly verified.
- Status: completed and released to WordPress.org independently
- Task: published the actual circular Alt Text Pro listing icons at 128×128 and 256×256 in the top-level SVN `assets/` directory at revision 3630198, without changing the plugin version or creating a tag.
- Status: completed locally; not released
- Task: corrected the public plugin display name to "Alt Text Pro" in the 1.7.7 local package while preserving the permanent alt-text-pro slug and text domain.
- Status: completed (diagnostic only)
- Task: diagnosed why the live WordPress.org plugin directory does not surface the plugin prominently or label it “Alt Text Pro.” The stable 1.7.6 PHP header and readme both declare “AI Alt Text Pro,” while the official search API places the unrated, fewer-than-10-install listing on page 3 even for exact name/slug searches; no plugin, SVN, website, or production changes were made.
- Status: completed and released to WordPress.org
- Task: released the Alt Text Pro 1.7.6 plugin package. SVN trunk was committed at revision 3630092, tag `1.7.6` was created at revision 3630093, and the public WordPress.org plugin API reports version 1.7.6.
- Status: completed locally; not released
- Task: updated the Alt Text Pro readme with the current bulk-processing, credit-accurate stopping, live-progress, and warning-notification behavior for local version 1.7.6.
- Status: completed locally; not released
- Task: replaced the misplaced zero-count "Needs Attention" indicator with a compact bottom-right warning shown only for genuine bulk-processing issues in Alt Text Pro 1.7.5.
- Status: completed locally; not released
- Task: removed the redundant pre-run image summary cards from the Alt Text Pro 1.7.4 bulk-generation page.
- Status: completed locally; not released
- Task: improved the Alt Text Pro 1.7.3 live bulk-processing view with clear current-work, progress, outcome, remaining-work, activity, and stop-state information.
- Status: completed locally; not released
- Task: fixed Alt Text Pro 1.7.2 bulk-stop credit/result accounting. The browser no longer aborts and hides an already-billable request; WordPress tracks the active request, reports a non-terminal stopping state, prevents later batches, and reconciles the active result before showing the final successful count.
- Status: completed locally; not released
- Task: completed Alt Text Pro 1.7.1 adaptive bulk-request pacing. Successful one-image batches now wait 750 ms rather than an unconditional 15 seconds; one-image-at-a-time processing, cancellation safeguards, and provider-directed rate-limit waits remain intact.
- Status: completed and released to production and WordPress.org
- Task: released the Alt Text Pro 1.7.0 public download package to production and published the matching WordPress.org trunk/tag release after explicit authorization.
- Status: completed on the authorized test site; not released to production
- Task: fixed the verified API-key persistence failure in Alt Text Pro 1.7.0 and confirmed the email-verification connection flow saves the key on `plugintest2.xyz`.
- Status: completed
- Task: reset Alt Text Pro's setup state on the user-provided `plugintest2.xyz` test site and installed a reusable test-only Settings-page helper for repeating the first-time onboarding flow.
- Status: completed
- Task: installed and activated the current local Alt Text Pro 2.1.0 package on the user-provided `plugintest2.xyz` WordPress test site for hands-on testing.
- Status: completed locally; not released
- Task: created a caption-led first-time setup walkthrough video and script using Remotion; plugin behavior and version remain unchanged.
- Status: completed locally; not released
- Task: corrected onboarding button icon alignment and incremented the plugin from 2.0.0 to 2.1.0.
- Status: completed locally; not released
- Task: removed the unnecessary arrow from the “I’ll do this later” action and incremented the plugin from 1.9.0 to 2.0.0.
- Status: completed locally; not released
- Task: replaced the tall desktop onboarding flow with a compact two-column, no-scroll layout and incremented the plugin from 1.8.0 to 1.9.0.
- Status: completed locally; not released
- Task: reduced the redesigned onboarding modal on desktop screens and incremented the plugin from 1.7.0 to 1.8.0.
- Status: completed locally; not released
- Task: redesigned the signup onboarding modal from the supplied reference with existing Alt Text Pro brand colors and incremented the plugin from 1.6.0 to 1.7.0.
- Status: completed
- Task: created an isolated persistent localhost WordPress site and activated the current Alt Text Pro plugin source for hands-on testing.
- Status: completed and deployed to production
- Task: deployed the original Paris café and Eiffel Tower campaign image and its location-aware email example.
- Status: completed
- Task: replaced the fox example in the WPGeared campaign email with a travel-blogger example demonstrating location-aware alt text for the Dolomites in northern Italy.
- Status: completed
- Task: sent the approved second low-credit email to Sarah from `help@alt-text.pro` after verifying her current balance is zero.
- Status: completed
- Task: verified Sarah's low-credit lifecycle test email was sent and is present in the authenticated sender's Gmail Sent folder.
- Status: completed and deployed to production
- Task: deployed the secure, one-time WPGeared customer campaign claim flow that awards 1,000 persistent bonus credits to eligible free accounts and corrects the email CTA.
- Status: completed
- Task: created and visually verified a branded, email-client-friendly Alt Text Pro customer offer template with a 1,000-credit free-account bonus.
- Status: complete
- Task: external archive and private Git backup workflow documented and verified.
- Status: completed
- Task: prepared a publication-ready Medium article introducing Alt Text Pro.
- Status: completed
- Task: created and added an original hero image for the Alt Text Pro Medium article.
- Status: completed
- Task: applied the agreed annual Standard plan to the specified customer account.

## Completed baseline

- Active source is at commit `1b13f2d` (`Release local Alt Text Pro 1.6.0 updates`).
- Before this documentation work, local source and private `origin/main` pointed to the same commit.
- No tracked file exceeded 20 MiB during the backup audit.
- Local `.env` files and generated dependencies are ignored.

## Decisions

- `Aamirf730/alt-text-io` is the authoritative private source repository.
- Every WordPress plugin update will increment the public version by `0.0.1`; the current local build is 1.7.12, and the next plugin update will be 1.7.13.
- Backup-ledger documentation will be committed on a non-production `codex/` branch; production `main` will not be changed as part of archival work.
- The complete containing folder is preserved separately as a full external ZIP.
- The WPGeared offer matches authenticated, confirmed account emails against 239 normalized SHA-256 hashes; readable customer emails are not stored in the migration.
- Campaign awards require an explicit in-page claim action so inbox link scanners cannot grant credits.
- Promotional credits are tracked separately from plan allowance credits, remain usable after the plan allowance is exhausted, and survive free-plan renewal.
- Bulk image payload failures should use the short user-facing message `Image too large to process.` rather than exposing the raw API status `413`.

## Risks and constraints

- Pushing to `main` may trigger production deployment and is outside this archival task.
- Local environment files exist for development and must remain untracked.
- Production services must not be mutated without explicit scoped approval.
- Supabase intentionally reports that the private eligibility ledger has no RLS policies and that the authenticated claim RPC is `SECURITY DEFINER`; direct table access is revoked, the function has an empty search path, and its authorization checks are implemented inside the RPC.

## Verification evidence

- 2026-08-03: WordPress.org public propagation completed. The plugin API reports `Alt Text Pro` version 1.7.10 and download link `https://downloads.wordpress.org/plugin/alt-text-pro.1.7.10.zip`. The public ZIP returns HTTP 200, passes integrity checks, matches the 15-file tag/source, aligns header/constant/stable tag/changelog at 1.7.10, and has SHA-256 `43de629fb2eb898b1ab7fb8224f6b3d882b8862e35fcc0b353773054cc8c626b`. Public 128×128 and 256×256 listing icons return HTTP 200 and match the local/SVN assets with SHA-256 `7999fa7410884da4213dd02bae62d572af5f9b2e1a768bbc204aba0c9cdc66ec` and `38a97388e110bed4487fdfdad687c417200380ed7fa6fdcf553c099d3c463d39`.
- 2026-08-03: Netlify production deployment was not attempted because the authenticated account cannot resolve the configured site ID and its accessible site list does not contain `alt-text-ai`. No deploy was created. Read-only live checks show the homepage and health endpoint remain HTTP 200, both stable plugin URLs still package version/stable tag 1.7.0, and the Netlify-hosted versioned 1.7.10 URL remains HTTP 404.
- 2026-08-03: WordPress.org trunk revision `3632676` was committed with the six expected 1.7.10 files. A fresh remote export contains 15 files and matches the tested source byte-for-byte excluding local `.DS_Store` metadata. Tag `1.7.10` was created by the authorized account at revision `3632678` from the verified trunk and its fresh remote export also matches all 15 source files.
- 2026-08-03: rebuilt the five Alt Text Pro 1.7.10 distribution ZIP copies. All contain 22 expected entries, pass `unzip -t`, contain no test/generated-metadata exclusions, align the header/constant/stable tag/changelog at 1.7.10, and share SHA-256 `802c524ef50069cf230e4301da9d9a997318acd8881341690f3c247210459450`. All 11 PHP files, `admin.js`, `git diff --check`, and the persistent external-object-cache/database-transient regression check passed.
- 2026-08-03: authorized 1.7.10 release preflight passed at 15:34 IST. Source header, `ALT_TEXT_PRO_VERSION`, readme stable tag, changelog, and all five generated distribution ZIP copies report 1.7.10 with matching SHA-256 `3a899b49e54baa0be2b2dded431fd073bc340f17d415085cd0a0b91f5aec7699`. WordPress.org trunk remains 1.7.7 and tag `1.7.10` is absent. Netlify authentication succeeds, but the linked production site ID is unavailable and `alt-text-ai` is absent from the accessible site list; no Netlify deployment will be claimed without correct site access.
- 2026-08-02: created the authorized one-time release automation for Alt Text Pro 1.7.10 at 2026-08-03 3:32 PM IST. The automation is scoped to the current project and explicitly prevents releasing another version or claiming Netlify success without access.
- 2026-08-02: read-only pacing inspection confirmed the installed plugin is 1.7.10 in a fresh WordPress admin page. The previously open bulk tab remained on its pre-update 1.7.9 page assets. Source and live-script inspection confirmed a 500 ms PHP `usleep()` plus a 750 ms browser `batchDelayMs` between normal one-image batches; provider-directed rate-limit waits are separate and apply only after retryable responses.
- 2026-08-02: Alt Text Pro 1.7.10 passed all PHP and JavaScript syntax checks, whitespace validation, a targeted persistent-cache/database-transient read test, ZIP integrity and metadata checks, and packaged-state invariants. The five generated distribution copies have matching SHA-256 `3a899b49e54baa0be2b2dded431fd073bc340f17d415085cd0a0b91f5aec7699`. No WordPress.org or Netlify release was scheduled or performed.
- 2026-07-31: confirmed the local source and live WordPress.org SVN tag `1.7.6` both declare `Plugin Name: AI Alt Text Pro` and `=== AI Alt Text Pro ===`; Git history traces that display-name change to commit `9a69f31` on 2026-06-26.
- 2026-07-31: the official WordPress.org plugin API returned `alt-text-pro` at result 100 for “Alt Text Pro” and approximately result 93–95 for “AI Alt Text Pro”; with WordPress core's 36-result installer page size, both searches place it on page 3. The listing reports fewer than 10 active installations, zero ratings, and zero reviews.
- 2026-07-31: inspected WordPress.org's current plugin-search scoring source: title and slug matches receive boosts, but the relevance score is multiplied by freshness, compatibility, active-install, support, and rating factors. The plugin's zero rating explains why its exact-name/slug relevance boost is effectively suppressed.
- 2026-07-18: GitHub repository `Aamirf730/alt-text-io` confirmed private.
- 2026-07-18: `origin/main` and local source both resolved to `1b13f2d` before documentation changes.
- 2026-07-18: complete containing-folder archive passed `unzip -t`; SHA-256 is `1594b62cc1dfa5797e096a4d1efa5144675d04a3759f57f9fc8b78d1374b0a8f`.
- 2026-07-18: non-production backup-ledger branch was pushed and remotely verified.
- 2026-07-18: local project remains present; no files were deleted.
- 2026-07-23: Medium draft checked against the live Alt Text Pro website, the current WordPress.org plugin listing, W3C image-alt guidance, and Google Search Central image guidance.
- 2026-07-23: generated and visually reviewed a 1672x941 PNG hero image; added it to the article with descriptive alt text and a caption.
- 2026-07-23: manually upgraded the authorized customer account to active annual Standard (`tier2`), granting the 400-credit monthly allowance and setting renewal for 2027-07-23; verified the persisted profile fields.
- 2026-07-28: verified the customer-offer HTML template at desktop and 390px mobile widths; confirmed responsive stacking, no horizontal overflow, successful live image loading, and a 17 KB HTML payload below common inbox clipping limits.
- 2026-07-28: verified all 239 eligible customer hashes exactly match the deduplicated source list and confirmed no plaintext customer emails appear in the migration.
- 2026-07-28: passed 119 Netlify/function tests and 21 frontend tests, including three promotional-credit accounting cases.
- 2026-07-28: completed a production Next.js build with the new static `/customer-offer` route and visually verified its signed-out desktop and 390px mobile states with no horizontal overflow.
- 2026-07-28: applied and recorded production migrations `20260728125159` and `20260728132319` in Supabase project `qurbdtzrngzfzevgoolp`; verified 239 distinct eligibility hashes, zero claims, RLS enabled, no direct `anon` or `authenticated` table access, authenticated-only claim execution, empty function search paths, and preservation of all 19 existing profiles.
- 2026-07-28: reran 119 Netlify/function tests, 21 frontend tests, and the production Next.js build successfully before release.
- 2026-07-28: deployed production commit `21f9f25` through Netlify deploy `6a68adc97eb5050009bacb74`; verified HTTP 200 responses for the homepage, health API, plans API, and UTM-tagged `/customer-offer` page.
- 2026-07-28: verified the live offer page shows the invitation-only 1,000-credit account flow and retains `noindex` protection; production database still had zero campaign claims after deployment.
- 2026-07-28: confirmed Sarah's `credits_low_no_purchase` lifecycle record is `sent` with no error and matched it to the message in the authenticated Gmail Sent folder.
- 2026-07-28: verified the approved follow-up to Sarah was accepted by the Alt Text Pro mail transport and appears in Gmail Sent from `help@alt-text.pro`.
- 2026-07-28: verified the revised campaign template uses the live optimized mountain image, contains no fox references, remains 17 KB, and passes whitespace/error checks.
- 2026-07-28: generated and visually reviewed an original 1536×1024 Paris café and Eiffel Tower image, saved an email-ready JPEG in the website assets, and verified the revised 17 KB template copy and image reference.
- 2026-07-28: deployed production commit `8a9904d` through Netlify deploy `6a68bf8d0436900009dcc5ad`; verified HTTP 200 `image/jpeg` responses for both the raw Paris image and the exact optimized email image URL, plus HTTP 200 from the production health API.
- 2026-07-29: installed WordPress 7.0.2 at `http://localhost:8088`, activated Alt Text Pro 1.6.0 from the current plugin source, verified the WordPress login and plugin dashboard load, and registered a persistent macOS launch agent for the local server.
- 2026-07-29: verified the Alt Text Pro 1.7.0 onboarding redesign on localhost at desktop and 390px mobile widths; confirmed top-safe scrolling, no horizontal overflow, active automatic/manual connection controls, aligned version metadata, successful PHP/JavaScript syntax checks, and a valid 445 KB plugin ZIP with SHA-256 `c34412dce68e9946ce1bdf2a078d5447aa6fe7758e0971d30e41e2c65ead91a0`.
- 2026-07-29: verified the compact Alt Text Pro 1.8.0 modal at a 1246×628 desktop viewport and a 390×844 mobile viewport; desktop width is limited to 560px, short screens use internal scrolling, mobile has no horizontal overflow, and the valid 445 KB ZIP has SHA-256 `0a75849c9ea92f530a90719be8fec24c9ae9c1d85e666712c17e613d0861c3d3`.
- 2026-07-29: verified the Alt Text Pro 1.9.0 two-column modal fits without scrolling at 1246×628 desktop (`640×439` modal) and 390×844 mobile (`370×787` modal), with no horizontal overflow; syntax and ZIP integrity checks passed, and the 446 KB package has SHA-256 `7c53594e264fc2b01d5b121ab581ef15e677536d2d51c00a3805e1baa6025fff`.
- 2026-07-29: verified the Alt Text Pro 2.0.0 defer action renders only “I’ll do this later” with no child icon, the desktop modal remains scroll-free, syntax and ZIP integrity checks passed, and the 446 KB package has SHA-256 `371aa9ac7c54bf70ce86b3f243a9deeffd4a2a36ff247bfc8ef9c603ff8c805e`.
- 2026-07-29: verified the Alt Text Pro 2.1.0 connect arrow and save lock are vertically aligned in their buttons, the modal remains `640×433` and scroll-free at the tested desktop viewport, syntax and ZIP integrity checks passed, and the 446 KB package has SHA-256 `859238a22a82447aea436fbb95037c26018a2d51aea69a87e1524b6b71c05812`.
- 2026-07-29: rendered and visually reviewed the 54.06-second Alt Text Pro first-time setup walkthrough in H.264 1920×1080. The caption-led video uses the current two-column onboarding modal and covers account connection, the secure browser sign-in confirmation, the manual API-key fallback, and the ready state.
- 2026-07-29: uploaded the validated 446 KB Alt Text Pro 2.1.0 ZIP (SHA-256 `859238a22a82447aea436fbb95037c26018a2d51aea69a87e1524b6b71c05812`) to `plugintest2.xyz`, activated it, and verified the plugin dashboard loads and reports v2.1.0.
- 2026-07-29: created and locally syntax-checked Alt Text Pro Test Reset 1.1.0, then installed it on `plugintest2.xyz`. Its Settings page clears only Alt Text Pro's saved API key and setup preferences, preserving site content and plugin logs; the resulting dashboard was visually verified with the first-time onboarding modal open.
- 2026-07-29: diagnosed the verified-key save failure: `ajax_validate_key()` encrypts the API key before calling `update_option()`, then the registered settings sanitizer rejects that encrypted value as an invalid API-key format and preserves the blank existing key. The post-save read-back check correctly reports the failure.
- 2026-07-29: built and installed the corrected Alt Text Pro connection flow on `plugintest2.xyz`; PHP and JavaScript syntax checks passed. Re-ran the automatic email-verification connection: the key saved successfully, the onboarding modal closed, and the connected dashboard displayed the account's 30 remaining credits. The public release package is versioned 1.7.0; production was not modified.
- 2026-07-29: aligned `plugintest2.xyz` with the public 1.7.0 release package after completing the connection-flow verification; the active dashboard reports v1.7.0 and remains connected.
- 2026-07-29: production Netlify deploy `6a69e3225fb2e1d70218c1b2` completed successfully. Verified the live stable ZIP has `Version: 1.7.0` and `Stable tag: 1.7.0`; homepage, health endpoint, and both plugin download URLs returned HTTP 200. WordPress.org remote trunk remains 1.6.0 because SVN authentication failed before commit; the remote 1.7.0 tag does not exist.
- 2026-07-29: after WordPress.org SVN authentication was refreshed, confirmed the trunk commit reports `Version: 1.7.0` and `Stable tag: 1.7.0`, created remote tag revision `3627178`, and confirmed the public WordPress.org plugin API reports version 1.7.0 with its versioned download URL.
- 2026-07-31: local WordPress cancellation-state verification confirmed idle stop → `cancelled`, active stop → `cancelling`, active marker cleared → `cancelled`, with `needs_next_batch=false`. JavaScript/PHP syntax, whitespace, ZIP integrity, packaged version, active-image status, and stop-label checks passed. The Alt Text Pro 1.7.2 distribution ZIP SHA-256 is `2e2c6e7246b8039e348a00d6842723ff1fe6aac11939d35ad306f871713e9bb5`.
- 2026-07-31: completed local Alt Text Pro 1.7.3 live-processing interface update. JavaScript/PHP syntax and whitespace checks passed; the rebuilt ZIP passed integrity and version checks. The local WordPress bulk page reports v1.7.3. The distribution ZIP SHA-256 is `6321eb7d30a1c0b1cef8957d63db35993a95b54e44b6b5245df68c42635c74f1`; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.4 bulk-page simplification. PHP syntax and whitespace checks passed, the rebuilt ZIP passed its integrity and metadata checks, and the local WordPress install reports v1.7.4. The distribution ZIP SHA-256 is `74287df0a2646ff936f1247ff4644e55891923f968bcd0fa033f3de883b215a2`; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.5 bulk-warning notification update. JavaScript/PHP syntax and whitespace checks passed, the rebuilt ZIP passed integrity and metadata checks, and the local WordPress install reports v1.7.5. The distribution ZIP SHA-256 is `8a52a4c99582d4f88b1304af1627a3ed0125c51e5cd910f378f5a4e7171ec2d8`; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.6 readme update. The readme now documents bulk pacing, credit-accurate stopping, live progress, and bottom-right warning notifications; syntax, whitespace, ZIP integrity, metadata, and local version checks passed. The distribution ZIP SHA-256 is `decfd86ab7a54153a8cab881a1d0526c851ffc8d420860316cfd1436a92d8b64`; production and WordPress.org remain unchanged.

## Update history

- 2026-08-04: ran a synthetic free-account signup while Meta Test Events was active; Meta reported `Complete registration` as `Processed` at 21:57:39 IST. The site showed the email-confirmation message, and the campaign remained an unpublished draft with no spend.
- 2026-08-04: deployed production commit `a9c2193` through Netlify deploy `6a7210af32a910b4ecb8336d`, verified the corrected live CSP and Pixel configuration load, and confirmed a processed `PageView` in Meta Test Events; the campaign remains unpublished.
- 2026-08-04: identified the live Pixel failure as a production CSP block: the page contains the correct account-391 Pixel markup, but `script-src`, `connect-src`, and `img-src` do not permit Meta's required domains, explaining Meta's “pixel wasn't detected” result.
- 2026-08-04: switched the production Pixel through the `aamirf730@gmail.com` Netlify account, published deploy `6a71f848cfe2cc08f9586f88`, and verified the live homepage serves account-391 Pixel `1038182865619573`; Meta activity verification remains pending.
- 2026-08-04: ran Meta Test Events for `https://www.alt-text.pro/` after a live visit; the account-391 dataset still showed no `PageView`, so campaign optimization was not changed.
- 2026-08-04: finalized the unpublished account-391 campaign draft with one clean WPGeared audience/lookalike ad set and one ALT Text Pro ad, and removed the older ad set containing the unrelated Facebook Page lookalike; live Pixel-event and Advantage+ placement blockers remain.
- 2026-08-03: completed the authorized Alt Text Pro 1.7.10 WordPress.org release and public verification; no other version or schedule was created.
- 2026-08-03: recorded the separate Netlify blocker after verifying the authenticated account lacks the configured production site; no deployment was claimed or created and the live site download package remains 1.7.0.
- 2026-07-31: completed the read-only WordPress.org search diagnosis: the public display name is intentionally “AI Alt Text Pro,” and the listing is pushed to page 3 by its zero-rating/fewer-than-10-install search signals despite exact name and slug matches.
- 2026-07-18: initialized required project documentation and began verified backup work.
- 2026-07-18: completed and recorded external archive and private Git verification.
- 2026-07-23: completed the first Medium article draft for Alt Text Pro.
- 2026-07-23: completed the Medium hero image and article integration.
- 2026-07-23: completed the authorized customer annual Standard plan upgrade.
- 2026-07-28: completed the responsive Alt Text Pro customer-offer email template using live optimized brand imagery and the 1,000-credit free-account offer.
- 2026-07-28: completed the local one-time campaign claim implementation, persistent bonus-credit accounting, dashboard display, hashed eligibility seed, and corrected email destination; production remains unchanged pending approval.
- 2026-07-28: received explicit approval to apply the production Supabase migration and update the live website; release preflight started.
- 2026-07-28: completed the production database migration, advisor follow-up index, Git release, Netlify deployment, and live route verification.
- 2026-07-28: completed a read-only verification of Sarah's low-credit lifecycle email in both the production send ledger and Gmail Sent mail.
- 2026-07-28: sent and verified Sarah's approved low-credit follow-up from the Alt Text Pro sender address.
- 2026-07-28: replaced the campaign email's fox example with a location-aware travel-blogger result using the Dolomites mountain image.
- 2026-07-28: replaced the campaign email example locally with an original Paris café scene and a “Paris, France detected” alt-text result; production asset deployment remains pending approval.
- 2026-07-28: deployed the Paris café campaign asset and revised email example to production after explicit approval; confirmed the live optimized image is ready for Brevo.
- 2026-07-29: completed the isolated local WordPress test environment and opened the authenticated Alt Text Pro dashboard for hands-on testing.
- 2026-07-29: completed the branded onboarding-modal redesign and local 1.7.0 package; production website and WordPress.org remain unchanged pending explicit release approval.
- 2026-07-29: compacted the onboarding modal for desktop and completed the local 1.8.0 package; production website and WordPress.org remain unchanged.
- 2026-07-29: replaced the onboarding modal with a scroll-free two-column desktop layout and completed the local 1.9.0 package; production website and WordPress.org remain unchanged.
- 2026-07-29: removed the unnecessary defer-action arrow and completed the local 2.0.0 package; production website and WordPress.org remain unchanged.
- 2026-07-29: corrected the connect and save button icon alignment and completed the local 2.1.0 package; production website and WordPress.org remain unchanged.
- 2026-07-29: completed the local first-time setup video and reusable script; no plugin or production changes were made.
- 2026-07-29: installed and activated Alt Text Pro 2.1.0 on the user-provided `plugintest2.xyz` WordPress test site for hands-on testing.
- 2026-07-29: added and installed the test-only Alt Text Pro Test Reset 1.1.0 helper, and verified it restores the first-time onboarding state on `plugintest2.xyz`.
- 2026-07-29: re-versioned the pending public release as Alt Text Pro 1.7.0, rebuilt the package, and recorded that future plugin changes increment by 0.0.1; production and WordPress.org remain unchanged pending explicit approval.
- 2026-07-29: diagnosed the Alt Text Pro 2.1.0 email-verification save error; no code or live plugin change has been made yet.
- 2026-07-29: deployed the verified Alt Text Pro 1.7.0 download package to production. Prepared the WordPress.org SVN trunk and confirmed the 1.7.0 tag is available, but could not commit because the saved WordPress.org SVN login has expired.
- 2026-07-29: completed the WordPress.org Alt Text Pro 1.7.0 release after authentication was refreshed: committed trunk, created tag `1.7.0` at SVN revision `3627178`, and verified the public directory API now advertises 1.7.0.
- 2026-07-30: completed local Alt Text Pro 1.7.1 adaptive bulk pacing. JavaScript and PHP syntax checks, plugin ZIP integrity, and package version metadata checks passed. The distribution ZIP SHA-256 is `52c1ca19ad8b94e6a89eb32353afc2f4b99bfb9ed1f938e82c50c6e9bcf14db8`; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.2 cancellation accounting fix and verified stop-state transitions without consuming customer credits; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.3 live-processing interface update; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.4 bulk-page simplification; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.5 bulk-warning notification update; production and WordPress.org remain unchanged.
- 2026-07-31: completed local Alt Text Pro 1.7.6 readme update; production and WordPress.org remain unchanged.
- 2026-07-31: released Alt Text Pro 1.7.6 to WordPress.org after explicit authorization. Local PHP/JavaScript syntax checks and ZIP integrity checks passed; the release ZIP SHA-256 is `dec2bfd4c447c502160dce27309c63195c1aae7a7de9d89302f1a62d523e25f9`. SVN trunk revision `3630092` and tag revision `3630093` both contain the aligned 1.7.6 version metadata, and the public plugin API reports the versioned download URL.
- 2026-07-31: completed local Alt Text Pro 1.7.7 display-name correction. PHP/JavaScript syntax, whitespace, metadata, slug/text-domain, package-content, local WordPress, and ZIP integrity checks passed. The distribution ZIP SHA-256 is `6a3a4141be17d230cc88ddffb8b55b4694f1937d7c5e3c3356eaaedc6ea1477c`; no publish, deploy, push, commit, or live-system mutation was performed.
- 2026-07-31: corrected and independently released the WordPress.org listing icon. The top-level asset generator now derives `icon-128x128.png` and `icon-256x256.png` from the actual circular Alt Text Pro logo; both files are RGBA and have the required dimensions. SVN assets revision `3630198` was verified, and both public icon CDN URLs return HTTP 200 with checksums matching the local assets.
- 2026-08-02: released Alt Text Pro 1.7.7 to WordPress.org after explicit authorization. PHP/JavaScript syntax checks and ZIP integrity checks passed; the local distribution ZIP SHA-256 is `226e7b3cf3ccd62dd121ec2ac4eb1d0b23e1babf9b08a26db8687f2e00f37965`. SVN trunk revision `3631490` and tag revision `3631491` contain the aligned `Alt Text Pro`/1.7.7 metadata. The public API reports version 1.7.7, the downloaded public ZIP returns HTTP 200 and contains the correct metadata, and the listing icon CDN remains live with the branded logo.
- 2026-08-02: attempted the authorized Netlify production deployment for 1.7.7. Netlify authentication succeeded, but the linked site ID was not found and `alt-text-ai` was absent from the authenticated account's site list; the deploy failed before upload, and the live `www.alt-text.pro` stable ZIP remains 1.7.0. Deployment is waiting for access to the correct Netlify team/site.
- 2026-08-02: diagnosed the client report that single-image generation succeeds but WordPress.org 1.7.6 bulk processing remains at image 1 with zero results. Confirmed the local 1.7.6 and 1.7.7 bulk files are identical and identified silent batch-AJAX failure handling as the visible stuck-state defect; no client site or production code was changed.
- 2026-08-02: reproduced the bulk failure on the authenticated `totraveltoo.com` client page using one selected image. The run initialized process `bulk_6a6ef81b0c4b39.46290635`, stayed at `Generating`/`0 of 1` for more than 10 seconds with no activity result, and moved to `Stopping after current image` after cancellation. It then finalized as `Cancelled` with 0 processed, 0 successful, 0 errors, and the visible balance unchanged at 399 of 400 credits; no alt text was generated.
- 2026-08-02: tested bulk processing on the authenticated `travelingterry.xyz` client page with two selected images. `Service-Option-2-fd-scaled.jpg` succeeded, while `Image-3-alternate-scaled.png` returned `API error (Status: 413)`; the run completed with 2 processed, 1 generated, 1 error, and 0 remaining.
- 2026-08-02: completed local Alt Text Pro 1.7.8 bulk reliability fixes. HTTP 413 now displays "Image too large to process."; failed or timed-out bulk AJAX requests now show a visible retry message and finish the run instead of leaving it stuck on "Generating." PHP/JavaScript syntax, whitespace, ZIP integrity, package metadata, and matching distribution-copy SHA-256 checks passed. WordPress.org and Netlify were not changed.
- 2026-08-02: completed the local 1.7.8 bulk-header cleanup. Stray "Needs attention" counters rendered inside the shared header are moved into the bulk progress card and hidden from the header; package checks passed and the scheduled WordPress.org/Netlify release remains unchanged.
- 2026-08-02: completed local 1.7.8 oversized-image handling. File-size failures, API HTTP 413 responses, and payload-too-large transport errors now create per-image errors, advance progress, and continue the bulk run without retrying the oversized image. Package and matching distribution-copy checks passed; the scheduled release remains unchanged.
- 2026-08-02: reproduced the new 1.7.8 failure on the authenticated `totraveltoo.com` bulk page. The first batch ended in the browser transport-error handler before a per-image result was returned (`0 / 398`, `1` needs attention), confirming the queue needed a guarded server-side skip/recovery path. Added that recovery path and rebuilt 1.7.8; all package checks passed and the scheduled release remains unchanged.
- 2026-08-02: diagnosed the remaining `totraveltoo.com` failure as a persistent-object-cache compatibility bug. Manual `wp_cache_delete()` calls were deleting the Redis-backed bulk-process transient, so the following AJAX batch received no process state and stopped. Removed those destructive calls, added force-refreshed cancellation reads that preserve the transient, incremented to 1.7.10, rebuilt and verified the test ZIP, and left all release scheduling disabled.
- 2026-08-02: completed a read-only diagnosis of the post-image bulk pause. The normal path intentionally waits 500 ms server-side and 750 ms client-side before the next sequential image request, for a base transition of roughly 1.25 seconds. Confirmed 1.7.10 is installed in a fresh admin page and did not start another customer bulk run.
- 2026-08-02: scheduled the authorized Alt Text Pro 1.7.10 WordPress.org release and matching Netlify release attempt for 2026-08-03 at 3:32 PM IST; no release has run yet.
