-- Billing fixes from the 2026-10-29 flow audit (sections 2.3, 2.4 and 4).
--
-- 1. profiles.subscription_status accepts 'past_due' (failed renewal charge).
-- 2. payment_reconciliation records who resolved a row (admin replay).
-- 3. marketing_events.dedupe_key makes Polar lifecycle events idempotent.
-- 4. payment_refunds + record_payment_refund(): one refund bookkeeping path
--    for order.refunded and refund.*, keeping partial refunds partial.
-- 5. find_billing_user_ids_by_email(): bounded, confirmed-email identity
--    fallback for unmatched Polar events (replaces paging through Auth).
-- 6. activate_subscription_profile() keeps an existing polar_customer_id
--    when the activation payload has none.
--
-- Every statement is idempotent. Apply this migration before deploying the
-- webhook code that calls these objects.

-- ---------------------------------------------------------------------------
-- 1. past_due subscription status.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('active', 'cancelled', 'expired', 'pending', 'past_due'));

-- ---------------------------------------------------------------------------
-- 2. Reconciliation resolution columns. status, resolved_at and
--    resolved_user_id were created with the table; the guards keep this safe
--    on a database that predates them.
-- ---------------------------------------------------------------------------
alter table public.payment_reconciliation
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution_notes text;

comment on column public.payment_reconciliation.resolved_by is
  'Auth user (an admin) who replayed and resolved this row.';

-- ---------------------------------------------------------------------------
-- 3. Idempotent marketing events for Polar lifecycle webhooks. NULL keys
--    never conflict, so other event sources are unaffected. The index is not
--    partial so PostgREST's on_conflict=dedupe_key can infer it. Existing
--    rows keep a NULL key; only new deliveries are deduplicated.
-- ---------------------------------------------------------------------------
alter table public.marketing_events
  add column if not exists dedupe_key text;

create unique index if not exists marketing_events_dedupe_key_uidx
  on public.marketing_events (dedupe_key);

-- ---------------------------------------------------------------------------
-- 4. Refund bookkeeping.
--
-- Polar compares an order's refundedAmount with its pre-tax net amount
-- (total minus tax) to decide that an order is fully refunded, and reports
-- refund tax separately. payments.amount is the gross total and tax_amount
-- its tax, so "full" here means refunded_amount >= amount - tax_amount, or
-- Polar's own order status says 'refunded'. Anything less stays
-- 'partially_refunded'.
--
-- refund.* events carry one refund each; they are stored by refund ID so
-- replays and out-of-order deliveries sum correctly. order.refunded carries
-- Polar's cumulative totals. Totals only ever increase.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_refunds (
  refund_id text primary key,
  provider text not null default 'polar',
  payment_id text not null,
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_refunds_payment_id_idx
  on public.payment_refunds (payment_id);

alter table public.payment_refunds enable row level security;
revoke all on table public.payment_refunds from public, anon, authenticated;
grant all on table public.payment_refunds to service_role;

comment on table public.payment_refunds is
  'One row per Polar refund (refund.created/updated), summed into payments.refunded_amount.';

