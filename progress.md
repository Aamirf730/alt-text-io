# Progress

## 2026-10-24: Yellow + white redesign (not deployed)

- Owner decision: brand is yellow + white only, dark gray `#3F3F46` for text and icons (no black anywhere), applied to the website, customer dashboard, admin portal, WordPress plugin, emails, logo and icons. Rules in `docs/design-system.md`.
- Logo redrawn as SVG in the same composition (`frontend-next/public/brand/logo.svg`, small "ALT" mark `logo-mark.svg`); rendered the website logo, app icon, favicon, plugin logo, and WordPress.org icons and banners from them.
- Website/dashboard/admin (`frontend-next/`): token-based theme, one Button system, black surfaces removed, icons flex-aligned, equal-height cards; screenshots of every page at 1440/390 including signed-in dashboard and admin (mocked auth and APIs in a scratch Playwright script).
- Plugin admin: tokens scoped to plugin screens, one button system, shared header partial, notice placement fixed, mono SVG menu icon; screenshots of every plugin screen on a Playground site.
- Emails: Supabase confirmation and recovery templates, customer-offer email, lifecycle email, contact-form, unsubscribe page and funnel report recoloured; previews rendered.
- Verification: frontend 162 tests, functions 208, migration chain 28, TypeScript, ESLint, `next build`, plugin harnesses on PHP 7.4/8.5.
- Not yet: content rewrite, Supabase dashboard email templates (need pasting live), WordPress.org assets (need SVN), deploy.

## 2026-10-24: Plugin 1.7.26 tested on a temporary WordPress site

- Ran the exact ZIP served by alt-text.pro (1.7.26) on a local WordPress Playground site (WordPress 7.1.3, PHP 8.3) with a must-use stub standing in for the Alt Text Pro service, so no real account, key or credit was used.
- Passed: onboarding and setup card; rejected key kept out; long Japanese Blog Context saved intact and cut at 500 characters; connected dashboard (1,697 available, 1,497 of 1,500 plan credits plus 200 pack credits, "Growth Monthly"); API key never present in page HTML; single-image draft and apply (apply fills the WordPress field, the image must still be updated to save it); posts-list button batched 3 + 1 generations and synced once, keeping the author-written alt, filling empty alts, preserving `\u003c…` and `C:\Users\name`, adding no block-comment alt, one revision; bulk run of a 3000x2400 PNG via the resize path; second concurrent bulk start refused and the lock released afterwards; logs and CSV export; Disconnect.
- Found and fixed: the settings page never displayed its own messages ("Settings saved.", invalid, rejected or unencryptable key) because plugin pages suppress admin notices and the template did not call `settings_errors()`; a finished bulk run logged its summary twice. Both fixed, added to the 1.7.26 changelog and to `tests/p3-hygiene.php`; harnesses pass on PHP 7.4 and 8.5.
- Not tested here: the Connect popup and auto-generate on upload with the real service.

## 2026-10-24: 2026-10 release in progress (owner approved)

- Polar: created the 9 new products (IDs in `docs/pricing-2026-10-rollout.md`) through the dashboard session; old products still active until after the deploy.
- Netlify: added `NEXT_PUBLIC_POLAR_LEGACY_TIER{1-4}_{MONTHLY,ANNUAL}` with the old product IDs (confirmed against the live JS bundle) and `NEXT_PUBLIC_POLAR_BULK_PACK`; pointed `TIER1/TIER2/TIER4` and both pack variables at the new products; set `LIFECYCLE_AUTOMATION_DRY_RUN=true`. `TIER3` variables kept until after the deploy.
- Supabase: applied `20261024120000`, `20261024130000` and `20261024140000` in order, each in one transaction that also records it in `supabase_migrations.schema_migrations`. Verified the catalogue, the `change_subscription_plan` function, the new payment columns, and that both paid profiles kept their pinned 400-credit allowance.
- Deployed: pushed `6792637`; Netlify deploy `6adca5c0acbdca45dd7b8bfb` is ready. Live checks: `/`, `/dashboard`, `/connect`, `/docs`, `/terms`, `/admin`, `/api/health`, `/api/get-plans` return 200; the CSP header with a script nonce is now served (no CSP console errors on `/` or `/connect`, toasts styled, Google sign-in renders); `/connect` sends `Cross-Origin-Opener-Policy: unsafe-none`; `get-plans` lists free, tier1, tier2, tier4 and the three packs only; the bundle carries the new product IDs; both plugin ZIP URLs serve 1.7.26.
- Archived the 10 old Polar products (existing subscriptions on them continue), renamed the new Agency products to "Alt Text Pro — Agency Monthly/Annual", and deleted the `NEXT_PUBLIC_POLAR_TIER3_*` variables.
- Still open: lifecycle dry-run check on the next scheduled run, then `LIFECYCLE_AUTOMATION_DRY_RUN=false`; WordPress.org 1.7.26 SVN release; owner tests (Connect from a WordPress site, one real or 100%-discount purchase, password reset on a phone). The Polar "Free" product still describes "50 Free Credits each month".

## 2026-10-24: Remaining lower-priority fixes (website, admin, plugin 1.7.26)

- Status: implemented, tested and committed locally; not pushed, not deployed, not released to WordPress.org. Owner chose to fix these before release and to deploy with `LIFECYCLE_AUTOMATION_DRY_RUN=true` first.
- Website: the usage bar includes bonus/pack credits on every plan; the dashboard updates its monthly counters after a generation; first-image tracking and onboarding use the lifetime count; inline "Resend confirmation email" on the homepage and `/connect`, plus "Forgot password?" on `/connect`; Navbar and SEO-page sign-in/sign-up links open the homepage dialog (`/?auth=`); signed-in visitors' hero button goes to the dashboard; `/email-confirmed` really redirects; plan cards say "credits / month" and the rollover FAQ matches the terms; all Polar routes default to production unless `POLAR_ENVIRONMENT=sandbox`; old pack-plan accounts can buy packs.
- Admin and functions: revenue is net of tax and refunds (new migration `20261024140000` adds `tax_amount`, `refunded_amount`, `refunded_tax_amount`; the webhook records them) and "Paying Subscribers" replaces "Active Users"; the lifecycle tab covers every profile; lifecycle and funnel reads page past 10,000 rows (lifecycle skips page views) and long ID filters are chunked; lifecycle status and test sends count pack credits; admin reports ignore stale responses; the plan filter includes legacy names; user deletion protects admins, revokes the Polar subscription first (`DELETE /v1/subscriptions/{id}`), deletes through the auth-user cascade and writes an audit row; unsubscribe matches the signed user ID only; the health check sends the Gemini key in a header; a pinned allowance survives on a legacy profile without a stored subscription ID.
- Plugin 1.7.26 (still unreleased): author-written in-post alt text is preserved; post generation runs 3 images per request and syncs once at the end (with a sync-only recovery request); multisite network activation, new sites, lazy table check and per-site uninstall; Disconnect account; multibyte-safe Blog Context; out-of-credits copy mentions credit packs; exact `wp-image-N` context matching; offloaded media downloaded safely; logs CSV export; activation redirect only for admins on normal requests; 404/503 API handling; daily cleanup of abandoned bulk state that never touches the live run; connect callback built from the browser location.
- Verification: frontend 23 files / 162 tests, Netlify Functions 31 files / 208 tests, migration chain 28 tests, TypeScript, ESLint, `next build`; plugin lint and six harnesses on PHP 7.4 and 8.5; WordPress Playground (WordPress 7.1.3) post-flow 38/38 and multisite 14/14 checks on PHP 7.4 and 8.5; 1.7.26 ZIP build.
- Release order note: apply migrations `20261024120000`, `20261024130000` and `20261024140000` before pushing; the new webhook writes `tax_amount`.

## 2026-10-24: WordPress plugin 1.7.26 prepared locally

- Status: implemented, tested and committed locally; not pushed, not released to WordPress.org, not deployed.
- Plugin fixes:
  - Post-level generation saved content without `wp_slash()`, so WordPress stripped every backslash (block JSON escapes such as `\u003c`, code samples). Saves are now slashed, block comments only change when they already hold an alt attribute, and `<img>` tags whose alt already matches are left untouched, so a post is only re-saved when alt text really changes. Post generation stops at 402.
  - One bulk run per site (atomic option lock released on every terminal state; a run idle for 15 minutes stops blocking). Queue cap raised from 1,000 to 20,000 newest images; the Bulk page and queue are scoped in SQL instead of per-image capability checks.
  - Images over 3 MB, or not JPEG/PNG/WebP/GIF, are downscaled to 2,048 px and re-encoded (WebP/PNG for transparent sources, JPEG otherwise) before upload.
  - Plugin dashboard: one 15-second usage request (the unused `test_connection()` call is gone), an error card with "Try again" / "Reconnect account" instead of placeholder "Free / 100 credits", available credits plus plan credits left and bonus/pack credits, and server-provided plan names. A newly pasted key the service rejects (401) no longer replaces a working key.
  - Version 1.7.26 (header, constant, stable tag, changelog, upgrade notice) and a WordPress.org "External services" readme section.
- Website/functions: `/connect` now sends `Cross-Origin-Opener-Policy: unsafe-none` (other routes keep `same-origin-allow-popups`), so the plugin popup keeps `window.opener`. `get-usage` returns `plan_name` and `plan_credits_remaining`; `get-usage` and `auth-validate` name legacy subscribers by their original plan. The scheduled lifecycle and daily-report wrappers recognise Netlify's POST schedule event (production runs were all refused at the secret check).
- Verification: PHP lint of every plugin file on PHP 7.4 and 8.5 (php-wasm); all five plugin harnesses pass on 7.4 and 8.5 (new tests for the site-wide run lock and post sync); real WordPress 7.1.3 (WordPress Playground CLI) on PHP 7.4 and 8.5 shows the post handler keeps `\u003c` and `C:\Users\name` while the old unslashed save strips them, and a 21.6 MB PNG is sent as a 2.3 MB 2048x1638 WebP with no temp files left; frontend 23 files / 156 tests, Netlify Functions 28 files / 196 tests, migration chain 27 tests, TypeScript, ESLint, `next build`, local `/connect` header check, 1.7.26 ZIP build.
- Still needs a real browser: one "Connect Account" click from a WordPress site to confirm the popup hands the key back automatically.

## 2026-10-24: Pre-launch fixes for website, dashboard and admin

- Status: implemented and verified locally on top of the 2026-10 pricing commit; not committed, not deployed. No production system was changed.
- Fixed: a plan or pack chosen before sign-up/sign-in is kept for 24 hours (`src/lib/pending-checkout.ts`) and reopened on the dashboard; `/api/checkout` returns 409 `subscription_exists` instead of starting a second subscription, and subscribers who run out of credits are offered packs; same-period plan switches from the Polar portal now apply immediately through new RPC `change_subscription_plan` (migration `20261024130000`); admin "Send Test" refuses unsubscribed or unknown accounts and asks for confirmation; open redirect in `getSafeAuthRedirect` (`//host` paths); dashboard and admin fetch a fresh access token per request; `get-usage` uses a count, this cycle's rows and the 10 newest rows instead of the whole history; legacy subscribers keep their original plan name and allowance on the dashboard.
- CSP: `proxy.ts` sat at the project root, which Next.js ignores for a `src/` project, so no CSP was ever sent. It now lives at `src/proxy.ts`; scripts stay nonce-only and styles allow inline (needed by sonner and next/image). Verified with a local production server: header present, every script tag carries the nonce, sonner styles apply, no CSP violations on public pages.
- Scheduled jobs (checked in Netlify, read-only): every lifecycle and daily-report run in the last 24 hours finished in ~4 ms with no output although all required variables are set, so both were refused at the secret check. The scheduled wrappers now recognise Netlify's POST schedule event (`next_run` body); the public URL of a scheduled function returns an empty platform 403, and the shared handlers still require the secret. Not committed or deployed.
- Supabase (read-only, 2026-10-24): the reset-password email still uses the default `{{ .ConfirmationURL }}` template, so resets fail across devices; replaced in production on 2026-10-24 with the owner's approval: subject "Reset your Alt Text Pro password" and the body of `supabase/templates/recovery.html`, verified after reload (token_hash link through `/auth/confirm?type=recovery`, no `ConfirmationURL`). The deployed `/auth/confirm` already handles recovery links. The sign-up template is the branded one; redirect URLs cover `https://www.alt-text.pro/**`. Aggregates: 38 profiles (34 Free active, 2 Free cancelled, 2 `tier2` active, both pinned), migrations applied through `20260817060012`, last lifecycle send 2026-08-14, and only `page_viewed` events (169) in the last 30 days.
- Verification: frontend 23 files / 155 tests, Netlify Functions 27 files / 181 tests, migration chain 27 tests, TypeScript, ESLint, `next build`, `git diff --check`.

## 2026-10-24: 2026-10 pricing prepared locally

- Status: implemented and verified locally; not committed, not deployed. No Polar, Supabase production, or Netlify change was made.
- New catalogue for new purchases: Starter `tier1` $5/500, Growth `tier2` $12/1,500, Agency `tier4` $29/5,000; annual is 10x monthly. Pro `tier3` and `pay_as_go` are retired from sale (`is_active = false`). Packs: `small_pack` $12/1,000, `credit_pack` (Library Pack) $45/5,000, new `bulk_pack` $99/15,000, open to every account including Free. Free is unchanged (150 signup + 15/month).
- Existing subscribers keep their price (old Polar products are archived, not deleted) and their allowance: migration `20261024120000_apply_2026_10_pricing.sql` pins `monthly_credit_allowance` for every paid profile before changing plan rows. Old product IDs move to `NEXT_PUBLIC_POLAR_LEGACY_TIER*` variables, which map renewals but are not offered at checkout.
- Plan copy no longer implies per-plan feature gating; every plan lists the same features. Homepage pricing now shows the three packs.
- Polar product list, Netlify variable steps, release order and rollback are in `docs/pricing-2026-10-rollout.md`. Plugin `dashboard.php` labels (Lite/Standard) are unchanged pending a plugin release.
- Verification: frontend 20 files / 113 tests, Netlify Functions 25 files / 176 tests, migration chain 26 tests, TypeScript, ESLint on changed files, production `next build`, and a desktop/mobile visual check of the pricing section.

## 2026-10-24: Repository root cleanup

- Removed the committed Vim swap file `frontend-next/src/app/dashboard/.page.tsx.swp` and ignored `*.swp`/`*.swo`.
- The raw audit artifacts (`CODE_AUDIT_REPORT.md`, `report.md`, `full-project-code-audit-and-issue-report.json`, `audit-evidence/2026-08-17/`) stay local and are now ignored instead of showing as untracked.
- Committed the `next dev`-generated `frontend-next/AGENTS.md` and `frontend-next/CLAUDE.md`, and the deletion of stale public plugin ZIPs. `build-plugin.sh` recreates `alt-text-pro-plugin.zip`, the current versioned ZIP, and `downloads/alt-text-pro.zip` during every Netlify build; the `.gitignore` exceptions for old ZIPs were removed.
- Deleted unused code: the six `start-*.sh` scripts (they started a removed `frontend/` CRA app), `netlify-frontend/`, `netlify-functions-auth/`, `netlify-functions-built/`, `netlify-config/`, `netlify-config-auth/`, `supabase-auth-frontend/`, `tests/`, `deno.lock`, `.emergent/`, `legacy/` (PayPal), root `backups/`, `backup.sh`, `create-full-backup.sh`, and `.cursor/rules/zenable.mdc`.
- Moved one-off production scripts to `scripts/ops/` and superseded docs to `docs/archive/`.
- Known issue, not fixed: the deleted `backups/.../database-export.sql` contained customer email addresses and remains in Git history since 2025-11-20. History was intentionally not rewritten; a purge needs separate approval.
- `email-template-preview.html` was left untracked pending a decision. No production system was touched; nothing was pushed.

## 2026-10-24: Complete workspace restored to T7

- Owner requested restoration for local work under `/Volumes/T7/Projects`.
  Restored the full latest recorded vault archive `Alt-text-Pro_v1.7.25_03.zip`
  (2026-09-01) to `/Volumes/T7/Projects/Alt-text`; preserved its original folder
  name and complete internal structure. No destination was overwritten.
- Authoritative source is `/Volumes/T7/Projects/Alt-text/v3 - react to next - working/app-main`.
  The outer Git repository remains archival and must not be treated as the source root.
- SHA-256 matched `dbffd716204f4d9cf268d5a7a2c3a02c39ffc516189610ee8bbc1a3748c8b98b`.
  ZIP integrity and full extraction verification passed for all 77,046 entries:
  71,852 regular files, 5,129 directories and 65 symlinks. Every regular file's
  SHA-256, permissions, structure and symlink target matched before this update.
- Read the project navigation/context and operational instructions and ran
  `scripts/ai-context.sh`. Git integrity passed; local main and archived origin/main
  remain at `ed3b4b9a61956352718af495283b9920ed2522e3`. Preserved all 14 archived
  dirty/untracked entries, including deliberate generated-package deletions and
  existing documentation/audit changes. No pull, commit, push or remote change.
- Plugin header, version constant, stable tag and frontend marker all report 1.7.25.
  No application changes, package rebuilding, deployment, live-system operation,
  archive creation/deletion or cleanup occurred. This progress update is local and
  uncommitted; builds/runtime tests were not rerun. Earlier production evidence is
  historical, not a fresh production check. Vault manifest/history updated.

## 2026-08-30: Generated live-site redesign directions

- Status: three independent landing-page design directions were generated from a captured read-only view of `https://www.alt-text.pro/` and the existing frontend context; waiting for the user to select a visual direction before any build work.
- Assessment: the current visual identity is distinctive, but the first-screen value proposition is still abstract until the WordPress review workflow is shown. The directions test workflow-first proof, editorial trust, and demo-first interaction.
- Scope: no application code, production system, billing, Supabase, Netlify, or WordPress site was changed.

