# Pricing & Packages Update — Implementation Plan (2026-08)

**Audience:** developer implementing the change
**Author:** prepared from a full audit of the current codebase (branch `codex/current-alt-text-1.7.14`)
**Status:** ready to implement — no code has been changed yet

---

## 0. TL;DR — what we are changing

### New public catalogue

| Plan | id | Monthly | Yearly (−10%) | Effective /mo | Credits / month | Credits / year |
|---|---|---|---|---|---|---|
| Free | `free` | $0 | $0 | $0 | **15** | 180 |
| Lite | `tier1` | **$4** | **$43.20** | $3.60 | 150 | 1,800 |
| Standard ⭐ | `tier2` | **$9** | **$97.20** | $8.10 | **1,000** | 12,000 |
| Pro | `tier3` | **$14** | **$151.20** | $12.60 | **2,000** | 24,000 |
| Agency (new) | `tier4` | **$19** | **$205.20** | $17.10 | **3,500** | 42,000 |

### New credit packs (one-time, never expire unless consumed)

| Pack | id | Price | Credits — was | Credits — new | Per credit |
|---|---|---|---|---|---|
| Starter / Small Pack | `small_pack` | $5 | 100 | **500** | $0.0100 |
| Value / Credit Pack | `credit_pack` | $10 | 250 | **1,200** | $0.0083 |

Prices are unchanged — only the credit amount goes up. These land in `purchased_credits_remaining`, which is already a persistent ledger: never reset by a renewal, a plan change, a downgrade, or a refund of a *different* purchase. They are only reduced by actual usage. No code change is needed to make them non-expiring; that is already the behaviour.

> **Pricing note, stated once and then implemented as asked:** at the new rates a pack costs $0.0083–$0.0100 per credit, while the Standard subscription costs $0.0090 and Lite costs $0.0267. The $10 pack is therefore *cheaper per credit than every subscription*, and 1,200 one-time credits outweigh a full month of Standard (1,000). Expect some substitution away from Lite and Standard toward repeat pack purchases. If that is intentional (packs as the volume-flexible product), nothing needs to change — the plan below implements the numbers exactly as specified.

### New free-account rules

1. **15 credits per month** on the free plan (down from 30). Resets every 30 days, does **not** roll over.
2. **150 signup credits, granted instantly at account creation**, stored in the persistent **bonus** ledger so they **never expire** and are **never reset** by a monthly renewal, a plan change, a downgrade, or a refund. They are only reduced by actual usage.

### Spending order (already implemented, do not change)

`plan allowance → bonus credits → purchased credits`
(see `public.reserve_credit()` in `supabase/migrations/20260806143048_reserve_credits_before_ai_generation.sql`)

So a new user sees **165 credits** on day 1: 15 plan + 150 bonus. In month 2 they see 165 again only if they never generated anything; otherwise 15 + whatever bonus is left.

### The hard constraint

> **Existing paying customers must keep the price AND the credit allowance they bought.**

This is not automatic. Section 3 explains exactly why, and Sections 4 & 6 implement it. **Do not skip them.**

---

## 1. Scope

**In scope**

- Polar product catalogue (manual dashboard work)
- Credit-pack credit amounts ($5 → 500, $10 → 1,200; prices unchanged)
- Supabase: `subscription_plans` rows + the `subscription_plan` CHECK constraint + 3 database functions + 1 new column + backfills
- `frontend-next` webhook / plan-mapping / credit-limit code
- `frontend-next` pricing UI, dashboard upgrade modal, marketing copy, docs, terms
- `netlify-functions` credit-limit map
- WordPress plugin plan labels + allowed-plan list
- Tests

**Out of scope (do not touch)**

- The credit reservation / finalize / release engine — it is correct and plan-agnostic
- `usage_logs`, `credit_pack_grants`, `payment_reconciliation` behaviour
- Credit-pack **prices** ($5 and $10 stay) and the two Polar pack products
- The legacy `pay_as_go` plan row ($5 / 550). It is not purchasable — no env var, no UI, and `netlify-functions/get-plans.js` (the only endpoint that would expose it) has **no consumer in the codebase**. Historical `payments.plan_id` rows may reference it, so do **not** delete it.
- The WPGeared 1,000-credit campaign (`campaign_offer_eligibility`) — it uses the same bonus ledger and keeps working unchanged
- `alt-text-pro-new-design/` (prototype folder, not deployed — `netlify.toml` publishes `frontend-next/.next`)
- The legacy hidden pricing block in `frontend-next/src/app/page.tsx` (`<section id="legacy-pricing" className="hidden ...">`, ~lines 822–1100). It is dead markup. Updating it is optional; deleting it is a separate cleanup PR.

---

## 2. How the system works today (read before editing)

Understanding these five facts prevents every likely mistake.

1. **`profiles.credits_remaining` is an aggregate, not the plan balance.**
   Invariant everywhere in the codebase:
   `credits_remaining = (plan allowance left this cycle) + bonus_credits_remaining + purchased_credits_remaining`
   Any code that writes `credits_remaining` must re-add the two persistent ledgers. Every existing writer already does.

2. **Three ledgers, different lifetimes.**
   | Ledger | Column | Lifetime |
   |---|---|---|
   | Plan allowance | derived (not stored directly) | resets every cycle, no rollover |
   | Bonus / promotional | `bonus_credits_remaining` | persistent, never reset — **this is where the 150 signup credits go** |
   | Purchased packs | `purchased_credits_remaining` | persistent, never reset |

3. **The monthly limit is resolved as `coalesce(nullif(profiles.monthly_credit_allowance, 0), subscription_plans.credits, 0)`.**
   Used by `reserve_credit()`, `finalize_credit_reservation()`, and `netlify-functions/utils/api-key-validator.js → getMonthlyCreditState()`.
   → **A per-profile `monthly_credit_allowance` overrides the plan table.** This is the grandfathering lever.

4. **Today `monthly_credit_allowance` is only set for annual subscribers** (the monthly "drip"); the webhook explicitly writes `null` for monthly subscribers. That is what we change in Section 6.

5. **Renewals:**
   - free → `public.renew_monthly_credits()` (hardcodes `30`)
   - annual paid drip → `public.renew_paid_monthly_credits()` (uses `monthly_credit_allowance`)
   - monthly paid → Polar `subscription.updated` webhook
   - downgrade/refund → `public.revoke_subscription_access()` (hardcodes `30`)

---

## 3. Grandfathering: why it needs work, and the rule we adopt

### The two ways an existing customer would silently break

**(a) Credits.** A legacy Standard customer paying $5 has `subscription_plan = 'tier2'` and `monthly_credit_allowance = NULL` (monthly billing). Their limit resolves from `subscription_plans.credits`. The moment we set `tier2.credits = 1000`, that $5 customer starts getting 1,000 credits/month. Same for legacy Pro ($9 → 2,000). Revenue loss, and it silently changes their product.

**(b) Price.** If you *edit the price on the existing Polar product*, some providers re-price active subscriptions. Never do this — create new products instead (Section 4).

### The rule we implement

> **Pin the allowance to the profile at migration time, and let the pin win for as long as the customer stays on the exact subscription + product they bought.**

Concretely:

