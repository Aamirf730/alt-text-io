-- 2026-08 pricing and packages update.
--
-- New catalogue: Free 15/mo (+150 non-expiring signup bonus), Lite $4/150,
-- Standard $9/1000, Pro $14/2000, Agency $19/3500. Annual billing is the
-- monthly price x12 minus 10%, dripped monthly.
--
-- Existing paid subscribers keep the allowance they purchased. Their
-- allowance is pinned before the catalogue update and remains effective while
-- the same Polar subscription and product remain active.

-- ---------------------------------------------------------------------------
-- 1. Pin every existing paid subscriber before changing subscription_plans.
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
-- 2. Record the Polar product backing the active subscription.
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
-- 3. Allow the Agency plan and established aliases on profiles.
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
-- 4. Apply the new public catalogue.
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
-- 5. New accounts receive 15 plan credits plus 150 persistent bonus credits.
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
-- 6. Free renewal: 30 -> 15, preserving persistent ledgers and in-flight
--    plan reservations.
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
-- 7. Revocation lands on the new free allowance while preserving persistent
--    bonus and purchased ledgers.
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

-- ---------------------------------------------------------------------------
-- 8. Preserve the reservation engine and add tier4 to its monthly-plan
--    recognition. Historical migrations remain unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_credit(
  user_uuid uuid,
  credits_to_reserve integer default 1
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_credits integer;
  v_bonus_credits integer;
  v_purchased_credits integer;
  v_subscription_plan text;
  v_monthly_allowance integer;
  v_plan_credits integer;
  v_credits_last_renewed_at timestamptz;
  v_monthly_limit integer;
  v_cycle_credits_used integer;
  v_active_plan_reservations integer;
  v_plan_credits_remaining integer;
  v_credit_source text;
  v_new_credits integer;
  v_new_bonus_credits integer;
  v_new_purchased_credits integer;
  v_new_active_plan_reservations integer;
  v_monthly_credits_remaining integer;
  v_reservation_id uuid;
  v_expired_reservation_id uuid;
begin
  if user_uuid is null then
    return json_build_object('success', false, 'error', 'User UUID is required');
  end if;

  if credits_to_reserve <> 1 then
    return json_build_object('success', false, 'error', 'Only one credit can be reserved per generation');
  end if;

  perform 1
  from public.profiles p
  where p.id = user_uuid
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  for v_expired_reservation_id in
    select r.id
    from public.credit_reservations r
    where r.user_id = user_uuid
      and r.status = 'reserved'
      and r.expires_at <= now()
    order by r.expires_at, r.id
  loop
    perform public.release_credit_reservation(v_expired_reservation_id);
  end loop;

  select
    greatest(
      coalesce(p.credits_remaining, 0),
      coalesce(p.bonus_credits_remaining, 0),
      coalesce(p.purchased_credits_remaining, 0)
    ),
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0),
    p.subscription_plan,
    p.monthly_credit_allowance,
    p.credits_last_renewed_at,
    sp.credits
  into
    v_current_credits,
    v_bonus_credits,
    v_purchased_credits,
    v_subscription_plan,
    v_monthly_allowance,
    v_credits_last_renewed_at,
    v_plan_credits
  from public.profiles p
  left join public.subscription_plans sp on sp.id = p.subscription_plan
  where p.id = user_uuid;

  if v_current_credits <= 0 then
    return json_build_object('success', false, 'error', 'No credits remaining');
  end if;

  v_monthly_limit := coalesce(nullif(v_monthly_allowance, 0), v_plan_credits, 0);
  v_cycle_credits_used := 0;
  v_active_plan_reservations := 0;
  v_plan_credits_remaining := 0;

  if v_subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency') then
    select coalesce(sum(ul.credits_used), 0)::integer
    into v_cycle_credits_used
    from public.usage_logs ul
    where ul.user_id = user_uuid
      and ul.created_at >= coalesce(
        v_credits_last_renewed_at,
        date_trunc('month', now())
      );

    select count(*)::integer
    into v_active_plan_reservations
    from public.credit_reservations r
    where r.user_id = user_uuid
      and r.status = 'reserved'
      and r.credit_source = 'plan'
      and r.expires_at > now();

    v_plan_credits_remaining := greatest(
      0,
      v_monthly_limit
        - v_cycle_credits_used
        - v_active_plan_reservations
    );

    if v_plan_credits_remaining > 0 then
      v_credit_source := 'plan';
    elsif v_bonus_credits > 0 then
      v_credit_source := 'bonus';
    elsif v_purchased_credits > 0 then
      v_credit_source := 'purchased';
    else
      return json_build_object(
        'success', false,
        'error', 'Monthly credits exhausted',
        'credits_remaining', v_current_credits,
        'monthly_credit_limit', v_monthly_limit,
        'monthly_credits_remaining', 0
      );
    end if;
  elsif v_bonus_credits > 0 then
    v_credit_source := 'bonus';
  elsif v_purchased_credits > 0 then
    v_credit_source := 'purchased';
  else
    v_credit_source := 'plan';
  end if;

  v_new_bonus_credits := case
    when v_credit_source = 'bonus' then v_bonus_credits - 1
    else v_bonus_credits
  end;
  v_new_purchased_credits := case
    when v_credit_source = 'purchased' then v_purchased_credits - 1
    else v_purchased_credits
  end;

  if v_monthly_limit > 0 then
    if v_credit_source = 'plan' then
      v_new_credits := v_plan_credits_remaining - 1
        + v_new_bonus_credits
        + v_new_purchased_credits;
      v_new_active_plan_reservations := v_active_plan_reservations + 1;
    else
      v_new_credits := v_new_bonus_credits + v_new_purchased_credits;
      v_new_active_plan_reservations := v_active_plan_reservations;
    end if;
  else
    v_new_credits := v_current_credits - 1;
    v_new_active_plan_reservations := v_active_plan_reservations;
  end if;

  v_new_credits := greatest(
    0,
    v_new_credits,
    v_new_bonus_credits,
    v_new_purchased_credits
  );

  update public.profiles
  set
    credits_remaining = v_new_credits,
    bonus_credits_remaining = v_new_bonus_credits,
    purchased_credits_remaining = v_new_purchased_credits,
    updated_at = now()
  where id = user_uuid;

  insert into public.credit_reservations (
    user_id,
    credit_source
  )
  values (
    user_uuid,
    v_credit_source
  )
  returning id into v_reservation_id;

  if v_monthly_limit > 0 then
    v_monthly_credits_remaining := least(
      v_new_credits,
      greatest(
        0,
        v_monthly_limit
          - v_cycle_credits_used
          - v_new_active_plan_reservations
      )
        + v_new_bonus_credits
        + v_new_purchased_credits
    );
  else
    v_monthly_credits_remaining := v_new_credits;
  end if;

  return json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'credit_source', v_credit_source,
    'credits_remaining', v_new_credits,
    'bonus_credits_remaining', v_new_bonus_credits,
    'purchased_credits_remaining', v_new_purchased_credits,
    'total_processed', v_cycle_credits_used,
    'monthly_credit_limit', v_monthly_limit,
    'monthly_credits_remaining', v_monthly_credits_remaining,
    'expires_at', now() + interval '10 minutes'
  );
