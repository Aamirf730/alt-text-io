-- 2026-10 pricing update.
--
-- New public catalogue: Starter $5/500 (tier1), Growth $12/1,500 (tier2),
-- Agency $29/5,000 (tier4). Annual billing is ten times the monthly price
-- (two months free), dripped monthly. Pro (tier3) is retired from sale.
-- One-time packs: 1,000 for $12 (small_pack), 5,000 for $45 (credit_pack),
-- 15,000 for $99 (bulk_pack), open to every account. Free is unchanged.
--
-- Existing paid subscribers keep the allowance they purchased. Their
-- allowance is pinned before the catalogue update and remains effective while
-- the same Polar subscription and product remain active; their price stays on
-- the Polar product they subscribed to.

-- ---------------------------------------------------------------------------
-- 1. Pin every existing paid subscriber before changing subscription_plans.
-- ---------------------------------------------------------------------------
update public.profiles p
set
  monthly_credit_allowance = sp.credits,
  updated_at = now()
from public.subscription_plans sp
where sp.id = p.subscription_plan
  and p.subscription_plan in (
    'tier1', 'tier2', 'tier3', 'tier4',
    'lite', 'standard', 'pro', 'agency'
  )
  and coalesce(p.monthly_credit_allowance, 0) = 0;

-- ---------------------------------------------------------------------------
-- 2. Allow the new bulk pack ID wherever plan IDs are recorded.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (subscription_plan in (
    'free',
    'tier1', 'tier2', 'tier3', 'tier4',
    'lite', 'standard', 'pro', 'agency',
    'pay_as_go', 'small_pack', 'credit_pack', 'bulk_pack'
  ));

-- ---------------------------------------------------------------------------
-- 3. Apply the new public catalogue.
-- ---------------------------------------------------------------------------
insert into public.subscription_plans (
  id, name, price, annual_price, credits, billing_cycle, features,
  is_popular, per_credit_cost, is_active
)
values
  ('tier1', 'Starter', 5, 50, 500, 'monthly',
   '["500 AI alt text generations", "Every plugin feature included", "Bulk, WooCommerce and context-aware workflows", "Email support"]'::jsonb,
   false, 0.0100, true),
  ('tier2', 'Growth', 12, 120, 1500, 'monthly',
   '["1,500 AI alt text generations", "Every plugin feature included", "Bulk, WooCommerce and context-aware workflows", "Email support"]'::jsonb,
   true, 0.0080, true),
  ('tier4', 'Agency', 29, 290, 5000, 'monthly',
   '["5,000 AI alt text generations", "Every plugin feature included", "Bulk, WooCommerce and context-aware workflows", "Email support"]'::jsonb,
   false, 0.0058, true),
  ('small_pack', 'Small Credit Pack', 12, null, 1000, 'one-time',
   '["1,000 credits (never expire)", "Available on every plan, including Free", "Used after your monthly allowance"]'::jsonb,
   false, 0.0120, true),
  ('credit_pack', 'Library Pack', 45, null, 5000, 'one-time',
   '["5,000 credits (never expire)", "Available on every plan, including Free", "Used after your monthly allowance"]'::jsonb,
   false, 0.0090, true),
  ('bulk_pack', 'Bulk Pack', 99, null, 15000, 'one-time',
   '["15,000 credits (never expire)", "Available on every plan, including Free", "Used after your monthly allowance"]'::jsonb,
   false, 0.0066, true)
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  annual_price = excluded.annual_price,
  credits = excluded.credits,
  billing_cycle = excluded.billing_cycle,
  features = excluded.features,
  is_popular = excluded.is_popular,
  per_credit_cost = excluded.per_credit_cost,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- 4. Retire plans that are no longer sold. The rows stay because legacy
--    profiles and payments still reference them.
-- ---------------------------------------------------------------------------
update public.subscription_plans
set is_active = false, is_popular = false
where id in ('tier3', 'pay_as_go');
