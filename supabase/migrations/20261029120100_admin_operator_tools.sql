-- Audit 2026-10-29 §6: operator tools and a Users tab that scales.
--
-- 1. profiles.blocked_at / blocked_reason (service-role only).
-- 2. admin_adjust_credits: audited grant or removal of credits.
-- 3. admin_list_users: server-side search, filter and paging with per-user
--    aggregates computed in SQL (replaces loading every profile, payment and
--    usage row into the function and joining them in O(n^2)).
-- 4. admin_dashboard_stats: revenue, MRR/ARR, plugin versions and operator
--    queues in one aggregate query.
--
-- plugin_sites is created by a separate migration. These functions are
-- plpgsql, so the table is resolved when they run, not when they are created.

-- ---------------------------------------------------------------------------
-- 1. Block / unblock
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;

do $blocked_reason_length$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_blocked_reason_length'
  ) then
    alter table public.profiles
      add constraint profiles_blocked_reason_length
      check (blocked_reason is null or length(blocked_reason) <= 500);
  end if;
end;
$blocked_reason_length$;

comment on column public.profiles.blocked_at is
  'Set by an operator to suspend the account. The generation API returns 403 account_suspended while set. Service role only.';
comment on column public.profiles.blocked_reason is
  'Operator note for the suspension. Service role only.';

create index if not exists profiles_blocked_at_idx
  on public.profiles (blocked_at)
  where blocked_at is not null;

-- Clients already have SELECT only on profiles (20260811110000). Repeat the
-- column-level revoke so a future broad UPDATE grant cannot reach these.
revoke insert (blocked_at, blocked_reason), update (blocked_at, blocked_reason)
  on public.profiles from public, anon, authenticated;

-- Defence in depth: only the service role (or a migration/superuser) may
-- change the suspension columns, whatever grants exist later.
create or replace function public.guard_profile_block_columns()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (new.blocked_at is distinct from old.blocked_at
      or new.blocked_reason is distinct from old.blocked_reason)
    and coalesce(auth.role(), 'service_role') not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'blocked_at and blocked_reason can only be changed by an operator'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_profile_block_columns on public.profiles;
create trigger guard_profile_block_columns
  before update on public.profiles
  for each row execute function public.guard_profile_block_columns();

-- ---------------------------------------------------------------------------
-- 2. Audited credit adjustments
-- ---------------------------------------------------------------------------
-- Grants go through grant_promotional_credits (bonus credits that never
-- expire, idempotent). Removals take bonus credits only: plan credits renew
-- on their own and purchased pack credits were paid for (refund those in
-- Polar instead). Both write an audit row naming the operator.
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_actor_email text
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_key text;
  reason_text text;
  grant_result json;
  current_credits integer;
  current_bonus integer;
  removed integer;
  new_credits integer;
  new_bonus integer;
