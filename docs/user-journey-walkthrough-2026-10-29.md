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

There are 186 steps across 16 sections: 120 OK, 42 PARTIAL, 24 MISSING (21 different gaps, 3 of which are listed in two sections) and 0 BROKEN. Before the 29 Oct fixes: 109 OK, 48 PARTIAL, 27 MISSING and 2 BROKEN.

| Step | What's missing or broken |
|---|---|
| A5 | Reviews, ratings, install count or testimonials on the website |
| B11 | Welcome email after a free sign-up |
| B14 | Getting-started checklist in the dashboard |
| C11 | "Set a password" for Google-only accounts |
| E10 | Plugin showing which account the site is connected to |
| F2 | Generate from the Media Library list view (row or bulk action) |
| G6 | Bulk runs that keep going without the browser tab open |
| G14 | Undo a bulk run |
| G15 | Bulk filters by date, post, category or WooCommerce products |
| H5 | Filling image title, caption or description |
| H6 | Approving bulk or auto results before they go live |
| H7 | Multilingual sites (WPML or Polylang) |
| H8 | Marking one image as decorative |
| I7 | "You've run out of credits" email |
| K7 | In-app warning when a renewal payment fails |
| M4 | Self-service data export |
| M9 | Team members |
| N10 | Reminder before an annual renewal (unless Polar sends one) |
| N12 | Win-back email after cancelling |
| N13 | "Your account was deleted" email |
| O5 | Auto-reply after contacting support |

---

## Still open

Collected during the one-by-one review (sections A and B so far). Tick an item off when it is done, and add new ones as the review goes on.

**Left as they are for now (decide later)**

- [ ] **A5:** no reviews, ratings, install count or testimonials on the website. Left out on purpose while the plugin has about 10 installs and no ratings.
- [ ] **A13:** Privacy doesn't name the email delivery provider. Needs the provider's name.
- [ ] **A3:** email sign-ups that need confirmation still lose the homepage demo image. Only email sign-in and Google keep it.
- [ ] **A8:** no "how many credits do I need" calculator. A worked example and the plugin's Bulk page cover it for now.
- [ ] **A10:** the Alt Text Simulator stays a scripted demo, not a real generator.
- [ ] **B2:** the 6-character password minimum is a live Supabase setting. Raising it needs approval to change production.

**Done in code but not seen working yet**

- [ ] **A3:** the demo resuming after sign-in. Needs a real account.
- [ ] **A15:** the tax note in the dashboard upgrade window. Needs a signed-in account.
- [ ] **A8:** the plugin Bulk page's "credits needed" box. Needs a WordPress site. The plugin's PHP tests have not been run (no PHP on this machine).
- [ ] **B4:** the real "account already exists" reply from Supabase.
- [ ] **B5:** a real sign-up, resend and rate-limit reply from Supabase. The connect window and customer offer page changes were checked by tests only, not looked at in the browser.

**Release steps not done**

- [ ] Commit the B2, B4 and B5 fixes (A2 to A15 are committed).
- [ ] Push the branch and deploy the website. None of the 29 Oct website fixes are live.
- [ ] Release plugin 1.7.28 to WordPress.org (Bulk page credits box, readme wording).
- [ ] Apply the 8 database migrations to production (the steps marked *needs new migration*).

**Noticed during A and B, belongs to a later step**

- [ ] **C:** signing in with the wrong password shows Supabase's bare "Invalid login credentials", with no hint for accounts that use Google.
- [ ] **B9:** the expired-link page's "Resend confirmation email" button has no 60-second countdown like the sign-up forms now have.
- [ ] Supabase's project-wide "Email rate limit exceeded" error is shown as is on all sign-up forms.

---

## A. Finding and evaluating Alt Text Pro

**A1. Reads the homepage**: OK
The headline says what it is. Two buttons: "Start with 150 free credits" and "Install the WordPress plugin".