1. The migration writes each existing paid profile's **current** allowance into `profiles.monthly_credit_allowance` **before** the plan table is updated (150 / 400 / 1000, or whatever they already had).
2. We add `profiles.polar_product_id` and record which Polar product the active subscription is for.
3. The webhook grants the pinned allowance when **subscription id matches AND product id matches** (i.e. a plain renewal). If either changed — a new checkout, or a plan switch in the Polar customer portal — the **new product's** allowance is used and the pin is overwritten.
4. `monthly_credit_allowance` is now persisted for **both** billing cycles (previously only annual). This is safe: `renew_paid_monthly_credits()` filters on `billing_cycle = 'annual'`, so monthly subscribers are still never touched by the drip job.

**Free users are intentionally NOT grandfathered** — they move to 15/month at their next renewal, which is the requested behaviour. Existing free users do **not** retroactively receive the 150 signup bonus (see Appendix A if the owner wants that).

---

## 4. Step 1 — Polar dashboard (manual, do this FIRST)

> ⚠️ **Do not edit prices on the existing 6 products.** Existing subscribers are billed against those products.

1. **Create 8 new products** (Alt Text Pro organisation):

   | Product name | Type | Price |
   |---|---|---|
   | `Alt Text Pro — Lite Monthly` | recurring, monthly | $4.00 |
   | `Alt Text Pro — Lite Annual` | recurring, yearly | $43.20 |
   | `Alt Text Pro — Standard Monthly` | recurring, monthly | $9.00 |
   | `Alt Text Pro — Standard Annual` | recurring, yearly | $97.20 |
   | `Alt Text Pro — Pro Monthly` | recurring, monthly | $14.00 |
   | `Alt Text Pro — Pro Annual` | recurring, yearly | $151.20 |
   | `Alt Text Pro — Agency Monthly` | recurring, monthly | $19.00 |
   | `Alt Text Pro — Agency Annual` | recurring, yearly | $205.20 |

2. **On every new product, set metadata** (this makes plan resolution exact instead of relying on name matching):

   | Key | Value |
   |---|---|
   | `plan_id` | `tier1` / `tier2` / `tier3` / `tier4` |
   | `type` | `subscription` |
   | `credits` | monthly allowance: `150` / `1000` / `2000` / `3500` for monthly products; `1800` / `12000` / `24000` / `42000` for annual products |

   > ⚠️ `credits` metadata takes priority over every code map (`getCreditsForProduct()` returns it directly). For **annual** products it must be the *yearly* number — the code divides/uses `MONTHLY_CREDITS_MAP` for the drip. If you are unsure, **leave `credits` unset** and let the code maps decide; `plan_id` and `type` are the important ones.

3. **Archive the 6 old subscription products** so no new customer can check out on old pricing. Archiving does not cancel active subscriptions. Keep the product IDs recorded (paste them into the PR description) for support lookups.

4. **Credit packs: keep both existing products, do not create new ones and do not archive them.** The prices ($5 and $10) are unchanged, so there is no re-pricing risk and no reason to churn the product IDs — the `NEXT_PUBLIC_POLAR_SMALL_PACK` / `NEXT_PUBLIC_POLAR_CREDIT_PACK` env vars stay exactly as they are.

   **But you must check their metadata.** Open each pack product and look for a `credits` key:
   - If `credits` is set → change it to **`500`** (Small Pack) and **`1200`** (Credit Pack). `getCreditsForProduct()` returns product metadata *before* consulting any code map, so a stale `credits: 100` here silently overrides everything in Section 7 and customers keep getting 100 credits.
   - If `credits` is not set → leave it unset; the code map in §7.2 is authoritative.
   - Optionally update the product **description** to say 500 / 1,200 credits so the Polar checkout page matches the site.

   Past purchases are unaffected: `public.credit_pack_grants` stores the credit amount granted per `payment_id`, and `revoke_credit_pack_purchase()` refunds from that stored row — so refunding an old $10 purchase still removes 250, not 1,200. No historical data migration is needed.

5. Copy the 8 new subscription product IDs — you need them in Step 2.

---

## 5. Step 2 — Environment variables

Add/update in **Netlify → Site settings → Environment variables** and in `frontend-next/.env.example`:

```
NEXT_PUBLIC_POLAR_TIER1_MONTHLY=<new Lite monthly product id>
NEXT_PUBLIC_POLAR_TIER1_ANNUAL=<new Lite annual product id>
NEXT_PUBLIC_POLAR_TIER2_MONTHLY=<new Standard monthly product id>
NEXT_PUBLIC_POLAR_TIER2_ANNUAL=<new Standard annual product id>
NEXT_PUBLIC_POLAR_TIER3_MONTHLY=<new Pro monthly product id>
NEXT_PUBLIC_POLAR_TIER3_ANNUAL=<new Pro annual product id>
NEXT_PUBLIC_POLAR_TIER4_MONTHLY=<new Agency monthly product id>   # NEW
NEXT_PUBLIC_POLAR_TIER4_ANNUAL=<new Agency annual product id>     # NEW
```

`NEXT_PUBLIC_POLAR_SMALL_PACK` and `NEXT_PUBLIC_POLAR_CREDIT_PACK` stay as they are.

`frontend-next/.env.example` currently lists lines 23–31 — add the two `TIER4` lines there too.

---

## 6. Step 3 — Database migration

Create **`supabase/migrations/20260809120000_apply_2026_08_pricing_packages.sql`**.

> ⚠️ Order matters: the grandfathering backfill (part 1) **must** run before the catalogue update (part 4), because it reads the *old* `subscription_plans.credits` values.

> 🚨 **Part 3 is not optional and not cosmetic.** `profiles.subscription_plan` carries a CHECK constraint from the bootstrap migration that allows only `('free','tier1','tier2','tier3','pay_as_go','small_pack','credit_pack')`. **`tier4` is not in that list.** Without part 3, the first Agency purchase makes the Polar webhook throw a constraint violation, the customer is charged, never provisioned, and Polar retries the failing webhook indefinitely.