## 2026-08-25: Corrected frontend plugin version marker

- Status: complete. Ran `scripts/sync-plugin-version.mjs` so `frontend-next/src/lib/plugin-version.ts` now reports `1.7.25`, matching the WordPress plugin header, version constant, and readme stable tag.
- Verification: frontend Vitest suite passed (20 files, 102 tests), TypeScript `--noEmit` passed, and `git diff --check` passed.
- No production deployment or WordPress.org mutation was performed.

## 2026-08-25: Backed up current Alt Text Pro workspace

- Status: complete. The current local workspace was archived to `/Volumes/One Touch/Project Vault/Archives/Alt-text/Alt-text-Pro_v1.7.25.zip` after the tracked 1.7.25 popup-flow changes were committed and pushed to private GitHub `Aamirf730/alt-text-io` `main` at commit `2cd6b50ac8809f8c8de2fe5e4dc915670926bc24`.
- Archive verification: 159,231 entries, 1,706,819,913 bytes, ZIP integrity test passed, SHA-256 `a883ecf386f1fadb1987d7cac2d6ea59aef37fd18054d8121fef360f76e1f27e`.
- Scope: local project remains present; no older SSD archive was overwritten or deleted. Untracked audit/report artifacts remain local and were included only in the complete SSD workspace archive, not pushed to GitHub.
- Known consistency issue: the WordPress plugin header/readme report `1.7.25`, while `frontend-next/src/lib/plugin-version.ts` still reports `1.7.24`; this backup preserves the current workspace without changing that code.

## 2026-08-22: Published WordPress plugin 1.7.25 and verified listing cache behavior

- Status: plugin 1.7.25 is live on WordPress.org. SVN trunk commit `3660021` and tag commit `3660023` were accepted; the follow-up screenshot-byte refresh was committed as assets revision `3660024`.
- Public verification: WordPress.org page/API report version `1.7.25`; the versioned download `alt-text-pro.1.7.25.zip` contains 1.7.25 and passes ZIP integrity; trunk and tag headers/readmes are aligned.
- Screenshot verification: listing HTML references `screenshot-1.png` through `screenshot-6.png?rev=3660024`; direct `ps.w.org` originals are the corrected captures and the lightbox shows them. The responsive `i0.wp.com/plugins.svn.wordpress.org` thumbnails remain stale per-image, so the gallery grid can still show old artwork while the enlarged view is correct. This is an external WordPress.com CDN cache issue, not a missing SVN upload.
- Scope: no production database or live WordPress customer site was changed. Local website/plugin ZIPs were rebuilt and remain uncommitted alongside the user’s existing working-tree changes.

## 2026-08-22: WordPress.org listing screenshots corrected and published

- Status: complete at WordPress.org assets SVN revision `3659964`; only `assets/screenshot-1.png` through `assets/screenshot-6.png` were committed. Existing icons, banners, trunk, and tags were not changed.
- Replaced the obsolete captures with real WordPress 7.0.2 admin screens running the publicly listed Alt Text Pro 1.7.24 release. The new set uses clean demo branding, representative media/log data, a populated bulk-selection workflow, a readable 1440x1024 desktop format, and an actual 768x1200 responsive capture.
- Verification: all six remote SVN files and all six cache-busted `ps.w.org` files match the local SHA-256 hashes and valid PNG dimensions. WordPress.org metadata still referenced prior asset revision `3639973` immediately after publication, so its `i0.wp.com` gallery-thumbnail cache remained pending directory-side propagation even though the new source assets were live.
- Scope guard held: unrelated working-tree changes were preserved; no customer account, production WordPress site, API credit, plugin code, plugin release tag, icon, or banner was changed.

## 2026-08-17: Rebuilding customer dashboard as an operations console

- Status: implementation and local verification complete in the Desktop `main` worktree; not committed or deployed.
- Visual target: the selected third dashboard concept, adapted to Alt Text Pro's existing black, yellow, white, and gray brand palette.
- Scope completed: responsive sidebar navigation, compact connection/onboarding state, recent activity, quick actions, plan/usage visibility, quick generation, API settings, and preserved billing/auth behavior. The obsolete hidden dashboard markup was removed.
- Verification: frontend 20 files / 102 tests, TypeScript, production Next build, `git diff --check`, desktop/mobile browser checks, mobile navigation interaction, browser console review, and `design-qa.md` all pass.
- Visual QA evidence: `/tmp/alt-text-dashboard-design-comparison-clean-wide.png` and `/tmp/alt-text-dashboard-default.png`; final result is `passed`.

## 2026-08-17: Made dashboard first-run onboarding conditional

- Status: implemented in the Desktop `main` worktree; not deployed.
- `get-usage` now reports plugin connection only from an existing `connect_completed` event whose source is the WordPress plugin. Having an issued API key no longer counts as a connected plugin.
- The customer dashboard hides the setup card after the plugin is connected and the first generation is complete; it remains available for users who still need either step.
- Verification: Netlify Functions 16 files / 129 tests, frontend 19 files / 99 tests, TypeScript, JavaScript syntax, production Next build, and `git diff --check` passed.

## 2026-08-17: Published WordPress plugin 1.7.24

- Status: plugin 1.7.24 is published through the WordPress.org SVN channel. Trunk commit `3650534` and tag `1.7.24` revision `3650537` were accepted under the authenticated `aamirfaiz` account.
- Public verification now reports WordPress.org version `1.7.24`; `https://downloads.wordpress.org/plugin/alt-text-pro.1.7.24.zip` returns HTTP 200. The archive was also checked locally with `unzip -t`.
- The SaaS website download remains version 1.7.24 and is independent of WordPress.org directory propagation.

## 2026-08-17: Audit-hardening release deployed

- Status: all seven migrations for the current audit-hardening release are applied successfully to production, and the matching application/plugin release is live from Git-backed `main`. The code release is in `0429744`, migration-history reconciliation is in `b342604`, and the release evidence follow-up is recorded after deploy.
- Production migration ledger entries are `20260817055942` through `20260817060012`; the repository filenames now use those recorded versions so a future migration check will not replay the applied SQL.
- Read-only verification confirms the activation, renewal, API-key issuance, promotional-grant, subscription-revocation, pack-revocation, reservation-reaper, and legacy `use_credit` functions; the promotional ledger, reservation indexes, accounting constraints, subscription index, private-schema usage, and five-minute cron reaper are present. Authenticated clients no longer have table-level `SELECT` on `public.api_keys`, and the old unique profile-email constraint is absent.
- Netlify deploy `6a82a4900eacef0008b49937` is ready, Git-backed, on `main`, and built commit `393fa93fb8d8ac5fde3f244607c8b9d3bfb9e247`. Post-deploy smoke checks returned HTTP 200 for `/`, `/admin`, `/connect`, the first Next static asset, and `/downloads/alt-text-pro.zip`; `/api/health` reported `backend: redis`, `probe: skipped`, and `status: healthy`. The production plugin ZIP is version 1.7.24 and passes `unzip -t`.
- The four raw audit artifacts remain intentionally untracked: `CODE_AUDIT_REPORT.md`, `audit-evidence/2026-08-17/`, `full-project-code-audit-and-issue-report.json`, and `report.md`.

## 2026-08-17: Implemented Supabase audit findings 32 through 39 locally

- Status: findings 32–39 are implemented in the Desktop `main` worktree. No production migration, commit, deployment, or live data mutation was performed.
- Added `supabase/migrations/20260817120000_harden_credit_and_profile_integrity.sql`: legacy `use_credit` now uses the reservation engine (including tier4/agency caps); promotional grants have a service-role-only idempotency ledger; subscription revocation is locked and retry-safe; paid-pack revocation uses profile-then-ledger lock ordering; expired reservations have a bounded `pg_cron` reaper; accounting checks and the `profiles.subscription_id` index are added; and profile email uniqueness is removed so each auth identity can receive its own profile while `user_id` remains authoritative.
- Updated migration-chain and webhook regression coverage, plus the promotional-grant release documentation.
- Verification: migration-chain tests 25/25, Polar webhook tests 28/28, credit-reservation tests 6/6, JavaScript syntax checks, and `git diff --check` passed.
- Read-only production preflight found 0 invalid usage rows, 0 negative payments, 0 duplicate lowercased profile emails, 2 annual and 32 null profile billing cycles, the expected existing `profiles_email_key`, and no `profiles_subscription_id_idx`. The migration will add/remove those items when explicitly applied.
- A real fresh `supabase db reset`/Postgres replay has not run because no local Docker/Postgres instance is available; the migration remains uncommitted and unapplied.

## 2026-08-17: Completed plugin audit findings P3.24 through P3.31 locally

- Status: P3.24–P3.31 are fixed in the Desktop `main` worktree. No production database, WordPress site, WordPress.org publication, commit, or deployment was performed.
- Post-level generation now honors `context_enabled`; the active context-suggestion UI has a nonce- and capability-protected AJAX handler; and the unused dynamic refresh action was removed.
- Dashboard and logs statistics now use WordPress site-time date prefixes instead of database-server `CURDATE()`/`MONTH()` values. API-generated alt text is sanitized on the remaining plugin write paths, and attachment filename extraction safely handles `get_attached_file()` returning `false`.
- Uninstall now removes durable bulk-state options and the API-key storage-error option. Plugin translations are loaded explicitly, obsolete admin bindings/methods were removed, and the API-key callback no longer renders the removed toggle control.
- Plugin metadata and local distribution artifacts are at version 1.7.24. Added `wordpress-plugin/tests/p3-hygiene.php` for these regressions.
- Verification passes: PHP lint for all changed plugin PHP files, P3 hygiene checks, API-key persistence, Gutenberg synchronization, attachment-permission, and security regression harnesses; JavaScript syntax; plugin ZIP build; and `git diff --check`. Changes remain uncommitted and undeployed.

## 2026-08-17: Completed audit findings P3.15 through P3.23 locally

- Status: P3.15–P3.23 are implemented in the Desktop `main` worktree. No production database, Netlify configuration, commit, or deployment was touched.
- Polar webhooks now queue missing-order-ID refunds instead of creating `polar_ord_undefined`, fail loudly when customer-ID persistence fails, reconcile unknown one-time products without granting credits, use bounded product-ID/metadata/name mapping, and expose an explicit 503 guard when `POLAR_WEBHOOK_SECRET` is absent.
- Dashboard subscription checkout now offers monthly and annual product IDs/prices. Free-credit usage displays include the persistent bonus balance. Connect analytics no longer treats every authenticated revisit as a signup and uses the authenticated email captured in a ref rather than a stale closure.
- CSP is now nonce-based in `frontend-next/proxy.ts` with no `unsafe-inline` script/style allowances. Inline style attributes were removed, JSON-LD scripts receive the request nonce, and the secure email-confirmation page trusts only the session established by `/auth/confirm`.
- Verification passes: frontend 99 tests, Next production build, TypeScript, Netlify Functions 127 tests, auxiliary Netlify tests 47 tests, migration-chain 17 tests, JavaScript syntax checks, and `git diff --check`. The build logs the expected local warning that `POLAR_WEBHOOK_SECRET` is not configured; no production secret was inspected or changed.

## 2026-08-17: Closed the remaining P3-7 auth-validation timeout gap

- Status: the legacy Supabase `/auth/v1/user` request in `auth-validate.js` now aborts after five seconds with `AbortSignal.timeout(...)`. No production configuration, database, deployment, or commit was touched.
- Verification: the API-key storage/auth-validation test passed (4 tests), JavaScript syntax validation passed, and `git diff --check` passed.

## 2026-08-17: Implemented Netlify P3 audit fixes 1 through 14 locally

- Status: P3.1–P3.14 are implemented in the Desktop `main` worktree. No production database, Netlify site, commit, or deployment was touched.
- Security fixes include exact CORS preview origins, constant-time lifecycle-secret checks without query-string secrets, parameter-safe lifecycle event queries, serialized API-key issuance/rotation, paginated account deletion, case-insensitive Bearer parsing, safe module loading without Supabase environment variables, bounded auth/database health requests, query-string secret redaction, a brand-domain sender fallback, and removal of unused legacy utilities.
- Consistency fixes centralize subscription-plan fallback credits and record low-credit lifecycle events for both plugin and dashboard generation paths. Lifecycle email messages now include signed unsubscribe links backed by `profiles.marketing_unsubscribed_at`; scheduled and admin test sends honor the opt-out.
- Added migrations `20260817100000_atomic_api_key_issuance.sql` and `20260817110000_add_lifecycle_unsubscribe.sql`. They are not applied to production.
- Verification passes: Netlify Functions 25 test files / 174 tests, frontend 16 test files / 89 tests, migration-chain 17 tests, TypeScript, JavaScript syntax checks, and `git diff --check`. A local `supabase migration list --local` check could not connect because no local Postgres/Docker instance is running; no production migration was attempted.

## 2026-08-17: Completed audit findings 4.5 through 4.12

- Status: all eight findings are fixed and locally verified in the Desktop `main` worktree; no production mutation, commit, or deployment has been performed.
- Server-side work protects the daily funnel schedule, scrubs deletion-provider errors, paginates all affected PostgREST reads, makes lifecycle-send deduplication complete, requires the dedicated API-key encryption secret, and bounds Gemini generation while returning database re-check failures as 500 rather than 402. Admin data now fails closed instead of returning a misleading partial result when a paginated query fails.
- Plugin work removes the duplicate connection click handler and renders connection/bulk activity values as text. Plugin metadata and the rebuilt distribution artifact are at 1.7.23.
- Verification: Netlify Functions 18 files/158 tests passed; frontend 16 files/89 tests passed; migration-chain 15 tests passed; TypeScript, JavaScript syntax, and `git diff --check` passed. Using the local PHP 7.4.33 binary at `/opt/homebrew/opt/php@7.4/bin/php`, all four plugin regression harnesses also passed, including the security, Gutenberg, API-key persistence, and attachment-permission checks.

## 2026-08-17: Completed historical client-write integrity review

- Status: 4.4 closed as a historical review; the client write boundary is already fixed in production by `20260811110000_harden_client_data_boundaries.sql`. No production data was changed.
- Read-only production checks covered profiles updated during the exposed window, payments, usage logs, credit-pack grants, campaign claims, campaign audit rows, and persistent credit ledgers. The window contained 1 Polar payment, 1,360 unit-credit usage rows, no credit-pack grants, and two campaign claims totaling 2,000 credits with matching `credit.add` audit entries.
- No non-Polar/negative payments, negative active grants, purchased balances above the grant ledger, aggregate balances below persistent ledgers, or unexplained historical campaign claims were found. The known annual profile missing a provider subscription ID remains a separate provider-linking issue.
- Evidence is recorded in `audit-evidence/2026-08-17/HISTORICAL_CLIENT_WRITE_REVIEW.md`. This review cannot prove that no write occurred because the old schema had no row-level audit trail, but it found no actionable integrity anomaly requiring repair.

## 2026-08-17: Closed direct authenticated API-key table access

- Status: 4.3 fixed locally in the Desktop `main` worktree; no production migration, commit, or deployment was performed.
- The API-key storage migration now revokes table-level privileges from `public`, `anon`, and `authenticated`, so its column-level revokes cannot be bypassed by the bootstrap table grant.
- Added repair migration `20260816202022_secure_api_key_table_access.sql` for databases where the original storage migration is already applied. Service-role access remains available for the Netlify key endpoint; RLS policies remain as defense in depth but are no longer reachable through client table privileges.
- Migration-chain coverage verifies both the original and repair table-level revokes.

## 2026-08-17: Made subscription renewal fulfillment atomic

- Status: 4.2 fixed and verified locally in the Desktop `main` worktree; the migration is not applied to production, and no commit or deployment was performed.
- Added `20260816200907_renew_subscription_credits_atomically.sql`, exposing the renewal operation only to `service_role`. The RPC locks the profile row, re-checks the subscription binding and period boundary inside the transaction, preserves current bonus/purchased ledgers, and skips duplicate or stale periods.
- `onSubscriptionUpdated` now delegates renewal credit and metadata updates to the RPC instead of performing a JavaScript read-compute-write. Concurrent credit debits therefore serialize safely with renewal, and webhook retries cannot reset an already-processed period.
- Verification: migration-chain tests passed (14), Polar webhook tests passed (25), TypeScript passed, and `git diff --check` passed.

## 2026-08-17: Corrected Small Credit Pack fulfillment amount

- Status: 4.1 fixed and verified locally in the Desktop `main` worktree; no production deployment or commit was performed.
- One-time Polar product names now resolve through the shared plan matcher before broad credit-name substring matching, preventing `Small Credit Pack` from falling through to the 1,200-credit large-pack match.
- Added webhook regression coverage confirming the Small Credit Pack grants exactly 500 credits while explicit `credits` metadata remains authoritative.

## 2026-08-17: Protected public health checks from Redis probe abuse

- Status: P1-3.6 fixed and verified locally in the Desktop `main` worktree; no production configuration change, deployment, or commit was performed.
- `/health` now applies a 30-request-per-minute distributed rate limit per resolved client IP before serving GET health requests. Requests are rejected with the existing `429` response once the client quota is exhausted; if the limiter backend is unavailable, the endpoint reports a degraded health state instead of exposing internal limiter details.
- Public basic health checks now use a sanitized backend status snapshot and do not call the Redis `PING` health probe. Redis probing remains available only to secret-protected detailed checks.
- Public responses no longer expose initialization error text or memory-fallback override flags.
- Regression coverage verifies the per-IP cap, the no-probe public path, sanitized output, and Redis status reporting without a ping. Netlify Functions verification passed: 22 test files / 190 tests; JavaScript syntax checks and `git diff --check` passed.