**A2. Sees how it works**: OK
A three-step section (install and connect, generate, review and save) with example alt text. *Fixed 29 Oct:* the step 1 picture was a website file-upload box, which suggested images are uploaded on the website. It now shows the plugin's Connect Account card, and the text no longer says to create an account first.

**A3. Tries it on their own image before signing up**: PARTIAL
They can pick an image on the homepage, but generating needs an account. After signing up they're sent to the dashboard and the image is lost (`LandingPageClient.tsx:179-186, 302`). *Fixed 29 Oct:* when the sign-in form was opened from the demo, signing in (email or Google) now keeps them on the homepage and generates alt text for their image. Email sign-ups that need confirmation still lose the image.

**A4. Tries a large phone photo in the homepage demo (signed in)**: OK
The homepage sends the full-size image without resizing. The dashboard resizes to 1600 px / 3 MB because of the server's size limit. A big photo will likely fail with "Invalid response from server." (not tried) (`LandingPageClient.tsx:140-213`, `dashboard/page.tsx:42-43`). *Fixed 29 Oct:* the homepage now uses the same shrink step as the dashboard (`lib/prepare-image.ts`). A 39 MB test image was sent as a 0.67 MB, 1600 × 1200 JPEG.

**A5. Sees reviews, star ratings, install count or testimonials**: **MISSING**
The footer only says "Available on WordPress.org / Payments by Polar / Secure connection".

**A6. Compares plans, monthly vs annual**: OK
Free, Starter $5, Growth $12 and Agency $29, with an annual toggle showing "2 months free". *Changed 29 Oct:* the per-image price line was removed from the plan cards (it showed the monthly rate even on annual).

**A7. Understands the free tier**: OK
150 credits on sign-up that never expire, plus 15 each month.

**A8. Works out what to buy for 800 images**: PARTIAL
Credit packs are shown ($12 for 1,000 and up). There's no "how many credits do I need" helper. *Fixed 29 Oct:* the pricing section now has a worked example (800 images: 150 free credits plus the $12 pack), and the plugin's Bulk page compares images missing alt text with credits and says how many more are needed.

**A9. Reads the FAQ**: OK
Six questions on the homepage, more in the docs. *Changed 29 Oct:* two questions added, "Will it replace alt text I already wrote?" and "What happens to my images?", so there are now eight.

**A10. Tries the Alt Text Simulator**: PARTIAL
A scripted demo. It doesn't generate anything real and has no sign-up button. *Fixed 29 Oct:* the page now ends with "Start with 150 free credits" and "Install the WordPress plugin" buttons, and the "No alt text" keywords say png instead of jpg. It stays a teaching page, not a generator.

**A11. Reads the docs**: OK
Getting started, installation, features, pricing, troubleshooting and FAQ. *Fixed 29 Oct:* the button is now called "Connect Account" (docs and readme), the settings list matches the plugin (batch size removed, five newer settings added, the "Test" button named correctly), AVIF and HEIC are listed, the API error example matches the real reply, the two misleading troubleshooting headings were renamed, the quick start no longer says to create an account first, and bulk is described as one image at a time.

**A12. Opens the WordPress.org listing**: OK
Linked from the hero, footer and guide pages.

**A13. Checks the trust pages (privacy, terms, about, contact)**: OK
All four exist and are linked from the footer. *Fixed 29 Oct: added the About link.* *Also fixed 29 Oct:* the operator is named (Alt Text Pro, India) on About, Privacy and Terms; Terms gained "governed by the laws of India" and no longer contradict themselves on refunds; Privacy covers Google sign-in and says emails come from help@alt-text.pro; Contact shows the email address. Still open: the email delivery provider is not named.

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
The repo has a branded template. Whether production uses it can't be confirmed from code.

**B7. Clicks the link, possibly on another device**: OK
Works across devices, then goes to /email-confirmed and on to the dashboard.

**B8. Goes back to the original tab after confirming in another one**: PARTIAL
That tab stays on "Confirm your email" and doesn't move on. The plugin's connect window handles this; the homepage doesn't.