```sql
-- 2026-08 pricing update.
--
-- New catalogue: Free 15/mo (+150 non-expiring signup bonus), Lite $4/150,
-- Standard $9/1000, Pro $14/2000, Agency $19/3500. Annual billing is the
-- monthly price x12 minus 10%, dripped monthly.
--
-- Existing subscribers keep the allowance they purchased. Their allowance is
-- pinned onto the profile before the plan catalogue changes, and the pin wins
-- for as long as they stay on the same Polar subscription and product.

-- ---------------------------------------------------------------------------
-- 1. Pin every existing paid subscriber to the allowance they bought.
--    Runs BEFORE the catalogue update so it reads the old plan credits.
-- ---------------------------------------------------------------------------
update public.profiles p
set
  monthly_credit_allowance = sp.credits,
  updated_at = now()
from public.subscription_plans sp
where sp.id = p.subscription_plan
  and p.subscription_plan in ('tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro')
  and coalesce(p.monthly_credit_allowance, 0) = 0;

-- ---------------------------------------------------------------------------
-- 2. Record which Polar product an active subscription belongs to, so the
--    webhook can tell "renewal of the grandfathered product" apart from
--    "customer switched plan".
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists polar_product_id text;

comment on column public.profiles.polar_product_id is
  'Polar product ID backing the active subscription. Used to keep a legacy allowance pinned across renewals of the same product.';

update public.profiles p
set polar_product_id = latest.polar_product_id
from (
  select distinct on (pay.user_id)
    pay.user_id,
    pay.polar_product_id
  from public.payments pay
  where pay.status = 'completed'
    and pay.polar_product_id is not null
    and pay.subscription_id is not null
  order by pay.user_id, pay.created_at desc
) latest
where latest.user_id = p.id
  and p.polar_product_id is null
  and p.subscription_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Allow the new Agency plan id on profiles.
--    The bootstrap CHECK constraint predates tier4 and would reject every
--    Agency subscription written by the Polar webhook. The alias names are
--    added defensively because several code paths already treat
--    'lite'/'standard'/'pro' as valid plan values.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (subscription_plan in (
    'free',
    'tier1', 'tier2', 'tier3', 'tier4',
    'lite', 'standard', 'pro', 'agency',
    'pay_as_go', 'small_pack', 'credit_pack'
  ));

-- ---------------------------------------------------------------------------
-- 4. New public catalogue, including the larger credit packs.
--    Pack prices are unchanged; only the credit amounts increase.
--    Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------
insert into public.subscription_plans (
  id, name, price, annual_price, credits, billing_cycle, features,
  is_popular, per_credit_cost
)
values
  ('free', 'Free', 0, 0, 15, 'monthly',
   '["150 bonus credits on signup (never expire)", "15 AI alt texts every month", "Full WordPress Plugin", "Media Library Sync"]'::jsonb,
   false, 0),
  ('tier1', 'Lite', 4, 43.20, 150, 'monthly',
   '["150 AI-Optimized Alt Texts", "Auto-Describe on Upload", "High-Accuracy Visual AI", "Standard Email Support"]'::jsonb,
   false, 0.0267),
  ('tier2', 'Standard', 9, 97.20, 1000, 'monthly',
   '["1,000 AI-Optimized Alt Texts", "Bulk One-Click Library Fix", "Multi-Language AI (130+)", "SEO & WCAG Compliance", "Priority Support"]'::jsonb,
   true, 0.0090),
  ('tier3', 'Pro', 14, 151.20, 2000, 'monthly',
   '["2,000 AI-Optimized Alt Texts", "Advanced Context-Aware AI", "Full Auto-Pilot Workflow", "Custom Post Type Support", "Premium 24/7 Support"]'::jsonb,
   false, 0.0070),
  ('tier4', 'Agency', 19, 205.20, 3500, 'monthly',
   '["3,500 AI-Optimized Alt Texts", "Multi-Site Friendly Workflow", "Advanced Context-Aware AI", "Full Auto-Pilot Workflow", "Premium 24/7 Support"]'::jsonb,
   false, 0.0054),
  ('small_pack', 'Small Pack', 5, null, 500, 'one-time',
   '["500 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
   false, 0.0100),
  ('credit_pack', 'Credit Pack', 10, null, 1200, 'one-time',
   '["1,200 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
   false, 0.0083)
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  annual_price = excluded.annual_price,
  credits = excluded.credits,
  billing_cycle = excluded.billing_cycle,
  features = excluded.features,
  is_popular = excluded.is_popular,
  per_credit_cost = excluded.per_credit_cost;

-- ---------------------------------------------------------------------------
-- 5. Signup grant: 15 plan credits + 150 non-expiring bonus credits.
--    credits_remaining is the aggregate, so it starts at 165.
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column credits_remaining set default 15;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  insert into public.profiles (
    id,
    email,
    subscription_plan,
    subscription_status,
    credits_remaining,
    bonus_credits_remaining,
    total_processed,
    credits_last_renewed_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    'active',
    165,
    150,
    0,
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- ---------------------------------------------------------------------------
-- 6. Free monthly renewal: 30 -> 15. Everything else is byte-identical to
--    20260806182541_repair_renew_monthly_credits_signature.sql, including the
--    subtraction of in-flight plan reservations.
-- ---------------------------------------------------------------------------
create or replace function public.renew_monthly_credits()
returns table (
  renewed_count integer,
  renewed_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  renewed_users uuid[];
  renewal_count integer := 0;
begin
  with renewed as (
    update public.profiles as p
    set
      credits_remaining = greatest(
        0,
        15
          + coalesce(p.bonus_credits_remaining, 0)
          + coalesce(p.purchased_credits_remaining, 0)
          - coalesce((
            select count(*)::integer
            from public.credit_reservations r
            where r.user_id = p.id
              and r.status = 'reserved'
              and r.credit_source = 'plan'
              and r.expires_at > now()
          ), 0)
      ),
      credits_last_renewed_at = now(),
      updated_at = now()
    where p.subscription_plan = 'free'
      and p.subscription_status = 'active'
      and (
        p.credits_last_renewed_at is null
        or p.credits_last_renewed_at <= now() - interval '30 days'
      )
    returning p.id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  return query
  select
    renewal_count,
    coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_monthly_credits()
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. Downgrade / revocation lands on the new free allowance (30 -> 15) and
--    clears the pinned product. Bonus and purchased ledgers are preserved,
--    so a refunded customer keeps their non-expiring credits.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_subscription_access(
  p_user_id uuid,
  p_subscription_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  updated_user_id uuid;
begin
  if p_user_id is null then
    return json_build_object(
      'success', false,
      'error', 'User ID is required'
    );
  end if;

  update public.profiles
  set
    credits_remaining = 15
      + coalesce(bonus_credits_remaining, 0)
      + coalesce(purchased_credits_remaining, 0),
    total_processed = 0,
    subscription_plan = 'free',
    subscription_status = 'active',
    subscription_id = null,
    billing_cycle = null,
    monthly_credit_allowance = null,
    polar_product_id = null,
    next_billing_date = null,
    credits_last_renewed_at = now(),
    updated_at = now()
  where id = p_user_id
    and (
      nullif(trim(p_subscription_id), '') is null
      or subscription_id = trim(p_subscription_id)
      or subscription_id is null
    )
  returning id into updated_user_id;

  if updated_user_id is null then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'stale_subscription', true
    );
  end if;

  return json_build_object(
    'success', true,
    'already_processed', false,
    'stale_subscription', false
  );
exception
  when others then
    raise warning 'Error revoking subscription access for user %: %', p_user_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during subscription revocation'
    );
end;
$function$;

revoke all on function public.revoke_subscription_access(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_subscription_access(uuid, text)
  to service_role;
```

### Migration notes

- `handle_new_user()` deliberately does **not** write to `audit_logs`. A failure there would break signup. The bonus is auditable via `profiles.bonus_credits_remaining` and `created_at`.
- The `on conflict (id) do update` branch of `handle_new_user()` only touches `email`, so a replayed trigger can never grant the 150 twice.
- Nothing in this migration resets `bonus_credits_remaining` or `purchased_credits_remaining`.
- **Do not modify** the earlier migration files. `frontend-next/src/app/api/webhooks/polar/route.test.ts` reads some of them from disk as fixtures.

---

## 7. Step 4 — Backend code

### 7.1 `frontend-next/src/lib/polar-plan-mapping.ts`

