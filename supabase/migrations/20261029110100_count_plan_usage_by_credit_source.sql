-- Count only plan-source usage against the monthly allowance (audit 4,
-- "mid-period upgrade credit math").
--
-- usage_logs had no record of which ledger paid for a generation, so
-- reserve_credit and change_subscription_plan subtracted every generation
-- this cycle -- including ones paid from bonus or credit-pack ledgers --
-- from the plan allowance. Example: a Starter subscriber who spent 500 plan
-- and 300 pack credits and then upgraded to Growth got 1,500 - 800 = 700
-- plan credits instead of 1,000.
--
-- usage_logs.credit_source is now written by finalize_credit_reservation
-- from the reservation's own source ('plan', 'bonus' or 'purchased').
--
-- Historic rows: credit_source is NULL for every generation logged before
-- this migration. We cannot tell which ledger paid for them, so NULL is
-- counted as plan usage. That is the conservative choice: it can only
-- under-state the plan credits left in the cycle that is running when this
-- is applied (the same result as before this migration), never grant
-- credits that were already spent. From the next renewal on, every row in
-- the cycle carries a source.
--
-- Function signatures, return shapes and grants are unchanged.

alter table public.usage_logs
  add column if not exists credit_source text;

comment on column public.usage_logs.credit_source is
  'Ledger that paid for this generation (plan, bonus, purchased). NULL = logged before 2026-10-29; treated as plan.';

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.usage_logs'::regclass
      and conname = 'usage_logs_credit_source_check'
  ) then
    alter table public.usage_logs
      add constraint usage_logs_credit_source_check
      check (credit_source is null or credit_source in ('plan', 'bonus', 'purchased'));
  end if;