begin
  normalized_key := nullif(btrim(p_idempotency_key), '');
  reason_text := nullif(btrim(p_reason), '');

  if p_user_id is null
    or p_delta is null
    or p_delta = 0
    or abs(p_delta) > 1000000
    or normalized_key is null
    or length(normalized_key) > 200
    or reason_text is null
    or length(reason_text) > 500 then
    return json_build_object('success', false, 'error', 'Invalid credit adjustment');
  end if;

  if p_delta > 0 then
    grant_result := public.grant_promotional_credits(p_user_id, p_delta, reason_text, normalized_key);

    if coalesce((grant_result ->> 'success')::boolean, false)
      and not coalesce((grant_result ->> 'already_processed')::boolean, false) then
      insert into public.audit_logs (actor_id, actor_email, action, resource_type, resource_id, details, severity)
      values (
        p_actor_id,
        p_actor_email,
        'admin.credits_granted',
        'user',
        p_user_id::text,
        jsonb_build_object(
          'credits', p_delta,
          'reason', reason_text,
          'idempotency_key', normalized_key,
          'credits_remaining_after', grant_result -> 'credits_remaining',
          'bonus_credits_remaining_after', grant_result -> 'bonus_credits_remaining'
        ),
        'warning'
      );
    end if;

    return grant_result;
  end if;

  -- Removal. Lock the profile first (same order as every credit function),
  -- then check the idempotency key in the audit trail.
  select
    greatest(
      coalesce(p.credits_remaining, 0),
      coalesce(p.bonus_credits_remaining, 0),
      coalesce(p.purchased_credits_remaining, 0)
    ),
    coalesce(p.bonus_credits_remaining, 0)
  into current_credits, current_bonus
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  if exists (
    select 1 from public.audit_logs a
    where a.action = 'admin.credits_removed'
      and a.resource_id = p_user_id::text
      and a.details ->> 'idempotency_key' = normalized_key
  ) then
    return json_build_object('success', true, 'already_processed', true, 'idempotency_key', normalized_key);
  end if;

  removed := least(-p_delta, current_bonus);
  new_bonus := current_bonus - removed;
  new_credits := greatest(0, current_credits - removed);

  update public.profiles
  set
    credits_remaining = new_credits,
    bonus_credits_remaining = new_bonus,
    updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs (actor_id, actor_email, action, resource_type, resource_id, details, severity)
  values (
    p_actor_id,
    p_actor_email,
    'admin.credits_removed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'credits_requested', -p_delta,
      'credits_removed', removed,
      'reason', reason_text,
      'idempotency_key', normalized_key,
      'credits_remaining_before', current_credits,
      'credits_remaining_after', new_credits,
      'bonus_credits_remaining_before', current_bonus,
      'bonus_credits_remaining_after', new_bonus
    ),
    'warning'
  );

  return json_build_object(
    'success', true,
    'already_processed', false,
    'idempotency_key', normalized_key,
    'credits_removed', removed,
    'credits_requested', -p_delta,
    'credits_remaining', new_credits,
    'bonus_credits_remaining', new_bonus
  );
exception
  when others then
    raise warning 'Error adjusting credits for user %: %', p_user_id, sqlerrm;
    return json_build_object('success', false, 'error', 'Database error during credit adjustment');
end;
$function$;