**B9. Clicks an expired or used link**: OK
Clear message, a resend form and a sign-in button.

**B10. Signs up with Google on the homepage**: OK
New Google accounts are now recorded as sign-ups, so they get the "connect your site" email and appear in the funnel. Returning Google users aren't counted again, on the homepage or in the connect window. *Fixed 29 Oct.*

**B11. Gets a welcome email right after signing up**: **MISSING**
The first email is a "connect your site" nudge 4 hours later, only if they haven't connected.

**B12. Picks a paid plan before having an account**: OK
The choice is kept for 24 hours and reopens in the dashboard. It's lost if they confirm in a different browser.

**B13. Sees the dashboard for the first time**: PARTIAL
*Fixed 29 Oct:* new users now see "Welcome", and the banner says to install from WordPress.org and click Connect Account. Still only one banner linking to the docs (see B14).

**B14. Follows a getting-started checklist (install, connect, first image, bulk)**: **MISSING**

**B15. Tries generating in the dashboard before installing the plugin**: OK
Upload one image; it's resized and alt text is generated.

## C. Signing in later and keeping access

**C1. Signs in**: OK

**C2. Types the wrong password**: OK
Shows "Invalid login credentials".

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

**C9. Signs out on one computer**: PARTIAL
It signs them out on every device, because the sign-out is global (`Navbar.tsx:90`, `dashboard/page.tsx:263`). Plugin keys aren't affected.

**C10. Google-only account tries a password**: PARTIAL
Generic "Invalid login credentials", with no "you signed up with Google" hint.

**C11. Google-only account sets a password**: **MISSING**
Left out on purpose last round. The password section is hidden for these accounts.

## D. Getting and installing the plugin

**D1. Installs from WordPress.org**: OK

**D2. Downloads the ZIP instead**: OK
From the docs and the dashboard. The ZIP is built during deploy.

**D3. Reads install instructions**: OK
Both methods are in the docs, plus the WordPress 5.0 / PHP 7.4 requirement.

**D4. Dashboard tells them what to do next**: PARTIAL
Only a docs link. No "Install from WordPress.org" button, and the ZIP is far down the page.

**D5. Follows the readme setup steps**: PARTIAL
The readme says to click "Connect to Alt Text Pro". The buttons are actually labelled "Connect Account" and "Start onboarding".

**D6. Activates the plugin and lands somewhere useful**: OK
Goes straight to the plugin's dashboard (not on network or bulk activation).

**D7. Sees a welcome or connect window**: OK
Opens automatically until connected or dismissed.

**D8. Closes the window ("later")**: PARTIAL
The plugin dashboard then has no Connect button. They have to go through Settings.

**D9. Finds the plugin in the admin menu**: OK
"Alt Text Pro" with Dashboard, Bulk Process, Settings and Usage & Logs.

**D10. Sees a reminder on other admin pages**: OK
The "configure your API key" notice has a "Don't show again" link, remembered for each user. *Fixed 29 Oct.*

**D11. Server can't store the key securely**: PARTIAL
No check up front. They only find out after signing in, with an AUTH_KEY/OpenSSL error.

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

**E10. Sees which account the site is connected to**: **MISSING**
The plugin never shows the account email. The server returns it (`class-settings.php:638`), but the plugin only shows the plan and credits.

**E11. Switches to another account**: PARTIAL
They must Disconnect first or paste a new key. "Start onboarding" is hidden once a key exists.

**E12. Service is down while connecting**: OK
The key is saved as "unverified", with a hint to test it later.

**E13. Sees the site appear in the website dashboard**: PARTIAL
The connected-sites list doesn't refresh until the page is reloaded *(needs new migration)*.

## F. First alt text

**F1. Generates for one image in the Media Library grid or image window**: OK

**F2. Generates from the Media Library list view (row action or bulk action)**: **MISSING**
There's nothing in the list view. They have to open each image.

