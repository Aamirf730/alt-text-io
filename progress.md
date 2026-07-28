# Progress

## Current work

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
- Backup-ledger documentation will be committed on a non-production `codex/` branch; production `main` will not be changed as part of archival work.
- The complete containing folder is preserved separately as a full external ZIP.
- The WPGeared offer matches authenticated, confirmed account emails against 239 normalized SHA-256 hashes; readable customer emails are not stored in the migration.
- Campaign awards require an explicit in-page claim action so inbox link scanners cannot grant credits.
- Promotional credits are tracked separately from plan allowance credits, remain usable after the plan allowance is exhausted, and survive free-plan renewal.

## Risks and constraints

- Pushing to `main` may trigger production deployment and is outside this archival task.
- Local environment files exist for development and must remain untracked.
- Production services must not be mutated without explicit scoped approval.
- Supabase intentionally reports that the private eligibility ledger has no RLS policies and that the authenticated claim RPC is `SECURITY DEFINER`; direct table access is revoked, the function has an empty search path, and its authorization checks are implemented inside the RPC.

## Verification evidence

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

## Update history

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