end
$constraints$;

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
    -- Only plan-source usage counts against the monthly allowance. Rows
    -- written before usage_logs.credit_source existed are NULL and count as
    -- plan usage (the conservative reading; see the header).
    select coalesce(sum(ul.credits_used), 0)::integer
    into v_cycle_credits_used
    from public.usage_logs ul
    where ul.user_id = user_uuid
      and ul.created_at >= coalesce(
        v_credits_last_renewed_at,
        date_trunc('month', now())
      )
      and coalesce(ul.credit_source, 'plan') = 'plan';

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
  v_credit_source text;
  v_cycle_plan_credits_used integer;
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

  select r.status, r.expires_at, r.credit_source
  into v_status, v_expires_at, v_credit_source
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

  -- total_processed stays "generations this cycle" (every source); the
  -- monthly allowance math below uses plan-source usage only. NULL
  -- credit_source rows predate the column and count as plan usage.
  select
    coalesce(sum(ul.credits_used), 0)::integer,
    coalesce(sum(ul.credits_used) filter (
      where coalesce(ul.credit_source, 'plan') = 'plan'
    ), 0)::integer
  into v_cycle_credits_used, v_cycle_plan_credits_used
  from public.usage_logs ul
  where ul.user_id = v_user_id
    and ul.created_at >= coalesce(
      v_credits_last_renewed_at,
      date_trunc('month', now())
    );

  v_new_total_processed := v_cycle_credits_used + 1;
  if v_credit_source = 'plan' then
    v_cycle_plan_credits_used := v_cycle_plan_credits_used + 1;
  end if;

  insert into public.usage_logs (
    user_id,
    credits_used,
    alt_text_generated,
    image_context,
    credit_source
  )
  values (
    v_user_id,
    1,
    p_alt_text,
    p_context,
    v_credit_source
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
      greatest(0, v_monthly_limit - v_cycle_plan_credits_used)
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
    'monthly_plan_credits_used', v_cycle_plan_credits_used,
    'credit_source', v_credit_source,
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

create or replace function public.change_subscription_plan(
  p_user_id uuid,
  p_subscription_id text,
  p_subscription_plan text,
  p_polar_product_id text default null,
  p_billing_cycle text default 'monthly',
  p_monthly_credit_allowance integer default 0,
  p_next_billing_date timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_subscription_id text;
  v_existing_plan text;
  v_existing_product_id text;
  v_existing_billing_cycle text;
  v_existing_allowance integer;
  v_bonus_credits integer;
  v_purchased_credits integer;
  v_current_credits integer;
  v_credits_last_renewed_at timestamptz;
  v_allowance integer;
  v_product_id text;
  v_cycle_credits_used integer;
  v_active_plan_reservations integer;
  v_plan_credits_remaining integer;
  v_new_credits integer;
begin
  if p_user_id is null then
    return json_build_object('success', false, 'error', 'User ID is required');
  end if;

  if nullif(trim(coalesce(p_subscription_id, '')), '') is null then
    return json_build_object('success', false, 'error', 'Subscription ID is required');
  end if;

  if nullif(trim(coalesce(p_subscription_plan, '')), '') is null then
    return json_build_object('success', false, 'error', 'Subscription plan is required');
  end if;

  if trim(coalesce(p_billing_cycle, '')) not in ('monthly', 'annual') then
    return json_build_object('success', false, 'error', 'Billing cycle must be monthly or annual');
  end if;

  v_allowance := greatest(coalesce(p_monthly_credit_allowance, 0), 0);
  if v_allowance = 0 then
    return json_build_object('success', false, 'error', 'Monthly credit allowance is required');
  end if;

  v_product_id := nullif(trim(coalesce(p_polar_product_id, '')), '');

  select
    p.subscription_id,
    p.subscription_plan,
    p.polar_product_id,
    p.billing_cycle,
    coalesce(p.monthly_credit_allowance, 0),
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0),
    coalesce(p.credits_remaining, 0),
    p.credits_last_renewed_at
  into
    v_existing_subscription_id,
    v_existing_plan,
    v_existing_product_id,
    v_existing_billing_cycle,
    v_existing_allowance,
    v_bonus_credits,
    v_purchased_credits,
    v_current_credits,
    v_credits_last_renewed_at
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  -- Only the subscription currently bound to the profile may change its plan.
  if v_existing_subscription_id is null
    or v_existing_subscription_id <> trim(p_subscription_id)
  then
    return json_build_object(
      'success', true,
      'changed', false,
      'reason', 'subscription_mismatch'
    );
  end if;

  if v_existing_plan = trim(p_subscription_plan)
    and v_existing_product_id is not distinct from v_product_id
    and v_existing_billing_cycle is not distinct from trim(p_billing_cycle)
    and v_existing_allowance = v_allowance
  then
    return json_build_object(
      'success', true,
      'changed', false,
      'reason', 'no_change'
    );
  end if;

  -- Only plan-source usage this cycle reduces the new allowance. Bonus and
  -- pack credits spent this cycle came out of their own ledgers. NULL
  -- credit_source rows predate the column and count as plan usage.
  select coalesce(sum(ul.credits_used), 0)::integer
  into v_cycle_credits_used
  from public.usage_logs ul
  where ul.user_id = p_user_id
    and ul.created_at >= coalesce(
      v_credits_last_renewed_at,
      date_trunc('month', now())
    )
    and coalesce(ul.credit_source, 'plan') = 'plan';

  select count(*)::integer
  into v_active_plan_reservations
  from public.credit_reservations r
  where r.user_id = p_user_id
    and r.status = 'reserved'
    and r.credit_source = 'plan'
    and r.expires_at > now();

  v_plan_credits_remaining := greatest(
    0,
    v_allowance - v_cycle_credits_used - v_active_plan_reservations
  );
  v_new_credits := v_plan_credits_remaining + v_bonus_credits + v_purchased_credits;

  update public.profiles
  set
    credits_remaining = v_new_credits,
    subscription_plan = trim(p_subscription_plan),
    polar_product_id = v_product_id,
    billing_cycle = trim(p_billing_cycle),
    monthly_credit_allowance = v_allowance,
    next_billing_date = coalesce(p_next_billing_date, next_billing_date),
    updated_at = now()
  where id = p_user_id;

  return json_build_object(
    'success', true,
    'changed', true,
    'previous_plan', v_existing_plan,
    'monthly_credit_allowance', v_allowance,
    'monthly_credits_remaining', v_plan_credits_remaining,
    'credits_remaining', v_new_credits
  );
exception
  when others then
    raise warning 'Error changing subscription plan for user %: %', p_user_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during subscription plan change'
    );
end;
$function$;

revoke all on function public.change_subscription_plan(
  uuid, text, text, text, text, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.change_subscription_plan(
  uuid, text, text, text, text, integer, timestamptz
) to service_role;
