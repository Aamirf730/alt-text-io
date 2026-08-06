-- Canonical database bootstrap for Alt Text Pro.
--
-- This migration is ordered before the first feature migration
-- (20260625150407). The old supabase-migration/*.sql files were applied by
-- hand and remain historical references only. A fresh database starts here
-- and then replays every tracked migration in timestamp order.
--
-- Supabase owns auth.users. Every public-schema object required by the
-- application is defined here or in a later tracked migration.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  price numeric(10, 2) not null,
  annual_price numeric(10, 2),
  credits integer not null,
  billing_cycle text not null,
  features jsonb not null default '[]'::jsonb,
  is_popular boolean not null default false,
  per_credit_cost numeric(10, 4),
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (
  id, name, price, annual_price, credits, billing_cycle, features,
  is_popular, per_credit_cost
)
values
  ('free', 'Free', 0, 0, 30, 'monthly',
   '["30 Free SEO Alt Texts", "Full WordPress Plugin", "Media Library Sync"]'::jsonb,
   false, 0),
  ('tier1', 'Lite', 3, 30, 150, 'monthly',
   '["150 AI-Optimized Alt Texts", "Auto-Describe on Upload", "High-Accuracy Visual AI", "Standard Email Support"]'::jsonb,
   false, 0.02),
  ('tier2', 'Standard', 5, 48, 400, 'monthly',
   '["400 AI-Optimized Alt Texts", "Bulk One-Click Library Fix", "Multi-Language AI (130+)", "SEO & WCAG Compliance", "Priority Support"]'::jsonb,
   true, 0.0125),
  ('tier3', 'Pro', 9, 86, 1000, 'monthly',
   '["1,000 AI-Optimized Alt Texts", "Advanced Context-Aware AI", "Full Auto-Pilot Workflow", "Custom Post Type Support", "Premium 24/7 Support"]'::jsonb,
   false, 0.009),
  ('pay_as_go', 'Credit Pack', 5, null, 550, 'one-time',
   '["550 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
   false, 0.0091),
  ('small_pack', 'Small Pack', 5, null, 100, 'one-time',
   '["100 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
   false, 0.05),
  ('credit_pack', 'Credit Pack', 10, null, 250, 'one-time',
   '["250 Credits (never expire)", "Flexible usage", "Works with any plan"]'::jsonb,
   false, 0.04)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  subscription_plan text not null default 'free',
  credits_remaining integer not null default 30,
  bonus_credits_remaining integer not null default 0,
  purchased_credits_remaining integer not null default 0,
  total_processed integer not null default 0,
  subscription_status text not null default 'active',
  subscription_id text,
  polar_customer_id text,
  billing_cycle text,
  monthly_credit_allowance integer,
  credits_last_renewed_at timestamptz,
  next_billing_date timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_subscription_plan_check
    check (subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'pay_as_go', 'small_pack', 'credit_pack')),
  constraint profiles_subscription_status_check
    check (subscription_status in ('active', 'cancelled', 'expired', 'pending')),
  constraint profiles_credits_nonnegative check (credits_remaining >= 0),
  constraint profiles_bonus_credits_nonnegative check (bonus_credits_remaining >= 0),
  constraint profiles_purchased_credits_nonnegative check (purchased_credits_remaining >= 0)
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_subscription_plan_idx on public.profiles (subscription_plan);
create index if not exists profiles_subscription_status_idx on public.profiles (subscription_status);
create index if not exists profiles_next_billing_date_idx
  on public.profiles (next_billing_date)
  where next_billing_date is not null;
create index if not exists profiles_polar_customer_id_idx
  on public.profiles (polar_customer_id)
  where polar_customer_id is not null;

create table if not exists public.usage_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits_used integer not null default 1,
  alt_text_generated text,
  image_context text,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);
create index if not exists usage_logs_created_at_idx
  on public.usage_logs (created_at desc);

create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  payment_id text not null,
  subscription_id text,
  plan_id text references public.subscription_plans(id),
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  payment_method text not null default 'polar',
  polar_product_id text,
  product_name text,
  discount_id text,
  discount_code text,
  discount_name text,
  discount_amount numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_created_at_idx
  on public.payments (user_id, created_at desc);
create index if not exists payments_status_idx
  on public.payments (status)
  where status in ('pending', 'failed');
create index if not exists payments_subscription_id_idx
  on public.payments (subscription_id)
  where subscription_id is not null;
create index if not exists payments_polar_product_id_idx
  on public.payments (polar_product_id)
  where polar_product_id is not null;
create index if not exists payments_discount_code_idx
  on public.payments (discount_code)
  where discount_code is not null;

create table if not exists public.api_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  api_key text not null unique,
  name text not null default 'WordPress Plugin',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_active boolean not null default true
);

create index if not exists api_keys_api_key_idx
  on public.api_keys (api_key)
  where is_active = true;
create index if not exists api_keys_user_id_idx on public.api_keys (user_id);

-- These operational tables previously existed only in production or in
-- hand-applied scripts. Their DDL belongs in the canonical recovery path.
create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

create table if not exists public.marketing_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_name text not null,
  source text not null default 'web_app',
  anonymous_id text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  properties jsonb not null default '{}'::jsonb,
  page_path text,
  referrer text,
  user_agent text,
  ip_address text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists marketing_events_event_name_idx
  on public.marketing_events (event_name, occurred_at desc);
create index if not exists marketing_events_user_id_idx
  on public.marketing_events (user_id, occurred_at desc);
create index if not exists marketing_events_anonymous_id_idx
  on public.marketing_events (anonymous_id, occurred_at desc);

create table if not exists public.marketing_automation_sends (
  id uuid primary key default extensions.gen_random_uuid(),
  automation_key text not null,
  actor_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  source_event_id uuid references public.marketing_events(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  subject text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_key, actor_key)
);

create index if not exists marketing_automation_sends_email_idx
  on public.marketing_automation_sends (user_email, created_at desc);
create index if not exists marketing_automation_sends_status_idx
  on public.marketing_automation_sends (status, created_at desc);
create index if not exists marketing_automation_sends_user_id_idx
  on public.marketing_automation_sends (user_id, created_at desc);
create index if not exists marketing_automation_sends_source_event_id_idx
  on public.marketing_automation_sends (source_event_id);

alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;
alter table public.payments enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.api_keys enable row level security;
alter table public.audit_logs enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_automation_sends enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view own usage logs" on public.usage_logs;
create policy "Users can view own usage logs"
  on public.usage_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own usage logs" on public.usage_logs;
create policy "Users can insert own usage logs"
  on public.usage_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Anyone can view subscription plans" on public.subscription_plans;
create policy "Anyone can view subscription plans"
  on public.subscription_plans for select to anon, authenticated
  using (true);

drop policy if exists "Users can view their own API keys" on public.api_keys;
create policy "Users can view their own API keys"
  on public.api_keys for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own API keys" on public.api_keys;
create policy "Users can insert their own API keys"
  on public.api_keys for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own API keys" on public.api_keys;
create policy "Users can update their own API keys"
  on public.api_keys for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own API keys" on public.api_keys;
create policy "Users can delete their own API keys"
  on public.api_keys for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "No client access" on public.marketing_events;
create policy "No client access"
  on public.marketing_events for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No client access" on public.marketing_automation_sends;
create policy "No client access"
  on public.marketing_automation_sends for all to anon, authenticated
  using (false) with check (false);

revoke all on public.audit_logs from public, anon, authenticated;
revoke all on public.marketing_events from public, anon, authenticated;
revoke all on public.marketing_automation_sends from public, anon, authenticated;
grant all on public.audit_logs to service_role;
grant all on public.marketing_events to service_role;
grant all on public.marketing_automation_sends to service_role;
grant select on public.subscription_plans to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.usage_logs to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert, update, delete on public.api_keys to authenticated;
grant all on public.profiles, public.usage_logs, public.payments, public.subscription_plans, public.api_keys to service_role;

create or replace view public.user_usage_stats as
select
  p.id as user_id,
  count(ul.id)::bigint as total_usage_count,
  coalesce(sum(ul.credits_used), 0)::bigint as total_credits_used,
  max(ul.created_at) as last_usage_at
from public.profiles p
left join public.usage_logs ul on ul.user_id = p.id
group by p.id;

-- Legacy-compatible function signatures required by the first tracked
-- migrations. Later migrations replace their implementations.
create or replace function public.generate_api_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  new_key text;
begin
  loop
    new_key := 'alt_' || encode(extensions.gen_random_bytes(32), 'base64');
    new_key := replace(replace(new_key, '/', '_'), '+', '-');
    exit when not exists (
      select 1 from public.api_keys where api_key = new_key
    );
  end loop;
  return new_key;
end;
$function$;

create or replace function public.get_or_create_api_key(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  existing_key text;
  new_key text;
begin
  select api_key into existing_key
  from public.api_keys
  where user_id = p_user_id and is_active = true
  order by created_at desc
  limit 1;

  if existing_key is not null then
    return existing_key;
  end if;

  new_key := public.generate_api_key();
  insert into public.api_keys (user_id, api_key)
  values (p_user_id, new_key)
  returning api_key into new_key;
  return new_key;
end;
$function$;

create or replace function public.validate_api_key(p_api_key text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.api_keys
  where api_key = p_api_key and is_active = true
  limit 1;

  if v_user_id is not null then
    update public.api_keys
    set last_used_at = now()
    where api_key = p_api_key;
  end if;

  return v_user_id;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  insert into public.profiles (
    id, email, subscription_plan, subscription_status, credits_remaining,
    bonus_credits_remaining, purchased_credits_remaining, total_processed,
    credits_last_renewed_at, created_at, updated_at
  )
  values (
    new.id, coalesce(new.email, ''), 'free', 'active', 30,
    0, 0, 0, now(), now(), now()
  )
  on conflict (id) do update
    set email = excluded.email, updated_at = now();
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.use_credit(
  user_uuid uuid,
  alt_text text,
  context text default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  current_credits integer;
  current_total_processed integer;
  new_credits integer;
  new_total_processed integer;
begin
  select credits_remaining, total_processed
  into current_credits, current_total_processed
  from public.profiles
  where id = user_uuid
  for update;

  if current_credits is null then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  if current_credits <= 0 then
    return json_build_object('success', false, 'error', 'No credits remaining');
  end if;

  new_credits := current_credits - 1;
  new_total_processed := coalesce(current_total_processed, 0) + 1;

  update public.profiles
  set credits_remaining = new_credits,
      total_processed = new_total_processed,
      updated_at = now()
  where id = user_uuid;

  insert into public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  values (user_uuid, 1, alt_text, context);

  return json_build_object(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'total_processed', new_total_processed
  );
end;
$function$;

create or replace function public.renew_monthly_credits()
returns table (renewed_count integer, user_ids uuid[])
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  renewed_users uuid[];
  renewal_count integer := 0;
begin
  with renewed as (
    update public.profiles as p
    set credits_remaining = 30,
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

  return query select renewal_count, coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

create or replace function public.renew_paid_monthly_credits()
returns table (renewed_count integer, user_ids uuid[])
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  renewed_users uuid[];
  renewal_count integer := 0;
begin
  with renewed as (
    update public.profiles as p
    set credits_remaining = coalesce(p.credits_remaining, 0) + p.monthly_credit_allowance,
        credits_last_renewed_at = now(),
        updated_at = now()
    where p.subscription_status = 'active'
      and p.billing_cycle = 'annual'
      and p.monthly_credit_allowance is not null
      and p.monthly_credit_allowance > 0
      and (
        p.credits_last_renewed_at is null
        or p.credits_last_renewed_at <= now() - interval '30 days'
      )
    returning p.id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  return query select renewal_count, coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

create or replace function public.upgrade_subscription(
  user_uuid uuid,
  new_plan text,
  payment_id text,
  subscription_id text default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  plan_credits integer;
  plan_price numeric(10, 2);
begin
  select credits, price into plan_credits, plan_price
  from public.subscription_plans
  where id = $2;

  if plan_credits is null then
    return json_build_object('success', false, 'error', 'Invalid plan');
  end if;

  update public.profiles as p
  set subscription_plan = $2,
      credits_remaining = case
        when $2 in ('pay_as_go', 'small_pack', 'credit_pack')
          then coalesce(p.credits_remaining, 0) + plan_credits
        else plan_credits
      end,
      subscription_status = 'active',
      subscription_id = coalesce($4, p.subscription_id),
      next_billing_date = case
        when $2 in ('tier1', 'tier2', 'tier3') then now() + interval '1 month'
        else null
      end,
      updated_at = now()
  where p.id = $1;

  insert into public.payments (user_id, payment_id, subscription_id, plan_id, amount, status)
  values ($1, $3, $4, $2, plan_price, 'completed');

  return json_build_object(
    'success', true,
    'plan', $2,
    'credits_remaining', (select credits_remaining from public.profiles where id = $1)
  );
end;
$function$;

create or replace function public.cancel_subscription(user_uuid uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  update public.profiles
  set subscription_status = 'cancelled',
      subscription_id = null,
      next_billing_date = null,
      updated_at = now()
  where id = user_uuid;

  return json_build_object('success', true, 'message', 'Subscription cancelled');
end;
$function$;

revoke all on function public.generate_api_key() from public, anon, authenticated;
revoke all on function public.get_or_create_api_key(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.renew_monthly_credits() from public, anon, authenticated;
revoke all on function public.renew_paid_monthly_credits() from public, anon, authenticated;
revoke all on function public.upgrade_subscription(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.use_credit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.validate_api_key(text) from public, anon, authenticated;

grant execute on function public.generate_api_key() to service_role;
grant execute on function public.get_or_create_api_key(uuid) to authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.renew_monthly_credits() to service_role;
grant execute on function public.renew_paid_monthly_credits() to service_role;
grant execute on function public.upgrade_subscription(uuid, text, text, text) to service_role;
grant execute on function public.use_credit(uuid, text, text) to service_role;
grant execute on function public.validate_api_key(text) to service_role;

-- The renewal schedules are part of the database contract. pg_cron is
-- available on Supabase-hosted projects.
create extension if not exists pg_cron;

select cron.unschedule('renew-free-credits')
where exists (select 1 from cron.job where jobname = 'renew-free-credits');

select cron.schedule(
  'renew-free-credits',
  '0 2 * * *',
  $$ select public.renew_monthly_credits(); $$
);

select cron.unschedule('renew-paid-credits')
where exists (select 1 from cron.job where jobname = 'renew-paid-credits');

select cron.schedule(
  'renew-paid-credits',
  '5 2 * * *',
  $$ select public.renew_paid_monthly_credits(); $$
);

-- The legacy public.users table is intentionally not recreated. No current
-- application path references it, and its historical "allow all" policy would
-- reintroduce an unsafe dead schema during recovery.
