-- Supabase audit findings 32-39.
--
-- Keep legacy credit callers on the same reservation-aware accounting path as
-- the current generation endpoint, make promotional grants replay-safe, keep
-- all credit-related locks in profile -> ledger order, reap abandoned
-- reservations, and add the missing data/lookup constraints.

-- ---------------------------------------------------------------------------
-- 32. Route the legacy use_credit signature through the reservation engine.
-- reserve_credit already recognizes tier4/agency and enforces their monthly
-- allowance. This prevents an older service-role caller from bypassing that
-- cap while preserving the historical function signature.
-- ---------------------------------------------------------------------------
create or replace function public.use_credit(
  user_uuid uuid,
  alt_text text,
  context text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reserved_result json;
  finalized_result json;
  reservation_id uuid;
begin
  reserved_result := public.reserve_credit(user_uuid, 1);

  if coalesce((reserved_result ->> 'success')::boolean, false) is not true then
    return reserved_result;
  end if;

  reservation_id := nullif(reserved_result ->> 'reservation_id', '')::uuid;
  if reservation_id is null then
    raise exception 'reserve_credit returned no reservation ID';
  end if;

  finalized_result := public.finalize_credit_reservation(
    reservation_id,
    alt_text,
    context
  );

  if coalesce((finalized_result ->> 'success')::boolean, false) is not true then
    perform public.release_credit_reservation(reservation_id);
  end if;

  return finalized_result;
exception
  when others then
    raise warning 'Error in reservation-backed use_credit for user %: %', user_uuid, sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error during credit deduction'
    );
end;
$function$;