> ⚠️ **Ordering trap.** `matchPlanId()` returns the first matcher whose term is a substring of the normalised product name. Product names contain the words "Alt Text **Pro**", so a product called `Alt Text Pro — Agency Monthly` normalises to `alt_text_pro_—_agency_monthly`, which **contains `pro`**. If the `tier4` matcher is placed after `tier3`, every Agency product resolves to **Pro**. `tier4` must come **before** `tier3`.

```ts
const SUBSCRIPTION_PLAN_MATCHERS: Array<{ planId: string; terms: string[] }> = [
  { planId: "tier1", terms: ["tier1", "tier_1", "lite"] },
  { planId: "tier2", terms: ["tier2", "tier_2", "standard"] },
  { planId: "tier4", terms: ["tier4", "tier_4", "agency"] }, // MUST precede tier3
  { planId: "tier3", terms: ["tier3", "tier_3", "pro"] },
];
```

And in `isPolarSubscriptionProduct()`:

```ts
  return planId === "tier1" || planId === "tier2" || planId === "tier3" || planId === "tier4";
```

Setting `plan_id` metadata on the Polar products (Step 1.2) makes this path exact anyway — the ordering fix is the safety net for products whose metadata is missing.

### 7.2 `frontend-next/src/app/api/webhooks/polar/route.ts`

**(a) Credit maps** (replace lines ~20–48):

```ts
// Credit mapping based on product/plan
// Updated Aug 2026: Lite/Standard/Pro/Agency
const CREDITS_MAP: Record<string, number> = {
    lite_monthly: 150,
    standard_monthly: 1000,
    pro_monthly: 2000,
    agency_monthly: 3500,
    // Annual subscriptions (monthly credits x 12)
    lite_annual: 1800,
    standard_annual: 12000,
    pro_annual: 24000,
    agency_annual: 42000,
    // Plan-id aliases
    tier1_monthly: 150,
    tier2_monthly: 1000,
    tier3_monthly: 2000,
    tier4_monthly: 3500,
    tier1_annual: 1800,
    tier2_annual: 12000,
    tier3_annual: 24000,
    tier4_annual: 42000,
    // One-time purchases (Aug 2026: prices unchanged, credits increased)
    small_pack: 500,    // $5
    credit_pack: 1200,  // $10
};

// Monthly allowance per plan. Used for the annual drip AND as the per-cycle
// grant for monthly plans (they are the same number by design).
const MONTHLY_CREDITS_MAP: Record<string, number> = {
    tier1: 150,
    tier2: 1000,
    tier3: 2000,
    tier4: 3500,
};
```

**(b) `getCreditsForProduct()` fallback block** — same substring trap: check `agency` **before** `pro`.

```ts
    if (normalizedName.includes("agency")) {
        return normalizedName.includes("annual") ? 42000 : 3500;
    }
    if (normalizedName.includes("lite")) {
        return normalizedName.includes("annual") ? 1800 : 150;
    }
    if (normalizedName.includes("standard")) {
        return normalizedName.includes("annual") ? 12000 : 1000;
    }
    if (normalizedName.includes("pro")) {
        return normalizedName.includes("annual") ? 24000 : 2000;
    }
    // Legacy tierN naming
    if (normalizedName.includes("tier1") || normalizedName.includes("tier_1")) {
        return normalizedName.includes("annual") ? 1800 : 150;
    }
    if (normalizedName.includes("tier2") || normalizedName.includes("tier_2")) {
        return normalizedName.includes("annual") ? 12000 : 1000;
    }
    if (normalizedName.includes("tier3") || normalizedName.includes("tier_3")) {
        return normalizedName.includes("annual") ? 24000 : 2000;
    }
    if (normalizedName.includes("tier4") || normalizedName.includes("tier_4")) {
        return normalizedName.includes("annual") ? 42000 : 3500;
    }
```

And further down the same function, the two pack fallbacks (lines ~515–520):

```ts
    if (normalizedName.includes("small")) {
        return 500;
    }
    if (normalizedName.includes("credit") || normalizedName.includes("pack")) {
        return 1200;
    }
```

**(c) Read the new column.** Add `polar_product_id` to `BillingProfile` (line ~121) and to `BILLING_PROFILE_COLUMNS` (line ~134):

```ts
type BillingProfile = {
    // ...existing fields...
    polar_product_id: string | null;
};

const BILLING_PROFILE_COLUMNS = [
    "id",
    "email",
    "subscription_id",
    "polar_customer_id",
    "polar_product_id",
    "bonus_credits_remaining",
    "purchased_credits_remaining",
    "credits_remaining",
    "credits_last_renewed_at",
    "monthly_credit_allowance",
    "next_billing_date",
].join(", ");
```

**(d) One shared allowance resolver.** Add near `getCreditsForProduct()`:

```ts
function getPolarProductId(subscription: any): string | null {
    const id = subscription?.product?.id || subscription?.productId || null;
    return id ? String(id) : null;
}

/**
 * Monthly allowance to grant for this billing event.
 *
 * A customer who bought a legacy plan keeps the allowance pinned on their
 * profile for as long as they stay on the same Polar subscription AND the
 * same Polar product. Any new checkout (new subscription id) or an in-place
 * plan switch in the Polar customer portal (new product id) adopts the
 * current catalogue allowance instead.
 */
function resolveMonthlyAllowance({
    profile,
    planId,
    productId,
    subscriptionId,
    productCredits,
    isAnnual,
}: {
    profile: BillingProfile;
    planId: string;
    productId: string | null;
    subscriptionId: string | null;
    productCredits: number;
    isAnnual: boolean;
}): number {
    const catalogueAllowance =
        MONTHLY_CREDITS_MAP[planId]
        || (isAnnual ? Math.round(productCredits / 12) : productCredits);

    const pinned = Number(profile.monthly_credit_allowance || 0);
    if (pinned <= 0) return catalogueAllowance;

    const sameSubscription =
        Boolean(subscriptionId) && profile.subscription_id === subscriptionId;
    const sameProduct =
        !profile.polar_product_id || !productId || profile.polar_product_id === productId;

    return sameSubscription && sameProduct ? pinned : catalogueAllowance;
}
```

**(e) `onSubscriptionActive`** — replace the `creditsToGrant` / `monthlyAllowance` block (lines ~772–803) with:

```ts
            const rawCredits = getCreditsForProduct(productName, mergedMetadata);
            const billingCycle = isAnnual ? "annual" : "monthly";
            const productId = getPolarProductId(subscription);

            const monthlyAllowance = resolveMonthlyAllowance({
                profile: profile!,
                planId,
                productId,
                subscriptionId: subscription.id,
                productCredits: rawCredits,
                isAnnual,
            });

            // Monthly and annual plans both start a cycle with one monthly
            // allowance; annual plans get the rest via the monthly drip.
            const creditsToGrant = monthlyAllowance;

            if (creditsToGrant > 0) {
                await updateUserCredits(userId, creditsToGrant, true);
            } else {
                console.warn(`No credits found for subscription product: ${productName}`);
            }

            await getSupabase()
                .from("profiles")
                .update({
                    subscription_plan: planId,
                    subscription_status: "active",
                    subscription_id: subscription.id,
                    polar_customer_id: subscription.customer?.id || null,
                    polar_product_id: productId,
                    billing_cycle: billingCycle,
                    // Persisted for BOTH cycles now. renew_paid_monthly_credits()
                    // filters on billing_cycle = 'annual', so monthly subscribers
                    // are still never touched by the drip job.
                    monthly_credit_allowance: monthlyAllowance,
                    next_billing_date: getSubscriptionEnd(subscription),
                    credits_last_renewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);
```

