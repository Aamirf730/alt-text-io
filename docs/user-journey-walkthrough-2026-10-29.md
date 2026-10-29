# Alt Text Pro: the customer journey, step by step

Checked on 29 October 2026 against commit `4791c4d` (branch `fix/flow-audit-2026-10`) by reading the code, then updated after the follow-up fixes the same day (steps marked *fixed 29 Oct*). From 29 Oct each step is being reviewed again one at a time, against the code and the local website; what that review leaves unfinished goes in **Still open** below. Nothing here was tried on a live WordPress site or with a real account.

**The customer.** A small-business owner runs a WordPress site with about 800 images, most of them without alt text. They find Alt Text Pro, sign up free, connect their site, fix their library, pay when the free credits run out, use it for a year, and eventually leave.

**How to read each step**

- **OK**: works the way a customer would expect.
- **PARTIAL**: exists, but something is lacking (the line says what).
- **MISSING**: a customer would reasonably expect this step, and the product has nothing for it.
- **BROKEN**: exists, but doesn't work.

Some steps depend on the 8 new database migrations from the last round, which are not applied to production yet. Those are marked *(needs new migration)*.

---

## Missing or broken at a glance

There are 186 steps across 16 sections: 175 OK, 5 PARTIAL, 6 MISSING (6 different gaps, 0 of which are listed in two sections) and 0 BROKEN. Before the 29 Oct fixes: 109 OK, 48 PARTIAL, 27 MISSING and 2 BROKEN.

| Step | What's missing or broken |
|---|---|
| A5 | Reviews, ratings, install count or testimonials on the website |
| G6 | Bulk runs that keep going without the browser tab open |
| G14 | Undo a bulk run |
| G15 | Bulk filters by date, post, category or WooCommerce products |
| H6 | Approving bulk or auto results before they go live |
| M9 | Team members |

---

## Still open

Collected during the one-by-one review (sections A and B so far). Tick an item off when it is done, and add new ones as the review goes on.

**Waiting on a decision**

- [ ] **A5:** no reviews, ratings, install count or testimonials on the website. Left out on purpose while the plugin has about 10 installs and no ratings.
- [ ] **B2:** the 6-character password minimum is a live Supabase setting. Raising it needs approval to change production.
- [ ] **M9:** team members are not built. A proper version needs new tables (members and invitations), invitation emails, and members spending the owner's credits, which changes the credit-reservation database functions. API keys are stored hashed, so members can't simply be shown the owner's key. Decide whether Agency customers need it before building it.
- [ ] **O4, O5:** the Contact page and the automatic reply now say "We usually reply within one to two business days". Confirm that promise, or change the wording.

**Done in code but not seen working yet**

- [ ] **A3:** the demo resuming after sign-in, and the demo image waiting in the dashboard after an email sign-up. Needs a real account.
- [ ] **A15:** the tax note in the dashboard upgrade window. Needs a signed-in account.
- [ ] **Plugin 1.7.28 on a real WordPress site:** A8 (Bulk page credits box), D8 (Connect Account on the dashboard), D11 (storage check in the connect window), E10 ("Connected as"), E11 ("Connect a different account"), and the later plugin steps marked *fixed 29 Oct*. Only a PHP syntax check was possible here (no PHP runtime); the plugin's PHP tests have not been run.
- [ ] **B11:** the welcome email arriving after a real sign-up (needs the functions deployed). It can be previewed first with the admin test-send tool (`signup_welcome`).
- [ ] **B14:** the getting-started checklist with a real account. It was checked locally against sample account data.
- [ ] **I6, I7, J9:** the low-credit (per plan, per cycle), out-of-credits and purchase emails with a real account after the functions are deployed. Preview each with the admin test-send tool first (`credits_low_no_purchase`, `credits_out_no_purchase`, `purchase_onboarding`).
- [ ] **J5, K2, K7, K9, L2:** the checkout back button (Polar `returnUrl`) and the dashboard billing lines with real Polar data. The dashboard states were checked locally against sample data (failed payment, annual, cancelled).
- [ ] **M1, M4, N10, N12, N13, O5, O6, P9, P10:** with real accounts after deploying: an email change (both links, then receipts moving to the new address in Polar), Download my data, the renewal reminder, the win-back and account-deleted emails, the contact auto-reply with a signed-in account attached, the deleted-account warning in the admin queue, and a checkout for an email that had a deleted account.
- [ ] **B6:** that production still sends the repo's branded template. Last confirmed with a real test email on 12 Aug (`progress.md`).
- [ ] **B4, B5, B7, C10:** the real Supabase replies (account already exists, sign-up, resend, rate limit, wrong password), and a plugin sign-up confirmed on a phone finishing with "I've confirmed — continue". The screens were checked in the browser by setting their state by hand.

**Release steps not done**