## 2026-08-17: Restored customer-offer private schema access locally

- Status: P1-3.5 fixed locally in the Desktop `main` worktree; no production migration, deployment, or commit was performed.
- The customer-offer isolation migration now grants `USAGE ON SCHEMA private` to `authenticated`, allowing its security-invoker public wrapper to resolve the identity-bound private function.
- Added repair migration `20260816183608_grant_customer_offer_schema_usage.sql` for environments where the isolation migration is already marked applied. It restores schema usage and the private function execute grant without exposing the schema to anonymous callers.
- Migration-chain coverage now checks both the original grant and the repair migration.

## 2026-08-17: Made Tier 4 catalogue migration replayable locally

- Status: P1-3.4 fixed locally in the Desktop `main` worktree; no production migration, deployment, or commit was performed.
- `20260809211033_activate_tier4_catalogue.sql` now creates `public.subscription_plans.is_active` with an idempotent `add column if not exists` before updating the Tier 4 row. This repairs fresh replay while remaining safe for production schemas that already have the manually-added column.
- Migration-chain coverage now verifies both the DDL and its ordering before the `is_active` update.

## 2026-08-16: Made subscription activation idempotent locally

- Status: P1-3.3 fixed and verified in the Desktop `main` worktree; no production migration, deployment, or commit was performed.
- Added migration `20260816174327_make_subscription_activation_idempotent.sql`. The activation RPC locks the profile row and skips a replay when the same subscription ID and `next_billing_date` period are already recorded, returning `already_processed: true` and preserving the current balance/usage.
- A changed period continues through the existing atomic reset path. The row lock also serializes concurrent duplicate deliveries so only the first activation can reset credits.
- Verification: migration-chain tests (12), Polar webhook tests (24), JavaScript/TypeScript checks, and `git diff --check` are the release gates; production was not changed.

## 2026-08-16: Fixed forwarded-IP spoofing in rate limits and request records

- Status: P1-3.2 fixed locally in the Desktop `main` worktree; no production deployment or mutation was performed.
- `getClientIp` now uses the rightmost non-empty `X-Forwarded-For` entry, matching the edge-appended client address instead of trusting the caller-controlled leftmost value.
- Audit-log request metadata now reuses the shared resolver, keeping forensic IP records consistent with rate-limit keys. `track-event` already uses the shared resolver.
- Regression coverage now asserts rightmost forwarded-IP selection, including whitespace/empty entries. Focused and full Netlify Functions tests, JavaScript syntax checks, and `git diff --check` are the verification gates.

## 2026-08-16: Closed lifecycle scheduler authorization bypass locally

- Status: P1-3.1 fixed and verified in the main worktree; no production deployment was performed.
- `lifecycle-automation.js` no longer treats missing HTTP markers as proof of a trusted scheduler. Every run now requires `LIFECYCLE_AUTOMATION_SECRET`.
- The scheduled wrapper injects the secret only into scheduler-shaped events; HTTP-shaped calls retain their original headers and are blocked unless the caller supplies the secret.
- Added shared-handler and wrapper-level regression coverage for unauthenticated schedule-shaped requests, authenticated scheduled events, and HTTP requests that must not receive the scheduler credential.

## 2026-08-16: Confirmed encryption compatibility debt and removal gate

- Status: P3-4 reviewed; no CBC removal is appropriate before plugin version 2.6.0.
- `enc2:` AES-256-GCM remains the only new storage format. The `enc:` AES-256-CBC reader is intentionally retained for older installations and upgrades successful reads in place.
- Added regression coverage proving a valid legacy CBC record remains readable and is rewritten as authenticated `enc2:` storage.
- Removal gate for 2.6.0: verify that all supported customer databases have migrated or have a documented recovery path, then remove the CBC decryptor and migration-on-read branch in a separate release.

## 2026-08-16: Added durable recovery for bulk processing state

- Status: P3-3 fixed and verified in the main worktree; no plugin publish, commit, or deployment was performed.
- Active bulk-process state is now written to a non-autoloaded WordPress options-table record as well as the transient cache. If an external object cache evicts the transient, the next request restores the state from the database and repopulates the cache.
- Terminal completed and cancelled jobs remove their durable state record so finished runs do not accumulate indefinitely.
- Plugin version advanced from 1.7.21 to 1.7.22 with synchronized metadata and changelog entries.
- Verification: WordPress security, API-key persistence, Gutenberg synchronization, and attachment-permission regressions passed; PHP 7.4 lint passed for the changed plugin files; `git diff --check` passed.

## 2026-08-16: Disabled legacy credit deduction fallback locally

- Status: P3-2 fixed and verified in the main worktree; no production deployment was performed.
- `netlify-functions/utils/api-key-validator.js` no longer calls `public.use_credit`. The exported `updateUserCredits` name remains only as a compatibility shim, marked deprecated and failing closed with `requiresReservation: true`.
- Generation continues through the reservation lifecycle: reserve before AI, finalize on success, and release on failure.
- Verification: credit-reservation tests cover the fail-closed shim and the absence of the legacy RPC path; focused reservation/API-key checks and JavaScript syntax checks passed.

## 2026-08-16: Removed obsolete bulk-processing AJAX stub locally

- Status: P3-1 fixed in the main worktree; no commit, plugin publish, or deployment was performed.
- Removed the unused `wp_ajax_alt_text_pro_bulk_process` registration and its error-only `ajax_bulk_process()` method from the plugin.
- Confirmed the active batch processor remains registered through `alt_text_pro_bulk_start`, `alt_text_pro_bulk_status`, `alt_text_pro_bulk_process_batch`, `alt_text_pro_bulk_skip_failed_image`, and `alt_text_pro_bulk_cancel`.
- Version: plugin metadata and synchronized frontend version advanced from 1.7.20 to 1.7.21.

## 2026-08-16: Post-generation permission omissions now visible locally

- Status: P2-4 implementation and verification complete in the main worktree; no plugin publish, commit, or deployment was performed.
- Authorization preserved: post generation still processes only attachments for which the current user has `edit_post` permission.
- Reporting fixed: rejected image IDs are now returned as `skipped_attachment_ids`, counted separately as `permission_skipped`, and included in a structured `insufficient_attachment_permissions` warning. The total now includes both processable and permission-filtered images.
- UI fixed: the posts list warns before generation when images are excluded, and the AJAX result cannot render a permission-only outcome as a successful completion.
- Version: plugin metadata and the synchronized frontend version advanced from 1.7.19 to 1.7.20.
- Verification: permission-reporting, security, Gutenberg sync, and encrypted API-key PHP regressions passed; PHP lint, JavaScript syntax, and `git diff --check` passed.

## 2026-08-16: Rate-limit backend health visibility hardened locally

- Status: implementation and focused verification complete locally in the main worktree; no production configuration change or deployment was performed.
- Health endpoint: `netlify-functions/health.js` now includes a `rate_limiter` check on basic, database, AI, and full responses. It actively pings Redis with a timeout, reports `redis`, `memory`, or `unavailable`, and returns degraded/503 when the required backend cannot serve requests.
- Production policy: `RATE_LIMIT_ALLOW_MEMORY_FALLBACK=true` is now ignored in hosted/production contexts. If present there, rate-limited requests still fail closed and health reports `memory_fallback_override_forbidden` so the configuration can be removed.
- Documentation: updated `netlify-functions/README.md` to describe the hosted fail-closed policy and public rate-limit health reporting.
- Verification: focused rate-limiter and health tests passed (23 tests); JavaScript syntax checks and `git diff --check` passed.

## 2026-08-16: P1 billing activation atomicity and distributed rate-limit hardening release in progress

- Status: released to production from Git-backed Netlify deploy `6a818ce5cf1f6c0008a4552c` at commit `aa4db95` on `main`.
- Subscription activation fix: added migration `supabase/migrations/20260816092527_activate_subscription_atomically.sql` with service-role RPC `public.activate_subscription_profile(...)`, which locks the profile row and applies the subscription plan metadata, monthly allowance, next billing date, renewal timestamp, and reset aggregate credits in one atomic database operation.
- Webhook change: `frontend-next/src/app/api/webhooks/polar/route.ts` now routes `subscription.active` through the new RPC instead of performing one credit update followed by a separate profile update. One-time pack fulfillment still uses the existing idempotent credit-pack RPC.
- Rate-limit hardening: `netlify-functions/utils/rate-limiter.js` allows in-memory fallback only for local/dev contexts or an explicit `RATE_LIMIT_ALLOW_MEMORY_FALLBACK=true` override in non-hosted contexts. Netlify/production contexts fail closed with a temporary `503` response if Upstash is missing or Redis initialization/request handling fails. `netlify-functions/utils/cors.js` now renders that backend-unavailable state as `503 Rate limiter unavailable` instead of a misleading `429`.
- Caller alignment: `admin-marketing-funnel.js`, `admin-lifecycle-status.js`, `admin-lifecycle-test-send.js`, and `track-event.js` now use the shared rate-limit response helper so unavailable distributed enforcement returns the same fail-closed `503` shape everywhere.
- Regression coverage: `frontend-next/src/app/api/webhooks/polar/route.test.ts` now asserts `subscription.active` calls the atomic activation RPC; `supabase/migrations/migration-chain.test.js` now expects the atomic activation migration as the latest migration and verifies the RPC's lock/update/grant shape; `netlify-functions/utils/rate-limiter.test.js` now covers production fail-closed behavior for both missing Upstash configuration and Redis initialization failure; `netlify-functions/utils/cors.test.js` now covers the `503` response path.
- Verification: `node --test supabase/migrations/migration-chain.test.js` passed (11 tests); `frontend-next/src/app/api/webhooks/polar/route.test.ts` passed (24 tests) from the `frontend-next` project root; `netlify-functions/utils/rate-limiter.test.js` passed (10 tests); `netlify-functions/utils/cors.test.js` passed (17 tests); `find netlify-functions -name '*.js' -not -path '*/node_modules/*' -print0 | xargs -0 -n 1 node --check` passed; `./frontend-next/node_modules/.bin/tsc --noEmit -p frontend-next/tsconfig.json` passed; `git diff --check` passed.
- Production migration verification: Supabase production project `ALT-Text-Ai` has migration ledger entry `20260816092527_activate_subscription_atomically`. RPC `public.activate_subscription_profile(uuid,text,text,text,text,text,integer,timestamptz)` exists, runs as `SECURITY DEFINER`, grants `EXECUTE` to `service_role`, and denies `anon`/`authenticated`.
- Release preflight: Netlify production has both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` accessible, so the fail-closed limiter should use distributed Redis in production rather than returning backend-unavailable responses.
- Production deploy verification: Netlify deploy `6a818ce5cf1f6c0008a4552c` is ready, `manual_deploy = false`, `branch = main`, and `commit_ref = aa4db95607d9f300bf8da7ccadac4a31612fc5a0`. Live smoke checks returned HTTP 200 for `/`, `/admin`, `/connect`, `/api/get-plans`, and `/api/health`; unsigned Polar webhook returned 403; public tracker rejected reserved `polar_webhook` source with 403 and accepted a normal anonymous page-view event with 200.

## 2026-08-16: Gutenberg post-content alt sync fix applied to main worktree

- Status: completed locally in the main worktree only. No deploy, WordPress.org publish, commit, or production mutation was performed.
- Scope: applied the Gutenberg block-validation fix to the current main-branch plugin state, preserving the newer 1.7.18 security changes already present in this tree.
- Root cause: post-level alt-text regeneration updated rendered `<img alt>` markup inside `post_content` but left Gutenberg block comment attributes stale, causing block validation errors and editor-side reverts when posts were reopened.
- Fix: `wordpress-plugin/alt-text-pro/alt-text-pro.php` now synchronizes both Gutenberg block metadata and rendered image HTML when post-level regeneration updates content images, with recursive block handling and classic-content fallback.
- Regression coverage: added `wordpress-plugin/tests/gutenberg-post-content-sync.php` to assert that `core/image` block JSON and rendered `<img>` markup update together while non-target images remain unchanged.
- Verification: `php -l wordpress-plugin/alt-text-pro/alt-text-pro.php`, `php wordpress-plugin/tests/api-key-persistence.php`, and `php wordpress-plugin/tests/gutenberg-post-content-sync.php` all passed using `/opt/homebrew/opt/php@7.4/bin/php`. The default `/opt/homebrew/bin/php` in this environment is currently broken because its `net-snmp` dependency is missing, so it was not used for verification. `git diff --check` passed for the changed plugin files.

## 2026-08-13: Homepage branding, pricing, and footer trust marks deployed

- Status: complete and live on `https://www.alt-text.pro`.
- Release commit: `4bec583` (`feat: clarify homepage branding and trust marks`) was pushed to `main`; the Git-backed Netlify production build is serving the update.
- Included: explicit “Alt Text Pro” homepage H1, compact subscription labels (“150 Credits”, “1,000 Credits”, etc.), one-line “Most popular” badge, official WordPress W mark, official Polar app icon, and the secure-connection badge.
- Verification: production homepage returned HTTP 200 and contains the updated H1, pricing labels, Polar/security footer copy; `/logos/polar-app-icon.png` and `/logos/wordpress-w.png` returned HTTP 200; `/api/health` returned healthy.
- Note: direct CLI deploy was not used because the local Netlify CLI site-link lookup returned 404; pushing `main` used the existing Git-backed production workflow successfully.

## 2026-08-13: Homepage branding clarity update ready for review

- Status: local implementation complete and opened for review; production has not been changed.
- Requested change: make “Alt Text Pro” explicit in the homepage H1 so Google’s OAuth branding review can match the consent-screen name; retain “Make Every Image Speak” as the headline; reduce the supporting credit notes and remove the pill/button styling from “1 credit per image.”
- Verification: frontend tests (14 files/74 tests), TypeScript, ESLint, and `git diff --check` pass. Local Next.js is running at `http://localhost:3000/` with the updated homepage open in the browser.

## 2026-08-13: Compact pricing allowance labels in progress

- Status: local implementation in progress; production has not been changed.
- Requested change: show subscription allowances as compact labels such as “150 Credits” and “1,000 Credits,” and keep the Standard “Most popular” badge on one line.

## 2026-08-13: Footer trust marks ready for review

- Status: local implementation complete and opened for review; production has not been changed.
- Requested change: restore recognizable WordPress, Polar.sh, and secure-connection trust marks near the footer platform information.
- Approach: reuse the repository’s WordPress SVG and use clear text/icon badges for Polar.sh and the secure connection because no official local Polar/security logo assets are available.
- Verification: TypeScript, Footer ESLint, focused pricing mapping tests, and `git diff --check` pass. Local homepage refreshed at `http://localhost:3000/`.
- Follow-up: added Polar’s official app icon from `https://polar.sh/assets/brand/app-icon.png` as a local asset and enlarged the WordPress mark for recognizability. The secure badge remains a neutral lock/shield indicator because no specific security provider was identified.
- Follow-up: replaced the WordPress wordmark with the official standalone W mark and increased both the WordPress and Polar marks to 40px+ visual size in their 48px badges.

## 2026-08-12: First-party authentication branding released and verified

- Status: complete. The direct Google Identity flow, first-party email confirmation page, custom SMTP sender, branded template, and Google consent settings are live on `www.alt-text.pro` without a Supabase paid plan.
- Scope: replace browser redirects through the Supabase Google OAuth hostname, add an `alt-text.pro` token-verification flow, provide versioned email-template/configuration assets, and verify every signup surface without changing billing, credits, API keys, or customer data.
- Implementation: the homepage, WordPress connect flow, and customer-offer flow now use Google Identity Services and exchange the signed Google ID token directly with Supabase using a hashed nonce. Added a first-party `/auth/confirm` token-hash verifier, strict redirect validation, a branded confirmation template, and the required CSP/COOP rules.
- Provider configuration: authorized both `https://www.alt-text.pro` and `https://alt-text.pro` as Google JavaScript origins. Changed the Google consent brand to `Alt Text Pro` and replaced the old Netlify homepage/privacy/terms values with the public `alt-text.pro` URLs. Added the existing Google client ID to the linked Netlify project's build environment without committing it.
- SMTP and template: the existing production Gmail transport authenticates successfully; Supabase now sends as `Alt Text Pro <help@alt-text.pro>` with subject `Confirm your Alt Text Pro email`. The deployed template links directly to `https://www.alt-text.pro/auth/confirm` and contains neither the default Supabase confirmation URL nor a `supabase.co` hostname. No new paid mail service was required.
- Production release: commit `b504e808687b7fe888abba5e89df06a8fbd1ae64` is on `origin/main`; Git-backed Netlify deploy `6a7c631fad32910008061518` is `ready`. Live smoke checks passed for `/`, `/connect`, `/customer-offer`, `/auth/confirm`, `/privacy`, `/terms`, and `/api/health`, including the Google CSP directives and `same-origin-allow-popups` header.
- Verification: frontend 14 files/74 tests, TypeScript, ESLint, the Next.js production build (28 routes), `git diff --check`, the draft deploy, and live browser checks pass. No customer-facing source retains `signInWithOAuth`; the production sign-in modal renders Google's official button without exposing Supabase branding or console errors.
- Email delivery proof: created one uniquely tagged disposable signup. Gmail received the branded message from `Alt Text Pro <help@alt-text.pro>`; its CTA remained on `www.alt-text.pro`; the live token-hash verifier established a session and reached `/email-confirmed` without console errors. The disposable profile/Auth user were then removed and the test message moved to Gmail Trash.
- Safety: existing untracked design/audit artifacts are preserved. No secrets were printed or committed, no customer data was changed, and temporary Netlify/test artifacts were removed or moved to Trash after verification.
- External review note: Google still records a prior branding-verification failure for the former Netlify homepage. The new production origins and branding are saved; domain ownership/reverification is a separate provider review and does not block the direct Google button rollout.

