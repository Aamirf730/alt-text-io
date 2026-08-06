-- Keep cancelled annual subscriptions eligible for their paid monthly drip
-- until the provider's period-end timestamp, then revoke paid access only
-- when Polar sends subscription.revoked.

-- Track a paid-pack revocation so order.refunded and refund.created can be
-- safely delivered in either order or more than once.
alter table public.credit_pack_grants
  add column if not exists revoked_at timestamptz;

create index if not exists credit_pack_grants_active_payment_idx
  on public.credit_pack_grants(payment_id)
  where revoked_at is null;

comment on column public.credit_pack_grants.revoked_at is
  'When Polar revoked the unspent portion of this paid credit pack.';

-- Use one audited path for promotional grants. The aggregate balance and the
-- persistent promotional ledger must move together; otherwise monthly-limit
-- enforcement can strand credits that still appear on the dashboard.
create or replace function public.grant_promotional_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_credits integer;
  current_bonus_credits integer;
  current_purchased_credits integer;
  new_credits_remaining integer;
  new_bonus_credits_remaining integer;
  reason_text text;
begin
  reason_text := nullif(btrim(p_reason), '');

  if p_user_id is null
    or p_credits is null
    or p_credits <= 0
    or reason_text is null
    or length(reason_text) > 500 then
    return json_build_object(
      'success', false,
      'error', 'Invalid promotional credit grant'
    );
  end if;

  select
    greatest(coalesce(p.credits_remaining, 0), 0),
    coalesce(p.bonus_credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0)
  into current_credits, current_bonus_credits, current_purchased_credits
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'error', 'User not found'
    );
  end if;

  current_credits := greatest(
    current_credits,
    current_bonus_credits,
    current_purchased_credits
  );

  update public.profiles
  set
    credits_remaining = current_credits + p_credits,
    bonus_credits_remaining = current_bonus_credits + p_credits,
    updated_at = now()
  where id = p_user_id
  returning credits_remaining, bonus_credits_remaining
  into new_credits_remaining, new_bonus_credits_remaining;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    action,
    resource_type,
    resource_id,
    details,
    severity
  )
  values (
    null,
    null,
    'credit.add',
    'promotional_credit',
    p_user_id::text,
    jsonb_build_object(
      'credits_added', p_credits,
      'reason', reason_text,
      'credits_remaining_before', current_credits,
      'credits_remaining_after', new_credits_remaining,
      'bonus_credits_remaining_before', current_bonus_credits,
      'bonus_credits_remaining_after', new_bonus_credits_remaining
    ),
    'info'
  );

  return json_build_object(
    'success', true,
    'credits_added', p_credits,
    'reason', reason_text,
    'credits_remaining', new_credits_remaining,
    'bonus_credits_remaining', new_bonus_credits_remaining,
    'purchased_credits_remaining', current_purchased_credits
  );
exception
  when others then
    raise warning 'Error granting promotional credits for user %: %', p_user_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during promotional credit grant'
    );
end;
$function$;

comment on function public.grant_promotional_credits(uuid, integer, text) is
  'Atomically grants promotional credits to the aggregate and persistent bonus ledgers and records the reason in audit_logs.';

revoke all on function public.grant_promotional_credits(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.grant_promotional_credits(uuid, integer, text)
  to service_role;

-- Atomically remove subscription-cycle credits when paid access actually ends
-- while preserving the separate promotional and purchased ledgers. Grant the
-- normal free-tier allowance immediately so a downgrade cannot wait for the
-- next 30-day cron boundary.
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
    credits_remaining = 30
      + coalesce(bonus_credits_remaining, 0)
      + coalesce(purchased_credits_remaining, 0),
    total_processed = 0,
    subscription_plan = 'free',
    subscription_status = 'active',
    subscription_id = null,
    billing_cycle = null,
    monthly_credit_allowance = null,
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

create or replace function public.revoke_credit_pack_purchase(
  p_payment_id text
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  grant_user_id uuid;
  grant_credits integer;
  grant_revoked_at timestamptz;
  current_credits integer;
  current_purchased_credits integer;
  revoked_credits integer;
begin
  if nullif(trim(p_payment_id), '') is null then
    return json_build_object(
      'success', false,
      'error', 'Payment ID is required'
    );
  end if;

  select
    g.user_id,
    g.credits,
    g.revoked_at
  into grant_user_id, grant_credits, grant_revoked_at
  from public.credit_pack_grants g
  where g.payment_id = trim(p_payment_id)
  for update;

  if not found then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'grant_found', false
    );
  end if;

  if grant_revoked_at is not null then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'grant_found', true,
      'revoked_credits', 0
    );
  end if;

  select
    coalesce(p.credits_remaining, 0),
    coalesce(p.purchased_credits_remaining, 0)
  into current_credits, current_purchased_credits
  from public.profiles p
  where p.id = grant_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  end if;

  revoked_credits := least(grant_credits, current_purchased_credits);

  update public.credit_pack_grants
  set revoked_at = now()
  where payment_id = trim(p_payment_id);

  update public.profiles
  set
    purchased_credits_remaining = current_purchased_credits - revoked_credits,
    credits_remaining = greatest(0, current_credits - revoked_credits),
    updated_at = now()
  where id = grant_user_id;

  return json_build_object(
    'success', true,
    'already_processed', false,
    'grant_found', true,
    'revoked_credits', revoked_credits
  );
exception
  when others then
    raise warning 'Error revoking credit pack for payment %: %', p_payment_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during credit-pack revocation'
    );
end;
$function$;

revoke all on function public.revoke_credit_pack_purchase(text)
  from public, anon, authenticated;
grant execute on function public.revoke_credit_pack_purchase(text)
  to service_role;

-- A cancellation is still entitled to the paid period. Once the stored end
-- timestamp passes, the webhook should have revoked the subscription, but
-- this guard also prevents a delayed/missing revoke event from granting a
-- new monthly drip after access has ended.
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
    update public.profiles
    set
      credits_remaining = credits_remaining + monthly_credit_allowance,
      total_processed = 0,
      credits_last_renewed_at = now(),
      updated_at = now()
    where
      billing_cycle = 'annual'
      and monthly_credit_allowance is not null
      and monthly_credit_allowance > 0
      and (
        subscription_status = 'active'
        or (
          subscription_status = 'cancelled'
          and next_billing_date is not null
          and next_billing_date > now()
        )
      )
      and (
        credits_last_renewed_at is null
        or credits_last_renewed_at <= now() - interval '30 days'
      )
    returning id
  )
  select
    array_agg(id),
    count(*)::integer
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