**(f) `onSubscriptionUpdated`** — replace the `profileOverride` / `creditsToGrant` logic (lines ~1094–1099) and the update payload (lines ~1131–1142):

```ts
                    const productId = getPolarProductId(subscription);
                    const monthlyAllowance = resolveMonthlyAllowance({
                        profile: user,
                        planId,
                        productId,
                        subscriptionId: subscription.id,
                        productCredits: rawCredits,
                        isAnnual,
                    });
                    const creditsToGrant = monthlyAllowance;
```

```ts
                            .update({
                                credits_remaining: newCredits,
                                total_processed: 0,
                                subscription_status: "active",
                                subscription_id: subscription.id,
                                subscription_plan: planId,
                                polar_product_id: productId,
                                next_billing_date: subscription.currentPeriodEnd,
                                billing_cycle: billingCycle,
                                monthly_credit_allowance: monthlyAllowance,
                                credits_last_renewed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
```

> Note: `subscription_plan: planId` is added here so an in-portal plan switch also moves the profile's plan. Today `onSubscriptionUpdated` never updates `subscription_plan`, which is an existing gap this closes.

**(g) `onSubscriptionUncanceled`** (lines ~946–955) — keep the pin instead of nulling it for monthly:

```ts
            const productId = getPolarProductId(subscription);
            await updateProfile(profile.id, {
                subscription_plan: planId,
                subscription_status: "active",
                subscription_id: subscription.id,
                polar_customer_id: subscription.customer?.id || profile.polar_customer_id,
                polar_product_id: productId || profile.polar_product_id,
                billing_cycle: isAnnual ? "annual" : "monthly",
                monthly_credit_allowance:
                    Number(profile.monthly_credit_allowance || 0) > 0
                        ? profile.monthly_credit_allowance
                        : (MONTHLY_CREDITS_MAP[planId] || null),
                next_billing_date: getSubscriptionEnd(subscription) || profile.next_billing_date,
                updated_at: new Date().toISOString(),
            });
```

(No credits are granted here — correct, no new billing period started.)

### 7.3 `frontend-next/src/lib/utils.ts` (lines 11–19)

```ts
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  free: 15,
  lite: 150,
  standard: 1000,
  pro: 2000,
  agency: 3500,
  tier1: 150,
  tier2: 1000,
  tier3: 2000,
  tier4: 3500,
};
```

This is only a **display fallback** in the dashboard (`planAllowance = monthlyCreditLimit || ...`), so grandfathered users still show their real pinned allowance from the API. Update it anyway for consistency.

### 7.4 `netlify-functions/utils/api-key-validator.js` (lines 22–30)

```js
const SUBSCRIPTION_PLAN_CREDITS = {
  free: 15,
  tier1: 150,
  tier2: 1000,
  tier3: 2000,
  tier4: 3500,
  lite: 150,
  standard: 1000,
  pro: 2000,
  agency: 3500,
};
```

> This map also gates `isMonthlyLimited`. A plan id missing from it is treated as unlimited-aggregate, so **`tier4`/`agency` must be present**.

### 7.5 `netlify-functions/get-usage.js` (line 188)

```js
    const totalCredits = planDetails ? planDetails.credits : 15; // was 100
```

Cosmetic hardening — the DB lookup normally succeeds.

### 7.6 Files that need **no** change

`generate-alt-text.js`, `get-plans.js`, `get-subscription.js`, `auth-validate.js`, `credits-low-event.js` (threshold 5 is still sensible on a 15-credit plan), and the whole reservation engine. They all read the plan catalogue or the profile.

---

## 8. Step 5 — Frontend UI & copy

### 8.1 `frontend-next/src/components/PricingSection.tsx` — the live pricing section

Replace the `plans` array (lines 10–48):

```ts
const plans = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    credits: "15 credits every month",
    features: ["150 bonus credits on signup — never expire", "WordPress plugin included", "No credit card"],
    cta: "Start with 150 credits",
  },
  {
    id: "tier1",
    name: "Lite",
    monthlyPrice: "$4",
    annualPrice: "$43.20",
    credits: "150 credits every month",
    features: ["Auto-generate on upload", "Single-image workflow", "Standard support"],
    cta: "Choose Lite",
  },
  {
    id: "tier2",
    name: "Standard",
    monthlyPrice: "$9",
    annualPrice: "$97.20",
    credits: "1,000 credits every month",
    features: ["Bulk media-library fixes", "130+ languages", "Priority support"],
    cta: "Choose Standard",
    featured: true,
  },
  {
    id: "tier3",
    name: "Pro",
    monthlyPrice: "$14",
    annualPrice: "$151.20",
    credits: "2,000 credits every month",
    features: ["Context-aware generation", "WooCommerce workflows", "Premium support"],
    cta: "Choose Pro",
  },
  {
    id: "tier4",
    name: "Agency",
    monthlyPrice: "$19",
    annualPrice: "$205.20",
    credits: "3,500 credits every month",
    features: ["Built for multi-site workflows", "Highest monthly volume", "Premium 24/7 support"],
    cta: "Choose Agency",
  },
];
```

Also in the same file:

- Line 86: `Annual <span className="ml-1 text-sm">Save 20%</span>` → **`Save 10%`**
- Line 91 grid: `lg:grid-cols-4` → `lg:grid-cols-3 xl:grid-cols-5` (5 cards do not fit at `lg`)
- Line 95: `min-h-[570px]` may need to relax to `min-h-[540px]` at 5 columns — check visually
- Optional but recommended: under the price, when `isAnnual` and `plan.id !== "free"`, render the effective monthly rate (`$3.60`, `$8.10`, `$12.60`, `$17.10` `/mo billed yearly`)

> **Worth raising with the owner:** the live pricing section has **no credit-pack cards at all**. The only pack UI on the homepage sits inside the hidden `#legacy-pricing` block, so today packs can only be bought from the logged-in dashboard. With packs jumping to 500 / 1,200 credits this is probably the wrong place to hide them. Recommended (small, self-contained): add a "Need a one-off top-up?" strip under the five plan cards with two buttons wired to the existing `onSelectPlan('small_pack', 'Starter Pack', '$5')` / `onSelectPlan('credit_pack', 'Value Pack', '$10')` — the checkout path already works end to end. Treat as a separate commit so the pricing change can ship on its own.

### 8.2 `frontend-next/src/app/page.tsx`

- Lines 31–39 `POLAR_PRODUCTS`: add
  ```ts
  tier4_monthly: process.env.NEXT_PUBLIC_POLAR_TIER4_MONTHLY || '',
  tier4_annual: process.env.NEXT_PUBLIC_POLAR_TIER4_ANNUAL || '',
  ```
- `getPolarProductId()` (lines 360–376): add
  ```ts
  if (planId === 'tier4') {
    return cycle === 'annual' ? POLAR_PRODUCTS.tier4_annual : POLAR_PRODUCTS.tier4_monthly;
  }
  ```