## 2026-08-12: Technical release-blocker remediation and production release completed

- Status: production/staging database hardening, legacy API-key encryption, staging orphan-data cleanup, customer-offer function isolation, dependency remediation, full regression, isolated preview, Git-backed Netlify release, and live smoke verification are complete. The live site now serves plugin 1.7.18 and the protected checkout-status route.
- Scope: production Supabase hardening migrations and verification, staging RLS/grant remediation, legacy API-key migration strategy, leaked-password protection feasibility, missing-index remediation, dependency/tooling posture, credential/history remediation preflight, and authenticated/provider release gates where automation and access safely permit them.
- Safety: secrets will not be printed. Database mutations are limited to reviewed migrations with verification and a rollback path. The user approved the WordPress.org publication and shared Git-history purge in this work session; external credential rotation remains intentionally skipped because the user does not use that server.
- Database changes: applied `harden_client_data_boundaries` to staging and production; applied `correct_public_plan_features` to production; added the missing user foreign-key indexes; moved the customer-offer security-definer implementation into the non-exposed `private` schema behind a security-invoker public wrapper; and verified Supabase no longer reports the exposed security-definer warning.
- API-key migration: encrypted all 22 remaining legacy plaintext active keys in place with the deployed AES-GCM secret, verified each ciphertext round-trip before clearing plaintext, and confirmed 25/25 active keys have ciphertext plus hashes, zero retain plaintext, and zero duplicate hash groups. Existing installed plugin keys were not rotated.
- Staging cleanup: archived 51 rows from six orphan profiles and their related payment/usage/grant/marketing records into a private staging-only table, then removed the orphan profiles through existing cascades. Staging now has zero orphan profile/payment/usage rows; two Auth-backed profiles remain.
- Dependency remediation: removed the locally installed Netlify CLI and its vulnerable image/parser chain from the project dependency tree, retained an on-demand pinned CLI script, and confirmed root full/production dependency audits now report zero vulnerabilities.
- Auth setting: enabled leaked-password prevention in both Supabase dashboard projects. Dashboard state shows it enabled, but the advisor cache has not yet refreshed; keep this as pending advisor verification.
- Release packaging: the first Netlify preview preflight exposed two colocated test files being bundled as deployable functions. Moved both tests to the dedicated cross-function test project; no affected preview was published.
- Continuous deployment: the first Git-backed production attempt failed safely before build because the configured Node patch release was unavailable in Netlify's dependency-install environment. Production remained on the previous healthy deploy; aligned `.nvmrc` and Netlify to the verified Node 22.23.1 runtime before retrying.
- Production release: pushed the reviewed commits through `main`; Netlify deploy `6a7c3dc3b8011900088f420a` completed `ready` from commit `27f3ec2aaed5d4097e7004324e93484ebf66d0b3` with zero secret-scan matches. Live checks passed for the homepage, connect, customer-offer, dashboard shell, health, eight-plan catalogue, signed-out customer-portal guard, checkout-status guard, security headers, and both plugin download URLs. Both live ZIPs report version/stable tag 1.7.18 and their extracted contents match the reviewed package.
- Remaining owner/provider actions: provide legal operator/jurisdiction details if the legal pages are to be finalized with business-specific identity; otherwise the current factual placeholders remain the only nontechnical follow-up. Previously completed real side-effect tests are accepted as evidence and will not be repeated here. Supabase dashboards show leaked-password prevention enabled; the advisor recheck is recorded below.
- WordPress.org publication: trunk revision `3643153` and tag revision `3643155` published Alt Text Pro 1.7.18. Both remote copies report version/stable tag 1.7.18; the official API reports version 1.7.18 and both versioned/latest downloads return HTTP 200 with valid 1.7.18 archives.
- Git-history purge: created temporary full pre-rewrite bundles, then removed the credential-bearing FTP/debug paths and retired test-host references from all local refs before force-updating `origin/main`; the temporary bundles were moved to Trash after verification. Verification found no remaining historical blob containing the identified FTP host/IP, FTP URL, or password pattern. Untracked design/screenshots were preserved.
- Supabase advisor recheck: both production `qurbdtzrngzfzevgoolp` and staging `hkpxsfwifpnbeifcsslb` still return the cached `auth_leaked_password_protection` notice, while RLS-disabled and exposed security-definer notices remain absent. Dashboard state remains enabled; this is a stale advisor-cache observation, not an unverified dashboard setting.
- Post-purge deployment recovery: the history rewrite initially force-pushed the stale local `main` ref, causing one temporary legacy Netlify deploy. Corrected `main` to the purged reviewed release commit `f86b2dd`; Netlify deploy `6a7c472ced66f000081eeb2b` is ready and live checks again pass for health, plans, billing guards, homepage, and plugin 1.7.18.

## 2026-08-12: Complete product audit and local hardening completed

- Status: the repository-wide audit, local repair set, responsive browser verification, plugin 1.7.18 package, and final evidence report are complete. The code is a locally verified release candidate, but production release remains blocked by the external data/security/legal gates recorded below and in `audit-evidence/2026-08-11/REPORT.md`.
- Scope completed: website and SEO guides, auth, dashboard/admin, customer offer and portal, Polar checkout/webhooks, Netlify Functions, Supabase schema/policies, WordPress single/post/bulk/upload/connect/uninstall paths, package hygiene, design, accessibility, privacy/legal copy, dependency posture, and repository history.
- Final local fixes: protected admin shell no longer flashes before signed-out redirect; primary routes now expose correct main landmarks/heading hierarchy; unsupported speed/quality claims were removed; the cross-function Vitest config is scoped to its own suite; email-confirmation redirects preserve validated plugin callback context; server error context is recursively redacted; plugin API-key storage failures remain visibly fail-closed; post-content update failures are surfaced; logs no longer expose a billable regeneration action that cannot apply its draft; and bulk locks/retries are atomic and bounded.
- Final verification: frontend 10 files/63 tests, Netlify Functions 19 files/150 tests, cross-function suite 3 files/24 tests, migrations 9/9, plugin PHP 12/12, plugin JavaScript syntax, two focused plugin regressions, ESLint, TypeScript, Next.js production build (27 routes), `git diff --check`, and the final desktop/mobile browser pass all succeeded. The final browser console contained no errors and audited pages had no measured horizontal overflow. The final independent CodeRabbit review completed with 0 findings.
- Plugin release candidate: version 1.7.18, 23 packaged files, source/public ZIP SHA-256 `14f3cfb14cc54a5cf8f7b0df2523cf596e3eed71fdb047e31365ca96d7e0f027`; includes uninstall cleanup and excludes tests/debug/FTP utilities. No external publication was performed.
- Release blockers: rotate the server credential exposed in deleted tracked FTP helpers; decide Git-history cleanup for those files and the deleted user-data debug log; apply/verify production Supabase hardening migrations; repair staging RLS/grants; migrate or rotate 22 legacy plaintext API keys; enable leaked-password protection; add the measured missing FK index; supply legal operator/jurisdiction details; and complete authenticated staging/live E2E after an authorized deploy.
- Dependency residual: production dependency audits are clean; the full root audit retains 14 high advisories in the Netlify CLI/dev image toolchain. Treat this as an upstream developer-tooling risk and do not use an older downgrade that reintroduces critical advisories.
- Safety: production, staging, Netlify, Polar, WordPress.org, and live WordPress remained read-only. No external mutation, customer charge, email delivery, account creation, or deployment occurred.

## 2026-08-11: Complete product audit in progress

- Status: architecture, baseline verification, live website/customer journeys, endpoint smoke checks, and the read-only production/staging Supabase review are complete. WordPress/plugin source review and the local repair set are in progress.
- Safety: production systems are read-only for this audit. Local fixes may be prepared and verified; no Supabase, Netlify, Polar, WordPress.org, or live WordPress mutation is authorized.
- Baseline: branch `codex/pricing-release-main` at `c288027`; the working tree already contains the documented screenshot refresh, design artifacts, and prototype files, which will be preserved.
- Evidence plan: combine current-run browser captures, automated source/tests/build checks, package inspection, migration/security review, and live read-only endpoint verification. Findings, fixes, limitations, and final verification will be recorded here and in a dedicated audit report.
- Baseline verification: 53 frontend tests, 139 Netlify-function tests, TypeScript, Next.js production build, all 11 plugin PHP syntax checks, plugin JavaScript syntax, the API-key persistence regression, and all Netlify JavaScript syntax checks passed. Dependency review found production-relevant high-severity advisories in Next.js, Nodemailer, `ws`, PostCSS, Sharp, Nano ID, and the test toolchain; the root Netlify CLI is also substantially behind current releases.
- Live application findings: all public routes and protected API boundaries returned expected status codes, security headers are present, and the active versioned plugin ZIP downloads. The simulator image is blocked by the current CSP, `/payment-success` reports success without evidence of a checkout, Polar's documented `{CHECKOUT_ID}` return token is not used, and the dead `/api/activate-subscription` redirect returns 404.
- Live data findings: production is healthy at the integrity layer (zero negative balances, duplicate payment IDs, orphan usage/payment rows, open reconciliations, or stale pending reservations). Twenty-two active legacy API-key rows still retain plaintext and lack ciphertext while all active rows have hashes. The separate staging project has RLS disabled and broad anonymous/authenticated grants on profiles, payments, usage logs, marketing events, and subscription plans; no external repair was attempted.
- Product/design findings: the core visual system is strong and responsive with no measured mobile horizontal overflow. The homepage auth modal lacks dialog/focus semantics and accessible form associations, the mobile navigation does not expose expanded/control state, the footer makes unsupported Stripe/SOC 2 claims, synthetic testimonials and unsubstantiated accuracy percentages are presented as facts, and documentation contains feature/default wording that has drifted from the shipped plugin.
- Local repair status: checkout verification, auth/dialog semantics, marketing and legal copy, centralized pricing, endpoint abuse controls, health-detail authentication, server-log redaction, plugin callback/encryption hardening, media object authorization, owner-bound bulk jobs, and duplicate billable-request controls are now implemented locally with focused regression coverage. The plugin package is being prepared as 1.7.18; no external release has been made.
- Critical repository finding: six legacy FTP/debug utilities plus the root FTP guide contained embedded server credentials, and a stale root backend test could create remote accounts while printing returned tokens. These files were removed from the working tree. Because their content remains in Git history, the affected server credential must be rotated and history remediation must be decided before release; no credential was displayed, tested, or used during this audit.

## 2026-08-10: WordPress.org listing attachment rechecked

- The live plugin directory HTML now includes the `Screenshots` gallery and references `screenshot-1.png` through `screenshot-6.png` with `?rev=3639973`.
- The cache-busted `ps.w.org` files and the WordPress.org `i0.wp.com` responsive thumbnail endpoint both return the new captures. The bare `ps.w.org` URL can still serve the previous CDN cache, so an already-open listing tab may need a hard refresh.
- No additional SVN mutation was needed; the listing is attached to the new assets.

## 2026-08-10: WordPress.org screenshot refresh completed

- Replaced all six synthetic listing screenshots with captures from a disposable WordPress site at `http://127.0.0.1:8787`, running the shipped Alt Text Pro 1.7.16 plugin. Captures cover Dashboard, Settings, Bulk Process, Media Library integration, Usage & Logs, and a narrower responsive admin view.
- The local capture fixture used real WordPress admin screens, seeded image attachments, representative generation-log rows, and the actual plugin styles/templates. A local-only PHP display setting suppressed a fixture notice; no plugin source was changed for the screenshots.
- Published only `screenshot-1.png` through `screenshot-6.png` to WordPress.org assets SVN in revision 3639973. Existing icon and banner assets were not modified.
- Verified the SVN files and cache-busted public `ps.w.org` URLs match the local SHA-256 hashes and retain the captured UI. The uncached base CDN URLs were still serving the previous cached images immediately after commit; WordPress.org CDN propagation is pending.

## 2026-08-10: Final release audit closed

- Production Netlify deploy `6a79095b0ec3020008b26df4` is ready from commit `e2a7c3a` on `main`; `/api/health` reports healthy on version `e2a7c3a9`.
- Production `/api/get-plans` matches the requested catalogue and allowances, including the intentionally retained `pay_as_go` row. Unsigned Polar webhook requests return 403 and unauthenticated checkout requests return 401.
- Production Polar’s Active catalogue contains exactly the eight new subscriptions, Free, Small Pack (500), and Credit Pack (1,200); the six legacy subscription products are absent. The live plugin ZIP reports version and Stable tag 1.7.16.
- Pricing rollout evidence is complete across repository tests, production catalogue/deploy checks, WordPress.org publication, and the isolated staging pack/monthly/annual ledger smoke tests. No unresolved release blocker remains.

## 2026-08-10: Staging pricing smoke verification completed on current build

- Deployed the reviewed tracked source to staging as Netlify deploy `6a790a36f45a1a27670bfad0` (ready, 18 functions, clean secret scan). The prior Agency mismatch was traced to the stale August 5 deployment and to staging’s older database schema, not to the reviewed Agency-before-Pro plan matcher.
- The staging database was missing the current pricing columns (`subscription_plans.annual_price`, catalogue flags/cost fields, and `profiles.polar_product_id`). Added the required staging-only schema alignment, then applied the reviewed pricing migrations `20260809120000_apply_2026_08_pricing_packages.sql` and `20260809211033_activate_tier4_catalogue.sql`. Staging `/api/get-plans` now returns Free 15, Lite 4/43.20, Standard 9/97.20, Pro 14/151.20, Agency 19/205.20, Small Pack 500, Credit Pack 1,200, plus the intentionally retained `pay_as_go` row.
- Completed the exact staging credit-pack assertion: Polar sandbox Credit Pack order `polar_ord_1b205acb-c4eb-4dbd-a4e8-4edf505dd8dd` recorded `plan_id=credit_pack`, amount `$11.80` including sandbox tax, `credit_pack_grants.credits=1200`, and `purchased_credits_remaining=1200` for the isolated QA profile.
- Enabled `subscription.active` on the sandbox webhook endpoint and completed current-build Agency tests. Monthly order `polar_ord_4f04c7eb-8f30-4665-afad-5a1e95f95d88` recorded `plan_id=tier4`, amount `$22.42` including sandbox tax, and the profile resolved to `tier4`, `billing_cycle=monthly`, and `monthly_credit_allowance=3500`. Annual order `polar_ord_bf90336a-89bb-4ef3-b54e-69f65fd5cdd7` recorded `plan_id=tier4`, amount `$242.14` including sandbox tax, and the same profile resolved to `tier4`, `billing_cycle=annual`, and `monthly_credit_allowance=3500`.
- Polar delivery evidence for the current retests is HTTP 200 for both `order.paid` and `subscription.active`; the earlier HTTP 500 deliveries are retained as evidence of the pre-migration staging schema failure and were not treated as successful verification. No production database or production customer data was used for these tests.

## 2026-08-10: Staging verification found a stale deployment; refreshed deploy path

- The first direct Agency monthly sandbox checkout against staging used the August 5 manual deployment `6a73430…`, which predated the pricing release. Its payment row incorrectly resolved the product name `Alt Text Pro — Agency Monthly` to `tier3` because that stale build did not contain the reviewed Agency-before-Pro matcher; no production data was affected.
- Added `.git/` to `.netlifyignore` after the staging source-upload path returned HTTP 500 during a large local upload; this excludes repository internals from deploy payloads without changing the application bundle. The reviewed `main` code already contains the correct `tier4` mapping and passing regression tests.
- A clean staging account and profile are ready for a retest after the current reviewed source is deployed. The earlier staging 1,200-credit pack smoke test already proved `credit_pack` payment completion, `credit_pack_grants.credits = 1200`, and `purchased_credits_remaining = 1200` on the isolated staging profile.

## 2026-08-10: WordPress.org 1.7.16 release published and verified

- Corrected the release readme before finalizing: added the required 1.7.16 changelog entry covering Agency support and the 150 signup + 15 monthly free allowance. Rebuilt the distributed website plugin ZIPs so the same changelog is included in the downloadable package.
- Published the reviewed plugin trunk update to WordPress.org SVN (revision 3639810), created the 1.7.16 tag, and synchronized the tag readme correction (revisions 3639811, 3639813, and 3639815). The trunk/tag contain the intended six implementation files plus the required changelog documentation and no unrelated source files.
- Verified the official versioned and latest WordPress.org ZIP downloads: both are valid archives, report plugin version 1.7.16, use Stable tag 1.7.16, and include the 1.7.16 changelog and 150 signup + 15 monthly copy. PHP lint passed for the SVN release checkout.
- The Git-backed Netlify production build for commit `513c0a7` completed successfully as deploy `6a7901c33ada5d0008131bdb` (ready, 18 functions deployed, secret scan clean). The manual upload retry was not needed after the automatic main-branch build completed.
- Pricing implementation, production Polar/Supabase catalogue, production deployment, checkout/webhook safeguards, product archival, website assets, downloadable plugin package, and WordPress.org publication are complete. The exact staging ledger-credit assertion remains unclaimed because the staging project has no `auth.users` rows for the QA fixture profiles; application-side tests and the successful sandbox webhook deliveries cover the code path, but this environment limitation prevents a direct staging ledger proof.

## 2026-08-10: Polar sandbox smoke test passed; legacy production products archived

