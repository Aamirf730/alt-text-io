-- Make subscription activation safe to replay.
--
-- Polar retries webhook deliveries. A duplicate subscription.active event for
-- the same active subscription period must not reset credits_remaining or
-- total_processed, because doing so would restore credits already spent.
-- next_billing_date is the period boundary already persisted by the activation
-- RPC. The row lock makes two concurrent deliveries serialize before this
-- subscription/period check runs.

create or replace function public.activate_subscription_profile(
  p_user_id uuid,
  p_subscription_id text,
  p_subscription_plan text,
  p_polar_customer_id text default null,
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
  v_existing_next_billing_date timestamptz;
  v_allowance integer;
  v_updated_user_id uuid;
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

  if nullif(trim(coalesce(p_billing_cycle, '')), '') is null then
    return json_build_object('success', false, 'error', 'Billing cycle is required');
  end if;

  v_allowance := greatest(coalesce(p_monthly_credit_allowance, 0), 0);

  select
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0),
    coalesce(p.credits_remaining, 0),
    p.subscription_id,
    p.next_billing_date
  into
    v_bonus_credits,
    v_purchased_credits,
    v_current_credits,
    v_existing_subscription_id,
    v_existing_next_billing_date
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  if v_existing_subscription_id = trim(p_subscription_id)
    and v_existing_next_billing_date is not distinct from p_next_billing_date
  then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'credits_remaining', v_current_credits,
      'bonus_credits_remaining', v_bonus_credits,
      'purchased_credits_remaining', v_purchased_credits
    );
  end if;

  update public.profiles
  set
    credits_remaining = v_allowance + v_bonus_credits + v_purchased_credits,
    total_processed = 0,
    subscription_plan = trim(p_subscription_plan),
    subscription_status = 'active',
    subscription_id = trim(p_subscription_id),
    polar_customer_id = nullif(trim(coalesce(p_polar_customer_id, '')), ''),
    polar_product_id = nullif(trim(coalesce(p_polar_product_id, '')), ''),
    billing_cycle = trim(p_billing_cycle),
    monthly_credit_allowance = nullif(v_allowance, 0),
    next_billing_date = p_next_billing_date,
    credits_last_renewed_at = now(),
    updated_at = now()
  where id = p_user_id
  returning id into v_updated_user_id;

  if v_updated_user_id is null then
    return json_build_object('success', false, 'error', 'Profile update failed');
  end if;

  return json_build_object(
    'success', true,
    'already_processed', false,
    'credits_remaining', v_allowance + v_bonus_credits + v_purchased_credits,
    'bonus_credits_remaining', v_bonus_credits,
    'purchased_credits_remaining', v_purchased_credits
  );
exception
  when others then
    raise warning 'Error activating subscription for user %: %', p_user_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during subscription activation'
    );
end;
$function$;

revoke all on function public.activate_subscription_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.activate_subscription_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz
) to service_role;