- Line 233–241 signup metadata: `credits_remaining: 30` → `165` (this is only `raw_user_meta_data`; the real grant is the DB trigger, but leave no stale numbers)
- Line 440: `Start with 30 free credits` → `Start with 150 free credits`
- Line 1254: `Get 30 free credits` → `Get 150 free credits`
- **Checkout modal feature list, lines ~1449–1463 — this is a LIVE surface.** The live `PricingSection` calls `handlePlanSelection`, which opens this modal, and its "What's Included" chips are a hardcoded `if/else` chain. It currently claims 400 / 1,000 credits and 100 / 250 pack credits. Replace with:
  ```ts
  {(selectedPlan.id === 'tier1' ? [
    "150 Monthly Credits", "Auto-Pilot Analysis", "High-Fidelity AI", "Standard Support"
  ] : selectedPlan.id === 'tier2' ? [
    "1,000 Monthly Credits", "Bulk Library Optimization", "Multi-Language (130+)", "SEO Compliance", "Priority Support"
  ] : selectedPlan.id === 'tier3' ? [
    "2,000 Monthly Credits", "Context-Aware Generation", "Full Auto-Pilot Suite", "Custom API Access", "24/7 Strategic Support"
  ] : selectedPlan.id === 'tier4' ? [
    "3,500 Monthly Credits", "Multi-Site Workflows", "Context-Aware Generation", "Full Auto-Pilot Suite", "24/7 Strategic Support"
  ] : selectedPlan.id === 'small_pack' ? [
    "500 Credit Injection", "On-Demand Resource", "Never Expires", "Immediate Utility"
  ] : [
    "1,200 Credit Injection", "Efficiency Pack Bonus", "Never Expires", "Strategic Utility"
  ]).map(...)}
  ```
  Note the **new `tier4` branch** — without it, an Agency customer falls through to the final `else` and sees credit-pack copy in the checkout modal.
- Line 1428, small correctness fix while you are in this file: the "BILLED MONTHLY / ANNUALLY" caption is hidden only for `free` and `pay_as_go`, so the two credit packs currently display it on a one-time purchase. Change the condition to
  ```ts
  {!['free', 'pay_as_go', 'small_pack', 'credit_pack'].includes(selectedPlan.id) && (
  ```

### 8.3 `frontend-next/src/app/dashboard/page.tsx`

- Lines 11–19 `POLAR_PRODUCTS`: add the two `tier4_*` entries
- Lines 240–250 product map: add
  ```ts
  tier4: POLAR_PRODUCTS.tier4_monthly,
  tier4_monthly: POLAR_PRODUCTS.tier4_monthly,
  tier4_annual: POLAR_PRODUCTS.tier4_annual,
  ```
- Lines 76–86 `planLabels`: add `tier4: 'Agency', agency: 'Agency',`
- Upgrade modal (lines ~1274–1370): the "Monthly Subscriptions" grid is `md:grid-cols-3` with hardcoded Lite $3/150, Standard $5/400, Pro $9/1,000. Change to `md:grid-cols-2 xl:grid-cols-4` and:
  - Lite → `$4`, `150` Credits, `id: 'tier1_monthly'`
  - Standard → `$9`, `1,000` Credits, `id: 'tier2_monthly'`
  - Pro → `$14`, `2,000` Credits, `id: 'tier3_monthly'`
  - **Add Agency** → `$19`, `3,500` Credits, `id: 'tier4_monthly'`
- Credit-pack cards in the same modal (lines ~1370–1425): prices stay `$5` / `$10`, credit amounts change **`100` → `500`** ("Small Credit Pack") and **`250` → `1,200`** ("Priority Support Pack"). Keep the "Persistent resources (No expiry)" line — it is now doing real work in the copy.

### 8.4 `frontend-next/src/app/admin/page.tsx`

Line 435: add `<option value="tier4">Tier 4 (Agency)</option>` after Tier 3.

### 8.5 `frontend-next/src/app/connect/page.tsx`

- Line 553: `credits_remaining: 30` → `165` (signup metadata, same note as 8.2)
- Line 809: `30 Free Credits` → `150 Free Credits`

### 8.6 `frontend-next/src/components/Navbar.tsx`

Lines 154 and 251: `Get 30 Free Credits` → `Get 150 Free Credits`

### 8.7 SEO landing pages — swap `30` → `150`

| File | Lines |
|---|---|
| `frontend-next/src/app/layout.tsx` | 26 (meta description) |
| `frontend-next/src/app/ai-alt-text-generator-for-wordpress/page.tsx` | 25, 48, 113, 151, 165, 352 |
| `frontend-next/src/app/bulk-generate-alt-text-wordpress/page.tsx` | 148, 347 |
| `frontend-next/src/app/woocommerce-product-image-alt-text/page.tsx` | 112, 150, 339 |

Recommended wording, used consistently everywhere:
- CTA: **"Get 150 Free Credits"**
- Body: **"Start with 150 free credits, then 15 free credits every month."**
- Note at 113 / 112 (`"Free account includes 30 credits."`): **"Free account includes 150 signup credits plus 15 every month."**

---

## 9. Step 6 — Docs & legal copy

### 9.1 `frontend-next/src/app/terms/page.tsx` (section 4, lines 63–74)

```
Free Plan: $0/month — 15 credits per month, plus a one-time 150-credit signup bonus that does not expire
Lite:      $4/month  ($43.20/year)  — 150 images per month
Standard:  $9/month  ($97.20/year)  — 1,000 images per month
Pro:       $14/month ($151.20/year) — 2,000 images per month
Agency:    $19/month ($205.20/year) — 3,500 images per month
Pay as you go: $5 for 500 images or $10 for 1,200 images (one-time, never expire)
```

Add one sentence to the paragraph below the list:

> Existing subscribers keep the price and monthly credit allowance of the plan they purchased for as long as that subscription remains active. Signup bonus credits and purchased credit packs never expire and are not reset by a billing cycle.

### 9.2 `frontend-next/src/app/docs/page.tsx`

- Line 144: `start with 30 credits` → `start with 150 credits`
- Line 177: `You'll receive 30 credits` → `You'll receive 150 credits, plus 15 more every month`
- Lines 399–437 pricing cards: grid `md:grid-cols-4` → `md:grid-cols-2 xl:grid-cols-5`, update Free (`15 Credits/month + 150 on signup`), Lite `$4`, Standard `$9` / 1,000, Pro `$14` / 2,000, and **add an Agency card** `$19` / 3,500
- Line 438: rewrite to
  > Annual billing is available at $43.20/year for Lite, $97.20/year for Standard, $151.20/year for Pro, and $205.20/year for Agency — a 10% saving. The listed monthly credit allowance still renews monthly on subscription plans. One-time credit packs are also available: $5 for 500 credits or $10 for 1,200 credits. Pack credits never expire and are only used up when you generate.
- Line 536 FAQ: `get 30 free credits to start` → `get 150 free credits to start`

---

## 10. Step 7 — WordPress plugin

Small, but needed so Agency customers see the right thing in wp-admin.

1. **`wordpress-plugin/alt-text-pro/templates/dashboard.php`** (lines 103–113) — add to `$alt_text_pro_plan_names`:
   ```php
   'tier4'  => __('Agency', 'alt-text-pro'),
   'agency' => __('Agency', 'alt-text-pro'),
   ```
