# Alt Text Pro complete product audit

Audit completed: 2026-08-12
Scope: public website, authentication, SaaS dashboard, admin dashboard, customer offer/portal, checkout and billing, serverless API, Supabase, WordPress plugin, packaging, privacy/legal copy, responsive design, accessibility, and repository hygiene.

## Executive verdict

The locally repaired codebase is substantially safer, more internally consistent, and more usable than the audited baseline. The application, API, migrations, and plugin pass their automated verification, the Next.js production build completes, and the corrected public journeys render without browser console errors or horizontal overflow at the tested desktop and mobile widths.

The technical release blockers found in Supabase and the dependency tree have now been remediated and verified. The remaining owner/provider gates are credential rotation plus the associated Git-history decision, legal operator details, and destructive or billable authenticated end-to-end checks. The reviewed website release is proceeding through preview and production smoke gates; WordPress.org publication remains a separate release action.

Production and staging Supabase were changed only through reviewed migrations and a verified customer-safe API-key encryption pass. No customer charge, outbound email, WordPress.org publication, or live WordPress mutation was performed.

## System map

| Surface | Current implementation | Audit result |
|---|---|---|
| Marketing website | Next.js 16.3, responsive React UI | Corrected and verified locally |
| Authentication | Supabase Auth, email/password and Google | Boundaries and UI reviewed; authenticated live E2E still required |
| SaaS/customer dashboard | Next.js client dashboard plus authenticated APIs | Logic hardened and tests pass; authenticated staging E2E still required |
| Customer billing portal | Authenticated Next.js API route to Polar | Provider-bound and generic-error handling added; staging E2E still required |
| Checkout | Authenticated Next.js route to an allowlisted Polar catalogue | Arbitrary product checkout blocked; return verification added |
| Billing webhooks | Polar webhook route, Supabase ledgers/RPCs | Idempotency and identity handling covered by tests |
| Serverless API | Netlify Functions | Auth, CORS, rate limiting, logging, health, and contact boundaries hardened |
| Data | Supabase Postgres/Auth | Production and staging hardening applied and verified; leaked-password advisor refresh pending |
| WordPress integration | Alt Text Pro plugin 1.7.18 | Authorization, connection, key storage, bulk processing, privacy, and packaging hardened |
| Firebase | Not used | Only a disabled example provider block exists in `supabase/config.toml` |

## Highest-severity findings

| Severity | Finding | Resolution/state |
|---|---|---|
| Critical | Six tracked FTP/debug utilities and the root FTP guide contained an embedded server credential; a stale backend script could create remote accounts and print returned tokens | Files removed locally. **Blocked:** rotate the credential and decide Git-history cleanup before release |
| Critical | Production client policies/grants allow broader profile, payment, usage-log, marketing-event, and plan access than the product requires | Fixed: hardening migration applied; RLS, grants, indexes, and advisor state verified |
| Critical | Separate staging project has RLS disabled and broad anonymous/authenticated grants on five public tables | Fixed: RLS/grants restored, 51 orphan-related rows archived privately, and six orphan profiles removed |
| High | Checkout accepted caller-selected product identifiers and success UI could appear without provider confirmation | Fixed with authenticated allowlisting, Polar checkout ID return, provider-bound status validation, and regression tests |
| High | Plugin connection/key delivery had origin/state and legacy storage weaknesses | Fixed with exact target validation, cryptographic state, email-confirmation callback preservation, opener acknowledgement, AES-GCM `enc2` storage, persistent fail-closed recovery notices, and removal of URL/plaintext fallbacks |
| High | Bulk and auto-upload paths could create concurrent, duplicate, or unbounded retry billing | Fixed with owner-bound opaque jobs, atomic database-backed locks, three-attempt transport retry limits, stale-offset reconciliation, per-item authorization, and removal of duplicate scheduling |
| High | WordPress operations trusted broad page capabilities instead of checking each image/post | Fixed with attachment/post `edit_post` checks in single, post, batch, regenerate, and metabox flows |
| High | Public health detail and server logs could expose operational/user detail | Fixed with secret-gated detail checks, minimal public liveness, generic errors, and redacted logs |
| High | Contact endpoint lacked production-grade abuse and mail handling | Fixed with distributed rate limiting, honeypot, strict validation, CRLF normalization, escaping, SMTP support, and generic responses |
| High | 22 active legacy API-key rows in production retained plaintext while all had hashes and none had ciphertext | Fixed: all 22 encrypted in place with round-trip verification before plaintext removal; 25/25 active keys now have ciphertext and hashes |
| Medium | Public UI contained synthetic testimonials, unsupported accuracy/security/SEO claims, stale plan text, and a false direct payment-success state | Removed or rewritten as factual product behavior; pricing now uses one catalogue |
| Medium | Signed-out admin access could briefly render the dashboard shell before redirect | Fixed: only a neutral access check renders until an authenticated admin session is established |
| Medium | Several routes lacked a primary `main` landmark; payment cancellation used an `h2` as the page title | Fixed across public, auth, dashboard, admin, and connection states |
| Medium | CSP blocked the simulator asset and Meta Pixel configuration was inconsistent | Fixed; simulator uses a local optimized image and the final browser log is clean |
| Medium | Plugin left settings/history behind and performed global cache flushes | Added uninstall cleanup, targeted scheduled-hook cleanup, and removed global cache flushes |
| Medium | Test-project Vitest configuration unintentionally collected tests outside its own folder | Fixed by scoping its include pattern to `netlify-functions-tests/**` |

