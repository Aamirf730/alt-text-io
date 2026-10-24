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
5. Apply `supabase/migrations/20261024120000_apply_2026_10_pricing.sql` to production. It is safe before the deploy: the live site reads plan credits through pinned allowances, and the old checkout products still map correctly.
6. Push `main` so Netlify deploys the new code with the new variables.
7. Archive the old Polar products and delete the `TIER3` variables.
8. Verify live:
   - `/api/get-plans` returns free, tier1, tier2, tier4 and the three packs, and no tier3 or pay_as_go.
   - Homepage and dashboard show Starter / Growth / Agency and three packs.
   - A Polar sandbox or $0-discounted checkout of one plan and one pack grants 1,500 / 1,000 credits respectively.
   - One legacy subscriber's profile still shows its pinned allowance after the next renewal webhook.

## Rollback

- Code: revert the commit and redeploy. Pinned allowances are harmless to keep.
- Catalogue: re-run the 2026-08 `insert ... on conflict` values for `tier1`–`tier4`, `small_pack`, `credit_pack`, and set `tier3` and `pay_as_go` back to `is_active = true` if they should be listed again.
- Polar: unarchive the old products and restore the previous `NEXT_PUBLIC_POLAR_*` values.

## Not changed in this pass

- **WordPress plugin:** `templates/dashboard.php` still labels `tier1`/`tier2` as Lite/Standard. Changing it needs a plugin release (version 1.7.26 with header, constant, readme stable tag and changelog aligned) and a WordPress.org SVN commit.
- **Free plan:** kept at 150 signup credits plus 15 per month. That number is the headline in roughly 20 places across the site and the plugin listing.
- **Feature gating:** every plan has every feature, and the plan copy now says so. Gating features (for example multiple sites or API keys on Agency) would be separate work.