- [ ] Push the branch and deploy the website. None of the 29 Oct website fixes are live.
- [ ] Release plugin 1.7.28 to WordPress.org (Bulk page credits box, readme wording).
- [ ] Apply the 8 database migrations to production (the steps marked *needs new migration*).
- [ ] **M1:** apply the new email-change template in production Supabase (`supabase/templates/email_change.html`, set in `config.toml`).
- [ ] **C11:** in production Supabase, turn on "Secure password change" (it makes the emailed code required; the repo's `config.toml` now has it on) and apply the new security-code template (`supabase/templates/reauthentication.html`). Then try "Set a password" with a real Google account.
- [ ] **B6:** apply the updated confirmation and reset email templates (`supabase/templates/`) in production Supabase, and check that production's link expiry is 1 hour, as the emails now say.

**Done**

- [x] **A10:** the simulator links to the real homepage demo ("Try it on your own image"). *30 Oct.*
- [x] **A13:** Privacy names Google (Gmail) as the email provider, including for Supabase's confirmation and reset emails. *29 Oct.*
- [x] **A3:** email sign-ups that need confirmation keep the demo image. It is saved in the browser for 24 hours and waits in the dashboard, ready to generate. *29 Oct.*
- [x] **A8:** a "How many images need alt text?" calculator in the pricing section suggests the cheapest packs. *29 Oct.*
- [x] **C10:** a wrong password says "That email and password don't match… If you signed up with Google, use the Google button." on all sign-in forms. *29 Oct.*
- [x] **B9:** the expired-link page's resend button counts down 60 seconds like the sign-up forms. *29 Oct.*
- [x] Supabase's "Email rate limit exceeded" now reads "We have sent a lot of emails in the last hour. Please try again in a little while." *29 Oct.*
- [x] The connect window and customer offer page "check your email" changes, looked at in the browser. *29 Oct.*
- [x] Committed the B2, B4 and B5 fixes (`dcab046`). *29 Oct.*

---

## A. Finding and evaluating Alt Text Pro

**A1. Reads the homepage**: OK
The headline says what it is. Two buttons: "Start with 150 free credits" and "Install the WordPress plugin".

**A2. Sees how it works**: OK
A three-step section (install and connect, generate, review and save) with example alt text. *Fixed 29 Oct:* the step 1 picture was a website file-upload box, which suggested images are uploaded on the website. It now shows the plugin's Connect Account card, and the text no longer says to create an account first.

**A3. Tries it on their own image before signing up**: OK
They can pick an image on the homepage, but generating needs an account. After signing up they're sent to the dashboard and the image is lost (`LandingPageClient.tsx:179-186, 302`). *Fixed 29 Oct:* when the sign-in form was opened from the demo, signing in (email or Google) now keeps them on the homepage and generates alt text for their image. *Also fixed 29 Oct:* email sign-ups that need confirmation keep the image: it waits in the dashboard after the confirmation link, ready to generate.

**A4. Tries a large phone photo in the homepage demo (signed in)**: OK
The homepage sends the full-size image without resizing. The dashboard resizes to 1600 px / 3 MB because of the server's size limit. A big photo will likely fail with "Invalid response from server." (not tried) (`LandingPageClient.tsx:140-213`, `dashboard/page.tsx:42-43`). *Fixed 29 Oct:* the homepage now uses the same shrink step as the dashboard (`lib/prepare-image.ts`). A 39 MB test image was sent as a 0.67 MB, 1600 × 1200 JPEG.

**A5. Sees reviews, star ratings, install count or testimonials**: **MISSING**
The footer only says "Available on WordPress.org / Payments by Polar / Secure connection".

**A6. Compares plans, monthly vs annual**: OK
Free, Starter $5, Growth $12 and Agency $29, with an annual toggle showing "2 months free". *Changed 29 Oct:* the per-image price line was removed from the plan cards (it showed the monthly rate even on annual).

**A7. Understands the free tier**: OK
150 credits on sign-up that never expire, plus 15 each month.

**A8. Works out what to buy for 800 images**: OK
Credit packs are shown ($12 for 1,000 and up). There's no "how many credits do I need" helper. *Fixed 29 Oct:* the pricing section now has a worked example (800 images: 150 free credits plus the $12 pack), and the plugin's Bulk page compares images missing alt text with credits and says how many more are needed. *Also fixed 29 Oct:* the worked example became a calculator: type the number of images and it names the cheapest packs.

**A9. Reads the FAQ**: OK
Six questions on the homepage, more in the docs. *Changed 29 Oct:* two questions added, "Will it replace alt text I already wrote?" and "What happens to my images?", so there are now eight.

**A10. Tries the Alt Text Simulator**: OK
A scripted demo. It doesn't generate anything real and has no sign-up button. *Fixed 29 Oct:* the page now ends with "Start with 150 free credits" and "Install the WordPress plugin" buttons, and the "No alt text" keywords say png instead of jpg. It stays a teaching page, not a generator. *Changed 29 Oct:* the simulator stays a teaching page by design, and now leads with "Try it on your own image", which opens the real demo on the homepage.

**A11. Reads the docs**: OK
Getting started, installation, features, pricing, troubleshooting and FAQ. *Fixed 29 Oct:* the button is now called "Connect Account" (docs and readme), the settings list matches the plugin (batch size removed, five newer settings added, the "Test" button named correctly), AVIF and HEIC are listed, the API error example matches the real reply, the two misleading troubleshooting headings were renamed, the quick start no longer says to create an account first, and bulk is described as one image at a time.

**A12. Opens the WordPress.org listing**: OK
Linked from the hero, footer and guide pages.

**A13. Checks the trust pages (privacy, terms, about, contact)**: OK
All four exist and are linked from the footer. *Fixed 29 Oct: added the About link.* *Also fixed 29 Oct:* the operator is named (Alt Text Pro, India) on About, Privacy and Terms; Terms gained "governed by the laws of India" and no longer contradict themselves on refunds; Privacy covers Google sign-in and says emails come from help@alt-text.pro; Contact shows the email address. *Also fixed 29 Oct:* Privacy names Google (Gmail) as the email provider.

**A14. Types /pricing, /login or /signup**: OK
All three give the 404 page (which has useful links). There are no redirects. *Fixed 29 Oct:* /pricing goes to the pricing section, /login and /signin open the sign-in form, /signup and /register open the sign-up form. The ?auth= handler was also made safe for React Strict Mode, which kept the form from opening in development.

**A15. Sees whether prices include tax**: OK
Prices are bare USD. Polar adds VAT at checkout, so EU and UK buyers see a higher total with no warning. *Fixed 29 Oct:* "Prices are in US dollars. VAT, GST or sales tax may be added at checkout, depending on your country." now appears under the homepage pricing, in the docs and in the dashboard upgrade window, and the Terms say prices exclude taxes added at checkout.

## B. Creating an account on the website

**B1. Opens the sign-up form**: OK
Opens as a pop-up window on the homepage. Other pages send people there with `?auth=signup`.

**B2. Types email and password**: OK
Checks the email format and a 6-character minimum. No show-password button (the eye icon is imported but unused) and no strength hint. *Fixed 29 Oct:* the homepage form has a labelled show/hide password button and an "At least 6 characters." hint when signing up; the connect window's button is now reachable by keyboard and labelled. The 6-character minimum is unchanged (it is a live Supabase setting).

**B3. Sees Terms and Privacy at sign-up**: OK
"By creating an account you agree to the Terms and Privacy Policy" under the sign-up form, and "By continuing…" in the plugin's connect window. *Fixed 29 Oct.*

**B4. Signs up with an email that already has an account**: OK
Switches to sign-in with a clear message. It doesn't mention Google if that account uses Google sign-in. *Fixed 29 Oct:* the message now ends "If you signed up with Google, use the Google button." (on the homepage, the connect window and the customer offer page); on the homepage it stays in the form until the email changes or the form is sent again, instead of an 8-second pop-up; screen readers now announce the connect window's message.

**B5. Sees "check your email" with a resend button**: OK
*Changed 29 Oct:* the homepage now swaps the form for a "Check your email" panel (address, "Not there? Check your spam folder.", resend, "Already confirmed? Log in", "Use a different email") instead of a small note under a still-filled form. The connect window and customer offer page also mention the spam folder. On all three, the resend button counts down from 60 seconds after an email is sent, so Supabase's "you can only request this after N seconds" error no longer shows.

**B6. Gets a branded confirmation email**: OK
The repo has a branded template. Whether production uses it can't be confirmed from code. *Reviewed 29 Oct:* `progress.md` records it going live on 12 Aug, sent as Alt Text Pro <help@alt-text.pro> with the subject "Confirm your Alt Text Pro email", and checked with a real test email. The link goes to www.alt-text.pro/auth/confirm, not a supabase.co address. *Changed 29 Oct (repo only):* the confirmation and password reset emails now say the link works for 1 hour, include a copy-and-paste link under the button, add "Questions? Reply to this email and we will help.", and fit phone screens. The confirmation email also says the 150 free credits are ready once confirmed. Production keeps the old wording until the templates are applied in Supabase.

**B7. Clicks the link, possibly on another device**: OK
Works across devices, then goes to /email-confirmed and on to the dashboard. *Fixed 29 Oct:* for plugin sign-ups confirmed on a phone or another device, both connect windows said the WordPress window "continues on its own", which only happens in the same browser. They now say to click "I've confirmed — continue" in that case. The phone tab's "Close this tab" button, which browsers usually block for tabs opened from email, now falls back to "You can close this tab now." The homepage line about the saved demo image now says it waits "when you sign in on this computer".

**B8. Goes back to the original tab after confirming in another one**: OK
That tab stays on "Confirm your email" and doesn't move on. The plugin's connect window handles this; the homepage doesn't. *Fixed 29 Oct:* the homepage "Check your email" panel now notices a confirmation in another tab of the same browser and carries on (finishes the demo or opens the dashboard), like the connect window.

**B9. Clicks an expired or used link**: OK
Clear message, a resend form and a sign-in button. *Changed 29 Oct:* the resend button counts down 60 seconds after sending.

**B10. Signs up with Google on the homepage**: OK
New Google accounts are now recorded as sign-ups, so they get the "connect your site" email and appear in the funnel. Returning Google users aren't counted again, on the homepage or in the connect window. *Fixed 29 Oct.*

**B11. Gets a welcome email right after signing up**: OK
The first email is a "connect your site" nudge 4 hours later, only if they haven't connected. *Fixed 29 Oct:* a "Welcome to Alt Text Pro" email goes out with the next scheduled run (every two hours) with three setup steps, or the next steps for people who signed up from the plugin. Not sent to anyone who bought first, or more than two days after sign-up.

**B12. Picks a paid plan before having an account**: OK
The choice is kept for 24 hours and reopens in the dashboard. It's lost if they confirm in a different browser.

**B13. Sees the dashboard for the first time**: OK
*Fixed 29 Oct:* new users now see "Welcome", and the banner says to install from WordPress.org and click Connect Account. Still only one banner linking to the docs (see B14). *Fixed 29 Oct:* the banner became a getting-started checklist (B14).

**B14. Follows a getting-started checklist (install, connect, first image, bulk)**: OK
*Fixed 29 Oct:* the dashboard shows "Get started": create account, install the plugin, connect the site, generate a first image (each ticked from the account), then a pointer to the plugin's Bulk page. It can be hidden.

**B15. Tries generating in the dashboard before installing the plugin**: OK
Upload one image; it's resized and alt text is generated.

## C. Signing in later and keeping access

**C1. Signs in**: OK

**C2. Types the wrong password**: OK
Shows "Invalid login credentials". *Changed 29 Oct:* now the clearer message described in C10.

**C3. Signs in before confirming their email**: OK
Shows the resend option.

**C4. Forgets their password**: OK
Sends a reset email without revealing whether the account exists.

**C5. Clicks the reset link**: OK
"Set a new password" form. An expired link offers a new one.

**C6. Stays signed in across tabs**: OK
Signing out in one tab is followed in the others.

**C7. Session expires on the dashboard**: OK
"Your session expired", then the sign-in form.

**C8. Opens /dashboard while signed out**: OK
Sent to sign in.

**C9. Signs out on one computer**: OK
It signs them out on every device, because the sign-out is global (`Navbar.tsx:90`, `dashboard/page.tsx:263`). Plugin keys aren't affected. *Fixed 29 Oct:* Sign out on the website now signs out only this browser. Account settings has a separate "Sign out everywhere" button for all devices.

**C10. Google-only account tries a password**: OK
Generic "Invalid login credentials", with no "you signed up with Google" hint. *Fixed 29 Oct:* all sign-in forms now say "That email and password don't match. Check them or use Forgot password. If you signed up with Google, use the Google button."

**C11. Google-only account sets a password**: OK
Left out on purpose last round. The password section is hidden for these accounts. *Fixed 29 Oct:* Google-only accounts see "Set a password" in Account settings. A code is emailed to the account address first (Supabase re-authentication, with a branded template in the repo), then they choose a password and can sign in either way.

## D. Getting and installing the plugin

**D1. Installs from WordPress.org**: OK

**D2. Downloads the ZIP instead**: OK
From the docs and the dashboard. The ZIP is built during deploy.

**D3. Reads install instructions**: OK
Both methods are in the docs, plus the WordPress 5.0 / PHP 7.4 requirement.

**D4. Dashboard tells them what to do next**: OK
Only a docs link. No "Install from WordPress.org" button, and the ZIP is far down the page. *Fixed 29 Oct:* the dashboard's getting-started checklist has "Get the plugin" (WordPress.org) and the setup guide (B14).

**D5. Follows the readme setup steps**: OK
The readme says to click "Connect to Alt Text Pro". The buttons are actually labelled "Connect Account" and "Start onboarding". *Fixed 29 Oct:* the readme says "Connect Account", "Start onboarding" and "Test", matching the plugin (A11).

**D6. Activates the plugin and lands somewhere useful**: OK
Goes straight to the plugin's dashboard (not on network or bulk activation).

**D7. Sees a welcome or connect window**: OK
Opens automatically until connected or dismissed.

**D8. Closes the window ("later")**: OK
The plugin dashboard then has no Connect button. They have to go through Settings. *Fixed 29 Oct:* the plugin dashboard's "not connected" card now has a Connect Account button that opens the connect window.

**D9. Finds the plugin in the admin menu**: OK
"Alt Text Pro" with Dashboard, Bulk Process, Settings and Usage & Logs.

**D10. Sees a reminder on other admin pages**: OK
The "configure your API key" notice has a "Don't show again" link, remembered for each user. *Fixed 29 Oct.*

**D11. Server can't store the key securely**: OK
No check up front. They only find out after signing in, with an AUTH_KEY/OpenSSL error. *Fixed 29 Oct:* the connect window checks up front (a test encryption) and, if the site cannot store a key, says why (OpenSSL missing or no unique AUTH_KEY) and disables the connect buttons.

## E. Connecting the site to an account

**E1. Clicks "Connect Account"**: OK
A small window opens on alt-text.pro/connect.

**E2. Signs up inside that window**: OK
Email or Google. An existing email gets a clear message.

**E3. Confirms their email while the window waits**: OK
The window waits and moves on by itself. Also offers resend and "I've confirmed, continue".

**E4. Signs in instead, or resets the password**: OK

**E5. Sees which account and which site is being connected**: OK
"Signed in as …", and they confirm the WordPress address first.

**E6. Key is handed back to WordPress safely**: OK
Checked on both sides, and WordPress confirms it saved the key. If that confirmation doesn't arrive, the window shows the key to copy.

**E7. Pop-up is blocked**: OK
A clear message, plus a manual entry option.

**E8. Pastes a key by hand**: OK
The key is checked when saved.

**E9. Sees that it worked**: OK
"Connected successfully!", then the dashboard with credits and the number of images missing alt text.

**E10. Sees which account the site is connected to**: OK
The plugin never shows the account email. The server returns it (`class-settings.php:638`), but the plugin only shows the plan and credits. *Fixed 29 Oct:* the plugin dashboard's Plan card says "Connected as …" and Settings says which account the site is connected to (the usage reply now includes the account email).

**E11. Switches to another account**: OK
They must Disconnect first or paste a new key. "Start onboarding" is hidden once a key exists. *Fixed 29 Oct:* Settings shows "Connect a different account" when a key is saved. It opens the same connect window, which offers "Use a different account", and the new key replaces the old one.

**E12. Service is down while connecting**: OK
The key is saved as "unverified", with a hint to test it later.

**E13. Sees the site appear in the website dashboard**: OK
The connected-sites list doesn't refresh until the page is reloaded *(needs new migration)*. *Fixed 29 Oct:* the list refreshes by itself when the person comes back to the dashboard tab (at most every 10 seconds), as well as with its refresh button.

## F. First alt text

**F1. Generates for one image in the Media Library grid or image window**: OK

**F2. Generates from the Media Library list view (row action or bulk action)**: OK
There's nothing in the list view. They have to open each image. *Fixed 29 Oct:* each image in the Media Library list view has "Generate alt text", with the result shown in place (replace or keep when alt text already exists), and a bulk action opens the Bulk page with the chosen images selected.

**F3. Generates on the full image edit screen**: OK
Side box, then Apply, then Update.

**F4. Generates from the image block in the block editor**: OK
Only through the media window when choosing or replacing an image. *Fixed 29 Oct:* the image block has an Alt Text Pro panel with "Generate alt text" that fills the block's alternative text, and the Media Library's when it is empty or overwrite is on.

**F5. Reviews the draft before it's saved**: OK
Single images give a draft and an Apply button.

**F6. Generates a draft but never clicks Apply**: OK
The credit is used anyway, and it's logged as "generated" although the image still has no alt text. *Fixed 29 Oct:* Generate now says it uses 1 credit even if the draft is not applied, and the Logs mark each entry "Saved to image" or "Draft, not applied" (older rows show no status).

**F7. Edits or regenerates**: OK
Edited in the normal WordPress field. Each regenerate costs a credit.

**F8. Sees how many credits are left after generating**: OK
"Credits left: N" appears under the draft. *Fixed 29 Oct (was broken: the element didn't exist).*

**F9. Turns on auto-generate for new uploads**: OK
Off by default, and nothing suggests it after connecting. Runs in the background, charges once, and never overwrites newer alt text.

**F10. Chooses the alt text language**: OK
Defaults to the site's language.

**F11. Runs out of credits**: OK
A clear message with a "Buy credits or upgrade" link.

**F12. Key is invalid or has been rotated**: OK
Shows "Invalid API key…" with no link to Settings. *Fixed 29 Oct:* every "Invalid API key" message links to Settings to reconnect (or says to ask an administrator).

**F13. Service is down, or the image can't be described**: OK
Specific messages for each case.

**F14. Image is SVG or another unsupported type**: OK
The button is hidden and the reason is explained.

**F15. Image is very large (e.g. a 12 MB photo)**: OK
Shrunk to 2048 px. Clear error over 25 MB.

## G. Fixing the whole library in bulk

**G1. Sees how many images are missing alt text**: OK
"You have N images missing alt text", with a Fix Now button.

**G2. Sees what the run will cost before starting**: PARTIAL
Credits are shown, but there's no "this will use about N credits" check. The estimated time is calculated but never shown.

**G3. Starts a run with 150 credits for 800 images**: OK
Capped at 150, with an explanation and an upgrade link.

**G4. Watches progress**: OK
Progress bar, current image and a log. The log doesn't show the text that was written.

**G5. Closes the tab and comes back later**: PARTIAL
The run only moves while the tab is open. "Resume run" disappears after 15 minutes idle (`class-bulk-processor.php:27`). Starting a new "missing alt" run does pick up where it left off.

**G6. Lets the run finish without keeping the tab open**: **MISSING**
800 images means leaving a browser tab open for a long time.

**G7. Stops a run**: OK
"Stop after current image", with accurate credit counts.

**G8. Credits run out mid-run**: OK
Stops, shows a summary with an upgrade link, and sends an email.

**G9. Key revoked or account suspended mid-run**: OK
Stops at once and says why.

**G10. Service keeps failing**: OK
Retries three times, then stops with an explanation.

**G11. Sees a results summary at the end**: OK
A Results card appears when a run finishes, stops or is cancelled, with the totals. *Fixed 29 Oct (was broken: the card was never shown).*

**G12. Gets a list of failed images to retry**: PARTIAL
*Fixed 29 Oct:* the Results card lists the failed images (up to 50) with the reason and a link to each. The list is gone after a page reload, and failed images still aren't in the Logs or the CSV.

**G13. Chooses between overwriting and skipping existing alt text**: PARTIAL
There's an Overwrite option, but no warning before hand-written alt text is replaced. "Selected" mode always overwrites.

**G14. Undoes a bad run**: **MISSING**
The previous alt text isn't stored.

**G15. Narrows the run by date, post, category or WooCommerce products**: **MISSING**
Only a title/alt search and a missing/has/all filter.

**G16. Fixes images post by post**: OK
The Posts list has an "Alt Text" column, including featured and WooCommerce gallery images.

**G17. Exports a report**: PARTIAL
CSV of successful generations only. Failed and skipped images aren't included.

## H. Alt text reaching visitors and search engines

**H1. Alt text appears in posts that already contain the images**: OK
Empty alt text in posts is filled from the Media Library when the page is shown (WordPress 6.0+). Never overrides alt text written in the post.

**H2. Writes it into the saved post so the editor shows it**: OK
"Copy alt text into post" in the Posts list. Uses no credits.

**H3. Featured images and WooCommerce product images**: OK

**H4. Page builders (Elementor, Divi and others)**: OK
Only images inside normal post content are covered. Builders that store their own alt text aren't. *Fixed 29 Oct:* empty alt text is also filled in Elementor and Divi content shown outside the post content (Theme Builder headers, footers, templates, Elementor popups) when the image is from the Media Library. Builder alt text is never replaced; the readme FAQ lists what is not covered (images by URL, CSS backgrounds, other builders).

**H5. Image title, caption or description filled too**: OK
*Fixed 29 Oct:* optional settings (off by default) also fill the image title while it is still the file name, and the caption and description while empty, with new alt text.

**H6. Approves bulk or auto results before they go live**: **MISSING**
Bulk, auto-upload and post-level runs write straight to the live site. The only check afterwards is the Logs list.

**H7. Multilingual site (WPML or Polylang)**: OK
One language for the whole site. *Fixed 29 Oct:* on WPML and Polylang sites, each image is described in its own language when the language setting follows the site; a chosen language still wins.

**H8. Marks one image as decorative (empty alt on purpose)**: OK
The only option is to turn off the post fill for the whole site. *Fixed 29 Oct:* any image can be marked "Decorative image (empty alt on purpose)". It is never described or billed, keeps alt="" in posts, and is not counted as missing alt text.

## I. Running out of free credits

**I1. Knows what Free includes**: OK
150 once, plus 15 a month.

**I2. Knows when the free credits refill**: OK
The dashboard shows "Free credits refill around <date>", 30 days after the last refill. *Fixed 29 Oct (it said "No renewal scheduled").* The plugin doesn't show the date.

**I3. Hits 0 in the plugin (single or bulk)**: OK
Clear stop, a buy link, and Bulk Start is disabled.

**I4. Auto-generate fails on upload at 0**: OK
A notice with a buy link on the next admin page.

**I5. Gets a low-credit warning in WordPress**: OK
At 10 or fewer, but only on the plugin's own dashboard page. *Fixed 29 Oct:* a dismissible "Only N credits left" / "You are out of credits" notice shows on the Media Library screens and Alt Text Pro pages, from the last known balance, so pages never wait on the service.

**I6. Gets a low-credit email**: OK
Sent at 5 credits, the same threshold for every plan, and only once per person ever, so a subscriber is never warned again in later months (`bootstrap_schema.sql:218`). *Fixed 29 Oct:* the warning level now follows the plan (10% of the monthly allowance, at least 5 and at most 100 credits), and it can be sent again in each new credit cycle (after a refill or a purchase), once per cycle.

**I7. Gets a "you've run out" email**: OK
*Fixed 29 Oct:* a "You're out of Alt Text Pro credits" email goes out when the last credit is used or a generation is refused for no credits, once per credit cycle, with the three ways to continue (pack, upgrade, wait for the refill).

**I8. Goes from the plugin to paying**: OK
Links go to the pricing section. The chosen plan is remembered through sign-in.

## J. Paying

**J1. Chooses a plan, billing cycle or credit pack**: OK
Packs work on Free too.

**J2. Goes through checkout**: OK
Polar checkout. A second subscription is blocked.

**J3. Uses a discount code**: OK
Polar-hosted. Depends on Polar settings.

**J4. Gets correct VAT and a company invoice**: OK
Polar handles tax and invoices. Our site never mentions tax (see A15). *Fixed 29 Oct:* prices say tax may be added at checkout (A15), and the docs FAQ explains how to get an invoice with a company VAT number through Polar.

**J5. Backs out of checkout**: OK
A /payment-cancelled page exists, but nothing links to it and checkout doesn't return there. *Fixed 29 Oct:* checkout now has a back button (Polar's return URL) to the cancelled page, which says nothing was charged and the plan and credits are unchanged, with links to the dashboard and plans.

**J6. Card is declined**: OK
Handled in Polar checkout, and the success page handles failed or expired payments.

**J7. Sees the success page and the credits arrive**: OK
Waits until the account is updated. If it takes longer, the dashboard keeps checking and offers a support link.

**J8. Gets a receipt**: OK
From Polar.

**J9. Gets our post-purchase email**: OK
"Welcome to Alt Text Pro" includes a plugin download link, although they already have the plugin. *Fixed 29 Oct:* the purchase email now says the credits are ready and links to the dashboard. Setup steps (install from WordPress.org, Connect Account) appear only if the account has never connected a site.

**J10. Abandons checkout and gets a reminder**: OK
Sent after 1 hour.

## K. Being a subscriber

**K1. Monthly renewal refills credits**: OK

**K2. Annual plan refills every month**: OK
12 refills a year *(needs new migration)*. The next monthly refill date isn't shown. *Fixed 29 Oct:* the dashboard shows "Renews yearly on …" and "Next monthly credits on …", worked out the same way as the refill job.

**K3. Checks usage**: OK
Used, limit and extra balance, plus full history.

**K4. Knows whether unused credits roll over**: OK
Plan credits reset; bonus and pack credits stay. Stated in the terms and the dashboard.

**K5. Upgrades or downgrades**: OK
Only through Polar's billing page. A downgrade cuts credits at once. *Fixed 29 Oct:* messages now name the "Billing & receipts" button instead of "Manage billing". *Changed 29 Oct:* the dashboard explains before a plan change that it applies straight away (the allowance switches to the new plan minus what was used this month, and Polar adjusts the charge), and that cancelling keeps the plan until the period ends.

**K6. Buys extra credits while subscribed**: OK
"Top up credits".

**K7. Is told in the app that a renewal payment failed**: OK
The failed status is stored *(needs new migration)*, but neither the dashboard nor the plugin shows it, and there's no "update your card" prompt. Only Polar's emails reach them. *Fixed 29 Oct:* when a renewal payment fails, the dashboard shows a banner with "Update card in Billing & receipts", the plan card says "Renewal payment failed", and the plugin dashboard shows the same warning.

**K8. Updates their card**: OK
In Polar's billing page.

**K9. Sees "renews on" vs "ends on"**: OK
One bare date with no label, the same whether the plan renews or ends. *Fixed 29 Oct:* the date is labelled: "Renews on …", "Renews yearly on …", "Ends on … no further charges" for a cancelled plan, or the Free refill date.

## L. Cancelling and refunds

**L1. Cancels**: OK
In Polar's billing page.

**L2. Sees the cancellation confirmed**: OK
Polar's email only. The dashboard shows the same bare date (K9). *Fixed 29 Oct:* after cancelling, the dashboard says "Ends on …" with "Cancelled: no further charges. Your plan and its credits stay until then."

**L3. Period ends**: OK
Drops to Free and keeps bonus and pack credits.

**L4. Changes their mind before the end**: OK
Resumes in Polar.

**L5. Subscribes again later**: OK

**L6. Asks for a refund**: OK
The terms explain the policy. Contact is by form or email. Refunds are issued by hand in Polar.

**L7. Credits after a refund**: OK
A full refund removes the plan or the unused pack credits; a partial refund removes nothing. *(Needs new migration, and refund events must be turned on in Polar.)*

**L8. Gets a refund confirmation**: OK
From Polar.

## M. Managing the account

**M1. Changes their email**: OK
Uses Supabase's plain default email. The link only works in the same browser. The stored profile email and the Polar billing email aren't updated, so receipts keep going to the old address. *Fixed 29 Oct:* a branded "Confirm your new email address" template whose link works on any device (token through /auth/confirm, which also handles the first of the two confirmations), and the dashboard now moves the profile email and the Polar billing email to the new address, so receipts follow.

**M2. Changes their password**: OK
Asks for the current password first.

**M3. Views generation history**: OK
Full and paginated. No site, image name or search.

**M4. Downloads all their data**: OK
The privacy policy promises it on request. Only the plugin's per-site CSV exists. *Fixed 29 Oct:* Account settings has "Download my data": one JSON file with the account, credits, generation history, payments, connected sites, activity and emails sent (no internal keys or IP addresses). The Privacy policy points to it.

**M5. Sees connected sites**: OK
Last seen, plugin version and language *(needs new migration)*.

**M6. Disconnects one site from the website**: OK
Not possible. Rotating the single key disconnects every site. Left this way on purpose last round. *Changed 29 Oct:* the connected-sites card explains how to disconnect one site (Disconnect account in that site's plugin Settings) and that rotating the shared key disconnects all of them. Per-site keys stay out of scope by design.

**M7. Views, copies or rotates the key**: OK
Rotating warns that every site will disconnect.

**M8. Reconnects WordPress after rotating the key**: OK
The plugin says "Reconnect account", but that leads to Settings, where only Disconnect or a paste field are offered. *Fixed 29 Oct:* after a rotation, the plugin's Settings says the saved key no longer works and offers "Reconnect account", which opens the connect window and saves the new key.

**M9. Invites team members**: **MISSING**
Worth noting for the Agency plan.

**M10. Uses one account on several sites**: OK
One shared key and credit pool. No per-site usage breakdown.

**M11. Changes plugin settings**: OK
Auto-generate, overwrite, post fill, language, completion email, context options, and export/import.

**M12. Updates the plugin**: OK
Normal WordPress updates. No "what's new" notice.

## N. Emails along the way

**N1. Confirmation email**: OK
Branded template in the repo; production use can't be confirmed from code.

**N2. Welcome email**: OK
See B11. *Fixed 29 Oct* (B11).

**N3. "Connect your site" nudge after 4 hours**: OK
Now also reaches homepage Google sign-ups (B10).

**N4. Low-credit email**: OK
See I6. *Fixed 29 Oct* (I6).

**N5. "You've run out" email**: OK
See I7. *Fixed 29 Oct* (I7).

**N6. Bulk run finished email**: OK
Counts only.

**N7. Abandoned-checkout reminder**: OK

**N8. Receipt**: OK
From Polar.

**N9. Failed-payment emails**: OK
Polar only, nothing in the app (K7). *Fixed 29 Oct:* Polar sends the payment-failure emails, and the dashboard and the plugin now show a failed-payment warning with "Update card" (K7).

**N10. Reminder before the yearly charge on annual plans**: OK
Nothing in our code. Polar may send one, but that can't be checked from code. Some countries require it. *Fixed 29 Oct:* annual subscribers get "Your yearly Alt Text Pro plan renews on …" about a week before the renewal, with how to change or cancel. Not sent after a cancellation.

**N11. Cancellation confirmation**: OK
From Polar.

**N12. Win-back email after cancelling**: OK
Cancel events are recorded, but no email uses them. *Fixed 29 Oct:* three days after a cancellation a short email explains what happens next (plan until the period ends, then Free, packs keep working), how to resume, and asks what went wrong. Not sent if the cancellation is undone or they buy again.

**N13. "Your account was deleted" email**: OK
*Fixed 29 Oct:* deleting an account sends "Your Alt Text Pro account has been deleted" with what was removed and kept, and whether the subscription was cancelled.

**N14. Unsubscribes**: OK
One click from the email. There's no setting in the dashboard to see or undo it.

## O. Getting help

**O1. Finds the docs**: OK
From the navbar, footer and dashboard. No search.

**O2. Finds troubleshooting**: OK
Connection, credits, bulk, auto-processing and plugin conflicts.

**O3. Uses the contact form**: OK
Reaches support, and replying goes straight to the customer.

**O4. Sees a support email and response time on the Contact page**: OK
The email is shown elsewhere but not on the Contact page. No response time anywhere. *Fixed 29 Oct:* the Contact page shows help@alt-text.pro and "We usually reply within one to two business days".

**O5. Gets an auto-reply after contacting support**: OK
*Fixed 29 Oct:* the contact form sends an automatic "We got your message" reply with the expected reply time and two quick fixes. It never repeats what was typed.

**O6. Contacts support while signed in**: OK
Their email isn't filled in and the account isn't attached to the message. *Fixed 29 Oct:* signed in, the form fills in the account email, says so, and attaches the verified account to the message for support.

**O7. Hits a broken link**: OK
404 page with useful links.

**O8. Hits an error**: OK
Error page with Try again and a support link.

**O9. Needs help inside the dashboard**: OK
Contact support and a help card. No live chat.

**O10. Account is suspended**: OK
The plugin message says to contact help@alt-text.pro.

## P. Leaving

**P1. Disconnects the site in the plugin**: OK
Asks to confirm, and explains that the key still works on other sites.

**P2. Deactivates the plugin**: OK
Background tasks stop; settings are kept.

**P3. Uninstalls the plugin**: OK
Removes the plugin's settings and logs; alt text stays. Leaves the per-image context field behind.

**P4. Deletes their account from the dashboard**: OK
Type the email to confirm.

**P5. Subscription stops when the account is deleted**: OK
Cancelled at once, with a daily retry if that fails. The remaining paid time is lost, and the card says so.

**P6. Is told what's deleted and what's kept**: OK
The card only says "payment records are kept". It doesn't mention Polar invoices or that alt text stays on the site. *Fixed 29 Oct:* the delete card lists what is removed and what is kept (payment records, Polar's receipts and invoices), says alt text stays on the sites, and points to Download my data first.

**P7. Gets a confirmation email**: OK
See N13. *Fixed 29 Oct* (N13).

**P8. Knows how long data is kept**: OK
The privacy policy gives no retention period. *Fixed 29 Oct:* the Privacy policy's Data Retention section now says how long each kind of data is kept.

**P9. Polar's follow-up events after deletion**: OK
This is an admin-side issue. They land in the admin "Unmatched payments" queue, where they could be assigned to the wrong account by mistake. *Fixed 29 Oct:* the admin queue marks rows from a deleted account ("From a deleted account"), asks again before assigning one, and the server refuses unless that is confirmed (assigning to a new account with the same email is allowed).

**P10. Signs up again later with the same email**: OK
A new account and checkout work. A clash with the old Polar customer record is possible but can't be checked from code. *Fixed 29 Oct:* checkout reuses an existing Polar customer with the same email instead of failing on Polar's unique-email rule. Payments still go to the new account through the checkout's user ID.