revoke all on function public.admin_adjust_credits(uuid, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Shared revenue rule (matches admin-get-users getNetPaymentRevenue):
-- amount is gross incl. tax; refunded_amount is pre-tax (Polar's
-- refundedAmount; refund tax is kept apart in refunded_tax_amount, see
-- record_payment_refund in 20261029110000), so
--   net = amount - tax_amount - refunded_amount.
-- An older fully refunded row without a stored refund amount counts as 0.
-- p_refunded_tax_amount is accepted for call-site symmetry and not used.
-- ---------------------------------------------------------------------------
create or replace function public.payment_net_revenue(
  p_status text,
  p_amount numeric,
  p_tax_amount numeric,
  p_refunded_amount numeric,
  p_refunded_tax_amount numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_status not in ('completed', 'partially_refunded', 'refunded') then 0::numeric
    when p_status = 'refunded' and p_refunded_amount is null then 0::numeric
    else greatest(
      0::numeric,
      round(
        coalesce(p_amount, 0)
          - coalesce(p_tax_amount, 0)
          - coalesce(p_refunded_amount, 0),
        2
      )
    )
  end;
$function$;

revoke all on function public.payment_net_revenue(text, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.payment_net_revenue(text, numeric, numeric, numeric, numeric)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Users tab: search, filter, page.
-- ---------------------------------------------------------------------------
-- p_search matches, server-side: email (substring), user ID, Polar customer
-- ID, Polar subscription ID and connected site URL (plugin_sites).
create or replace function public.admin_list_users(
  p_search text default null,
  p_plan text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_site text;
  v_uuid uuid;
  v_plans text[];
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
begin
  if v_search is not null then
    v_site := regexp_replace(v_search, '^https?://(www\.)?', '');
    v_site := regexp_replace(v_site, '/+$', '');
    if v_search ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_uuid := v_search::uuid;
    end if;
  end if;

  -- Older accounts store the plan under its pre-tier name.
  v_plans := case
    when nullif(p_plan, 'all') is null then null
    when p_plan = 'tier1' then array['tier1', 'lite']
    when p_plan = 'tier2' then array['tier2', 'standard']
    when p_plan = 'tier3' then array['tier3', 'pro']
    when p_plan = 'tier4' then array['tier4', 'agency']
    else array[p_plan]
  end;

  with matches as (
    select p.id, p.created_at
    from public.profiles p
    where (v_plans is null or p.subscription_plan = any (v_plans))
      and (nullif(p_status, 'all') is null or p.subscription_status = p_status)
      and (
        v_search is null
        or p.id = v_uuid
        or lower(p.email) like '%' || v_search || '%'
        or lower(coalesce(p.polar_customer_id, '')) = v_search
        or lower(coalesce(p.subscription_id, '')) = v_search
        or exists (
          select 1 from public.plugin_sites s
          where s.user_id = p.id
            and lower(s.site_url) like '%' || v_site || '%'
        )
      )
  ),
  page_ids as (
    select m.id, m.created_at
    from matches m
    order by m.created_at desc, m.id desc
    limit v_limit
    offset v_offset
  ),
  page_rows as (
    select
      pi.id,
      pi.created_at,
      jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'subscription_plan', p.subscription_plan,
        'subscription_status', p.subscription_status,
        'billing_cycle', p.billing_cycle,
        'credits_remaining', p.credits_remaining,
        'bonus_credits_remaining', p.bonus_credits_remaining,
        'purchased_credits_remaining', p.purchased_credits_remaining,
        'total_processed', p.total_processed,
        'subscription_id', p.subscription_id,
        'polar_customer_id', p.polar_customer_id,
        'next_billing_date', p.next_billing_date,
        'expires_at', p.expires_at,
        'blocked_at', p.blocked_at,
        'blocked_reason', p.blocked_reason,
        'marketing_unsubscribed_at', p.marketing_unsubscribed_at,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'total_paid', coalesce(pay.total_paid, 0),
        'payment_count', coalesce(pay.payment_count, 0),
        'total_usage_count', coalesce(usage_totals.total_usage_count, 0),
        'total_credits_used', coalesce(usage_totals.total_credits_used, 0),
        'last_usage_at', usage_totals.last_usage_at,
        'connected_sites', coalesce(sites.connected_sites, 0),
        'latest_plugin_version', sites.latest_plugin_version,
        'plugin_last_seen_at', sites.last_seen_at
      ) as row_data
    from page_ids pi
    join public.profiles p on p.id = pi.id
    left join lateral (
      select
        round(sum(public.payment_net_revenue(
          pm.status, pm.amount, pm.tax_amount, pm.refunded_amount, pm.refunded_tax_amount
        )), 2) as total_paid,
        count(*) as payment_count
      from public.payments pm
      where pm.user_id = p.id
    ) pay on true
    left join lateral (
      select
        count(*) as total_usage_count,
        coalesce(sum(ul.credits_used), 0) as total_credits_used,
        max(ul.created_at) as last_usage_at
      from public.usage_logs ul
      where ul.user_id = p.id
    ) usage_totals on true
    left join lateral (
      select
        count(*) filter (where s.disconnected_at is null) as connected_sites,
        (array_agg(s.plugin_version order by s.last_seen_at desc nulls last)
          filter (where s.plugin_version is not null))[1] as latest_plugin_version,
        max(s.last_seen_at) as last_seen_at
      from public.plugin_sites s
      where s.user_id = p.id
    ) sites on true
  )
  select
    (select count(*) from matches),
    coalesce((select jsonb_agg(r.row_data order by r.created_at desc, r.id desc) from page_rows r), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'users', v_rows
  );
end;
$function$;

revoke all on function public.admin_list_users(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, text, integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Dashboard aggregates.
-- ---------------------------------------------------------------------------
-- MRR counts active and past_due (renewal retrying) paid subscriptions at
-- the latest net (ex-tax) amount
-- actually charged on that subscription, falling back to the catalogue price
-- when no payment row exists. Annual amounts are divided by 12. Subscriptions
-- cancelled at period end are reported separately as cancelling_mrr.
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
        select greatest(0, pm.amount - coalesce(pm.tax_amount, 0))
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

revoke all on function public.admin_dashboard_stats()
  from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats()
  to service_role;

-- Audit log viewer filters by resource.
create index if not exists audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id, created_at desc);
