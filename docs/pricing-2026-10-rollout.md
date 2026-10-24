# 2026-10 pricing rollout

Status: prepared locally. Nothing in Polar, Supabase production, or Netlify has been changed.

## New catalogue

| Plan | ID | Monthly | Annual (10x monthly) | Credits / month | Per credit |
|---|---|---:|---:|---:|---:|
| Free | `free` | $0 | – | 15 + 150 signup bonus (unchanged) | – |
| Starter | `tier1` | $5 | $50 | 500 | $0.010 |
| Growth (most popular) | `tier2` | $12 | $120 | 1,500 | $0.008 |
| Agency | `tier4` | $29 | $290 | 5,000 | $0.0058 |

One-time packs, open to every account including Free. Credits never expire and are spent after the monthly allowance.

| Pack | ID | Price | Credits | Per credit |
|---|---|---:|---:|---:|
| Small Credit Pack | `small_pack` | $12 | 1,000 | $0.012 |
| Library Pack | `credit_pack` | $45 | 5,000 | $0.009 |
| Bulk Pack | `bulk_pack` | $99 | 15,000 | $0.0066 |

Retired from sale: Pro (`tier3`, $14 / 2,000) and the old `pay_as_go` row. Both rows stay in `subscription_plans` with `is_active = false` because existing profiles and payments reference them.

## How existing subscribers keep their terms

- **Price:** Polar keeps each existing subscription on the product it was bought with. The old products are archived, not deleted, so renewals keep charging the old price.
- **Credits:** before the catalogue changes, the migration copies each paid subscriber's current plan credits into `profiles.monthly_credit_allowance` when it is not already set. Every credit check prefers that pinned value. The webhook keeps it while the Polar subscription ID and product ID stay the same (`resolveMonthlyAllowance` in `frontend-next/src/app/api/webhooks/polar/route.ts`).
- **Switching plans:** a subscriber who changes product or starts a new subscription moves to the new catalogue allowance.
- **Plan labels:** the dashboard shows legacy Lite and Standard subscribers as Starter and Growth because the plan IDs are shared; their price and credits are unchanged.

## Polar products to create

Create these in Polar production. Set the metadata exactly; the webhook resolves a product by its configured ID first, then by `plan_id` metadata, then by name.

| Product name | Type | Price | Metadata |
|---|---|---:|---|
| Alt Text Pro — Starter Monthly | Subscription, monthly | $5.00 | `plan_id=tier1`, `billing_cycle=monthly`, `type=subscription` |
| Alt Text Pro — Starter Annual | Subscription, yearly | $50.00 | `plan_id=tier1`, `billing_cycle=annual`, `type=subscription` |
| Alt Text Pro — Growth Monthly | Subscription, monthly | $12.00 | `plan_id=tier2`, `billing_cycle=monthly`, `type=subscription` |
| Alt Text Pro — Growth Annual | Subscription, yearly | $120.00 | `plan_id=tier2`, `billing_cycle=annual`, `type=subscription` |
| Alt Text Pro — Agency Monthly | Subscription, monthly | $29.00 | `plan_id=tier4`, `billing_cycle=monthly`, `type=subscription` |
| Alt Text Pro — Agency Annual | Subscription, yearly | $290.00 | `plan_id=tier4`, `billing_cycle=annual`, `type=subscription` |
| Alt Text Pro — Small Credit Pack | One-time | $12.00 | `plan_id=small_pack`, `credits=1000` |
| Alt Text Pro — Library Pack | One-time | $45.00 | `plan_id=credit_pack`, `credits=5000` |
| Alt Text Pro — Bulk Pack | One-time | $99.00 | `plan_id=bulk_pack`, `credits=15000` |

Do not put a `credits` key on subscription products: for annual products it would be read as the yearly total.

Then **archive** (do not delete) the old products so they cannot be bought again: Lite, Standard, Pro, and Agency (monthly and annual), Small Credit Pack ($5 / 500), and Credit Pack ($10 / 1,200). An archived old pack bought through a stale link would otherwise be granted the new pack size.

### Created in Polar production on 2026-10-24