- Used the Polar QA sandbox, where payments are explicitly not processed, to create Agency monthly/annual test products with the requested intervals, prices, and metadata, plus a Credit Pack (1,200) test product. Completed paid sandbox checkouts for Agency monthly, Agency annual, and the $10 credit pack using test card data; the sandbox recorded both Agency subscriptions as active and the pack order as paid.
- The sandbox webhook endpoint delivered all three `order.paid` events to `https://alt-text-pro-staging.netlify.app/api/webhooks/polar` with HTTP 200. The latest payload visibly contained `metadata.user_id`, `tier4`, `subscription`, and `3500` for Agency. Read-only staging checks found no ledger update because the QA profile fixtures have no corresponding rows in `auth.users`; application-side webhook/ledger behavior remains covered by the passing test suites, but this specific staging ledger proof is not claimed.
- After the sandbox smoke test, archived only the six old production Polar subscription products (old Lite, Standard, and Pro monthly/annual IDs). Rechecked the production Active catalogue: exactly the eight new subscriptions, Free, Small Pack (500), and Credit Pack (1,200) remain active; old IDs are absent.
- At that checkpoint, the WordPress.org 1.7.16 remote tag was absent and the separate external publication was still pending.

## 2026-08-10: Final completion audit — checkout and plugin publication gates remain

- Rechecked the Polar production catalogue: all eight new subscription products, Free, both corrected credit packs, and all six legacy subscription products are present under the Active filter. The legacy products have not been archived because the plan requires a completed Agency checkout, an annual/monthly checkout pair, and a $10 credit-pack purchase first.
- Rechecked the live catalogue and deployment after the documentation-only rebuild; the public catalogue still matches the requested prices and allowances, and the health endpoint remains healthy.
- At that checkpoint, read-only WordPress.org preflight confirmed that the 1.7.16 remote tag did not yet exist. The local plugin metadata and website ZIPs were 1.7.16, while publishing the WordPress.org trunk/tag was still pending.

## 2026-08-10: Pricing catalogue deployed and live checks completed

- Promoted the main-based release commit `c6212e5` to `origin/main` and published it through the documented Git-backed Netlify workflow. The first deploy reached the build stage but could not upload functions because inherited, unused PayPal variables exceeded AWS Lambda's 4 KB environment limit; removing only those 18 obsolete variables allowed the retry deploy `6a78f5bc831488169e4559e1` to complete with all 18 functions deployed and a clean secret scan.
- Verified the live production page at `https://www.alt-text.pro`: Free 15 monthly + 150 signup bonus; Lite $4/150; Standard $9/1,000; Pro $14/2,000; Agency $19/3,500. Annual mode shows $43.20, $97.20, $151.20, and $205.20 respectively, with the Standard allowance rendered as one line at 14px with `white-space: nowrap`.
- Verified production `/api/health`, `/api/get-plans`, both plugin ZIP endpoints, the 1.7.16 package contents, unsigned Polar webhook rejection (403), and unauthenticated checkout rejection (401). The catalogue includes the intentionally retained historical `pay_as_go` row; it remains excluded from the pricing UI and checkout mappings.
- The eight new Polar subscription products and corrected credit packs are configured, and the old six subscription products remain active pending the required authorized checkout smoke test. No real customer charge was initiated.

## 2026-08-10: Production checkout variables aligned; deploy upload blocked

- Verified access to the correct Netlify production project `www.alt-text.pro` and updated all eight production-context subscription variables to the new Polar product IDs; unchanged Free and credit-pack IDs were left intact.
- Three local-source deploy attempts reached Netlify but returned HTTP 500 from the deployment upload endpoint before a deploy ID was created. Direct public verification still shows the previous Free/Lite/Standard/Pro catalogue, so the production site still serves the previous code build; old Polar subscription products remain active to protect existing checkout.
- Added explicit generated/local-directory exclusions to `.netlifyignore`; local build, tests, typecheck, migration checks, and Polar/Supabase verification remain passing.

## 2026-08-10: Applied pricing catalogue to Polar and Supabase

- Created and verified eight new Polar subscription products with the requested monthly/yearly prices, intervals, `plan_id`, `type`, and annual/monthly `credits` metadata; updated the existing $5 and $10 pack names, metadata, and Polar meter benefits to 500 and 1,200 credits.
- Updated the local `frontend-next/.env.local` checkout IDs to the new Polar subscription products; existing pack IDs remain unchanged.
- Applied Supabase migration `apply_2026_08_pricing_packages` to production project `ALT-Text-Ai`, verified the new catalogue, Agency constraint support, `polar_product_id`, paid-profile allowance pins, and reservation functions. Applied follow-up `activate_tier4_catalogue` after verification caught the pre-existing inactive tier4 row; Agency is now active.
- Old Polar subscription products remain active until the new code build is live and a checkout smoke test can be completed; no customer-facing checkout was broken.

## 2026-08-10: Kept Standard allowance label on one line

- Reduced the Standard pricing card’s “1,000 credits every month” label to 14px and prevented wrapping so the annual pricing view keeps the allowance on a single line.
- Verification: frontend tests (7 files/55 tests), TypeScript typecheck, `git diff --check`, and local desktop browser verification passed; the rendered label measured one line with `white-space: nowrap`.
- Release state: local implementation only; no production system was mutated.

## 2026-08-10: Pricing and packages update planning completed

- Read `PRICING_PACKAGES_UPDATE_PLAN.md` from line 1 through line 1254 and mapped its catalogue, grandfathering, signup-bonus, credit-pack, UI, plugin, test, deployment, verification, and rollback requirements into an execution sequence.
- Repository preflight found one required addition to the supplied plan: the active `reserve_credit()` and `finalize_credit_reservation()` definitions still recognize monthly plans through a hardcoded list that omits `tier4`; the new pricing migration must preserve those functions while adding `tier4` to the recognized-plan checks.
- Planning only: no application code, database, Polar, Netlify, WordPress.org, or live WordPress changes were made.

## 2026-08-10: Pricing and packages implementation in progress

- Added the forward Supabase migration for the 2026-08 catalogue, grandfathered allowances, persistent signup bonus, free-plan renewal/revocation behavior, and Agency plan constraint support.
- Preserved the reservation engine while adding `tier4`/`agency` to the active reservation and finalization plan checks; historical migrations remain unchanged.
- Updated local Polar mappings, webhook allowance resolution, API limits, pricing cards, checkout copy, dashboard upgrade options, documentation, terms, and WordPress plugin Agency support/version metadata.
- Verification so far: pricing-plan mapping tests, Polar webhook tests, API-key limit tests, migration-chain tests, JavaScript syntax checks, PHP syntax check, and `git diff --check` pass.
- Release state: local implementation only; no Supabase, Polar, Netlify, WordPress.org, or live WordPress mutation has been performed.

## 2026-08-09: Softened featured pricing card background locally

- Added a pale-yellow background to the highlighted Standard pricing card while preserving the yellow border, “Most popular” badge, and primary CTA.
- Release state: local change pending the next production deploy; no live system was mutated in this edit.

## 2026-08-09: Applied supplied logo across website and plugin locally

- Replaced the shared website logo, Next.js app icon, plugin admin logo, and WordPress.org icon assets with the supplied `alt-text-pro.png` artwork.
- Rebuilt the plugin ZIPs and frontend download copies so distributed plugin packages include the new logo.
- Verification: asset hashes match the supplied source for the full-size website/plugin logos; TypeScript and `git diff --check` passed.
- Release state: local change pending an explicitly requested production deploy; no live site or WordPress.org mutation was performed.

## 2026-08-09: Highlighted one-credit image pricing locally

- Added prominent yellow “1 credit per image” messaging below the hero CTAs, in the benefits strip, and beneath the pricing cards.
- Kept the message positive and clear: “Simple, transparent pricing for every image.”
- Release state: local change pending the next production deploy; no live system was mutated in this edit.

## 2026-08-09: Removed duplicate dashboard plugin download action

- Kept the primary “Download Plugin” action in the dashboard header and removed the duplicate download button from the first-run setup card, leaving its Setup Guide link in place.
- Release state: local change pending the next production deploy; no live system was mutated in this edit.

## 2026-08-09: Published current design to production

- Deployed the current original `frontend-next` design to the linked Netlify production site `https://www.alt-text.pro` using deploy `6a7885ca3bceee54d9c19a0c` and unique URL `https://6a7885ca3bceee54d9c19a0c--alt-text-ai.netlify.app`.
- Verification: frontend tests passed (7 files/52 tests), the full Netlify build completed successfully, the public homepage returned HTTP 200 with “Good answers”, “Transparent Usage”, and the FAQ copy, and `/api/health` reported production healthy.
- Release state: live production deployment completed; no Supabase schema/data mutation was performed.

## 2026-08-09: Renamed credit benefit locally

- Renamed the benefit to exactly “Transparent Usage,” keeping its explanatory line unchanged.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Reframed credit transparency benefit locally

- Replaced the negative “Failed requests use 0 credits” benefit with “Transparent use of credits” and “See exactly how each credit is used.”
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Replaced final CTA with FAQ section locally

- Replaced the “Connect Your Site / And Generate One.” CTA with the supplied FAQ composition: left-side “Good answers, before you start.” copy and CTA, plus an interactive accordion for credit usage, media-library processing, WooCommerce support, and credit rollover.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Clarified social-proof section copy locally

- Replaced the vague “Loved by early adopters” message with clearer, evidence-neutral copy focused on accessible WordPress workflows and accurate SEO-friendly alt text.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Branded all toast notifications locally

- Updated the shared Sonner notification layer so success, error, warning, info, and loading notifications use the brand yellow `#FEE11C` background, black text/icons, and a visible yellow border.
- Kept the existing notification behavior and dismissal controls unchanged.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Moved benefits strip below hero locally

- Repositioned the benefits strip directly after the hero and before the media-library showcase so the key value points appear earlier in the page flow.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Added benefits strip locally

- Added a four-column benefits strip between the media-library showcase and setup steps, matching the supplied reference with bulk generation, 130+ languages, context-aware generation, and zero-credit failed requests messaging.
- The strip is responsive: columns stack on narrow screens and use separators on desktop.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Removed the reliability feature section locally

- Removed the complete “Built for Reliability” section, including its heading, description, and four feature cards, as requested.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Removed remaining showcase title icons locally

- Removed the sparkle, checkmark, and arrow symbols from the media-library showcase labels so “Generated alt text”, “Ready to use”, and “After Alt Text Pro” display as plain text.
- Functional controls such as the search affordance and copy control remain available.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Clarified setup section copy locally

- Replaced the abstract “First Alt Text” heading and longer setup-path sentence with clearer outcome-focused copy: “From Upload to Alt Text” and “Connect WordPress, generate accurate descriptions, and keep every image accessible from the start.”
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Normalized section spacing locally

- Reduced the bottom space after the media-library showcase so “First Alt Text Without Guesswork.” starts closer to the preceding section.
- Standardized the visible long-form sections on the same `py-24` vertical rhythm so their top and bottom spacing stays consistent across the page.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Simplified decorative text icons locally

- Removed decorative icons before “Generated alt text”, “Ready to use”, “Optimized Alt Text”, and research “Generated Alt Text” labels.
- Kept the copy icon and loading spinner because they communicate functional controls and in-progress state.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Matched setup status yellow to primary buttons locally

- Updated the SEO status control to use the same `#FEE11C` yellow as the primary “Get 30 Free Credits” button, with black text and a slightly darker yellow border.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Improved setup status contrast locally

- Removed the decorative check icons from the “Accessibility Standards” and “SEO Rank 1” status controls.
- Replaced the pale SEO accent with a darker yellow (`#D4B000`) and black text for clearer readability.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Aligned the third setup marker locally

- Anchored the large `03` background numeral to the “Review + Save” text block so it sits behind the heading like the first two setup steps.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Removed duplicate setup step markers locally

- Removed the smaller yellow `01`, `02`, and `03` pills from the setup headings, leaving the large background numerals as the single step markers.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Setup step numbers switched to brand yellow locally

- Updated the `01`, `02`, and `03` markers in the homepage setup path to use `#FEE11C` with black text, and changed their oversized background numerals to a soft yellow tint.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Gave media search group a responsive width locally

- Added a responsive max-width to the search-label/input group so the field no longer collapses to its icon when the row is laid out at the right edge of the media panel.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Made media search width responsive locally

- Replaced the fixed minimum width with a flexible search field that fills the remaining row space up to 300px, preventing narrow viewports from pushing the input off-screen.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Prevented media search field compression locally

- Added a 220px minimum width and disabled flex shrinking on the media-library search field so the input remains visibly wide beside the “Search media” label instead of collapsing to an icon-sized box.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Media search field widened locally

- Increased the media-library search field from 220px to 300px so it has the wider proportion shown in the supplied reference while keeping the “Search media” label on one line.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Media search label kept on one line locally

- Prevented the “Search media” label in the media-library showcase from wrapping by preserving its intrinsic width at narrower desktop layouts.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Screenshot-matched pricing section added locally

- Replaced the active homepage pricing presentation with a warm four-card Free/Lite/Standard/Pro layout matching the supplied reference, including the centered heading, black monthly/annual toggle, yellow Standard highlight, “Most popular” badge, and screenshot-aligned copy.
- Preserved the existing monthly/annual price data and plan-selection behavior; the previous markup remains hidden under `legacy-pricing` for safe reference.
- Verification: TypeScript, frontend tests (7 files/52 tests), production build, and `git diff --check` passed. Local browser shows the pricing cards and toggle with no console errors.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Showcase section moved closer to the hero locally

- Reduced only the top padding above “Better alt text, automatically.”, bringing the showcase closer to the hero while preserving its internal heading-to-card spacing and bottom rhythm.
- Verification: at the current 995×631 localhost viewport, the hero-to-showcase heading gap is now approximately 64px with no horizontal overflow; TypeScript and `git diff --check` passed.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Hero side spacing made visible at normal desktop widths

- Reworked the previous wide-only adjustment so the hero now adds approximately 15px of left/right padding at desktop widths generally, including the current sub-1024px browser viewport.
- Restored the 1800px canvas, applied `sm:px-[47px]`, and kept `calc(2vw + 15px)` at the large breakpoint so the change is visible in localhost while preserving the tighter center relationship.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Hero side spacing nudged further locally

- Reduced the wide hero canvas from `1800px` to `1770px`, adding approximately 15px more margin on both sides while preserving the existing column alignment and header sizing.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Hero side margins increased locally

- Narrowed the wide desktop hero canvas from `1920px` to `1800px`, adding balanced left/right breathing room so the headline and visual panel sit closer together through the center.
- Kept the existing header, copy, image treatment, and responsive breakpoints unchanged.
- Verification: at 2048×922 the hero content now sits inside a 1800px canvas with the headline and image panel visibly closer; TypeScript and `git diff --check` passed.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Local preview asset manifest refreshed

- The localhost tab briefly rendered unstyled HTML because the running Next dev process held an outdated CSS manifest after the production build regenerated `.next` assets.
- Restarted only the local `frontend-next` dev server. CSS now returns successfully and the showcase renders both mountain thumbnails, the generated-alt-text card, and the full layout again.
- Release state: local only at `http://localhost:3000/`; no application code or live system was changed for this recovery.

## 2026-08-09: Media library showcase section added locally

- Added a responsive WordPress media-library proof section to the original `frontend-next` homepage directly below the hero and above the existing “How It Works” section.
- Matched the supplied reference with the centered “Better alt text, automatically.” heading, WordPress-style sidebar, media table, before/after rows, and yellow generated-alt-text result card using existing project imagery and brand tokens.
- Verification: browser-rendered desktop capture at 1952×1216 and mobile capture at 390×844; no horizontal overflow or browser console errors; TypeScript check, frontend tests (7 files/52 tests), production build, and `git diff --check` passed. Evidence is recorded in `design-qa.md`.
- Release state: local only at `http://localhost:3000/`; no live site, deployment, or production system was changed.

## 2026-08-09: Homepage hero columns brought closer locally

- Reduced the horizontal gap between the hero's left text column and right visual column on the original homepage by tightening the hero grid spacing in `frontend-next/src/app/page.tsx` and nudging the right visual block left on desktop.
- Scope stayed limited to the top hero layout; no content, branding, or lower-page sections were changed.
- Release state: local only at `http://localhost:3000/`; no live site, deployment, or production system was changed.

## 2026-08-09: Responsive hero fold fix completed locally

- Corrected the homepage hero at the user's 1327×631 CSS viewport, where the previous 1280px breakpoint enlarged the headline to 160px, wrapped it across four lines, and pushed the supporting content below the fold.
- Replaced the fixed desktop jump with fluid headline scaling, limited ultra-wide spacing and offsets to viewports of at least 1800px, and tightened the medium-desktop CTA, note, visual-panel, and generated-text-card spacing.
- Verified the logged-out localhost homepage at the top of the page: headline, copy, both CTAs, credit note, image, and generated-alt-text card all fit within the 631px fold with no horizontal overflow. Mobile 390×844 and wide desktop 2048×922 checks also pass, and the browser console reports zero errors.
- Evidence: `design-qa-hero-responsive-1327x631.png`, `design-qa-responsive-comparison.jpg`, and the updated `design-qa.md` with final result `passed`.
- Verification: TypeScript passed; frontend tests passed 7 files/52 tests; `git diff --check` passed.
- Release state: local only at `http://localhost:3000/`; no live site or production system was changed.

## 2026-08-09: Live header sizing comparison completed

- Compared `https://www.alt-text.pro/` and `http://localhost:3000/` at the same 1280px viewport.
- Both headers render the same 960×74 inner menu and 106px total navigation height. No header sizing change was made.
- Correction: authentication changes the positions of the inner link group but does not change the header's outer dimensions. The misleading visual difference came from leaving the localhost preview at the 2048×922 QA viewport while comparing it with the live site at the normal 1280×720 viewport.
- Reset the localhost preview to the normal viewport so the fixed-width header displays at the same apparent scale as the live site.
- Release state: local only; no live-site mutation was performed.