2. **`wordpress-plugin/alt-text-pro/includes/class-bulk-processor.php`** (line 122):
   ```php
   $subscription_plans = array('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency');
   ```
3. **`wordpress-plugin/alt-text-pro/readme.txt`** line 61 — optional precision:
   > New accounts include 150 free signup credits plus 15 free credits every month.
4. **Version bump** `1.7.15 → 1.7.16` in `wordpress-plugin/alt-text-pro/alt-text-pro.php` (line 6) and `readme.txt` (`Stable tag`), plus a changelog entry. `frontend-next/src/lib/plugin-version.ts` is auto-generated by `scripts/sync-plugin-version.mjs` (runs on `prebuild`/`pretest`) — **do not hand-edit it**.
5. The zip in `frontend-next/public/wordpress-plugin/` is rebuilt by `wordpress-plugin/build-plugin.sh` during the Netlify build. No manual step.

**No credit numbers are hardcoded in the plugin** — it renders `monthly_credit_limit` / `monthly_credits_remaining` from the API, so allowances flow through automatically.

---

## 11. Step 8 — Tests

Run:

```bash
cd frontend-next && npm test && cd ../netlify-functions && npm test && cd .. && node --test supabase/migrations/migration-chain.test.js
```

Expect these to need updating:

1. **`supabase/migrations/migration-chain.test.js`** line ~21 asserts the newest migration filename:
   ```js
   assert.equal(files.at(-1), '20260809120000_apply_2026_08_pricing_packages.sql');
   ```
2. **`frontend-next/src/app/api/webhooks/polar/route.test.ts`**
   - The test `"defines an immediate 30-credit free-tier allowance on revocation"` (line 378) reads the **old** migration file, so it will still pass but is now misleading. Repoint it at the new migration and assert `credits_remaining = 15`, keeping the two `coalesce(...)` assertions.
   - Fixtures at lines 266–307 use `monthly_credit_allowance: 400` for `tier2`. Keep one such case as the **grandfathering regression test** (it now proves a legacy $5 Standard customer still gets 400) and add a new case for a fresh `tier2` at 1,000.
3. **`netlify-functions/utils/api-key-validator.test.js`** — `monthly_credit_limit: 30` at lines 13 and 29, and `total_processed: 30` at line 51, all assume the free plan is 30. Update to 15.
4. **`frontend-next/src/lib/polar-plan-mapping.test.ts`** — add cases:
   - `resolvePolarPlanId("Alt Text Pro — Agency Monthly", {})` → `"tier4"` (this is the test that catches the `pro` substring trap)
   - `resolvePolarPlanId("Alt Text Pro — Agency Annual", {})` → `"tier4"`
   - `isPolarSubscriptionProduct("Alt Text Pro — Agency Monthly", {})` → `true`

**New tests worth adding** (unit, no network):

- `resolveMonthlyAllowance()`: pinned 400 + same subscription id + same product id → **400**; pinned 400 + different product id → **1000**; pinned 400 + different subscription id → **1000**; pinned 0 → **1000**.
- `getCreditsForProduct("Alt Text Pro — Small Pack", {})` → **500**; `getCreditsForProduct("Alt Text Pro — Credit Pack", {})` → **1200**.
- `getCreditsForProduct("Alt Text Pro — Small Pack", { credits: 100 })` → **100**, documenting that Polar metadata outranks the code map (this is the test that explains the §4.4 metadata check).
- The new migration allows `tier4` on `profiles.subscription_plan`: assert the migration text contains `drop constraint if exists profiles_subscription_plan_check` and `'tier4'`.

---

## 12. Step 9 — Deploy order

Do it in this order; each step is safe on its own.

1. Polar: create the 8 new products + metadata. **Do not archive the old ones yet.**
2. Netlify: set the 8 `NEXT_PUBLIC_POLAR_TIER*` env vars (including the new `TIER4` pair). Do not deploy yet.
3. **Apply the DB migration.** Run it against staging first, then production.
   Between this step and step 4 the site briefly advertises old prices while the DB holds new allowances — impact is limited to new signups getting 15+150 (which is the intent) and a new checkout on an old product landing on the new catalogue allowance. Keep the gap short.
4. Deploy `frontend-next` + `netlify-functions` (code from Sections 7–10).
5. Smoke-test with a real card or Polar sandbox: one monthly checkout, one annual checkout — do at least one of them on **Agency**, which exercises the new plan id and the CHECK constraint — plus **one $10 credit-pack purchase** to confirm 1,200 credits land in `purchased_credits_remaining`.
6. **Now archive the 6 old Polar subscription products.**
7. Publish the plugin update (1.7.16) to WordPress.org if you ship plugin changes.

---

## 13. Step 10 — Verification

### SQL (run after the migration)

```sql
-- 1. Catalogue is exactly as intended.
select id, name, price, annual_price, credits, is_popular
from public.subscription_plans
order by price;
-- expect: free 0/0/15, tier1 4/43.20/150, tier2 9/97.20/1000 (popular),
--         tier3 14/151.20/2000, tier4 19/205.20/3500,
--         small_pack 5/-/500, credit_pack 10/-/1200,
--         and the untouched legacy pay_as_go 5/-/550

-- 1b. The Agency plan id is now accepted by the profiles CHECK constraint.
select pg_get_constraintdef(oid)
from pg_constraint
where conname = 'profiles_subscription_plan_check';
-- must contain 'tier4'

-- 2. NO existing paid subscriber is left unpinned.  MUST return 0 rows.
select id, email, subscription_plan, billing_cycle, monthly_credit_allowance
from public.profiles
where subscription_plan in ('tier1','tier2','tier3','lite','standard','pro')
  and coalesce(monthly_credit_allowance, 0) = 0;

-- 3. Distribution of pinned allowances (sanity: legacy users show 150/400/1000).
select subscription_plan, monthly_credit_allowance, count(*)
from public.profiles
where subscription_plan <> 'free'
group by 1, 2
order by 1, 2;

-- 4. Nobody lost bonus or purchased credits.  Compare to a pre-migration snapshot.
select sum(bonus_credits_remaining) as bonus,
       sum(purchased_credits_remaining) as purchased
from public.profiles;

-- 5. Function constants updated.
select prosrc from pg_proc where proname = 'renew_monthly_credits';
select prosrc from pg_proc where proname = 'revoke_subscription_access';
select prosrc from pg_proc where proname = 'handle_new_user';
-- expect 15 / 15 / (165 and 150) respectively, and no remaining "30"
```

> **Take the "before" snapshot for check 4 immediately before running the migration:**
> ```sql
> select sum(bonus_credits_remaining), sum(purchased_credits_remaining),
>        count(*) filter (where subscription_plan <> 'free') from public.profiles;
> ```

### Manual

