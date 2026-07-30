# Progress

## Current work

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
- Every WordPress plugin update will increment the public version by `0.0.1`; this release moves 1.6.0 to 1.7.0, and the next update will be 1.7.1.
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
