-- Audit 2026-10-29 §2.5: deleting an account must not destroy financial
-- records, and must remove personal data from marketing tables.
--
-- 1. payments.user_id was "on delete cascade", so deleting a user removed
--    their payment history, lowered all-time revenue and left later refunds
--    or chargebacks unmatched. It becomes "on delete set null" and the row
--    keeps the account email in user_email_at_deletion.
-- 2. A BEFORE DELETE trigger on auth.users stamps that email onto payments
--    and scrubs email/IP from marketing_events and marketing_automation_sends
--    in the same transaction as the delete, whichever path deletes the user
--    (admin endpoint, self-service endpoint or the Supabase dashboard).
--
-- Other tables that still cascade, on purpose:
--   usage_logs, credit_reservations, promotional_credit_grants, api_keys:
--     per-account usage and credit state, not money records.
--   credit_pack_grants: the credit ledger for a pack. The money record is the
--     payments row (kept). revoke_credit_pack_purchase treats a missing grant
--     as already processed, which is the correct outcome for a refund that
--     arrives after the account is gone.
--   payment_reconciliation.resolved_user_id is already "on delete set null".

-- ---------------------------------------------------------------------------
-- 1. payments.user_id -> on delete set null
-- ---------------------------------------------------------------------------
-- The bootstrap declares the FK inline, so Postgres names it
-- payments_user_id_fkey. Production tables predate the bootstrap, so also
-- drop any other single-column FK on payments(user_id) by its real name.
do $payments_fk$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.payments'::regclass
      and c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'user_id'
  loop
    execute format('alter table public.payments drop constraint %I', constraint_row.conname);
  end loop;
end;
$payments_fk$;

alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists user_email_at_deletion text,
  add column if not exists user_deleted_at timestamptz;

comment on column public.payments.user_email_at_deletion is
  'Account email captured when the owning account was deleted; user_id is then null.';
comment on column public.payments.user_deleted_at is
  'When the owning account was deleted.';

create index if not exists payments_user_email_at_deletion_idx
  on public.payments (lower(user_email_at_deletion))
  where user_email_at_deletion is not null;

-- ---------------------------------------------------------------------------
-- 2. Marketing tables: allow the email to be cleared.
-- ---------------------------------------------------------------------------
alter table public.marketing_automation_sends
  alter column user_email drop not null;

-- Email lookups (scrub, admin test-send) otherwise scan the events table.
create index if not exists marketing_events_user_email_idx
  on public.marketing_events (user_email)
  where user_email is not null;

-- ---------------------------------------------------------------------------
-- 3. Stamp and scrub inside the delete transaction.
-- ---------------------------------------------------------------------------
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
     or (v_email is not null and user_email = v_email);

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

revoke all on function public.prepare_account_deletion()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_deleting on auth.users;
create trigger on_auth_user_deleting
  before delete on auth.users
  for each row execute function public.prepare_account_deletion();
