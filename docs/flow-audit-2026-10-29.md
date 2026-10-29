# Alt Text Pro: user, billing, plugin and admin flow audit

Date: 2026-10-29. Read-only review of `main` at `b91ea87` (plugin 1.7.27). Nothing in production was touched.

Each finding is marked **verified** (re-read in code for this report) or **from code review** (traced by a reviewer, not re-checked line by line). Severity: **High** hurts revenue, data or the core promise; **Medium** is a real bug or gap users will hit; **Low** is polish.

---

## 1. The flows as they work today

### 1.1 New customer, website first

1. Visitor lands on `/` or an SEO page. Sign-in and sign-up are a modal on the homepage (`/?auth=signin|signup`); there is no `/login` page.
2. Sign-up with email (→ confirmation email → `/auth/confirm` → `/email-confirmed` → `/dashboard` after 3 s) or Google One Tap.
3. A database trigger gives 165 credits: 15 monthly plan credits plus 150 bonus credits that never expire.
4. Dashboard creates the API key on first load and shows usage, the last 5 generations, plan and a "Manage billing" link.
5. User installs the plugin and connects it (see 1.2), or pastes the key by hand.

### 1.2 New customer, plugin first (the main path)

1. Install and activate → redirect to the plugin dashboard → onboarding modal.
2. "Connect" opens a popup at `/connect?callback_url&state`. The user signs in, confirms the site's host, and the key is sent back by `postMessage`; the plugin validates it, encrypts it and acknowledges.
3. Settings: auto-generate on upload, overwrite existing, context field, site context.
4. Generation: on upload (synchronous), from the attachment edit screen's meta box, from the Posts list column, or Bulk (one image per request, polled every second, cancellable).
5. Logs page with CSV export; dashboard shows credits from `get-usage`.

### 1.3 Paying customer

1. Pricing card → signed-out choice is remembered → dashboard → `/api/checkout` (only configured products; second subscription blocked) → Polar.
2. Return to `/payment-success`, which polls Polar's checkout status only.
3. Webhooks: `order.paid` writes the payment row and grants credit packs; `subscription.active` activates the plan; `subscription.updated` renews or changes plan; `canceled` marks cancelled; `revoked` drops to Free; refunds via `order.refunded` and `refund.*`.
4. Each generation reserves a credit under a row lock, then finalizes or releases it; leftover reservations are reaped every 5 minutes.
5. Free credits renew by daily cron; annual plans get monthly refills by cron.

Prices agree across the pricing page, `get-plans`, the database, the webhook maps and Polar products.

### 1.4 Admin and operator

- Admin = an email listed in `SUPERUSER_EMAILS`, checked server-side on every admin endpoint.
- `/admin` can: list and filter users, open a read-only user detail modal, view revenue (net of tax and refunds), the marketing funnel, lifecycle email status, dry-run lifecycle emails and send test emails.
- `POST /api/delete-users` exists but has no UI.
- Automation: lifecycle emails every 2 h (5 rules, at most once per rule per person, unsubscribe honoured); daily funnel report email at 03:00 UTC.

---

## 2. Highest-impact problems

| # | Area | Problem | Severity |
|---|---|---|---|
| 1 | Plugin | Alt text written by bulk/auto-generate never reaches images inside post content, and the Posts list then says "All done" | High, verified |
| 2 | Connect | New users who sign up inside the plugin popup are never connected automatically | High, verified |
| 3 | Billing | Free accounts can get stuck as `cancelled` and stop receiving monthly credits | High, verified |
| 4 | Billing | A paid order that can't be matched to an account is parked silently; nobody is alerted | High, from code review |
| 5 | Admin | Deleting a user erases their payment history and lowers reported revenue | High, verified |
| 6 | Plugin | No output language: every site gets English alt text | High for non-English markets, verified |
| 7 | Plugin | No upgrade or buy-credits link anywhere in the plugin | Medium-high (revenue), verified |

### 2.1 Alt text doesn't reach post content (plugin)
- Bulk and upload write only `_wp_attachment_image_alt` (`class-bulk-processor.php:753-761`, `class-media-handler.php:96`).
- Images already inserted into posts carry their own `alt=""` in the post HTML. The plugin has no `the_content` / `render_block` / `wp_content_img_tag` filter, so they stay empty.
- The Posts list column counts only Media Library alt and prints "✓ All done" with no button when that is filled (`alt-text-pro.php:784-798`). The sync code at `alt-text-pro.php:1170-1209` therefore can't be reached.
- The readme promises filling empty alt attributes inside post content. For most existing sites this is the main reason to buy.
- **Fix direction:** have the column check the post HTML for empty `alt`, or add a front-end `wp_content_img_tag` filter that fills empty alt from the attachment.

