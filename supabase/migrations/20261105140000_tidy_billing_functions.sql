-- Tidy-ups from the 2026-11-05 review (low severity; nothing here was
-- causing wrong charges). Each function is copied from its latest
-- definition with only the change described here; signatures, return
-- shapes (except added fields) and grants are unchanged.
--
-- 1. renew_subscription_credits, revoke_subscription_access and
--    activate_subscription_profile subtract plan reservations still in
--    flight from the fresh allowance, as the cron renewals and
--    reserve_credit already do. Before, credits_remaining read one too high
--    until the next reserve recalculated it (nothing was ever free).
-- 2. activate_subscription_profile keeps the stored polar_product_id when
--    the same subscription is re-activated without one (as it already does
--    for polar_customer_id).
-- 3. finalize_credit_reservation returns the current balances on a repeated
--    finalize instead of none.
-- 4. prepare_account_deletion matches marketing_events.user_email
--    case-insensitively, like marketing_automation_sends.
-- 5. admin_dashboard_stats counts MRR from the latest payment net of tax and
--    refunds (payment_net_revenue), like total revenue.
-- 6. issue_api_key and touch_plugin_site use search_path = '' like every
--    other SECURITY DEFINER function (both already qualify every table).
-- 7. The legacy get_or_create_api_key() and generate_api_key() are dropped.
--    Both were revoked from every client role and nothing calls them;
--    issue_api_key replaced them.

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
  v_active_plan_reservations integer;
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
  -- A generation still in flight on the plan counts against the new
  -- allowance, as in the cron renewals and reserve_credit.
  select count(*)::integer
  into v_active_plan_reservations
  from public.credit_reservations r
  where r.user_id = p_user_id
    and r.status = 'reserved'
    and r.credit_source = 'plan'
    and r.expires_at > now();

  v_new_credits := greatest(0, v_allowance - v_active_plan_reservations)
    + v_bonus_credits + v_purchased_credits;

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
  existing_subscription_id text;
  existing_subscription_plan text;
  existing_billing_cycle text;
  normalized_subscription_id text;
  free_allowance integer;
  v_active_plan_reservations integer;
begin
  if p_user_id is null then
    return json_build_object(
      'success', false,
      'error', 'User ID is required'
    );
  end if;

  normalized_subscription_id := nullif(btrim(p_subscription_id), '');

  select
    p.subscription_id,
    p.subscription_plan,
    p.billing_cycle
  into
    existing_subscription_id,
    existing_subscription_plan,
    existing_billing_cycle
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'error', 'User not found'
    );
  end if;

  if normalized_subscription_id is not null
    and existing_subscription_id is not null
    and existing_subscription_id <> normalized_subscription_id then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'stale_subscription', true
    );
  end if;

  if existing_subscription_plan = 'free'
    and existing_subscription_id is null
    and existing_billing_cycle is null then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'stale_subscription', false
    );
  end if;

  select coalesce(sp.credits, 15)
  into free_allowance
  from public.subscription_plans sp
  where sp.id = 'free';
  free_allowance := coalesce(free_allowance, 15);

  select count(*)::integer
  into v_active_plan_reservations
  from public.credit_reservations r
  where r.user_id = p_user_id
    and r.status = 'reserved'
    and r.credit_source = 'plan'
    and r.expires_at > now();

  update public.profiles
  set
    credits_remaining = greatest(0, free_allowance - v_active_plan_reservations)
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
  where id = p_user_id;

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
  v_active_plan_reservations integer;
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

  select count(*)::integer
  into v_active_plan_reservations
  from public.credit_reservations r
  where r.user_id = p_user_id
    and r.status = 'reserved'
    and r.credit_source = 'plan'
    and r.expires_at > now();

  update public.profiles
  set
    credits_remaining = greatest(0, v_allowance - v_active_plan_reservations) + v_bonus_credits + v_purchased_credits,
    total_processed = 0,
    subscription_plan = trim(p_subscription_plan),
    subscription_status = 'active',
    subscription_id = trim(p_subscription_id),
    polar_customer_id = coalesce(
      nullif(trim(coalesce(p_polar_customer_id, '')), ''),
      polar_customer_id
    ),
    -- Keep the stored product when the same subscription is re-activated
    -- without one (like polar_customer_id); a new subscription always
    -- takes its own product.
    polar_product_id = case
      when v_existing_subscription_id = trim(p_subscription_id)
        then coalesce(nullif(trim(coalesce(p_polar_product_id, '')), ''), polar_product_id)
      else nullif(trim(coalesce(p_polar_product_id, '')), '')
    end,
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
    'credits_remaining', greatest(0, v_allowance - v_active_plan_reservations) + v_bonus_credits + v_purchased_credits,
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
    -- A repeated finalize reports the current balances instead of none
    -- (callers would read missing balances as 0 credits).
    return (
      select json_build_object(
        'success', true,
        'already_completed', true,
        'credits_remaining', coalesce(p.credits_remaining, 0),
        'bonus_credits_remaining', coalesce(p.bonus_credits_remaining, 0),
        'purchased_credits_remaining', coalesce(p.purchased_credits_remaining, 0),
        'total_processed', coalesce(p.total_processed, 0)
      )
      from public.profiles p
      where p.id = v_user_id
    );
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