## 2026-08-09: Homepage hero review adjustment completed locally

- Removed the full-width WordPress publisher badge from the original homepage hero at the user's request.
- Kept the existing top navigation structure and sizing unchanged; only its already-approved yellow brand color remains.
- Verified at `http://localhost:3000/` with the badge absent and the navbar still rendering at the existing 106px desktop height.
- Release state: local only; no production or live system mutation was performed.

## 2026-08-09: Homepage hero reference implementation in progress

- Status: implementing the supplied 2048×922 hero reference in the original `frontend-next` homepage.
- Scope: match the oversized two-line headline, WordPress publisher badge, yellow/white CTA pair, supporting credit note, tilted mountain image card, and generated-alt-text panel while keeping image upload, generation, and copy interactions functional.
- Release state: local only; no production deployment or live system mutation is authorized.

## 2026-08-09: Homepage hero reference implementation completed locally

- Status: complete in the original `frontend-next` homepage.
- Result: rebuilt the hero around the supplied reference with the WordPress publisher badge, `Make Every Image Speak` headline, yellow/white CTA pair, credit note, tilted mountain image panel, generated-alt-text card, and responsive mobile stacking.
- Interaction coverage: preserved image selection and generation flow; verified the hero image chooser, CTAs, copy control, sample alt text, and clipboard toast in the localhost browser.
- Visual QA: passed at 2048×922 against the supplied screenshot; mobile 390×844 has no horizontal overflow. Full evidence is recorded in `design-qa.md`.
- Verification: TypeScript check passed; frontend tests passed 7 files/52 tests; production build passed with existing non-blocking lint warnings.
- Release state: local only at `http://localhost:3000/`; no production site, Netlify, Supabase, WordPress.org, or live WordPress mutation was performed.

## 2026-08-08: Full product brand rollout in progress

- Status: implementation in progress across the original `frontend-next` app, WordPress plugin, reusable logo assets, generated WordPress.org artwork, Netlify email/report templates, and customer email templates.
- Scope: standardize on white, black, and `#FEE11C` yellow; keep semantic status colors where they communicate success/warning/error; preserve the homepage hero copy `Make Every Image Speak`.
- Completed in this pass: plugin CSS tokens and CTA treatments, plugin release metadata bump to 1.7.15, WordPress.org artwork generator palette, generated listing assets, shared logo recolor, lifecycle/contact/funnel email brand styles, and customer-offer email palette.
- Release state: local only; no Netlify, Supabase, WordPress.org, or live WordPress mutation is authorized or performed. Rebuilds and verification remain before completion.

## 2026-08-08: Full product brand rollout completed locally

- Status: complete locally across the original website/SaaS app, customer-offer and WordPress connection flows, plugin admin UI, shared logo files, WordPress.org listing assets, Netlify email/report templates, and the customer-offer email.
- Brand system: white canvas, black structure/text, and yellow `#FEE11C` for primary actions, highlights, borders, and brand accents. Semantic success, warning, and error colors remain where they convey state rather than brand identity.
- Hero copy: homepage now reads `Make Every Image Speak`.
- Plugin release: bumped source/readme metadata to 1.7.15 and rebuilt `wordpress-plugin/alt-text-pro-plugin-1.7.15.zip`, stable plugin ZIPs, and frontend download copies.
- Verification: frontend production build passes; frontend tests pass 7 files/52 tests; Netlify-function tests pass 20 files/163 tests; all plugin PHP files lint clean; plugin JS and asset-generator Python syntax checks pass; ZIP contents/version/legacy-color checks pass; `git diff --check` passes; clean localhost browser preview at `http://localhost:3000/` shows the new headline and palette with no console errors.
- Release state: local only. The live site and WordPress.org remain unchanged pending explicit deployment/release approval.

## 2026-08-08: Original frontend brand revision completed locally

- Status: complete locally in `frontend-next` after clarifying that the original application files are the target.
- Scope: apply the white/black/`#FEE11C` brand palette across shared theme tokens and existing UI surfaces, and change the homepage hero headline to `Make Every Image Speak`.
- Release state: local only; no Netlify, Supabase, WordPress.org, or live WordPress mutation is authorized or performed.
- Verification: Next.js production build passes; frontend tests pass 7 files/52 tests; the original app is running at `http://localhost:3000/`.

## 2026-08-08: Alt Text Pro prototype brand revision completed locally

- Status: complete locally in `alt-text-pro-new-design/`.
- Scope: replace the teal-led prototype accent system with white, `#FEE11C` yellow, and black, and change the hero headline to `Make Every Image Speak`.
- Release state: local prototype only; no production website, deployment, Supabase, WordPress.org, or live WordPress changes are authorized or performed.
- Verification: prototype production build passes; Sites packaging tests pass 4/4.

## 2026-08-08: Isolated Alt Text Pro website redesign completed locally

- Status: option 1 selected and implemented in the new `alt-text-pro-new-design/` prototype folder. No production, deployment, Supabase, WordPress.org, live WordPress, or existing `frontend-next` application changes were made.
- Scope: create a completely new Alt Text Pro marketing-site concept in a separate folder, inspired by the supplied Hanzo Framer reference while retaining Alt Text Pro's WordPress, accessibility, image-SEO, 30-free-credit, and existing brand context.
- Evidence: captured the supplied Hanzo reference at a 1440 px desktop canvas, reviewed its hero and section rhythm, inspected the local Alt Text Pro logo, brand tokens, current positioning, pricing, and core conversion path, then produced three independent 1440 px-wide, scrollable homepage concepts grounded in those inputs.
- Decision: implement the first displayed concept, using the exact selected image `exec-4fd44629-b8cc-4789-8aff-8c173e147841.png` as the visual source of truth.
- Result: the responsive React homepage includes the source-matched hero, media-library demonstration, workflow/proof strip, full pricing, FAQ, footer, local signup/sign-in flow, mobile menu, pricing switch, and generation replay.
- Verification: the local production build passes; Sites packaging tests pass 4/4; browser interaction checks pass; the clean prototype-page run has no console warnings/errors and there is no horizontal overflow at 390, 834, and 864 px; `alt-text-pro-new-design/design-qa.md` records `final result: passed` after a responsive-fidelity fix iteration. The internal cross-frame comparison wrapper later produced four no-source browser-instrumentation `MutationObserver` errors, with no matching application code.
- Next gate: user review. Sharing or deployment remains a separate, explicitly authorized action.

## 2026-08-07: M8 stale legacy surface removed locally

- Status: M3 is live. The reviewed reservation path was isolated from the older source commit so the released M4 per-credential limiter and M5 hash-based API-key validation remained intact. Source, migration, regression test, and release documentation are committed as `5dc6eee` and pushed to `main`.
- Production migration: the preflight confirmed that `credit_reservations`, `reserve_credit`, `finalize_credit_reservation`, and `release_credit_reservation` were absent. The migration applied successfully; the table and all three RPCs are present, RLS is enabled, and only `service_role` can execute the lifecycle operations. Supabase initially recorded generated version `20260806220451`; the ledger was reconciled to repository version `20260806143048` and name `reserve_credits_before_ai_generation`.
- Production deploy: Netlify deploy `6a75054644b2f70007e8fd60` was Git-backed from `main` commit `5dc6eee`, with `manual_deploy = false`. Health reports `production`, `main`, version `5dc6eeeb`, and Node `v20.20.2`; homepage, `/admin`, `/connect`, and a Next static asset returned HTTP 200.
- Generation gate: one controlled existing-key account successfully generated alt text with HTTP 200, `credits_used = 1`, a one-credit plan-balance decrease, one completed reservation, and one usage row. A forced provider failure returned HTTP 500 with no net credit or usage change, one released reservation, and no usage row. No account identity or API key was exposed in the verification output.
- Advisors after migration report the expected informational RLS-without-policy notice for the service-role-only reservation table; no new blocking security or performance issue was introduced by this migration.

## 2026-08-07: M3 credit-reservation preflight

- Production currently has no `credit_reservations` table and none of the `reserve_credit`, `finalize_credit_reservation`, or `release_credit_reservation` RPCs. No production change was made.
- The reviewed M3 commit must be isolated before release: its generation diff predates Batch A/M5 and would otherwise remove the per-credential rate limit and hash-based API-key validation. Only the reservation path and migration should be carried forward.
- The reservation migration also replaces both renewal functions; production signatures match the migration’s current output names (`renewed_user_ids` and `user_ids`), so no signature repair is needed for this batch.
- Release verification gate: one successful generation must finalize exactly one reservation/usage credit, and one controlled provider failure must leave the reservation released with no net credit loss.

## 2026-08-07: M5 API-key storage migration applied; app rollout pending

- Production migration `20260806153415_secure_api_key_storage` is applied before the app rollout. It added the hash/encrypted/last-four columns, seeded hashes for all 23 active legacy keys, and preserved every existing raw key for lazy authorized migration.
- The M5 application changes are isolated in commit `5098c89` on `codex/release-medium-batch-b`; they must be deployed only after this migration, which is now satisfied.
- The production encryption secret is already configured. No production key was deleted or rotated; the approved migration was the only production change before deployment.
- Git-backed Netlify deploy `6a74fd284b8a3b0008870853` completed from `main` at commit `6a1dcb5`; homepage, `/admin`, and health returned 200, with production/`main`/Node 20 reported by health.
- A real existing production API key authenticated successfully through the live plugin endpoint without exposing the key. Dashboard display is still pending because the available browser session is signed out and `/dashboard` redirects to the sign-in page.

## 2026-08-07: P7 Medium Batch A released

- Isolated Batch A from the unreleased M3/M5 code, then released M1, M2, M4, M6, M7, M8, and the P2 record-first ordering reversal through Git-backed commit `1ed1abf` on `main`.
- Applied production migrations M2 and M8 before the app release. The connected migration tool initially generated temporary ledger versions; those rows were corrected to the repository versions `20260806140000` and `20260807100000` without re-running SQL. M6's bootstrap ledger entry remained marked applied.
- Production verification after migration: `public.users` is absent, legacy PayPal functions are absent, and no profile has a negative credit balance. The M8 guard therefore dropped only the empty legacy table.
- Netlify Git deploy completed successfully. Live smoke checks returned 200 for the homepage, a Next static asset, JavaScript, the logo image, `/admin`, and `/api/health`; health reports `environment=production`, `branch=main`, `version=1ed1abf`, and Node 20.20.2.
- M3 and M5 were intentionally excluded and remain queued for their own migration-first releases. No manual Netlify upload was used.

## 2026-08-06: M2 subscription-credit rollover fixed locally

- Read-only production verification confirmed the failure on the live paid data: one active `tier2` annual profile stores 4,760 aggregate credits, has used 40 in the current cycle, and has only 360 usable; 4,400 are stranded future-plan allowance. The second active annual profile is at 0 usable credits after consuming its 400-credit cycle. No production data was changed.
- Root cause: `subscription.updated` and `renew_paid_monthly_credits()` added each new plan allowance to `credits_remaining`, while `use_credit` capped plan usage at the current cycle and only allowed bonus/purchased ledgers past that cap.
- Policy decision: subscription plan credits are per-cycle allowances and do not roll over. Bonus and purchased ledgers remain persistent and spendable after the plan allowance is exhausted.
- Fix: renewal webhook updates and the annual drip now reset the plan portion to one allowance plus persistent ledgers. Migration `20260806140000_fix_subscription_credit_rollover.sql` repairs existing active paid profiles from current-cycle usage logs and preserves bonus/purchased balances.
- Fix: auth validation, subscription, usage, and generation responses now expose the spendable current-cycle balance instead of the raw aggregate; the WordPress plugin receives that corrected value through the existing generation response contract.
- Verification: focused Polar lifecycle tests pass 24/24; credit-state tests pass 5/5; full frontend tests pass 7 files/52 tests; TypeScript passes; the full function suite passes 17 files/150 tests; all Netlify-function JavaScript syntax checks and `git diff --check` pass.
- Release state: local only. The migration is not applied, and no production code, push, or deployment has been performed. Apply this migration before deploying the matching webhook/API changes.

## 2026-08-06: M1 Redis rate-limit policy fix completed locally

- Confirmed the defect: `checkRateLimit(identifier, maxRequests, windowMs)` passed endpoint-specific limits through to the Redis branch but enforced one shared `slidingWindow(60, '60 s')` limiter. The response advertised 10 or 30 while production allowed up to 60 requests per minute.
- Fixed the Redis implementation to cache a limiter per `(maxRequests, window)` policy. The existing default `alttext:ratelimit` namespace is preserved for 60/minute callers; non-default policies receive isolated keyspaces so stricter admin rules cannot share the weaker counter.
- The existing endpoint policies remain unchanged: delete-users 10/minute, admin-get-users 30/minute, lifecycle status/marketing 30/minute, and lifecycle test-send 10/minute.
- Added Redis-mode regression coverage for the actual 10/minute cutoff, the configured limiter policy, and reuse/isolation of 10- and 30-per-minute policy instances.
- Verification: the complete function suite passes 17 test files and 149 tests; targeted rate-limiter tests pass 7/7; JavaScript syntax and `git diff --check` pass.
- Release state: local only. No production configuration, Redis data, push, migration, or deployment was changed. M1 remains queued with the other Medium fixes for the explicitly approved release.

## 2026-08-06: H4 subscription-payment duplication fixed and released

- The Polar webhook currently records subscription revenue in `onOrderPaid` using the stable `polar_ord_<order_id>` key, then records another payment in `onSubscriptionUpdated` using `polar_renewal_<subscription_id>_<timestamp>`. The second path is not protected by the payment ID uniqueness index because it uses a different key.
- Production read-only verification found two subscription IDs with both row types: 6 `polar_ord_*` rows totaling `$0` and 4 `polar_renewal_*` rows totaling `$69`. The current rows do not inflate the stored revenue amount because the order snapshots are zero-valued, but the duplicate path remains a future revenue-inflation risk and already inflates payment counts.
- Fixed by making `order.paid` the sole source of subscription payment bookkeeping and leaving `subscription.updated` responsible only for lifecycle/credit state. The stable `polar_ord_<order_id>` key remains retry-safe; the timestamped renewal insert is gone. Regression coverage verifies one subscription payment row from `order.paid` and none from `subscription.updated`.
- Released through the Git-backed `main` build as commit `7e038cdd` / Netlify deploy `6a747c918021c80008f634ec`. Production health reports `environment=production`, `branch=main`, and Node `v20.20.2`; homepage, `/admin`, logo, checkout auth, Polar signature protection, and analytics guards all passed smoke checks.
- The final read-only payment query remains 6 order rows totaling `$0`, 4 renewal rows totaling `$69`, 10 subscription payment rows totaling `$69`. No historical revenue amount correction was necessary, and no financial rows were deleted.

## 2026-08-06: H5 webhook idempotency re-verified; local ordering hardening not deployed

- Production read-only verification confirms `payments_payment_id_uidx` is live on `public.payments`, `payment_id` is non-null, `credit_pack_grants.payment_id` is the primary key, and the live Polar payment data has no duplicate `payment_id` groups. The original H5 migration/ledger fix is therefore already deployed through the C2 release.
- The local one-time `order.paid` path is now hardened to insert the payment first, then call the idempotent `grant_credit_pack_purchase` RPC. A `23505` payment insert is treated as already recorded, while the grant still runs so a retry can recover from an interruption after payment insertion but before credit fulfillment.
- Added regression coverage for payment-before-grant ordering, duplicate-payment retry recovery, and the migration's payment/grant idempotency keys. Focused webhook tests pass 20/20; the full frontend suite passes 7 files/48 tests; TypeScript and the local production build pass.
- No Supabase write, migration application, push to `main`, or Netlify deployment was performed for this local hardening. It remains pending explicit release approval.

## 2026-08-06: Netlify function test coverage restored

- Installed the ignored `netlify-functions` dependencies in this worktree, including `@supabase/supabase-js` and Vitest; no tracked dependency files changed.
- The combined function suite now passes: 17 test files and 147 tests. This covers the package utility tests plus the health, track-event, and lifecycle-routing tests stored in `netlify-functions-tests`.
- Expected test-only diagnostics remain: missing test Supabase credentials, rejected-origin logs, in-memory rate-limit fallback, and the audit logger's mocked persistence failure. None caused a test failure.
- `npm install` reports 7 dependency audit findings (1 low, 5 high, 1 critical). No automatic audit fix was applied; dependency review remains hygiene follow-up.

## 2026-08-06: Git-backed production redeploy and build metadata completed

- Code release: build metadata is committed as `1ae443c` on `fix/subscription-lifecycle-refunds` and was fast-forwarded into `origin/main`. Its metadata rollout deploy is `6a74705b541db90008b1d601`, with `manual_deploy = false`, `branch = main`, and `commit_ref = 1ae443c9123283de09ae28a09b8a61049a660da2`.
- Runtime: the Git build honors the pinned Node `v20.20.2` instead of the local manual-upload Node 24 runtime.
- Build metadata: `scripts/write-build-info.mjs` now records the Git commit, context, and branch before Netlify packages the functions; `health.js` reads that file when runtime build variables are unavailable. The generated file is ignored and remains optional for local development.
- Verification: `/api/health` reports `environment: production`, `version: 1ae443c9`, `branch: main`, and `node: v20.20.2`. Homepage, logo, grid asset, the plugin ZIP, all 11 `/_next/static` admin chunks, checkout auth, unsigned Polar webhook, and admin auth guards pass after the deploy.

## 2026-08-06: H1/H2/H3 and complete website release deployed