| # | Test | Expected |
|---|---|---|
| 1 | Sign up a brand-new account | Dashboard shows **165** credits; DB row: `credits_remaining=165`, `bonus_credits_remaining=150`, `subscription_plan='free'` |
| 2 | Generate 1 alt text on that account | 164 total; `bonus_credits_remaining` still **150** (the plan credit was spent first) |
| 3 | Spend all 15 plan credits, then generate once more | Succeeds, `bonus_credits_remaining` drops to 149 |
| 4 | Force a free renewal (`select * from public.renew_monthly_credits();` after setting `credits_last_renewed_at` back 31 days on a test user) | `credits_remaining = 15 + remaining bonus + remaining purchased`; bonus untouched |
| 5 | Checkout Agency Monthly | Profile: `subscription_plan='tier4'`, `monthly_credit_allowance=3500`, `credits_remaining=3500 + bonus + purchased`, `polar_product_id` set |
| 6 | Checkout Agency Annual | Charged $205.20; `billing_cycle='annual'`, `monthly_credit_allowance=3500`, credits granted **3,500** (not 42,000) |
| 7 | **Grandfathering:** pick a real legacy Standard ($5) subscriber and wait for / replay their renewal webhook | Still **400** credits, still billed $5. `monthly_credit_allowance` stays 400 |
| 8 | Legacy subscriber upgrades to the new Pro | New subscription id → allowance becomes **2,000**, billed $14 |
| 9 | Cancel + let Polar revoke a subscription | Drops to free: `credits_remaining = 15 + bonus + purchased`; bonus and purchased intact |
| 10 | Buy the $10 credit pack on a free account | `purchased_credits_remaining` **+1,200**; plan allowance and bonus unchanged; `credit_pack_grants` row shows `credits = 1200` |
| 10b | Buy the $5 pack | `purchased_credits_remaining` **+500** |
| 10c | Spend past the plan allowance and the bonus on that account | Generation still succeeds and draws from `purchased_credits_remaining` |
| 10d | Refund the $10 purchase in Polar | Exactly 1,200 removed; bonus and plan allowance untouched |
| 11 | WordPress plugin dashboard on an Agency account | Plan reads "Agency Monthly", allowance 3,500 |
| 12 | Pricing page at 1280px and 375px | 5 cards readable, annual toggle says "Save 10%", prices match the table in §0 |

---

## 14. Rollback

- **Code:** revert the deploy. The frontend is stateless.
- **Env:** point the 6 `TIER1–TIER3` vars back at the old product IDs and un-archive those products in Polar.
- **Database:** write a small down-migration that re-inserts the previous `subscription_plans` values (free 30, tier1 3/30/150, tier2 5/48/400, tier3 9/86/1000; delete `tier4`) and re-creates the three functions with `30` / `credits_remaining=30` / `credits_remaining=30, no bonus`.
  **Leave `profiles.monthly_credit_allowance` and `profiles.polar_product_id` in place** — the pins are harmless under old pricing (they equal the old plan credits) and removing them would break in-flight annual drips.
- **Signup bonuses already granted are not clawed back.** That is deliberate: they sit in the same non-expiring ledger as paid credit packs, and reversing them would take credits away from real users.

---

## Appendix A — Optional: give existing free users the 150 bonus

**Not part of the requested change. Requires the owner's explicit go-ahead.** The instruction was "on signup every user will get 150 credits", which reads as new accounts only. Existing free users simply move to 15/month.

If the owner does want to include them (e.g. as a launch goodwill gesture), there is already an audited, idempotent path — `public.grant_promotional_credits(uuid, integer, text)` from `20260805202418_fix_subscription_lifecycle_refunds.sql`, which updates both ledgers and writes an `audit_logs` row.

```sql
-- Dry run first: how many users, how many credits?
select count(*), count(*) * 150 as credits_to_grant
from public.profiles
where subscription_plan = 'free'
  and coalesce(bonus_credits_remaining, 0) = 0
  and created_at < '2026-08-09';

-- Grant (run once; the created_at guard prevents double-granting to new signups)
do $$
declare
  target record;
begin
  for target in
    select id
    from public.profiles
    where subscription_plan = 'free'
      and coalesce(bonus_credits_remaining, 0) = 0
      and created_at < '2026-08-09'
  loop
    perform public.grant_promotional_credits(target.id, 150, 'signup_bonus_backfill_2026_08');
  end loop;
end
$$;
```

Verify the function's exact argument order in that migration before running, and re-run the dry-run query afterwards — it should return 0.

---

## Appendix B — Quick reference

**Plan ids:** `free`, `tier1` (Lite), `tier2` (Standard), `tier3` (Pro), `tier4` (Agency), `small_pack`, `credit_pack`

**Monthly allowances:** 15 / 150 / 1,000 / 2,000 / 3,500
**Annual totals:** — / 1,800 / 12,000 / 24,000 / 42,000
**Monthly prices:** $0 / $4 / $9 / $14 / $19
**Annual prices:** $0 / $43.20 / $97.20 / $151.20 / $205.20
**Effective monthly on annual:** — / $3.60 / $8.10 / $12.60 / $17.10
**Credit packs (one-time):** $5 → **500** credits, $10 → **1,200** credits → `purchased_credits_remaining`, never expire
**Signup bonus:** 150 credits → `bonus_credits_remaining`, never expires, never reset
**New account aggregate on day 1:** 165
**Spend order:** plan allowance → bonus → purchased

**Every file that changes**

```
supabase/migrations/20260809120000_apply_2026_08_pricing_packages.sql   (new)
supabase/migrations/migration-chain.test.js
frontend-next/.env.example
frontend-next/src/lib/polar-plan-mapping.ts
frontend-next/src/lib/polar-plan-mapping.test.ts
frontend-next/src/lib/utils.ts
frontend-next/src/app/api/webhooks/polar/route.ts
frontend-next/src/app/api/webhooks/polar/route.test.ts
frontend-next/src/components/PricingSection.tsx
frontend-next/src/components/Navbar.tsx
frontend-next/src/app/page.tsx
frontend-next/src/app/dashboard/page.tsx
frontend-next/src/app/admin/page.tsx
frontend-next/src/app/connect/page.tsx
frontend-next/src/app/layout.tsx
frontend-next/src/app/docs/page.tsx
frontend-next/src/app/terms/page.tsx
frontend-next/src/app/ai-alt-text-generator-for-wordpress/page.tsx
frontend-next/src/app/bulk-generate-alt-text-wordpress/page.tsx
frontend-next/src/app/woocommerce-product-image-alt-text/page.tsx
netlify-functions/utils/api-key-validator.js
netlify-functions/utils/api-key-validator.test.js
netlify-functions/get-usage.js
wordpress-plugin/alt-text-pro/alt-text-pro.php
wordpress-plugin/alt-text-pro/readme.txt
wordpress-plugin/alt-text-pro/templates/dashboard.php
wordpress-plugin/alt-text-pro/includes/class-bulk-processor.php
```

**The five things most likely to go wrong**

1. **Skipping the CHECK-constraint fix (§6 part 3)** → the first Agency purchase fails the webhook, the customer is charged and never provisioned, and Polar retries forever. This one is silent until real money moves.
2. Forgetting the allowance pin (§6 part 1) → every legacy Standard/Pro customer silently gets 2.5× / 2× the credits they pay for.
3. Putting the `tier4`/`agency` matcher **after** `tier3` → "Alt Text **Pro** — Agency" resolves to Pro, and Agency customers get 2,000 credits instead of 3,500.
4. Editing prices on the existing Polar subscription products instead of creating new ones → active subscribers get re-priced.
5. Leaving a stale `credits` value in the Polar **pack** product metadata → it outranks every code map and customers keep receiving 100 / 250 credits after you have shipped 500 / 1,200.