create or replace function public.prepare_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := nullif(lower(btrim(coalesce(old.email, ''))), '');
begin
  update public.payments
  set
    user_email_at_deletion = coalesce(user_email_at_deletion, v_email),
    user_deleted_at = now(),
    updated_at = now()
  where user_id = old.id;

  update public.marketing_events
  set
    user_email = null,
    ip_address = null,
    user_agent = null
  where user_id = old.id
     or (v_email is not null and lower(user_email) = v_email);

  -- actor_key can embed the email ("email:<address>"); replace it with a
  -- stable hash so the (automation_key, actor_key) dedupe key stays unique.
  update public.marketing_automation_sends
  set
    user_email = null,
    actor_key = case
      when actor_key like 'email:%' then 'deleted:' || md5(actor_key)
      else actor_key
    end,
    updated_at = now()
  where user_id = old.id
     or (v_email is not null and lower(user_email) = v_email);

  return old;
end;
$function$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  with paid_subscriptions as (
    select
      p.id,
      p.subscription_plan,
      p.subscription_status,
      coalesce(p.billing_cycle, 'monthly') as billing_cycle,
      (
        -- Net of tax and refunds, like total revenue.
        select public.payment_net_revenue(
          pm.status, pm.amount, pm.tax_amount, pm.refunded_amount, pm.refunded_tax_amount
        )
        from public.payments pm
        where pm.subscription_id = p.subscription_id
          and pm.status in ('completed', 'partially_refunded')
        order by pm.created_at desc
        limit 1
      ) as last_net_amount,
      sp.price,
      sp.annual_price
    from public.profiles p
    left join public.subscription_plans sp
      on sp.id = case p.subscription_plan
        when 'lite' then 'tier1'
        when 'standard' then 'tier2'
        when 'pro' then 'tier3'
        when 'agency' then 'tier4'
        else p.subscription_plan
      end
    where p.subscription_plan in ('tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency')
      and p.subscription_status in ('active', 'past_due', 'cancelled')
  ),
  priced as (
    select
      *,
      case
        when billing_cycle = 'annual'
          then coalesce(last_net_amount, annual_price, price * 10, 0) / 12.0
        else coalesce(last_net_amount, price, 0)
      end as monthly_amount
    from paid_subscriptions
  )
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'blocked_users', (select count(*) from public.profiles where blocked_at is not null),
    'total_revenue', (
      select coalesce(round(sum(public.payment_net_revenue(
        status, amount, tax_amount, refunded_amount, refunded_tax_amount
      )), 2), 0)
      from public.payments
    ),
    'active_users', (select count(*) from priced),
    'total_credits_used', (select coalesce(sum(credits_used), 0) from public.usage_logs),
    'total_credits_remaining', (select coalesce(sum(credits_remaining), 0) from public.profiles),
    'mrr', (select coalesce(round(sum(monthly_amount) filter (where subscription_status in ('active', 'past_due')), 2), 0) from priced),
    'past_due_mrr', (select coalesce(round(sum(monthly_amount) filter (where subscription_status = 'past_due'), 2), 0) from priced),
    'past_due_subscriptions', (select count(*) from priced where subscription_status = 'past_due'),
    'cancelling_mrr', (select coalesce(round(sum(monthly_amount) filter (where subscription_status = 'cancelled'), 2), 0) from priced),
    'active_subscriptions', (select count(*) from priced where subscription_status in ('active', 'past_due')),
    'mrr_by_plan', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'plan', subscription_plan,
        'billing_cycle', billing_cycle,
        'subscriptions', subscriptions,
        'mrr', mrr
      ) order by mrr desc), '[]'::jsonb)
      from (
        select subscription_plan, billing_cycle, count(*) as subscriptions, round(sum(monthly_amount), 2) as mrr
        from priced
        where subscription_status in ('active', 'past_due')
        group by subscription_plan, billing_cycle
      ) plan_rows
    ),
    'plugin_versions', (
      select coalesce(jsonb_agg(jsonb_build_object('version', version, 'sites', sites) order by sites desc, version desc), '[]'::jsonb)
      from (
        select coalesce(plugin_version, 'unknown') as version, count(*) as sites
        from public.plugin_sites
        where disconnected_at is null
        group by coalesce(plugin_version, 'unknown')
      ) version_rows
    ),
    'connected_sites', (select count(*) from public.plugin_sites where disconnected_at is null),
    'users_with_sites', (select count(distinct user_id) from public.plugin_sites where disconnected_at is null),
    'unresolved_reconciliations', (select count(*) from public.payment_reconciliation where status = 'open'),
    'pending_subscription_cancellations', (
      select count(*) from public.audit_logs
      where action = 'account.deleted'
        and details ->> 'subscription_cancellation' = 'pending'
    )
  )
  into v_result;

  v_result := v_result || jsonb_build_object('arr', round((v_result ->> 'mrr')::numeric * 12, 2));
  return v_result;
end;
$function$;

alter function public.issue_api_key(uuid, text, text, text, boolean) set search_path = '';
alter function public.touch_plugin_site(uuid, text, text, text) set search_path = '';

drop function if exists public.get_or_create_api_key(uuid);
drop function if exists public.generate_api_key();