| Netlify variable | Polar product | Product ID |
|---|---|---|
| `NEXT_PUBLIC_POLAR_TIER1_MONTHLY` | Alt Text Pro — Starter Monthly ($5) | `bba2bc4d-e4ab-4c10-8184-ba615dc5a7de` |
| `NEXT_PUBLIC_POLAR_TIER1_ANNUAL` | Alt Text Pro — Starter Annual ($50) | `fcf7be1b-839b-4d7f-a3ee-547911119e99` |
| `NEXT_PUBLIC_POLAR_TIER2_MONTHLY` | Alt Text Pro — Growth Monthly ($12) | `3d8440e2-5586-4477-b968-cb99052fa8cc` |
| `NEXT_PUBLIC_POLAR_TIER2_ANNUAL` | Alt Text Pro — Growth Annual ($120) | `dcf8db2c-bcef-4f03-b8fe-497b7bd998b8` |
| `NEXT_PUBLIC_POLAR_TIER4_MONTHLY` | Alt Text Pro — Agency Monthly (2026) ($29) | `57037d10-2e4f-4017-838c-f9ba81260c9c` |
| `NEXT_PUBLIC_POLAR_TIER4_ANNUAL` | Alt Text Pro — Agency Annual (2026) ($290) | `c4b109b1-00b1-4863-9cdb-162b33a579f8` |
| `NEXT_PUBLIC_POLAR_SMALL_PACK` | Alt Text Pro — Small Credit Pack ($12, 1,000) | `ca4c2ee0-2ae8-439c-99ab-00d2ae42a07b` |
| `NEXT_PUBLIC_POLAR_CREDIT_PACK` | Alt Text Pro — Library Pack ($45, 5,000) | `940a7c9a-ed29-4b6f-9a87-b926f27eaeb4` |
| `NEXT_PUBLIC_POLAR_BULK_PACK` | Alt Text Pro — Bulk Pack ($99, 15,000) | `5ae3f7aa-0c69-4d42-91e2-0fcc2bf116f7` |

Old products to move to `LEGACY_*` (and archive after the deploy): Lite Monthly `0803076e-e824-46af-8aba-8c2fcf686f94`, Lite Annual `0c3c64f8-f2d5-47d9-a26b-df8dca718478`, Standard Monthly `399d3406-215d-400f-8123-e77bc036f7e0`, Standard Annual `39ac4f6a-768c-4cf0-9abb-ef718c3f29b2`, Pro Monthly `1c748e2f-df80-4271-8ff4-684ffc7ceef5`, Pro Annual `4060f5a2-1676-4647-b3cc-9b060d3f3093`, Agency Monthly `e7609ba7-5fd8-4911-90d7-3fcbe1f518ad`, Agency Annual `3d6e6bc9-5b66-4b0c-ab4e-36dcfd9ebbc6`, Small Pack (500) `cc60c632-baff-4dd5-8498-00df694ce96b`, Credit Pack (1,200) `dfc5136f-64aa-4535-a6d5-d9d02036be2c`. The two "(2026)" Agency names can be renamed to plain "Agency" once the old Agency products are archived.

## Netlify environment variables

Order matters: add the legacy variables before replacing the current ones, so renewals of old products always resolve.

1. Copy each current value to a legacy name (same value):
   - `NEXT_PUBLIC_POLAR_TIER1_MONTHLY` → `NEXT_PUBLIC_POLAR_LEGACY_TIER1_MONTHLY`
   - `NEXT_PUBLIC_POLAR_TIER1_ANNUAL` → `NEXT_PUBLIC_POLAR_LEGACY_TIER1_ANNUAL`
   - `NEXT_PUBLIC_POLAR_TIER2_MONTHLY` → `NEXT_PUBLIC_POLAR_LEGACY_TIER2_MONTHLY`
   - `NEXT_PUBLIC_POLAR_TIER2_ANNUAL` → `NEXT_PUBLIC_POLAR_LEGACY_TIER2_ANNUAL`
   - `NEXT_PUBLIC_POLAR_TIER3_MONTHLY` → `NEXT_PUBLIC_POLAR_LEGACY_TIER3_MONTHLY`
   - `NEXT_PUBLIC_POLAR_TIER3_ANNUAL` → `NEXT_PUBLIC_POLAR_LEGACY_TIER3_ANNUAL`
   - `NEXT_PUBLIC_POLAR_TIER4_MONTHLY` → `NEXT_PUBLIC_POLAR_LEGACY_TIER4_MONTHLY`
   - `NEXT_PUBLIC_POLAR_TIER4_ANNUAL` → `NEXT_PUBLIC_POLAR_LEGACY_TIER4_ANNUAL`
2. Point the current names at the new products: `NEXT_PUBLIC_POLAR_TIER1_MONTHLY`, `..._TIER1_ANNUAL`, `..._TIER2_MONTHLY`, `..._TIER2_ANNUAL`, `..._TIER4_MONTHLY`, `..._TIER4_ANNUAL`, `NEXT_PUBLIC_POLAR_SMALL_PACK`, `NEXT_PUBLIC_POLAR_CREDIT_PACK`.
3. Add `NEXT_PUBLIC_POLAR_BULK_PACK`.
4. Delete `NEXT_PUBLIC_POLAR_TIER3_MONTHLY` and `NEXT_PUBLIC_POLAR_TIER3_ANNUAL` (the legacy copies keep Pro renewals mapped). Checkout already ignores them.

## Release order

Each step touching production needs its own go-ahead.