## Journey and flow health

Health meanings: **Pass** = locally exercised or deterministically covered; **Pass with gate** = implementation passes local evidence but requires an authorized authenticated/provider/live test; **Blocked** = external state must be remediated first.

| Journey | Step | Health | Evidence/notes |
|---|---|---|---|
| Public discovery | Load homepage and primary navigation | Pass | Desktop/mobile rendered; no horizontal overflow or console errors |
| Public discovery | Open and close mobile menu | Pass | Expanded/close state and all primary links exposed |
| Public discovery | Read benefits, workflow, product facts, examples, and FAQ | Pass | Unsupported factual claims removed; FAQ controls expose expanded state |
| Pricing | Switch monthly to annual | Pass | Lite $43.20, Standard $97.20, Pro $151.20, Agency $205.20 yearly |
| Pricing | Select Free or a paid plan | Pass with gate | UI selects only centralized catalogue entries; authenticated Polar checkout needs staging E2E |
| Account | Open sign-in/sign-up dialog | Pass | Dialog name/description, labels, initial focus, focus trap, Escape, backdrop, and close actions verified |
| Account | Create account by email or Google | Pass with gate | Source/auth flow reviewed; no real account was created during this read-only audit |
| Account | Confirm email | Pass with gate | Invalid/no-token state fails closed; valid Supabase confirmation requires staging E2E |
| Protected SaaS | Visit dashboard while signed out | Pass | Redirects to homepage without exposing account data |
| Protected admin | Visit admin while signed out | Pass | Neutral access check appears, then replace-redirect; no admin shell flash |
| Dashboard | View credits, plan, usage, history, and onboarding | Pass with gate | Catalogue and data mapping reviewed; authenticated staging session required for UI/data proof |
| Dashboard | Reveal/copy/rotate API key | Pass with gate | Authenticated endpoint and rotation boundary reviewed; do not exercise against production without approval |
| Dashboard | Upload an image and generate a draft | Pass with gate | Real API path and credit reservation tests pass; live AI call intentionally not made |
| Dashboard | Download plugin | Pass | 1.7.18 package built, version synchronized, and archives validated |
| Checkout | Start checkout from an allowed plan/pack | Pass with gate | Auth required and product ID allowlisted; Polar staging checkout still required |
| Checkout | Return from Polar | Pass | Missing checkout ID fails closed; success is shown only after authenticated provider confirmation |
| Billing | Process subscription/order/refund webhooks | Pass with gate | 24 focused webhook tests pass; post-deploy staging delivery/reconciliation required |
| Customer portal | Open billing portal | Pass with gate | Auth and provider-customer binding enforced; staging E2E required |
| Customer offer | Load invitation offer and switch sign-up/sign-in | Pass | Desktop/mobile layout, form states, and one-claim copy verified |
| Customer offer | Claim invited-customer bonus | Pass with gate | Server-side eligibility path reviewed; authorized invite/account test still required |
| Contact | Enter name, email, subject, and message | Pass | Labels, required fields, responsive layout, and honeypot behavior reviewed |
| Contact | Submit and deliver support email | Pass with gate | Endpoint tests pass; real SMTP delivery intentionally not triggered |
| Plugin install | Install/activate package | Pass with gate | ZIP contents/lint pass; fresh disposable WordPress install smoke test remains advisable |
| Plugin connect | Start from WordPress with callback/state | Pass | Exact origin/source/state validation and confirmation logic covered by regression checks |
| Plugin connect | Save key or use manual recovery | Pass | Acknowledged delivery and encrypted persistence implemented; URL/plaintext fallbacks removed |
| Plugin single image | Generate a draft | Pass with gate | Attachment authorization enforced; output remains a reviewable draft before save |
| Plugin single image | Apply and save edited alt text | Pass with gate | UI targets the current attachment field; disposable WordPress UI test remains advisable |
| Plugin posts/pages | Generate for editable post images | Pass with gate | Post and per-attachment authorization enforced; WordPress E2E remains advisable |
| Plugin bulk | Select eligible images and start job | Pass | Only editable images counted/queued; opaque owner-bound job identifiers used |
| Plugin bulk | Process/retry/skip/cancel | Pass | Atomic locking, a three-attempt retry ceiling, and stale-offset reconciliation prevent concurrent or unbounded duplicate billing; cancel stops after current image |
| Plugin upload automation | Generate on upload/overwrite | Pass | Unconditional second scheduled generation removed; overwrite remains explicit |
| Plugin uninstall | Remove plugin-owned data | Pass | Settings, temporary jobs/locks, schedules, and local history removed; saved attachment alt text retained |
| Simulator | Toggle no-alt/with-alt/broken-image states | Pass | State, code example, crawler explanation, and screen-reader output update correctly |
| Documentation | Navigate setup/features/API/pricing/troubleshooting/FAQ | Pass | Sidebar scroll targets work on desktop/mobile; version/pricing/defaults synchronized |
| Legal/privacy | Read terms and privacy disclosures | Pass with gate | Product behavior is covered; operator legal name/address/jurisdiction still requires counsel/owner input |
| Production data | Apply hardening migrations | Pass | Applied and verified RLS, least-privilege grants, catalogue correction, indexes, and customer-offer function isolation |
| Staging data | Restore RLS and least privilege | Pass | Applied and verified; orphan data archived before cleanup |

