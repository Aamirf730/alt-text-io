-- Review fixes for the 2026-10-29 flow audit.
--
-- 1. payment_reconciliation.status accepts 'processing'. The admin replay
--    (POST /api/admin/reconcile-payment) claims a row atomically
--    (open -> processing) before replaying it, then sets it to resolved, or
--    back to open when the replay fails or cannot apply the event, so two
--    admins cannot replay one event at the same time.
-- 2. marketing_automation_sends.status accepts 'unknown'. lifecycle-automation
--    no longer resends a row left 'pending' by an interrupted run (the email
--    may have been delivered); it marks it 'unknown' and reports it.
--
-- Every statement is idempotent. Apply this migration before deploying the
-- code that writes these values.

-- ---------------------------------------------------------------------------
-- 1. Reconciliation claim status.
-- ---------------------------------------------------------------------------
alter table public.payment_reconciliation
  drop constraint if exists payment_reconciliation_status_check;

alter table public.payment_reconciliation
  add constraint payment_reconciliation_status_check
  check (status in ('open', 'processing', 'resolved', 'ignored'));

-- ---------------------------------------------------------------------------
-- 2. Lifecycle send status.
--
-- The bootstrap declares the check inline, so Postgres names it
-- marketing_automation_sends_status_check. Production tables predate the
-- bootstrap (supabase-migration/add-marketing-automation-sends.sql), so also
-- drop any other check constraint on this table that restricts status.
-- ---------------------------------------------------------------------------
do $sends_status$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.marketing_automation_sends'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
      and pg_get_constraintdef(c.oid) ilike '%pending%'
  loop
    execute format('alter table public.marketing_automation_sends drop constraint %I', constraint_row.conname);
  end loop;
end;
$sends_status$;

alter table public.marketing_automation_sends
  add constraint marketing_automation_sends_status_check
  check (status in ('pending', 'sent', 'failed', 'skipped', 'unknown'));

comment on column public.marketing_automation_sends.status is
  'pending: reserved, send in progress. sent / failed / skipped. unknown: interrupted after the send started; may have been delivered, never retried automatically.';