create or replace function public.record_payment_refund(
  p_payment_id text,
  p_refund_id text default null,
  p_refund_amount numeric default null,
  p_refund_tax_amount numeric default null,
  p_refund_status text default null,
  p_order_refunded_amount numeric default null,
  p_order_refunded_tax_amount numeric default null,
  p_order_status text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment_id text;
  v_refund_id text;
  v_refund_status text;
  v_order_status text;
  v_row_id uuid;
  v_amount numeric;
  v_tax numeric;
  v_status text;
  v_existing_refunded numeric;
  v_existing_refunded_tax numeric;
  v_refund_sum numeric;
  v_refund_tax_sum numeric;
  v_refunded numeric;
  v_refunded_tax numeric;
  v_net numeric;
  v_full boolean;
  v_new_status text;
begin
  v_payment_id := nullif(btrim(coalesce(p_payment_id, '')), '');
  if v_payment_id is null then
    return json_build_object('success', false, 'error', 'Payment ID is required');
  end if;

  v_refund_id := nullif(btrim(coalesce(p_refund_id, '')), '');
  v_refund_status := lower(coalesce(nullif(btrim(p_refund_status), ''), 'pending'));
  v_order_status := lower(coalesce(nullif(btrim(p_order_status), ''), ''));

  if v_refund_id is not null then
    insert into public.payment_refunds as existing (
      refund_id,
      payment_id,
      amount,
      tax_amount,
      status
    )
    values (
      v_refund_id,
      v_payment_id,
      greatest(coalesce(p_refund_amount, 0), 0),
      greatest(coalesce(p_refund_tax_amount, 0), 0),
      v_refund_status
    )
    on conflict (refund_id) do update
    set
      amount = excluded.amount,
      tax_amount = excluded.tax_amount,
      -- A late refund.created ('pending') must not undo a final status.
      status = case
        when existing.status in ('succeeded', 'failed', 'canceled')
          and excluded.status = 'pending'
          then existing.status
        else excluded.status
      end,
      updated_at = now();
  end if;

  select
    p.id,
    coalesce(p.amount, 0),
    coalesce(p.tax_amount, 0),
    p.status,
    coalesce(p.refunded_amount, 0),
    coalesce(p.refunded_tax_amount, 0)
  into
    v_row_id,
    v_amount,
    v_tax,
    v_status,
    v_existing_refunded,
    v_existing_refunded_tax
  from public.payments p
  where p.payment_id = v_payment_id
    and p.payment_method = 'polar'
  for update;

  if not found then
    return json_build_object(
      'success', true,
      'payment_found', false,
      'full_refund', false
    );
  end if;

  select
    coalesce(sum(r.amount), 0),
    coalesce(sum(r.tax_amount), 0)
  into v_refund_sum, v_refund_tax_sum
  from public.payment_refunds r
  where r.payment_id = v_payment_id
    and r.status = 'succeeded';

  v_refunded := greatest(v_existing_refunded, coalesce(p_order_refunded_amount, 0), v_refund_sum);
  v_refunded_tax := greatest(v_existing_refunded_tax, coalesce(p_order_refunded_tax_amount, 0), v_refund_tax_sum);
  v_net := greatest(v_amount - v_tax, 0);

  v_full := v_order_status = 'refunded'
    or (v_net > 0 and v_refunded >= v_net);

  v_new_status := case
    when v_full then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    else v_status
  end;

  -- Never move a refunded payment back to partial unless Polar says so.
  if v_status = 'refunded'
    and v_new_status = 'partially_refunded'
    and v_order_status <> 'partially_refunded'
  then
    v_new_status := 'refunded';
  end if;

  update public.payments
  set
    status = v_new_status,
    refunded_amount = case when v_refunded > 0 then v_refunded else refunded_amount end,
    refunded_tax_amount = case when v_refunded_tax > 0 then v_refunded_tax else refunded_tax_amount end,
    updated_at = now()
  where id = v_row_id;

  return json_build_object(
    'success', true,
    'payment_found', true,
    'full_refund', v_full,
    'status', v_new_status,
    'refunded_amount', v_refunded,
    'refunded_tax_amount', v_refunded_tax
  );
exception
  when others then
    raise warning 'Error recording refund for payment %: %', p_payment_id, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error recording refund'
    );
end;
$function$;

revoke all on function public.record_payment_refund(
  text, text, numeric, numeric, text, numeric, numeric, text
) from public, anon, authenticated;

grant execute on function public.record_payment_refund(
  text, text, numeric, numeric, text, numeric, numeric, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Email fallback for Polar events without checkout metadata or known
--    provider IDs. Only confirmed Auth users qualify. Returns every candidate
--    (bounded) so the caller can refuse to guess between several.
-- ---------------------------------------------------------------------------
create or replace function public.find_billing_user_ids_by_email(
  p_email text
)
returns table (
  user_id uuid,
  match_source text
)
language sql
stable
security definer
set search_path = ''
as $function$
  with target as (
    select lower(btrim(p_email)) as email
    where nullif(btrim(coalesce(p_email, '')), '') is not null
  ),
  candidates as (
    select u.id as user_id, 'auth_email'::text as match_source
    from auth.users u
    join public.profiles p on p.id = u.id
    cross join target t
    where lower(u.email) = t.email
      and u.email_confirmed_at is not null
      and u.deleted_at is null
    union
    select p.id as user_id, 'profile_email'::text as match_source
    from public.profiles p
    join auth.users u on u.id = p.id
    cross join target t
    where lower(p.email) = t.email
      and u.email_confirmed_at is not null
      and u.deleted_at is null
  )
  select c.user_id, c.match_source
  from candidates c
  order by c.match_source, c.user_id
  limit 10;
$function$;

revoke all on function public.find_billing_user_ids_by_email(text)
  from public, anon, authenticated;
grant execute on function public.find_billing_user_ids_by_email(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Activation keeps the stored Polar customer ID when the payload lacks
--    one; nulling it broke the customer portal. Otherwise identical to
--    20260817055942_make_subscription_activation_idempotent.sql.
-- ---------------------------------------------------------------------------
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
  uuid, text, text, text, text, text, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.activate_subscription_profile(
  uuid, text, text, text, text, text, integer, timestamptz
) to service_role;