1. Commit and review this change locally. Do not push yet.
2. Read-only preflight in Supabase: count paid profiles by `subscription_plan` with and without `monthly_credit_allowance`, and confirm no profile uses a plan outside the new check constraint.
3. Create the nine Polar products. Leave the old products active for now.
4. Set the Netlify variables from steps 1–3 above. Leave step 4 until after deploy.
5. Apply `supabase/migrations/20261024120000_apply_2026_10_pricing.sql` to production. It is safe before the deploy: the live site reads plan credits through pinned allowances, and the old checkout products still map correctly. Then apply `20261024130000_change_subscription_plan_mid_period.sql` (adds a function the new webhook calls) and `20261024140000_add_payment_tax_and_refund_amounts.sql` (adds payment columns the new webhook writes). Both must be applied **before** the deploy: the new webhook inserts `tax_amount`, and an insert into a missing column would fail every order.
6. Push `main` so Netlify deploys the new code with the new variables.
7. Archive the old Polar products and delete the `TIER3` variables.
8. Verify live:
   - `/api/get-plans` returns free, tier1, tier2, tier4 and the three packs, and no tier3 or pay_as_go.
   - Homepage and dashboard show Starter / Growth / Agency and three packs.
   - A Polar sandbox or $0-discounted checkout of one plan and one pack grants 1,500 / 1,000 credits respectively.
   - One legacy subscriber's profile still shows its pinned allowance after the next renewal webhook.
   - The response for `/` now carries a `Content-Security-Policy` header with a script nonce (it was never sent before, because `proxy.ts` was outside `src/`). Open the homepage, sign-in dialog, `/connect`, `/dashboard` and `/admin` and confirm the browser console shows no "Refused to …" CSP errors and that Google sign-in still renders.

## Production checks before launch

1. **Scheduled jobs (lifecycle emails, daily funnel report): checked 2026-10-24, broken in production, fixed locally.** Netlify logs showed every run in the last day finishing in about 4 ms with no output, while the database, email and secret variables are all set. That is the secret check refusing Netlify's POST schedule event. The scheduled wrappers now add the secret for any well-formed schedule body (`next_run`); Netlify's edge refuses outside requests to scheduled functions (the public URL returns an empty 403), and the URL-reachable shared handlers still require the secret.
   - **Decided 2026-10-24: dry run first.** Set `LIFECYCLE_AUTOMATION_DRY_RUN=true` in Netlify before the first deploy, check one scheduled run in the function log (it should take hundreds of milliseconds and report candidates without sending), then set it to `false` to start real sends (up to 25 per run, every 2 hours, to users from the last 30 days).
   - **After deploying:** a run should take hundreds of milliseconds and log a result; `select max(created_at) from marketing_automation_sends;` should move forward.
2. **Password reset template: fixed in production on 2026-10-24** (subject and body replaced with `supabase/templates/recovery.html`, verified after reload). Previously: The live template is Supabase's default (`{{ .ConfirmationURL }}`, unbranded). Replace its body with `supabase/templates/recovery.html` and its subject with "Reset your Alt Text Pro password". Redirect URLs already include `https://www.alt-text.pro/**`, and the Site URL is `https://www.alt-text.pro`. Where to change it: in Supabase, Authentication → Email Templates → Reset Password. The link should be `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` (the same pattern the confirmation template uses). If it uses `{{ .ConfirmationURL }}`, the reset link only works in the browser that requested it, because the site uses the PKCE flow. `supabase/templates/recovery.html` has the ready-made template to paste in. Also confirm Authentication → URL Configuration lists `https://www.alt-text.pro/auth/confirm` under Redirect URLs.

## Production state on 2026-10-24 (read-only checks)

- Profiles: 34 Free active, 2 Free cancelled, 2 `tier2` active (both already have a pinned allowance; one has no Polar subscription ID). No legacy `tier1`, `tier3` or `tier4` subscribers, so the pricing migration's pinning step affects no rows today.
- Applied migrations end at `20260817060012`; the two 2026-10 migrations are not applied.
- `pay_as_go` is already inactive; `tier3` is still active and is retired by the pricing migration.
- Lifecycle email sends: 8 in total, the latest on 2026-08-14, which matches the scheduler having been refused since then.
- Marketing events in the last 30 days: 169, all `page_viewed`. No sign-up, checkout or purchase events were recorded in that period.
- Largest usage history for one account: 6,840 rows. No unsubscribed profiles.

## Rollback

- Code: revert the commit and redeploy. Pinned allowances are harmless to keep.
- Catalogue: re-run the 2026-08 `insert ... on conflict` values for `tier1`–`tier4`, `small_pack`, `credit_pack`, and set `tier3` and `pay_as_go` back to `is_active = true` if they should be listed again.
- Polar: unarchive the old products and restore the previous `NEXT_PUBLIC_POLAR_*` values.

## Not changed in this pass

- **WordPress plugin:** `templates/dashboard.php` still labels `tier1`/`tier2` as Lite/Standard. Changing it needs a plugin release (version 1.7.26 with header, constant, readme stable tag and changelog aligned) and a WordPress.org SVN commit.
- **Free plan:** kept at 150 signup credits plus 15 per month. That number is the headline in roughly 20 places across the site and the plugin listing.
- **Feature gating:** every plan has every feature, and the plan copy now says so. Gating features (for example multiple sites or API keys on Agency) would be separate work.