- Production incident: the plugin-only Netlify publish used a raw `.next` upload, which exposed Next static files at `/static` instead of `/_next/static` and omitted `frontend-next/public`. The result was 404s for every public image and the `/admin` page chunk, leaving the dashboard on "Loading admin dashboard...".
- Fix: the complete release was built and deployed with `netlify deploy --build`, which restored the Next asset mapping and public assets. The preview `6a745f8c0de5e40fa212eb01` passed before promotion; production deploy `6a74609c1d7d3562f69cd368` is live at `https://www.alt-text.pro`.
- Database release: H1 migration `payment_reconciliation_h1` and H2/H3 migration `fix_subscription_lifecycle_refunds` applied successfully after the read-only preflight. Production migration records are `20260806102148` and `20260806102200`; the reconciliation table, revocation RPCs, promotional-grant RPC, paid-drip guard, and `credit_pack_grants.revoked_at` are present.
- Preflight: 2 annual paid profiles, 0 missing annual end dates, 0 stranded cancelled paid profiles, and 0 negative credit profiles.
- Verification: the full frontend suite passes 7 files/43 tests; TypeScript passes; all checked public images, the versioned plugin ZIP, and every `/admin` Next chunk return HTTP 200; `/admin` no longer hangs when unauthenticated; health is healthy; checkout rejects missing auth with 401; the unsigned Polar webhook rejects with 403; and admin functions reject missing auth with 401.
- Scope: the deployed app includes the committed `/connect` recovery/branding work and H1/H2/H3. The first real credit-pack purchase and the 30-day renewal branches remain post-release observation gates.

## 2026-08-06: WordPress plugin 1.7.14 published

- Baseline correction: the released 1.7.12 reference is `origin/main`/the distribution artifact; it contains no `enc:` sanitizer branch. The dirty working tree's newer branch was not used as the released baseline.
- Finding: `sanitize_settings()` ran during partial POST connection saves and unconditionally assigned all four checkbox fields from the payload. The absent `context_enabled` field visibly disabled context-aware generation on fresh installs; the other three fields were only safe because their current defaults are false.
- Fix: all four checkbox fields now change only when explicitly present in the sanitizer input; otherwise their current/default values are preserved. The three form-backed checkboxes now include hidden `value="0"` companions so a real unchecked settings submission remains explicit, while partial connection saves still omit them. The existing 1.7.13 encrypted-key fix remains in the same 1.7.14 source.
- Release decision: keep version `1.7.14` intentionally; its package includes the validated encrypted-key persistence fix, the connection-modal UI work, and this context-preservation fix.
- Verification: the POST-style API-key persistence regression covers explicit unchecked form values, hidden template inputs, fresh defaults, and preservation of enabled existing checkboxes; all plugin PHP files pass syntax checks; admin JavaScript passes syntax checks; and the source plus all three distribution ZIPs contain the guards, pass `unzip -t`, and match SHA-256 `28490170b60c9765f36a8a59764ffc8cbdd30d6d9b2e0ee3f72d26c7a737db25`.
- Manual QA: the local WordPress 7.0.2 settings page was temporarily linked to this worktree after clearing the PHP cache. Each form-backed checkbox was checked and saved, then unchecked and saved; every state persisted through the real `options.php` round-trip. The final local state was restored, `context_enabled` remained true, the original plugin link was restored, the temporary administrator was removed, and the local server was restarted.
- Release: commit `5ffee10` contains the focused plugin 1.7.14 package and release metadata. WordPress.org trunk revision `3636397` and tag revision `3636399` are live; the official versioned and stable download endpoints both return HTTP 200, and the versioned archive reports 1.7.14. Netlify production deploy `6a745aa7b7442d42f0e7231f` published the reviewed versioned, stable, and legacy download URLs; all three returned HTTP 200, matched the same SHA-256, and the production health endpoint returned healthy. The unrelated `/connect` changes and unreleased SaaS H1/H2/H3 changes were not included.

## 2026-08-06: H1 payment identity binding and reconciliation queue fixed locally

- Status: H1 was confirmed in the checkout route and every Polar billing handler, then fixed locally. No Supabase migration, website deployment, or production mutation was performed.
- Root cause: `/api/checkout` trusted an editable `customerEmail` query parameter, while webhook matching used case-sensitive email equality and an unpaginated `auth.admin.listUsers()` fallback. Unmatched paid orders, subscriptions, and refunds were only logged and discarded.
- Fix: checkout now requires a bearer Supabase session, derives the email and user ID from the verified account, links existing Polar customers or uses the account ID as `externalCustomerId`, and sends `metadata.user_id`. The landing page and dashboard now call the authenticated JSON checkout flow without putting an email in the URL.
- Fix: Polar handlers now resolve metadata `user_id` first, then subscription/customer IDs, then a normalized case-insensitive profile email and a paginated Auth-user fallback (`page`/`perPage: 1000`). Stale metadata does not fall through to another account's email; it is queued for review. The fallback is capped at 100 pages and fails closed if the directory continues beyond that boundary.
- Fix: migration `20260806051721_payment_reconciliation_h1.sql` adds a service-role-only `payment_reconciliation` table with provider/event uniqueness, retained payloads, identity candidates, status, and operator-resolution fields. Unmatched events emit a structured alert and are retained for reconciliation; queue/database failures remain retryable.
- Verification: the full frontend suite passes 7 files/43 tests; TypeScript passes; and `git diff --check` passes. Local SQL lint/execution remains blocked because the local Supabase Postgres service is unavailable at `127.0.0.1:54322`; the migration has not been applied remotely.

## 2026-08-06: H2/H3 pre-release review findings verified locally and against production

- Status: review items verified; free-tier downgrade fix is updated locally and the two provider-ended profiles plus one annual period end were repaired in production. The intentional legacy 900-credit grant was also reclassified into the persistent bonus ledger and moved to an active free profile. Website, webhook, migration, and plugin release remain paused.
- Finding 1: `revoke_subscription_access` previously left a revoked customer at only persistent-ledger credits and set `credits_last_renewed_at = now()`, delaying the normal 30-credit free allowance for 30 days. The migration now grants `30 + bonus_credits_remaining + purchased_credits_remaining` immediately.
- Finding 2: the live annual query found two annual profiles: one had `next_billing_date = null` and was backfilled to Polar's confirmed `2027-07-01T08:27:01.737Z`; the other has `2027-07-23T16:10:49.335Z` but null stored Polar IDs. This is not a release blocker because `findBillingProfile` falls back through subscription ID, Polar customer ID, and provider email, while `matchesSubscription` permits a missing stored ID; the remaining dependency is a matching Polar/profile email until H1 removes the fallback.
- Finding 3: two cancelled paid profiles mapped to Polar subscriptions already ended on 2026-03-28 and 2026-05-17 and were downgraded safely using the migration-equivalent update because the new RPC is not deployed yet. Both now have `subscription_plan = free`, `subscription_status = active`, and 30 credits. The third legacy profile had no provider IDs, a completed legacy/manual payment, and 900 aggregate credits with no bonus or purchased-ledger balance. A direct Polar customer search returned no exact-email or domain match, and the user confirmed the 900-credit grant was intentional. A guarded production repair preserved the 900 aggregate balance, mirrored it into `bonus_credits_remaining`, moved the profile to active `free`, and reset its renewal timestamp; the post-repair monthly-credit calculation returns 900 usable credits.
- Policy: partial refunds remain intentionally non-clawback; they update payment status and record the event only. This is documented in `RELEASE_CHECKLIST.md`.
- Audit schema check: production `information_schema` confirms `audit_logs.actor_id` and `audit_logs.actor_email` are both nullable, so the service-level promotional grant audit entry is valid with null actor fields; no migration change is required.
- Verification: the focused lifecycle suite now covers the immediate free allowance and the audited promotional-grant path; the full frontend suite passes 6 files/34 tests, TypeScript passes, and the live repair query confirms the two ended profiles, annual period-end backfill, and 900 usable legacy credits.
- Carry-forwards: `audit_logs` remains a pre-existing production table without DDL in the H2/H3 migration chain, so staging cannot yet reproduce the audit insert from migrations alone. The real pack-purchase path and 30-day renewal branches remain unexecuted in production; H1 and H4 are the remaining reporting/robustness items after release.
- Durability: the H2/H3 migration, Polar webhook, and lifecycle test are committed as `5222d3e` on local branch `fix/subscription-lifecycle-refunds`; no remote push, deployment, or migration application was performed.

## 2026-08-06: High-priority fix set verified locally; release intentionally paused

- Status: H2/H3 subscription lifecycle, the audited promotional-credit grant path, WordPress API-key persistence, WordPress onboarding modal, and `/connect` visual/recovery issues are fixed locally. Per the latest instruction, no website deploy, Supabase migration, WordPress.org SVN commit, or customer-site mutation was performed.
- Verification: frontend tests pass 6 files/34 tests; TypeScript passes; all 11 plugin PHP files pass syntax checks; the admin JavaScript passes syntax checks; the API-key persistence regression passes; all four plugin/site ZIP copies pass `unzip -t` and share SHA-256 `41d8ced2c8bdc71d3aa74ccd4395632f9a210e8d8bb8a6d90416fe72ea01a3c4`; migration static assertions pass; and `git diff --check` passes.
- Environment limit: Supabase local SQL lint remains blocked because Postgres is unavailable at `127.0.0.1:54322`. Netlify-function dependencies are not installed in this worktree, so that unrelated suite was not run; no dependency installation or production fallback was attempted.
- Release handoff: apply the H2/H3 migration before deploying the matching Polar webhook, deploy the website, publish WordPress.org 1.7.14, reconcile the already-cancelled paid profiles against Polar, and run the new-account connection smoke test with a rotated API key.

## 2026-08-06: Connect form branding polish fixed locally

- Status: fixed locally in response to the preview review. No production deployment has been made.
- Fix: the main connection logo now uses an explicit centered block layout, and the primary connection button, focus states, confirmation state, and account toggle use the Alt Text Pro teal palette instead of the leftover purple theme.
- Verification: the focused connect-page checks and full frontend suite pass 7 files/32 tests; TypeScript passes; and `git diff --check` passes.

## 2026-08-06: Automatic-connect popup fallback regression fixed locally

- Status: confirmed from the supplied screenshot and fixed locally. No production deployment, customer-site mutation, or API-key operation has been made.
- Verification: all connect-page CSS is declared inside the final authentication-form return. Loading, destination-confirmation, connecting, success, and manual-recovery branches return earlier, so none of those states mount the stylesheet. The screenshot is therefore the expected raw HTML rendering of the manual-recovery branch, not a browser-specific cosmetic issue.
- Fix: all early connection states now load a shared responsive stylesheet. The recovery state is a compact branded card with a clear warning, masked key, deliberate reveal and copy controls, numbered WordPress steps, security guidance, and an explicit close action. The existing secure `postMessage` acknowledgement flow is unchanged.
- Security: the supplied screenshot contains a complete API key, so that test key should be rotated even though the corrected screen now masks keys by default.
- Verification: focused connect-page regression tests cover the shared state stylesheet, masked-key behavior, centered logo, and brand palette; the full frontend suite passes 7 files/32 tests; TypeScript passes; the production Next.js build passes with non-secret placeholder configuration; and `git diff --check` passes.
- Visual QA limit: source-level responsive review covers desktop and the 520 px mobile breakpoint, but the exact authenticated manual-recovery state was not reopened in a real account because doing so would resend a live API key. `design-qa.md` records this limitation.
- Release gate: deploy the website after approval, rotate the exposed test key, then repeat automatic connection using the replacement key on the updated WordPress plugin.

## 2026-08-06: WordPress onboarding modal visual regression fixed locally

- Status: confirmed and fixed in Alt Text Pro 1.7.14. No production, WordPress.org, or customer-site mutation has been made.
- Verification: the released page templates contained the old inline onboarding markup, while the stylesheet targeted the newer shared modal structure (`onboarding-connect-button`, `onboarding-save-button`, dedicated heading/icon wrappers, and card-specific layout classes). That mismatch detached the manual save action into the footer, let the connect icon wrap onto a separate line, and created uneven card heights and spacing.
- Fix: Dashboard and Settings now render one shared modal template. Automatic and manual actions stay inside equal desktop cards; the modal stacks cleanly at 390 px; visible icons use fixed-size WordPress Dashicons; supported password managers are asked not to inject UI into the API-key field; and status feedback uses consistent loading, informational, success, and error treatments. Popup-blocked and failed-save states re-enable the automatic button.
- Accessibility: opening and closing now synchronizes `aria-hidden`, nested close-icon clicks work, focus styles are visible, the API-key help text is connected with `aria-describedby`, and external dashboard links use `noopener noreferrer`.
- Visual evidence: browser review at 1440 × 900 measured a 720 × 453 modal, equal 319 × 236 cards, and equal 281 × 44 primary actions. The 390 × 844 mobile capture has no horizontal clipping and keeps all controls visible. `design-qa.md` records `final result: passed`; the accepted mobile capture is `wordpress-plugin/tests/onboarding-modal-mobile.png`.
- Verification: all 11 plugin PHP files and the admin JavaScript pass syntax checks; the API-key persistence regression still passes; all 5 frontend test files/29 tests pass; `git diff --check` passes; and the 1.7.14 ZIP passes integrity inspection and matches the stable distribution copies at SHA-256 `0dfa83e556cdcf237947be6bff9d1cc4c4c2d950ec33b0b35867488eac3f36c9`.
- Test-environment cleanup: the temporary localhost administrator was deleted and the persistent local WordPress plugin symlink was restored to its original target after visual inspection.
- Release gate: publish the matching website download and WordPress.org 1.7.14 package, then repeat automatic and manual connection on an updated site.

## 2026-08-06: Urgent WordPress API-key persistence regression fixed locally

- Status: confirmed and fixed in Alt Text Pro 1.7.13. No production, WordPress.org, or customer-site mutation has been made.
- Verification: both the live Alt Text Pro download and the official WordPress.org 1.7.12 ZIP contain the broken path. The API validates successfully, then `ajax_validate_key()` encrypts it and calls `update_option()`. WordPress applies the registered `sanitize_settings()` callback, but the released sanitizer does not recognize a valid `enc:` value, treats it as an invalid public key, and preserves the existing blank key. The AJAX read-back consequently emits the exact error shown in the customer screenshot.
- Regression source: the tested 1.7.0 encrypted-value sanitizer fix exists in commit `e9872a2`, but that commit is not an ancestor of the current release branch. The 1.7.12 save-handler comment and changelog claimed the missing protection was present.
- Fix: restored the sanitizer branch that accepts an internally encrypted key only after it decrypts successfully on that WordPress installation and the decrypted key passes the normal Alt Text Pro format check. Malformed encrypted input preserves the existing key and raises a settings error. Added a standalone regression test and incremented all current package metadata to 1.7.13.
- Verification evidence: the regression test fails on 1.7.12 and passes with the fix; all 10 plugin PHP files and the admin JavaScript pass syntax checks; a real localhost WordPress option round-trip saved and decrypted a synthetic key and restored the original local setting; all 5 frontend test files/29 tests pass; `git diff --check` passes; and the 1.7.13 ZIP passes integrity inspection, contains the fix, excludes tests/debug files, and matches all stable distribution copies at SHA-256 `0d4a03936be9855e53e34825926407852c1432e1a7d870ff6be0ef7930853374`.
- Release gate: publish the matching website download and WordPress.org 1.7.13 update, then repeat the new-account connection flow on an updated site. Affected users do not need a new account or API key; after updating, they can save the same validated key again.

## 2026-08-06: H2/H3 subscription lifecycle fix completed locally

- Status: H3 and H2 are confirmed and fixed locally. No production mutation, deployment, or customer notification has been made.
- H3 verification: production has 2 active `tier2` annual profiles with a 400-credit monthly allowance. The live cancellation handler clears the annual drip fields immediately, while the live paid-renewal function only renews active annual profiles with a non-null allowance.
- H2 verification: the installed Polar adapter supports `onSubscriptionRevoked`, `onOrderRefunded`, `onRefundCreated`, and `onSubscriptionUncanceled`, but the webhook registers none of them. Production has 3 paid profiles already marked cancelled with null drip fields, and no recorded Polar refund/revocation lifecycle events in `marketing_events`.
- Fix: cancellation now records the provider period end in `next_billing_date` while preserving the paid plan, annual drip metadata, and cancellation-period access. The renewal function accepts cancelled annual profiles only while that end date is in the future. Revoked subscriptions atomically downgrade to free while preserving promotional/purchased ledgers; uncancellation restores metadata without granting a second allowance. Full refunds and succeeded benefit-revoking refunds mark payments and revoke subscription/pack benefits through idempotent database functions; pending refunds are rechecked on `refund.updated`.
- Verification: focused Polar lifecycle tests pass 7/7; the full frontend suite passes 5 files/29 tests; TypeScript passes; the production Next.js build passes with non-secret placeholder configuration; and `git diff --check` passes. The new migration is visible locally but not present in the read-only production migration list.
- Release gate: apply the migration before deploying the matching webhook, then reconcile existing cancelled paid profiles against Polar before considering the live account repaired. Local Supabase lint is blocked because Postgres is unavailable at `127.0.0.1:54322`; no live repair was attempted.

## 2026-08-05: Approved C1/C2/C3 release completed

