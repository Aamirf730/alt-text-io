-- Harden activate_subscription_profile() against replays and a second
-- subscription.
--
-- 1. Period guard. The no-op check only matched when subscription_id and
--    next_billing_date were both identical. A replayed or late
--    subscription.active for the bound subscription with an earlier period
--    end (for example after a renewal) granted the full allowance again,
--    reset credits_last_renewed_at so this cycle's usage dropped out of
--    reserve_credit's window, and moved next_billing_date back. It now
--    no-ops for the bound subscription unless the period end is later than
--    the stored one, or when the event has no period end.
--
-- 2. Mismatch guard. A subscription.active for a different subscription
--    replaced a still-active paid one without any check, leaving the old one
--    billing while its events were ignored. The function now returns
--    success with reason 'subscription_mismatch' and changes nothing; the
--    webhook queues the event in payment_reconciliation. A bound
--    subscription that is cancelled (ends at period end) can still be
--    replaced, so a customer can re-subscribe.
--
-- Copied from 20261029110000_billing_lifecycle_refunds_and_reconciliation.sql
-- with only those changes. Signature and grants are unchanged (create or
-- replace keeps the existing grants). The return value gains 'activated'
-- and, for a mismatch, 'reason'.

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
  v_existing_plan text;
  v_existing_status text;
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
    p.next_billing_date,
    p.subscription_plan,
    p.subscription_status
  into
    v_bonus_credits,
    v_purchased_credits,
    v_current_credits,
    v_existing_subscription_id,
    v_existing_next_billing_date,
    v_existing_plan,
    v_existing_status
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  -- The same subscription is already bound. Activation only grants the
  -- first period; later periods are granted by renew_subscription_credits.
  -- A redelivered or replayed event for the current or an earlier period,
  -- or one without a period end, must not grant the allowance again or
  -- reset this cycle's usage.
  if v_existing_subscription_id = trim(p_subscription_id)
    and (
      v_existing_next_billing_date is not distinct from p_next_billing_date
      or p_next_billing_date is null
      or (
        v_existing_next_billing_date is not null
        and p_next_billing_date <= v_existing_next_billing_date
      )
    )
  then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'credits_remaining', v_current_credits,
      'bonus_credits_remaining', v_bonus_credits,
      'purchased_credits_remaining', v_purchased_credits
    );
  end if;

  -- A different paid subscription is still live on this profile (checkout
  -- refuses a second one, so this came from outside the app). Do not
  -- replace it: the old one would keep billing while its events are
  -- ignored. The caller queues the event for an operator.
  if v_existing_subscription_id is not null
    and v_existing_subscription_id <> trim(p_subscription_id)
    and coalesce(v_existing_plan, 'free') <> 'free'
    and v_existing_status in ('active', 'past_due')
  then
    return json_build_object(
      'success', true,
      'already_processed', false,
      'activated', false,
      'reason', 'subscription_mismatch',
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
    polar_customer_id = coalesce(
      nullif(trim(coalesce(p_polar_customer_id, '')), ''),
      polar_customer_id
    ),
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
    'activated', true,
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
