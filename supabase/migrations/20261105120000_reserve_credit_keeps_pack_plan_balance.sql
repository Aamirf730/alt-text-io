-- Keep the balance of a one-time pack plan when it reserves a credit.
--
-- reserve_credit() rebuilt credits_remaining from the monthly allowance
-- whenever v_monthly_limit > 0. Pack plans (pay_as_go, small_pack,
-- credit_pack, bulk_pack) have catalogue credits in subscription_plans, so
-- the limit is positive for them too, but they skip the allowance
-- calculation and v_plan_credits_remaining stays 0. A legacy pack profile
-- whose credits sit only in credits_remaining was set to 0 on its first
-- generation (0 - 1 + 0 + 0, clamped), and spending a bonus credit dropped
-- everything outside the bonus and purchased ledgers.
--
-- The monthly balance math now runs only for subscription plans, the same
-- check finalize_credit_reservation() already makes. Every other plan
-- spends one credit from the aggregate balance, as before 2026-08.
--
-- Copied from 20261029110100_count_plan_usage_by_credit_source.sql with only
-- that condition changed. Signature, return shape and grants are unchanged
-- (create or replace keeps the existing grants).

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
  v_is_monthly_plan boolean;
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
  -- Only subscription plans have a monthly allowance. One-time pack plans
  -- (pay_as_go, small_pack, credit_pack, bulk_pack) also have catalogue
  -- credits, so v_monthly_limit alone would treat them as monthly and
  -- rebuild their balance from an allowance that is never calculated.
  v_is_monthly_plan := v_subscription_plan in ('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency')
    and v_monthly_limit > 0;
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

  if v_is_monthly_plan then
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

  if v_is_monthly_plan then
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