### 2.2 Plugin-popup sign-up dead-ends (connect)
- After email sign-up in the popup, the page shows a toast and waits (`connect/page.tsx:628-636`). It never listens for `onAuthStateChange`.
- The confirmation link opens in a new tab with no `window.opener`, so it always falls to manual copy with the wrong message "The WordPress window closed…" (`connect/page.tsx:461-467`).
- Every brand-new plugin user who signs up by email has to copy and paste the key. This is the top of the funnel.
- **Fix direction:** in the popup, subscribe to `onAuthStateChange` and/or poll `getSession`, and continue the handoff once the email is confirmed. Alternatively, send the plugin a short-lived connect code it can redeem server-side.

### 2.3 Free accounts stuck as `cancelled` (billing)
- `revoke_subscription_access` sets `subscription_id = null`.
- `matchesSubscription` treats a null `subscription_id` as a match (`webhooks/polar/route.ts:390-392`).
- A `subscription.canceled` that arrives after `revoked` (Polar doesn't guarantee order) therefore sets the Free profile to `cancelled` (`route.ts:1030-1044`).
- `renew_monthly_credits` only renews `free` + `active`, so that user never gets monthly credits again.
- `docs/pricing-2026-10-rollout.md:111` already records 2 Free/`cancelled` profiles in production.
- The same null match lets a late `subscription.uncanceled` restore a paid plan on a revoked profile.
- **Fix direction:** never match on a null profile subscription ID; ignore `canceled`/`uncanceled` when the plan is `free`. Repair the 2 existing rows (needs your approval for a production write).

### 2.4 Unmatched paid orders are silent (billing)
- An order that can't be matched to an account goes to `payment_reconciliation`, and the webhook returns 200 so Polar never retries.
- Nothing reads, alerts on or replays that table. The customer is charged and gets nothing until someone queries the table by hand.
- **Fix direction:** an admin "Unmatched payments" view with an assign-to-user action, plus an email alert on insert.

### 2.5 User deletion destroys financial records (admin)
- `payments.user_id … on delete cascade` (`supabase/migrations/20260625140000_bootstrap_schema.sql:108`). Deleting a user removes their payments, lowers all-time revenue, and later refunds or chargebacks can't be matched.
- The audit row stores only the user ID, so afterwards you can't tell who was deleted.
- Polar is cancelled before the delete, with no rollback. Subscriptions not marked active/cancelled on the profile aren't cancelled at all.
- `marketing_events` keep the email and IP after deletion, which contradicts "all associated data deleted".
- Separately, users have no way to delete their own account (privacy/GDPR expectation), and admins have no UI for it.

### 2.6 No language option (plugin + API)
- The plugin sends only the image and context (`class-api-client.php:88-91`).
- The prompt in `generate-alt-text.js:171-188` is English-only.
- There is no setting, and the WordPress locale isn't passed.

### 2.7 No path to pay from inside the plugin
- No template or JS string links to pricing or checkout. Zero-credit messages are plain text ("…at alt-text.pro").
- The only link is "Manage Subscription" (`dashboard.php:199`), and the Bulk Start button stays enabled at 0 credits.

---

## 3. Website account flow: other findings

| Problem | Evidence | Severity |
|---|---|---|
| A signed-in user on `/connect` can't see or switch which account is connecting. Cancel then signing in as someone else shows "Connected!" with no key sent | `connect/page.tsx:388-419, 528-531, 810-813` | Medium |
| Visiting `/connect` directly shows "Connected!" and logs `connect_completed`. The dashboard's "WordPress connected" badge is "any such event ever", so it never resets after key rotation or uninstall | `connect/page.tsx:500-531`; `utils/plugin-connect-event.js:92-111` | Medium, verified |
| `/connect` shows only "Failed to fetch API key" when the key needs rotating (409 `api_key_rotation_required`); the dashboard handles it | `connect/page.tsx:454-456` | Medium |
| Signing up with an already-registered email says "check your email", but no email arrives (`identities.length === 0` not checked) | `LandingPageClient.tsx:291-293`, `connect/page.tsx:628-636` | Medium |
| Failed `get-usage` (including expired session) silently shows 0 credits, Free plan; dashboard doesn't react to sign-out in another tab | `dashboard/page.tsx:436-467` | Medium |
| "Manage billing" is hidden for Free users who bought credit packs (no receipts), and for paid users when `get-subscription` fails | `dashboard/page.tsx:1124, 194-214` | Medium |
| Expired/used confirmation link: no resend or sign-in button; "Continue" loops to another failure page | `auth/confirm/page.tsx:123-131` | Low-medium |
| `/reset-password` still accepts `access_token`/`refresh_token` from the URL and calls `setSession` | `reset-password/page.tsx:37-56` | Low |
| Reset-password buttons go to `/` instead of `/?auth=signin`; customer-offer sign-in has no "forgot password" | `reset-password/page.tsx:190-199` | Low |
| Analytics records `window.location.search` on `/auth/confirm` before it is cleared, so the used `token_hash` goes to gtag/Plausible/Meta | `lib/analytics.ts:141`; `auth/confirm/page.tsx:65 vs 73` | Low |
| No custom `not-found.tsx`, `error.tsx` or `global-error.tsx` | `frontend-next/src/app/` | Low, verified |

**Missing:** user account deletion; change email or password from the dashboard; full generation history (shows 5 of 20 rows, no paging); per-site API keys or a list of connected sites (one key per account, so rotating it disconnects every site); server-side route protection (dashboard flashes before redirect).

---

## 4. Billing and credits: other findings

| Problem | Evidence | Severity |
|---|---|---|
| Mid-period upgrade subtracts **all** usage this cycle (including bonus and pack credits spent) from the new allowance. Example: Starter user who used 500 plan + 300 pack credits upgrades to Growth and gets 700, not 1,000 | `20261024130000_change_subscription_plan_mid_period.sql:119-140` (usage_logs has no credit-source column) | Medium, verified |
| Partial refunds: `processRefund` overwrites `partially_refunded` with `refunded`. Revenue can count as 0. A partial refund with "revoke benefits" removes the whole pack or downgrades the plan | `route.ts:504-509, 1201-1208` | Medium |
| `order.refunded` always revokes access on full refund even when you chose to keep benefits; `refund.*` honours the choice | `route.ts:1223-1227` | Low-medium |
| No past-due handling: non-active `subscription.updated` is ignored, so a failing card keeps showing an active paid plan | `route.ts:1276` | Low-medium |
| Annual plans get 13 refills a year (monthly cron on days 30…360, plus the renewal on day 365) | `20260806143048:651-664` | Low |
| Activation can null out `polar_customer_id` if the payload lacks it, which breaks the customer portal | `20260817055942:91`; `customer-portal/route.ts:42` | Low |
| `/payment-success` only checks Polar's status, not whether the account was credited; dashboard doesn't poll after return | `payment-success/page.tsx:33-92` | Low |
| Email fallback matching uses `ilike … limit 1` on non-unique emails and can scan all auth users per event | `route.ts:184-253` | Low |
| `get-subscription` under-reports credits (ignores bonus/pack) | `get-subscription.js:73-109` | Low |
| Repeated webhooks create duplicate marketing events for cancel/refund/revoke | no unique index | Low |

**Works correctly:** signup credits, free renewal, purchase, renewals, duplicate webhook delivery, release on failed generation, rollover of bonus and pack credits, price consistency.

---

## 5. WordPress plugin: other findings

| Problem | Evidence | Severity |
|---|---|---|
| A bulk run only stops on `no_credits`. 401/403/500 errors are logged per image and the run keeps going. The API key validator returns null on any DB error, which the API reports as 401 "invalid key", so a brief Supabase outage fails the whole queue and the settings page refuses a valid key | `class-bulk-processor.php:650, 701, 773-787`; `api-key-validator.js:131-210`; `class-settings.php:167` | Medium |
| Auto-generate failures (no credits, bad key) are stored in transients that nothing reads, so they fail silently | `class-media-handler.php:102-123` | Medium |
| Generate-on-upload runs synchronously, up to 60 s per image. This slows multi-file uploads, imports, WooCommerce CSV and `media_sideload_image` | `class-media-handler.php:53`; `class-api-client.php:427` | Medium |
| No Generate button in the Media Library grid modal, block editor media modal or list view; only the full attachment edit screen | `class-admin.php:23` (hook removed; `add_alt_text_field` is dead code) | Medium |
| A bulk run can't be resumed after closing the tab; restarting says "already in progress" for up to 15 min; other admins can't cancel it; no leave-page warning | `admin.js:912`; `class-bulk-processor.php:27, 66-68, 1603-1607` | Medium |
| SVG and other non-image `image/*` types show Generate and then fail with "no permission"; bulk queues them and they use up the credit-capped count | `alt-text-pro.php:627`; `class-bulk-processor.php:915, 135` | Low-medium |
| "Send context" setting is registered but never rendered, so users can't opt out of sending titles and filenames; the batch-size field does nothing | `class-settings.php:117-123`, bulk uses 1 | Low |
| Posts-list generation drops the site context | `alt-text-pro.php:1322` | Low |
| Logs search filters only the 20 visible rows | `alt-text-pro.php:583-588` | Low |
| Onboarding modal reopens on every load until a key exists ("later" isn't remembered) | `admin.js:548-556` | Low |
| 429 ignores `Retry-After`; the 60/min per-IP limit is shared by every site on one shared-hosting IP | `class-api-client.php:546-549`; `generate-alt-text.js:25` | Low |
| Most JS UI strings are hard-coded English (not translatable) | `admin.js` throughout | Low |
| Disconnect/uninstall delete only the local key; it stays valid on the service | `class-settings.php:343-359` | Low |
| Bulk completion email is always sent, not optional, not disclosed, and `esc_html__` turns quotes into entities in a plain-text email | `class-bulk-processor.php:1617-1648` | Low |
| "Selected" mode only lists the 50 newest images missing alt; you can't pick images to regenerate | `class-admin.php:520-524` | Low |

**Solid:** nonce and capability checks on every AJAX action; images always sent as base64 (works on localhost/staging/private sites), downscaled and re-encoded; encrypted key storage; safe connect handshake; one billable image per bulk request with accurate cancellation; multisite handled.

---

## 6. Admin, operations and automation: other findings

**Missing operator tools (Medium):**
- Grant or adjust credits with an audit trail (`grant_promotional_credits` exists but nothing calls it).
- Refund, comp a plan, block a user, revoke or rotate a user's key, impersonate.
- Look up a user by site URL (not stored anywhere), API key or Polar ID.
- An unmatched-payments queue (see 2.4).
- Generation errors and logs, MRR, plugin version distribution, audit log viewer.

| Problem | Evidence | Severity |
|---|---|---|
| Admin is any account whose email is in `SUPERUSER_EMAILS`; no `email_confirmed_at`, MFA or DB role check. If production allows unconfirmed sign-in, or a listed email has no account yet, whoever registers it becomes admin | `admin-get-users.js:168` (same in 4 other files); local `config.toml` has confirmations off | High if production confirmations are off, otherwise Low. Verified in code; check the production Supabase setting |
| A lifecycle email that fails or times out is never retried (pending/failed rows count as sent); runs return `success:true` even when every send fails or email isn't configured | `lifecycle-automation.js:247-271, 321-327` | Medium |
| Reports and lifecycle runs throw after 100k event rows. Anonymous `page_viewed` writes are allowed at 120/min per IP, so one IP can push the funnel past the limit and stop all lifecycle emails | `paginated-query.js:50-51`; `track-event.js:143` | Medium |
| One email per person is picked **before** filtering ones already sent, so a sent higher-priority email blocks the next one for 30 days | `lifecycle-automation.js:267-271` | Low |
| Any user can post `connect_completed` with any `plugin_version`; anonymous events can set any source and path, which pollutes admin stats | `track-event.js:43-47, 168` | Low |
| Unsubscribe happens on GET (email scanners can trigger it), tokens never expire, and there is no `List-Unsubscribe` header | `unsubscribe-lifecycle.js:22`; `lifecycle-automation.js:221-227` | Low |
| Funnel stage order puts "Plugin downloaded" after "Connect completed"; the period comparison is computed but never shown | `marketing-funnel.js:2-11, 345-348` | Low |
| Users tab loads every profile, payment and usage row into the browser and joins them in O(n²) | `admin-get-users.js:280-287` | Low now, grows with users |
| Sentry isn't flushed in scheduled/admin functions, so errors may be lost; no alert when a scheduled job returns 500 | `error-reporter.js:167-193` | Low |

**Solid:** server-side admin authorization; at-most-once lifecycle sends; unsubscribe honoured; timing-safe secrets on scheduled jobs; net revenue figures; marketing tables locked down by RLS.

---

## 7. Suggested order of work

1. **Quick wins with direct revenue or retention impact:** upgrade/buy links in the plugin (2.7); surface auto-generate errors; stop bulk on auth/server errors and make the key validator return 503 on DB errors.
2. **Core promise:** fill alt inside post content (2.1).
3. **Funnel:** popup sign-up completes the connection (2.2); "already registered" message; account switching on `/connect`.
4. **Billing correctness:** null-match fix for cancel/uncancel and repair of the 2 affected rows (2.3); unmatched-payment alert and admin view (2.4); upgrade credit math; partial refunds.
5. **Admin:** credit grants via the existing RPC; keep payments on deletion (`on delete set null` and store the email in the audit row); user self-service deletion; require a confirmed email for admin.
6. **Market expansion:** output language setting (2.6); per-site keys.
7. Everything marked Low.

Production data fixes (the 2 Free/`cancelled` profiles) and checking the production Supabase "confirm email" setting need your explicit go-ahead.
