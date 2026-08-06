-- M3: reserve a credit before calling the external AI provider.
--
-- A reservation is intentionally separate from usage_logs. The profile balance
-- is reduced before Gemini is called, which makes concurrent requests compete
-- for the same atomic balance. A successful request finalizes the reservation
-- into usage_logs; an AI failure releases it so failed generations are not
-- charged. Expired reservations are released the next time that user reserves.

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_source text not null check (credit_source in ('plan', 'bonus', 'purchased')),
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'released')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  completed_at timestamptz,
  released_at timestamptz
);

create index if not exists credit_reservations_user_active_idx
  on public.credit_reservations (user_id, credit_source, expires_at)
  where status = 'reserved';

alter table public.credit_reservations enable row level security;
revoke all on table public.credit_reservations from public, anon, authenticated;
grant all on table public.credit_reservations to service_role;

comment on table public.credit_reservations is
  'Short-lived AI credit reservations. Service-role functions finalize or release them.';

create or replace function public.release_credit_reservation(
  p_reservation_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_status text;
  v_credit_source text;
  v_current_credits integer;
  v_bonus_credits integer;
  v_purchased_credits integer;
  v_new_credits integer;
  v_new_bonus_credits integer;
  v_new_purchased_credits integer;
begin
  if p_reservation_id is null then
    return json_build_object('success', false, 'error', 'Reservation ID is required');
  end if;

  -- Read the owner before taking locks. All reservation lifecycle functions
  -- lock the profile first and the reservation second, preventing deadlocks.
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

  select r.status, r.credit_source
  into v_status, v_credit_source
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
    return json_build_object('success', true, 'already_released', true);
  end if;

  select
    greatest(
      coalesce(p.credits_remaining, 0),
      coalesce(p.bonus_credits_remaining, 0),
      coalesce(p.purchased_credits_remaining, 0)
    ),
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0)
  into
    v_current_credits,
    v_bonus_credits,
    v_purchased_credits
  from public.profiles p
  where p.id = v_user_id;

  v_new_bonus_credits := case
    when v_credit_source = 'bonus' then v_bonus_credits + 1
    else v_bonus_credits
  end;
  v_new_purchased_credits := case
    when v_credit_source = 'purchased' then v_purchased_credits + 1
    else v_purchased_credits
  end;
  v_new_credits := greatest(
    v_current_credits + 1,
    v_new_bonus_credits,
    v_new_purchased_credits
  );

  update public.profiles
  set
    credits_remaining = v_new_credits,
    bonus_credits_remaining = v_new_bonus_credits,
    purchased_credits_remaining = v_new_purchased_credits,
    updated_at = now()
  where id = v_user_id;

  update public.credit_reservations
  set
    status = 'released',
    released_at = now()
  where id = p_reservation_id;

  return json_build_object(
    'success', true,
    'released', true,
    'credits_remaining', v_new_credits,
    'bonus_credits_remaining', v_new_bonus_credits,
    'purchased_credits_remaining', v_new_purchased_credits
  );
exception
  when others then
    raise warning 'Error releasing credit reservation %: %', p_reservation_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error releasing credit reservation'
    );
end;
$function$;

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

  -- The profile row is the serialization point for all reservations for a
  -- user. The external Gemini request happens after this transaction ends.
  perform 1
  from public.profiles p
  where p.id = user_uuid
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  -- Recover abandoned reservations without requiring a separate cron job.
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

  if v_subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro') then
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
    -- Preserve the legacy non-monthly aggregate path for profiles that have
    -- usable credits but no recognized monthly plan.
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
  if v_subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro')
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

revoke all on function public.release_credit_reservation(uuid)
  from public, anon, authenticated;
grant execute on function public.release_credit_reservation(uuid)
  to service_role;

-- Renewals must preserve plan credits that are already reserved by an
-- in-flight generation. Persistent reservations have already been removed
-- from their bonus/purchased ledger, so only plan reservations are subtracted
-- from the newly issued monthly allowance.
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
        30
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

create or replace function public.renew_paid_monthly_credits()
returns table(
  renewed_count integer,
  user_ids uuid[]
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
        coalesce(p.monthly_credit_allowance, 0)
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
      total_processed = 0,
      credits_last_renewed_at = now(),
      updated_at = now()
    where p.billing_cycle = 'annual'
      and p.monthly_credit_allowance is not null
      and p.monthly_credit_allowance > 0
      and (
        p.subscription_status = 'active'
        or (
          p.subscription_status = 'cancelled'
          and p.next_billing_date is not null
          and p.next_billing_date > now()
        )
      )
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
  select renewal_count, coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_paid_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_paid_monthly_credits()
  to service_role;
