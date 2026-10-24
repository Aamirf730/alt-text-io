-- Apply a plan change made inside the current billing period.
--
-- When a customer switches product in the Polar customer portal, Polar sends
-- subscription.updated with the same subscription and the same current
-- period. renew_subscription_credits correctly refuses to grant a second
-- allowance for that period, which used to leave the old plan and allowance
-- in place until the next renewal. This function moves the profile to the new
-- plan immediately and keeps the credits already used this cycle: the plan
-- balance becomes the new allowance minus this cycle's usage and active plan
-- reservations, computed exactly as reserve_credit does. Bonus and purchased
-- ledgers are untouched. It is a no-op when nothing changed, so webhook
-- replays are safe.

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

  select coalesce(sum(ul.credits_used), 0)::integer
  into v_cycle_credits_used
  from public.usage_logs ul
  where ul.user_id = p_user_id
    and ul.created_at >= coalesce(
      v_credits_last_renewed_at,
      date_trunc('month', now())
    );

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
