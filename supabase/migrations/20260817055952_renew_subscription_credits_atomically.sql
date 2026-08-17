-- Make subscription.updated renewal fulfillment atomic and replay-safe.
--
-- The webhook must not read a profile, calculate a replacement balance in
-- JavaScript, and then write it back. This function locks the profile before
-- checking the subscription and period, so credit debits and duplicate
-- deliveries serialize against the renewal decision.

create or replace function public.renew_subscription_credits(
  p_user_id uuid,
  p_subscription_id text,
  p_subscription_plan text,
  p_current_period_start timestamptz,
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
  v_bonus_credits integer;
  v_purchased_credits integer;
  v_current_credits integer;
  v_existing_subscription_id text;
  v_last_renewed_at timestamptz;
  v_allowance integer;
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

  if p_current_period_start is null then
    return json_build_object('success', false, 'error', 'Current period start is required');
  end if;

  if nullif(trim(coalesce(p_billing_cycle, '')), '') is null then
    return json_build_object('success', false, 'error', 'Billing cycle is required');
  end if;

  v_allowance := greatest(coalesce(p_monthly_credit_allowance, 0), 0);

  select
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0),
    coalesce(p.credits_remaining, 0),
    p.subscription_id,
    p.credits_last_renewed_at
  into
    v_bonus_credits,
    v_purchased_credits,
    v_current_credits,
    v_existing_subscription_id,
    v_last_renewed_at
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  -- A profile already bound to another subscription must not be rebound by a
  -- stale or out-of-order provider event.
  if v_existing_subscription_id is not null
    and v_existing_subscription_id <> trim(p_subscription_id)
  then
    return json_build_object(
      'success', true,
      'renewed', false,
      'already_processed', false,
      'reason', 'subscription_mismatch',
      'credits_remaining', v_current_credits,
      'bonus_credits_remaining', v_bonus_credits,
      'purchased_credits_remaining', v_purchased_credits
    );
  end if;

  -- The row lock above makes this check authoritative at commit time. A
  -- duplicate delivery that read the old period before waiting on the lock is
  -- treated as already processed after the first delivery commits.
  if v_last_renewed_at is not null
    and p_current_period_start <= v_last_renewed_at
  then
    return json_build_object(
      'success', true,
      'renewed', false,
      'already_processed', true,
      'reason', 'period_already_processed',
      'credits_remaining', v_current_credits,
      'bonus_credits_remaining', v_bonus_credits,
      'purchased_credits_remaining', v_purchased_credits
    );
  end if;

  -- Preserve persistent promotional/purchased ledgers, while resetting the
  -- plan allowance for this billing period. All values come from the locked
  -- row, so a debit that committed before this point cannot be overwritten.
  v_new_credits := v_allowance + v_bonus_credits + v_purchased_credits;

  update public.profiles
  set
    credits_remaining = v_new_credits,
    total_processed = 0,
    subscription_status = 'active',
    subscription_id = trim(p_subscription_id),
    subscription_plan = trim(p_subscription_plan),
    polar_product_id = nullif(trim(coalesce(p_polar_product_id, '')), ''),
    next_billing_date = p_next_billing_date,
    billing_cycle = trim(p_billing_cycle),
    monthly_credit_allowance = nullif(v_allowance, 0),
    credits_last_renewed_at = now(),
    updated_at = now()
  where id = p_user_id;

  return json_build_object(
    'success', true,
    'renewed', true,
    'already_processed', false,
    'credits_remaining', v_new_credits,
    'bonus_credits_remaining', v_bonus_credits,
    'purchased_credits_remaining', v_purchased_credits
  );
exception
  when others then
    raise warning 'Error renewing subscription for user %: %', p_user_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during subscription renewal'
    );
end;
$function$;

revoke all on function public.renew_subscription_credits(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.renew_subscription_credits(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  timestamptz
) to service_role;
