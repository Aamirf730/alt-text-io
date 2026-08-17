-- Ensure the new Agency catalogue row is visible to plan consumers.
-- The canonical bootstrap predates this catalogue flag, so define it here
-- before touching the Tier 4 row. IF NOT EXISTS keeps this safe for production
-- databases where the column was added by an older manual schema change.
alter table public.subscription_plans
  add column if not exists is_active boolean not null default true;

update public.subscription_plans
set is_active = true
where id = 'tier4';