## WordPress plugin release evidence

- Version: `1.7.18` in plugin header, constant, readme stable tag/changelog, dashboard/docs, and downloadable archive names.
- PHP syntax: all 12 packaged PHP files pass.
- JavaScript syntax: packaged admin script passes.
- Regression checks: encrypted API-key persistence and security regression suites pass.
- Package hygiene: 23 files; includes `uninstall.php`; excludes tests, debug logs, node modules, and deleted FTP utilities.
- Source and public package SHA-256: `14f3cfb14cc54a5cf8f7b0df2523cf596e3eed71fdb047e31365ca96d7e0f027`.
- No WordPress.org publication or live-site mutation was performed.

## Data/security review

### Production Supabase

- Integrity checks found no negative balances, duplicate payment IDs, orphan usage/payment rows, open payment reconciliations, or stale pending credit reservations.
- All 25 active API keys have hashes and AES-GCM ciphertext; zero retain plaintext and zero hash groups are duplicated.
- Leaked-password prevention is enabled in the dashboard; the security advisor cache still needs to refresh before this can be closed as independently confirmed.
- Required user foreign-key indexes are present.
- Broad client policies/grants were replaced with the reviewed least-privilege boundary, and the public customer-offer RPC is now a security-invoker wrapper over a private implementation.

### Staging Supabase

- RLS is enabled on the five audited public application tables and broad client writes are removed.
- Six orphan profiles and related rows were archived to a private staging table before deletion; no orphan profile/payment/usage rows remain.
- Staging is suitable for further controlled testing, subject to normal test-account and provider isolation.