**F3. Generates on the full image edit screen**: OK
Side box, then Apply, then Update.

**F4. Generates from the image block in the block editor**: PARTIAL
Only through the media window when choosing or replacing an image.

**F5. Reviews the draft before it's saved**: OK
Single images give a draft and an Apply button.

**F6. Generates a draft but never clicks Apply**: PARTIAL
The credit is used anyway, and it's logged as "generated" although the image still has no alt text.

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

**F12. Key is invalid or has been rotated**: PARTIAL
Shows "Invalid API key…" with no link to Settings.

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

**H4. Page builders (Elementor, Divi and others)**: PARTIAL
Only images inside normal post content are covered. Builders that store their own alt text aren't.

**H5. Image title, caption or description filled too**: **MISSING**

**H6. Approves bulk or auto results before they go live**: **MISSING**
Bulk, auto-upload and post-level runs write straight to the live site. The only check afterwards is the Logs list.

**H7. Multilingual site (WPML or Polylang)**: **MISSING**
One language for the whole site.

**H8. Marks one image as decorative (empty alt on purpose)**: **MISSING**
The only option is to turn off the post fill for the whole site.

## I. Running out of free credits

**I1. Knows what Free includes**: OK
150 once, plus 15 a month.

**I2. Knows when the free credits refill**: OK
The dashboard shows "Free credits refill around <date>", 30 days after the last refill. *Fixed 29 Oct (it said "No renewal scheduled").* The plugin doesn't show the date.

**I3. Hits 0 in the plugin (single or bulk)**: OK
Clear stop, a buy link, and Bulk Start is disabled.

**I4. Auto-generate fails on upload at 0**: OK
A notice with a buy link on the next admin page.

**I5. Gets a low-credit warning in WordPress**: PARTIAL
At 10 or fewer, but only on the plugin's own dashboard page.

**I6. Gets a low-credit email**: PARTIAL
Sent at 5 credits, the same threshold for every plan, and only once per person ever, so a subscriber is never warned again in later months (`bootstrap_schema.sql:218`).

**I7. Gets a "you've run out" email**: **MISSING**

**I8. Goes from the plugin to paying**: OK
Links go to the pricing section. The chosen plan is remembered through sign-in.

## J. Paying

**J1. Chooses a plan, billing cycle or credit pack**: OK
Packs work on Free too.

**J2. Goes through checkout**: OK
Polar checkout. A second subscription is blocked.

**J3. Uses a discount code**: OK
Polar-hosted. Depends on Polar settings.

**J4. Gets correct VAT and a company invoice**: PARTIAL
Polar handles tax and invoices. Our site never mentions tax (see A15).

**J5. Backs out of checkout**: PARTIAL
A /payment-cancelled page exists, but nothing links to it and checkout doesn't return there.

**J6. Card is declined**: OK
Handled in Polar checkout, and the success page handles failed or expired payments.

**J7. Sees the success page and the credits arrive**: OK
Waits until the account is updated. If it takes longer, the dashboard keeps checking and offers a support link.

**J8. Gets a receipt**: OK
From Polar.

**J9. Gets our post-purchase email**: PARTIAL
"Welcome to Alt Text Pro" includes a plugin download link, although they already have the plugin.

**J10. Abandons checkout and gets a reminder**: OK
Sent after 1 hour.

## K. Being a subscriber

**K1. Monthly renewal refills credits**: OK

**K2. Annual plan refills every month**: PARTIAL
12 refills a year *(needs new migration)*. The next monthly refill date isn't shown.

**K3. Checks usage**: OK
Used, limit and extra balance, plus full history.

**K4. Knows whether unused credits roll over**: OK
Plan credits reset; bonus and pack credits stay. Stated in the terms and the dashboard.

**K5. Upgrades or downgrades**: PARTIAL
Only through Polar's billing page. A downgrade cuts credits at once. *Fixed 29 Oct:* messages now name the "Billing & receipts" button instead of "Manage billing".