exception
  when others then
    raise warning 'Error reserving credit for user %: %', user_uuid, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error reserving credit'
    );
end;
$function$;

create or replace function public.finalize_credit_reservation(
  p_reservation_id uuid,
  p_alt_text text,
  p_context text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_current_credits integer;
  v_bonus_credits integer;
  v_purchased_credits integer;
  v_subscription_plan text;
  v_monthly_allowance integer;
  v_plan_credits integer;
  v_credits_last_renewed_at timestamptz;
  v_monthly_limit integer;
  v_cycle_credits_used integer;
  v_new_total_processed integer;
  v_monthly_credits_remaining integer;
  v_usage_log_id uuid;
begin
  if p_reservation_id is null then
    return json_build_object('success', false, 'error', 'Reservation ID is required');
  end if;

  select r.user_id
  into v_user_id
  from public.credit_reservations r
  where r.id = p_reservation_id;

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Reservation not found');
  end if;

  perform 1
  from public.profiles p
  where p.id = v_user_id
  for update;

  select r.status, r.expires_at
  into v_status, v_expires_at
  from public.credit_reservations r
  where r.id = p_reservation_id
  for update;

  if v_status is null then
    return json_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;

  if v_status = 'released' then
    return json_build_object('success', false, 'error', 'Reservation was released');
  end if;

  if v_expires_at <= now() then
    perform public.release_credit_reservation(p_reservation_id);
    return json_build_object('success', false, 'error', 'Reservation expired');
  end if;

  select
    greatest(
      coalesce(p.credits_remaining, 0),
      coalesce(p.bonus_credits_remaining, 0),
      coalesce(p.purchased_credits_remaining, 0)
    ),
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0),
    p.subscription_plan,
    p.monthly_credit_allowance,
    p.credits_last_renewed_at,
    sp.credits
  into
    v_current_credits,
    v_bonus_credits,
    v_purchased_credits,
    v_subscription_plan,
    v_monthly_allowance,
    v_credits_last_renewed_at,
    v_plan_credits
  from public.profiles p
  left join public.subscription_plans sp on sp.id = p.subscription_plan
  where p.id = v_user_id;

  select coalesce(sum(ul.credits_used), 0)::integer
  into v_cycle_credits_used
  from public.usage_logs ul
  where ul.user_id = v_user_id
    and ul.created_at >= coalesce(
      v_credits_last_renewed_at,
      date_trunc('month', now())
    );

  v_new_total_processed := v_cycle_credits_used + 1;

  insert into public.usage_logs (
    user_id,
    credits_used,
    alt_text_generated,
    image_context
  )
  values (
    v_user_id,
    1,
    p_alt_text,
    p_context
  )
  returning id into v_usage_log_id;

  update public.profiles
  set
    total_processed = v_new_total_processed,
    updated_at = now()
  where id = v_user_id;

  update public.credit_reservations
  set
    status = 'completed',
    completed_at = now()
  where id = p_reservation_id;

  v_monthly_limit := coalesce(nullif(v_monthly_allowance, 0), v_plan_credits, 0);
  if v_subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency')
    and v_monthly_limit > 0 then
    v_monthly_credits_remaining := least(
      v_current_credits,
      greatest(0, v_monthly_limit - v_new_total_processed)
        + v_bonus_credits
        + v_purchased_credits
    );
  else
    v_monthly_credits_remaining := v_current_credits;
  end if;

  return json_build_object(
    'success', true,
    'credits_used', 1,
    'credits_remaining', v_current_credits,
    'bonus_credits_remaining', v_bonus_credits,
    'purchased_credits_remaining', v_purchased_credits,
    'total_processed', v_new_total_processed,
    'monthly_credit_limit', v_monthly_limit,
    'monthly_credits_remaining', v_monthly_credits_remaining,
    'usage_log_id', v_usage_log_id
  );
exception
  when others then
    raise warning 'Error finalizing credit reservation %: %', p_reservation_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error finalizing credit reservation'
    );
end;
$function$;

revoke all on function public.reserve_credit(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_credit(uuid, integer)
  to service_role;

revoke all on function public.finalize_credit_reservation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_credit_reservation(uuid, text, text)
  to service_role;