revoke all on function public.use_credit(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.use_credit(uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 33. Promotional grant idempotency.
-- ---------------------------------------------------------------------------
create table if not exists public.promotional_credit_grants (
  idempotency_key text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits integer not null check (credits > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint promotional_credit_grants_key_length
    check (length(btrim(idempotency_key)) between 1 and 200)
);

create index if not exists promotional_credit_grants_user_id_idx
  on public.promotional_credit_grants(user_id, created_at desc);

alter table public.promotional_credit_grants enable row level security;
revoke all on table public.promotional_credit_grants from public, anon, authenticated;
grant all on table public.promotional_credit_grants to service_role;

-- The old three-argument function cannot safely infer an idempotency key.
-- There are no application callers for it; remove it so every grant must carry
-- an explicit replay key.
drop function if exists public.grant_promotional_credits(uuid, integer, text);

create or replace function public.grant_promotional_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_idempotency_key text
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_key text;
  reason_text text;
  accepted_key text;
  existing_user_id uuid;
  existing_credits integer;
  existing_reason text;
  current_credits integer;
  current_bonus_credits integer;
  current_purchased_credits integer;
  new_credits_remaining integer;
  new_bonus_credits_remaining integer;
begin
  normalized_key := nullif(btrim(p_idempotency_key), '');
  reason_text := nullif(btrim(p_reason), '');

  if p_user_id is null
    or p_credits is null
    or p_credits <= 0
    or normalized_key is null
    or length(normalized_key) > 200
    or reason_text is null
    or length(reason_text) > 500 then
    return json_build_object(
      'success', false,
      'error', 'Invalid promotional credit grant'
    );
  end if;

  -- Lock the profile before touching the grant ledger. This both validates
  -- the target before recording the idempotency key and serializes concurrent
  -- grants for the same account.
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

  insert into public.promotional_credit_grants (
    idempotency_key,
    user_id,
    credits,
    reason
  )
  values (
    normalized_key,
    p_user_id,
    p_credits,
    reason_text
  )
  on conflict (idempotency_key) do nothing
  returning idempotency_key into accepted_key;

  if accepted_key is null then
    select
      g.user_id,
      g.credits,
      g.reason
    into existing_user_id, existing_credits, existing_reason
    from public.promotional_credit_grants g
    where g.idempotency_key = normalized_key;

    if existing_user_id is distinct from p_user_id
      or existing_credits is distinct from p_credits
      or existing_reason is distinct from reason_text then
      return json_build_object(
        'success', false,
        'error', 'Idempotency key is already used for a different grant'
      );
    end if;

    return json_build_object(
      'success', true,
      'already_processed', true,
      'idempotency_key', normalized_key,
      'credits_added', existing_credits,
      'reason', existing_reason
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
      'idempotency_key', normalized_key,
      'credits_remaining_before', current_credits,
      'credits_remaining_after', new_credits_remaining,
      'bonus_credits_remaining_before', current_bonus_credits,
      'bonus_credits_remaining_after', new_bonus_credits_remaining
    ),
    'info'
  );

  return json_build_object(
    'success', true,
    'already_processed', false,
    'idempotency_key', normalized_key,
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

comment on function public.grant_promotional_credits(uuid, integer, text, text) is
  'Atomically grants promotional credits with an explicit idempotency key and records the grant in audit_logs.';

revoke all on function public.grant_promotional_credits(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_promotional_credits(uuid, integer, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 34. Subscription revocation must not re-run after the profile is free.
-- The row lock also makes concurrent revoke deliveries deterministic. A paid
-- profile with a missing stored provider ID is allowed through once for the
-- existing email/identity fallback, then the free-state guard makes retries
-- no-ops.
-- ---------------------------------------------------------------------------
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

  update public.profiles
  set
    credits_remaining = free_allowance
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

revoke all on function public.revoke_subscription_access(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_subscription_access(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 35. Paid-pack revocation now follows the same profile -> ledger lock order
-- as grant_credit_pack_purchase.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_credit_pack_purchase(
  p_payment_id text
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_payment_id text;
  grant_user_id uuid;
  grant_credits integer;
  grant_revoked_at timestamptz;
  current_credits integer;
  current_purchased_credits integer;
  revoked_credits integer;
begin
  normalized_payment_id := nullif(btrim(p_payment_id), '');
  if normalized_payment_id is null then
    return json_build_object(
      'success', false,
      'error', 'Payment ID is required'
    );
  end if;

  -- Read the owner without locking. The profile is always locked before the
  -- grant row, matching grant_credit_pack_purchase.
  select g.user_id
  into grant_user_id
  from public.credit_pack_grants g
  where g.payment_id = normalized_payment_id;

  if not found then
    return json_build_object(
      'success', true,
      'already_processed', true,
      'grant_found', false
    );
  end if;

  perform 1
  from public.profiles p
  where p.id = grant_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  end if;

  select g.credits, g.revoked_at
  into grant_credits, grant_revoked_at
  from public.credit_pack_grants g
  where g.payment_id = normalized_payment_id
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
  where p.id = grant_user_id;

  revoked_credits := least(grant_credits, current_purchased_credits);

  update public.credit_pack_grants
  set revoked_at = now()
  where payment_id = normalized_payment_id;

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

-- ---------------------------------------------------------------------------
-- 36. Periodically release expired reservations and remove terminal history
-- after a short retention period. The candidate query intentionally takes no
-- reservation lock; release_credit_reservation acquires profile -> row locks.
-- ---------------------------------------------------------------------------
create index if not exists credit_reservations_expires_at_idx
  on public.credit_reservations(expires_at)
  where status = 'reserved';

create index if not exists credit_reservations_terminal_cleanup_idx
  on public.credit_reservations(status, released_at, completed_at, expires_at)
  where status in ('released', 'completed');

create or replace function public.reap_expired_credit_reservations(
  p_batch_size integer default 1000
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  batch_size integer;
  reservation_id uuid;
  release_result json;
  released_count integer := 0;
  deleted_count integer := 0;
begin
  batch_size := least(greatest(coalesce(p_batch_size, 1000), 1), 10000);

  for reservation_id in
    select r.id
    from public.credit_reservations r
    where r.status = 'reserved'
      and r.expires_at <= now()
    order by r.expires_at, r.id
    limit batch_size
  loop
    release_result := public.release_credit_reservation(reservation_id);
    if coalesce((release_result ->> 'released')::boolean, false) then
      released_count := released_count + 1;
    end if;
  end loop;

  with terminal_rows as (
    select r.id
    from public.credit_reservations r
    where r.status in ('released', 'completed')
      and coalesce(r.released_at, r.completed_at, r.expires_at)
        < now() - interval '7 days'
    order by coalesce(r.released_at, r.completed_at, r.expires_at), r.id
    limit batch_size
  )
  delete from public.credit_reservations r
  using terminal_rows old_row
  where r.id = old_row.id;

  get diagnostics deleted_count = row_count;

  return json_build_object(
    'success', true,
    'released_count', released_count,
    'deleted_count', deleted_count
  );
exception
  when others then
    raise warning 'Error reaping credit reservations: %', sqlerrm;
    return json_build_object(
      'success', false,
      'error', 'Database error reaping credit reservations'
    );
end;
$function$;

revoke all on function public.reap_expired_credit_reservations(integer)
  from public, anon, authenticated;
grant execute on function public.reap_expired_credit_reservations(integer)
  to service_role;

create extension if not exists pg_cron;

select cron.unschedule('reap-expired-credit-reservations')
where exists (
  select 1 from cron.job where jobname = 'reap-expired-credit-reservations'
);

select cron.schedule(
  'reap-expired-credit-reservations',
  '*/5 * * * *',
  $$ select public.reap_expired_credit_reservations(1000); $$
);

-- ---------------------------------------------------------------------------
-- 37. Reject invalid accounting values. Add as NOT VALID first so the DDL
-- takes a short lock, then validate explicitly so existing bad data blocks the
-- migration instead of being silently accepted.
-- ---------------------------------------------------------------------------
do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.usage_logs'::regclass
      and conname = 'usage_logs_credits_used_positive'
  ) then
    alter table public.usage_logs
      add constraint usage_logs_credits_used_positive
      check (credits_used > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_amount_nonnegative'
  ) then
    alter table public.payments
      add constraint payments_amount_nonnegative
      check (amount >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_billing_cycle_check'
  ) then
    alter table public.profiles
      add constraint profiles_billing_cycle_check
      check (billing_cycle is null or billing_cycle in ('monthly', 'annual')) not valid;
  end if;
end;
$constraints$;

alter table public.usage_logs
  validate constraint usage_logs_credits_used_positive;
alter table public.payments
  validate constraint payments_amount_nonnegative;
alter table public.profiles
  validate constraint profiles_billing_cycle_check;

-- ---------------------------------------------------------------------------
-- 38. The webhook's primary profile lookup is subscription_id.
-- ---------------------------------------------------------------------------
create index if not exists profiles_subscription_id_idx
  on public.profiles(subscription_id)
  where subscription_id is not null;

-- ---------------------------------------------------------------------------
-- 39. Profile email is a contact/fallback field, not the auth identity key.
-- Allow multiple auth identities to share an email; user_id remains the
-- authoritative binding and the lower(email) index remains for fallback reads.
-- ---------------------------------------------------------------------------
do $drop_email_uniques$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'email'
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      constraint_name
    );
  end loop;
end;
$drop_email_uniques$;

comment on column public.profiles.email is
  'Contact/fallback email; user_id is the authoritative account binding and duplicate emails are allowed.';