**K6. Buys extra credits while subscribed**: OK
"Top up credits".

**K7. Is told in the app that a renewal payment failed**: **MISSING**
The failed status is stored *(needs new migration)*, but neither the dashboard nor the plugin shows it, and there's no "update your card" prompt. Only Polar's emails reach them.

**K8. Updates their card**: OK
In Polar's billing page.

**K9. Sees "renews on" vs "ends on"**: PARTIAL
One bare date with no label, the same whether the plan renews or ends.

## L. Cancelling and refunds

**L1. Cancels**: OK
In Polar's billing page.

**L2. Sees the cancellation confirmed**: PARTIAL
Polar's email only. The dashboard shows the same bare date (K9).

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

**M1. Changes their email**: PARTIAL
Uses Supabase's plain default email. The link only works in the same browser. The stored profile email and the Polar billing email aren't updated, so receipts keep going to the old address.

**M2. Changes their password**: OK
Asks for the current password first.

**M3. Views generation history**: OK
Full and paginated. No site, image name or search.

**M4. Downloads all their data**: **MISSING**
The privacy policy promises it on request. Only the plugin's per-site CSV exists.

**M5. Sees connected sites**: OK
Last seen, plugin version and language *(needs new migration)*.

**M6. Disconnects one site from the website**: PARTIAL
Not possible. Rotating the single key disconnects every site. Left this way on purpose last round.

**M7. Views, copies or rotates the key**: OK
Rotating warns that every site will disconnect.

**M8. Reconnects WordPress after rotating the key**: PARTIAL
The plugin says "Reconnect account", but that leads to Settings, where only Disconnect or a paste field are offered.

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

**N2. Welcome email**: **MISSING**
See B11.

**N3. "Connect your site" nudge after 4 hours**: OK
Now also reaches homepage Google sign-ups (B10).

**N4. Low-credit email**: PARTIAL
See I6.

**N5. "You've run out" email**: **MISSING**
See I7.

**N6. Bulk run finished email**: OK
Counts only.

**N7. Abandoned-checkout reminder**: OK

**N8. Receipt**: OK
From Polar.

**N9. Failed-payment emails**: PARTIAL
Polar only, nothing in the app (K7).

**N10. Reminder before the yearly charge on annual plans**: **MISSING**
Nothing in our code. Polar may send one, but that can't be checked from code. Some countries require it.

**N11. Cancellation confirmation**: OK
From Polar.

**N12. Win-back email after cancelling**: **MISSING**
Cancel events are recorded, but no email uses them.

**N13. "Your account was deleted" email**: **MISSING**

**N14. Unsubscribes**: OK
One click from the email. There's no setting in the dashboard to see or undo it.

## O. Getting help

**O1. Finds the docs**: OK
From the navbar, footer and dashboard. No search.

**O2. Finds troubleshooting**: OK
Connection, credits, bulk, auto-processing and plugin conflicts.

**O3. Uses the contact form**: OK
Reaches support, and replying goes straight to the customer.

**O4. Sees a support email and response time on the Contact page**: PARTIAL
The email is shown elsewhere but not on the Contact page. No response time anywhere.

**O5. Gets an auto-reply after contacting support**: **MISSING**

**O6. Contacts support while signed in**: PARTIAL
Their email isn't filled in and the account isn't attached to the message.

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

**P6. Is told what's deleted and what's kept**: PARTIAL
The card only says "payment records are kept". It doesn't mention Polar invoices or that alt text stays on the site.

**P7. Gets a confirmation email**: **MISSING**
See N13.

**P8. Knows how long data is kept**: PARTIAL
The privacy policy gives no retention period.

**P9. Polar's follow-up events after deletion**: PARTIAL
This is an admin-side issue. They land in the admin "Unmatched payments" queue, where they could be assigned to the wrong account by mistake.

**P10. Signs up again later with the same email**: PARTIAL
A new account and checkout work. A clash with the old Polar customer record is possible but can't be checked from code.