- Status: the approved fix set is released and verified in production. The release sequence was migration first, matching Netlify app/webhook deploy second, and WordPress.org plugin release third.
- Netlify: production deploy `6a730485df0401d83198e2dd` is live at `https://www.alt-text.pro`; the production build passed TypeScript/lint/build checks and packaged 17 functions. The public health endpoint is healthy and the 1.7.12 plugin ZIP is available.
- Supabase: migration `20260805094230_fix_purchased_credit_pack_ledger` applied to project `qurbdtzrngzfzevgoolp`. The archive contains 2 losing payment rows; remaining duplicate payment rows and Polar/signup event groups are 0; paid-ledger column, grant/use/renew RPCs, indexes, and the non-negative constraint are present; no completed pack payments or grants were found.
- Polar reconciliation: the production API returned 13 orders, all subscription products; the one-time order query returned 0. There were therefore no unmatched one-time credit-pack orders and no manual credit remediation was performed.
- WordPress.org: trunk revision `3635163` and tag `1.7.12` revision `3635165` were committed. Remote tag metadata and the directory API now confirm the public name `Alt Text Pro` and version `1.7.12`; the official 1.7.12 download URL returns HTTP 200.
- Smoke checks: `/api/health` returned 200/healthy, `/api/track-event` rejected an unauthenticated lifecycle event with 401, the Polar webhook rejected an unsigned request with 403, and the plugin download returned HTTP 200 with the verified build hash.
- Final local verification: Netlify tests passed 16 files/141 tests and frontend tests passed 4 files/22 tests using the package Vitest/jsdom configuration.
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
- Task: fixed the verified API-key persistence failure in Alt Text Pro 1.7.0 and confirmed the email-verification connection flow saves the key on the disposable WordPress test site.
- Status: completed
- Task: reset Alt Text Pro's setup state on the disposable WordPress test site and installed a reusable test-only Settings-page helper for repeating the first-time onboarding flow.
- Status: completed
- Task: installed and activated the current local Alt Text Pro 2.1.0 package on the disposable WordPress test site for hands-on testing.
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
- 2026-07-29: uploaded the validated 446 KB Alt Text Pro 2.1.0 ZIP (SHA-256 `859238a22a82447aea436fbb95037c26018a2d51aea69a87e1524b6b71c05812`) to the disposable WordPress test site, activated it, and verified the plugin dashboard loads and reports v2.1.0.
- 2026-07-29: created and locally syntax-checked Alt Text Pro Test Reset 1.1.0, then installed it on the disposable WordPress test site. Its Settings page clears only Alt Text Pro's saved API key and setup preferences, preserving site content and plugin logs; the resulting dashboard was visually verified with the first-time onboarding modal open.
- 2026-07-29: diagnosed the verified-key save failure: `ajax_validate_key()` encrypts the API key before calling `update_option()`, then the registered settings sanitizer rejects that encrypted value as an invalid API-key format and preserves the blank existing key. The post-save read-back check correctly reports the failure.
- 2026-07-29: built and installed the corrected Alt Text Pro connection flow on the disposable WordPress test site; PHP and JavaScript syntax checks passed. Re-ran the automatic email-verification connection: the key saved successfully, the onboarding modal closed, and the connected dashboard displayed the account's 30 remaining credits. The public release package is versioned 1.7.0; production was not modified.
- 2026-07-29: aligned the disposable WordPress test site with the public 1.7.0 release package after completing the connection-flow verification; the active dashboard reports v1.7.0 and remains connected.
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
- 2026-07-29: installed and activated Alt Text Pro 2.1.0 on the disposable WordPress test site for hands-on testing.
- 2026-07-29: added and installed the test-only Alt Text Pro Test Reset 1.1.0 helper, and verified it restores the first-time onboarding state on the disposable WordPress test site.
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
- 2026-08-05: prepared the lifecycle scheduler durability release from `origin/main`: the cron now targets the sanitized `lifecycle-automation-scheduled` wrapper, the shared handler wires usage-count suppression and per-account priority selection, and focused routing/candidate tests were added. The release is ready for Git commit, push to `main`, and a commit-linked Netlify production deploy.
- 2026-08-05: committed the scheduler durability release as `50c9c57`, pushed it to `origin/main`, and verified Netlify production deploy `6a736ff873f5060008dc2c4e` is ready with commit ref `50c9c571b826e505bf99d236e54d1986be68fae2`. The homepage returned HTTP 200, unauthenticated lifecycle routes remained HTTP 403, and a repeat health probe returned HTTP 200/healthy after one transient cold-start 500.
- 2026-08-14: tested the authorized `help@wpgeared.com` account on the staging WordPress site with three rotated API keys (`U8LI`, `0ZjU`, `PjZo`, last four only). All three keys validated and saved; the first request was slow and needed a retry, while the next two completed normally. The staging dashboard showed 900 promotional credits, 0 used, and 15 plan credits throughout. Read-only database verification shows only `PjZo` active and all three new keys used successfully; no product code or production configuration was changed.
- 2026-08-14: diagnosed the reported staging bulk run for `help@wpgeared.com`: three images returned the plugin's generic HTTP-500 service error, while `Remaining 70` represented queued images rather than credits. Read-only verification showed 915 total credits (900 promotional), 0 total processed, no recent `usage_logs`, and a recently used active API key, confirming the failures were not billed and occurred after authentication in the AI-generation path. Netlify production metadata includes `GEMINI_API_KEY` and `GEMINI_MODEL` for function runtime scopes; their values/provider health still require function-log or health-check verification. No code or production configuration was changed.
- 2026-08-14: confirmed the exact generation failure in the retained production Netlify logs: Gemini model `gemini-2.5-flash` returned `503 Service Unavailable` during high demand, and other attempts returned `finish reason: MAX_TOKENS`. The WordPress plugin maps these backend failures to the generic service-error notice; the customer API key and credits were not the cause, and no code or production configuration was changed.
- 2026-08-14: read-only checked Google AI Studio billing, Usage, Spend, and Rate Limit for the open `iamaamirfaiz@gmail.com` account. The selected `Bingo AI` project is Tier 1 with no rate-limit usage data; Usage charts failed to load and Spend warned that cost data can lag. Billing shows postpay balance ₹30.08, ₹1,969.92 payment threshold available, and a warning to switch to prepay; no evidence of a large quota spike was visible. No billing or project settings were changed.
- 2026-08-14: corrected the Google AI Studio check to the `Alt-Text AI` project. Tier 1 Gemini 2.5 Flash limits show peak usage of 15 RPM / 1K, 6.6K TPM / 1M, and 417 RPD / 10K; Spend shows ₹99.89 / ₹1,000 monthly cap and ₹117.12 total for the displayed 28-day period. Usage data includes a `400 BadRequest` category but no near-limit signal; no billing or project settings were changed.
- 2026-08-14: verified the current Google Gemini model catalog read-only. Google’s models page lists `gemini-2.5-flash`, and the repository’s deployed generation function also resolves to `gemini-2.5-flash`; no `gemini-2.4` reference was found in the production code/config search. No model setting was changed.
- 2026-08-14: read-only reviewed Google’s current model catalog for a possible upgrade. The latest stable multimodal text-output option listed is `gemini-3.7-flash`; `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, and `gemini-3.1-flash-lite` are also listed as stable. The catalog confirms `gemini-3.7-flash` accepts image input and returns text. No production model setting was changed.
- 2026-08-14: rechecked Google’s official `gemini-3.1-flash-lite` model entry. It is stable, accepts Text/Image/Video/Audio/PDF inputs, and returns Text, so it can analyze images and generate alt text. No production model setting was changed.
- 2026-08-14: authorized model test completed. Updated Netlify `GEMINI_MODEL` to `models/gemini-3.1-flash-lite` (the Netlify connector’s update request returned 422, so the authenticated CLI performed the same scoped update), triggered production deploy `6a7f49fb151f1ebdf38cd110` from `main` commit `18a6f44`, and verified the deploy became ready. The authenticated WordPress test site then processed one image successfully: `carl-barcelo-nqUHQkuVj3c-unsplash` received alt text “A person in olive activewear performs a mermaid yoga pose on a mat in a room with wooden floors.” The plugin recorded 1 processed/1 generated/0 errors; lifetime site generation increased from 745 to 746, and the corresponding Netlify function request completed without an error. Production model setting is intentionally left on the tested model.
- 2026-08-14: completed the local top-up eligibility update. The dashboard now keeps Top up visible but disabled for free, annual, revoked, or otherwise ineligible accounts, explains that packs are for monthly subscribers only, and opens both the $5/500-credit and $10/1,200-credit packs for eligible monthly subscribers. The checkout API independently rejects ineligible credit-pack purchases, including direct requests, while preserving established paid-plan aliases and scheduled-cancellation access. Focused tests (15), TypeScript, lint, and the Next.js production build passed; production was not deployed.
- 2026-08-14: broadened the local top-up eligibility rule after product review: active paid monthly and annual subscribers can now buy either credit pack, including accounts with a scheduled cancellation while access remains active. Free, revoked, unsupported-cycle, and missing-status accounts remain blocked. Dashboard, modal, checkout, catalog copy, docs, terms, and regression tests were updated; 16 focused tests, TypeScript, lint, and the Next.js production build passed. Production was not deployed.
- 2026-08-14: added the local password-recovery flow. The main sign-in dialog now offers “Forgot password?”, sends a privacy-preserving Supabase reset email to the first-party `/reset-password` page, and the new page handles recovery sessions, code/hash links, password confirmation, update, sign-out, and expired-link errors. Recovery links also default to the reset page through `/auth/confirm`. Auth/app tests passed (50 tests across 8 app test files), TypeScript, targeted lint, and the Next.js production build passed; Supabase and production were not changed.
- 2026-08-15: deployed the approved top-up eligibility and password-recovery updates to Netlify production from commit `6394234`. Deploy `6a7f5fa5e3a232fe3b236041` is ready; the homepage and `/reset-password` return HTTP 200, and `/.netlify/functions/health` reports healthy. Final verification passed with 58 tests across 9 files, TypeScript, targeted lint, and the full Next.js production build. Supabase, billing, and WordPress settings were not changed.
- 2026-08-15: diagnosed the bulk-completion email sender. The plugin calls WordPress `wp_mail()` without explicit `From` or `Reply-To` headers, so the customer site's WordPress/SMTP configuration supplies `reports@email.metricpress.wpgeared.com`; Netlify's email settings do not affect this message. No production or plugin release change was made.
- 2026-08-21: read-only checked the production Supabase Auth and profile records for the newest signup. `editor@sagejournal.co.nz` created and confirmed the account through Google at `2026-08-21 07:43 UTC`; the free active profile has 1,165 credits (15 plan + 1,150 bonus), 0 processed, and no subscription. The audit log confirms the user claimed the 1,000-credit WPGeared campaign offer; no data was changed.
- 2026-08-21: read-only checked whether the newest user deleted the WordPress plugin. An active WordPress API key was created at `2026-08-21 07:43:36 UTC` but has never been used, and no `connect_completed` or usage event exists. The plugin uninstall routine removes only local WordPress settings/history and does not deactivate the remote API key, so deletion cannot be proven from the backend; the evidence is consistent with the plugin being removed or abandoned immediately after connection. No data was changed.
- 2026-08-21: clarified the signup evidence: the authenticated dashboard automatically calls `get-api-key`, which creates an API key even when the WordPress plugin is never installed. Because this user has no plugin connection or usage event and the key has never been used, the most likely explanation is account setup only, not plugin installation followed by deletion. No data was changed.
- 2026-08-15: prepared a Higgsfield brief for a 9:16 Instagram Reel tutorial showing a travel blogger using Alt Text Pro on her laptop, filmed by a second person on a mobile phone. The workflow and official logo reference were prepared, but generation did not start because the connected Higgsfield workspace has 0 credits; the available 3-day trial requires explicit user activation and a card. No application or production systems were changed.
- 2026-08-15: Higgsfield Plus trial is active with 100 credits, so the prepared Alt Text Pro Instagram Reel generation can resume. No application or production systems were changed.
- 2026-08-15: completed the Higgsfield creator reference, four-step storyboard, and required realism cleanup for the Alt Text Pro travel-blog Reel. The final 15-second Seedance render was not submitted because the trial’s 100 credits were exhausted by the preparatory generations; Higgsfield reports that this workspace has no top-up/auto-refill path and requires a paid plan upgrade. No application or production systems were changed.
- 2026-08-20: Higgsfield Plus is active with 1,000 credits, so the previously completed Alt Text Pro Reel assets are ready for the final video render retry. No application or production systems were changed.
- 2026-08-20: completed and verified the 15-second Alt Text Pro Instagram Reel. Final MP4 is 1080x1920 with H.264 video and AAC audio; no application or production systems were changed.
- 2026-08-20: started a four-variant Higgsfield promotion batch using the completed Alt Text Pro Reel storyboard, with distinct spoken hooks and CTAs for A/B testing. The workspace balance was 865 credits before submission.
- 2026-08-20: completed and verified four 15-second Alt Text Pro promotion variants with distinct spoken hooks and CTAs. All four are 1080x1920 with video and audio; Higgsfield balance after the batch is 325 credits. No application or production systems were changed.
- 2026-08-17: repaired localhost authentication setup by linking the main disk worktree to the existing Netlify project and running the app through Netlify Dev at `http://localhost:9999`. Verified the homepage returns 200, protected Functions return 401 without authentication, the injected Supabase project URL/key are non-placeholder, Supabase Auth settings return 200, and the sign-in dialog renders in-browser. No production configuration or deployment was changed; an authenticated dashboard session still requires the user to enter their own credentials.
- 2026-08-17: completed an authenticated localhost dashboard verification. Session restoration, usage, subscription, historical activity, connected-state suppression of onboarding, navigation targets, plan controls, generation empty state, and protected API calls loaded. Found one blocking defect: `get-api-key` returns 500 because `API_KEY_ENCRYPTION_SECRET` is absent from the linked Netlify environment, while the dashboard misleadingly renders a masked-key placeholder when no key was recovered. No key was exposed, rotated, or changed and no production mutation was made.
- 2026-08-17: hardened the API-key recovery failure path locally. Missing `API_KEY_ENCRYPTION_SECRET` now produces an explicit `api_key_encryption_not_configured`/503 response, while invalid ciphertext remains a separate recovery error; the dashboard shows `Unavailable` instead of a misleading masked key and disables reveal, copy, and rotation until configuration is restored. Function syntax, API-key tests (9/9), TypeScript, and diff checks passed. Netlify and Supabase were not changed.
- 2026-08-17: repaired API-key encryption configuration. A new dedicated `API_KEY_ENCRYPTION_SECRET` was set as a Netlify production secret and passed only to the local Netlify Dev runtime; the latest issued account key was rotated through `issue_api_key` and verified in memory by decrypting the stored ciphertext and matching its SHA-256 hash. The local server is healthy on port 9999; unauthenticated key access returns 401. Existing accounts with ciphertext from the unrecoverable prior secret still require individual rotation. No app deploy occurred.
- 2026-08-17: fixed the dashboard rotation-state bug found during localhost verification. The rotation POST returned 200 and issued the new key, but the previous recovery error remained in React state and kept rendering `Unavailable`; successful rotation now clears that error. TypeScript, JavaScript syntax, diff checks, local health (200), and unauthenticated key protection (401) passed.
- 2026-08-17: polished the customer dashboard locally: dashboard text now uses Lato, the top-right status/action cards have stable desktop widths, responsive stacking remains available on smaller screens, and dashboard button labels stay on one line. TypeScript, HTTP 200, and diff checks passed; no deployment occurred.
- 2026-08-17: diagnosed the dashboard generation `Failed to fetch` report as a stopped local Netlify Functions server: localhost uses `http://localhost:9999/.netlify/functions` while the dashboard runs on port 3000. Restarted the project’s local Netlify Dev setup; health returned 200, generation returned the expected 401 without authentication, and the localhost:3000 CORS preflight passed. No application or production code changed.
- 2026-08-17: fixed the dashboard generation failure for large uploads. The dashboard now resizes and JPEG-compresses selected images to a bounded payload before calling the generation function; this prevents the local Netlify server’s `Stream body too big` crash and gives oversized images a clear client-side message. TypeScript, diff checks, dashboard HTTP 200, function health 200, and unauthenticated generation protection 401 passed. No deployment occurred.
- 2026-08-17: diagnosed the dashboard API-key service error as a local Netlify Dev context mismatch: the default development context omitted the configured `API_KEY_ENCRYPTION_SECRET`. Restarted local Netlify Dev with the production context so the existing secret is injected without exposing it; health returned 200 and unauthenticated key access remained protected with 401. No production data or deployment changed.
- 2026-08-17: committed the verified dashboard/API-key/image upload release as `2af4812`, pushed `main`, and confirmed the Git-based Netlify production deploy completed. Live homepage and dashboard return 200, and unauthenticated API-key access remains protected with 401. No Supabase migration or WordPress.org release was needed for this application deploy.
- 2026-08-17: fixed the automatic WordPress connection fallback locally by opening each attempt in a fresh, state-specific popup instead of reusing the fixed `alt_text_pro_connect` window; stale popup opener state can no longer be reused across attempts. Bumped the plugin to 1.7.25, built the distribution ZIP, and verified JavaScript syntax, ZIP contents, and diff checks. PHP lint remains unavailable because the local PHP binary lacks `libnetsnmp.40.dylib`; no plugin submission or deployment occurred.
- 2026-08-21: sent the approved Alt Text Pro installation email to Emma Sage at `editor@sagejournal.co.nz` from the verified `help@alt-text.pro` sender alias using the designed HTML template. Gmail recorded the message as sent; no other application or production changes were made.
- 2026-08-21: read-only audited 37 profiles for Sage-like onboarding gaps. Twelve profiles, including Emma’s, have no `connect_completed` event and no usage record; all twelve also lack a `plugin_downloaded` event. Therefore 11 additional profiles currently have no backend evidence of plugin installation or use. Two of the twelve are cancelled Polar test accounts; no data was changed.
- 2026-08-21: after explicit confirmation, sent the same designed HTML installation email as eight separate messages from `help@alt-text.pro` to the remaining non-test, non-Polar profiles. Emma was excluded because she had already received it; the meta test address and both Polar addresses were excluded. Gmail reported all eight messages as sent.