### Repository history

- The working tree no longer contains the credential-bearing FTP/debug utilities or the 8,216-line plugin debug log with user data.
- Both remain recoverable from Git history. Credential rotation and a history-remediation decision are mandatory before sharing or releasing this repository more broadly.
- Current active-tree scan found no FTP credential helper/config matches.

## Design and accessibility review

- Visual system: consistent black/white/yellow brand language, strong typography, clear CTA hierarchy, coherent cards/forms, and responsive layouts.
- Responsive checks: 1280×720 desktop and 390×844 mobile; no measured horizontal overflow on audited pages.
- Interaction checks: navigation, mobile menu, pricing toggle, FAQ, auth states, documentation navigation, simulator controls, and protected-route redirects behave correctly.
- Accessibility improvements: dialog semantics/focus handling, mobile menu state, labeled form controls, page landmarks, heading hierarchy, live regions, button names, and review-before-save wording.
- Content integrity: synthetic testimonials, unsupported percentages, unsupported security badges, speed guarantees, and ranking/compliance implications were removed or qualified.
- Browser console: no errors after the final corrected route pass.

## Verification summary

| Check | Result |
|---|---|
| Frontend unit/API tests | 10 files, 63 tests passed |
| Netlify function unit tests | 19 files, 150 tests passed |
| Cross-function integration/security tests | 3 files, 24 tests passed |
| Total Netlify/API tests | 22 files, 174 tests passed |
| Supabase migration-chain tests | 10/10 passed |
| Frontend lint | Passed |
| TypeScript | Passed |
| Next.js production build | Passed; 27 routes generated/registered |
| Plugin PHP syntax | 12/12 passed |
| Plugin JavaScript syntax | Passed |
| Plugin focused regressions | 2/2 passed |
| Browser desktop/mobile route pass | Passed; no horizontal overflow or console errors |
| `git diff --check` | Passed |
| Independent final code review | Earlier repair review completed with 0 issues; release review service later ended during setup without a result |
| Runtime production dependency audit | Root, frontend, and functions: 0 production vulnerabilities |
| Full root dependency audit | 0 vulnerabilities after removing the locally installed CLI toolchain; Netlify CLI remains on-demand only |

## Remaining release gates

1. Rotate the exposed test-server credential and invalidate related sessions/keys; this requires the owner to enter the replacement credential.
2. After rotation, approve and coordinate Git-history cleanup for the credential-bearing files and deleted user-data debug log; rewriting shared history requires a force-push and fresh clones.
3. Supply legal operator name, postal address, governing jurisdiction, and counsel-approved terms/privacy language.
4. Confirm the Supabase leaked-password advisor has refreshed to match the enabled dashboard setting.
5. Complete deliberately authorized provider-side tests that create real external effects: Google/email auth, AI generation, checkout, webhook/refund, portal, SMTP, and a disposable WordPress install/uninstall cycle.
6. Publish plugin 1.7.18 to WordPress.org only as a separate reviewed release action.

## Accepted visual evidence

- [Final desktop homepage](./34-home-final-desktop.png)
- [Final annual pricing](./35-pricing-final-desktop.png)
- [Final sign-in dialog](./36-signin-final-desktop.png)
- [Final plugin connection](./37-connect-final-desktop.png)
- [Final customer offer](./38-customer-offer-final-desktop.png)
- [Final simulator state](./39-simulator-final-desktop.png)
- [Final contact page](./40-contact-final-desktop.png)
- [Final mobile homepage](./28-home-mobile-corrected.png)
- [Final mobile navigation](./29-mobile-menu-corrected.png)
- [Final mobile customer offer](./31-customer-offer-mobile-corrected.png)
- [Final mobile plugin connection](./32-connect-mobile-corrected.png)
- [Final mobile documentation](./33-docs-mobile-corrected.png)

## Release definition

The code is a verified release candidate with the identified technical database, application, plugin, and dependency defects repaired. “Perfect” cannot be honestly guaranteed for an AI, billing, authentication, and WordPress product; the responsible standard is evidence-backed release gates, owner control over destructive/provider actions, rollback readiness, and production monitoring.
