-- Production's audit_logs predates the bootstrap schema and names its time
-- column "timestamp"; the bootstrap schema, the admin console, account
-- deletion and payment reconciliation all use created_at. Add created_at
-- where it is missing and copy the recorded times into it. On a database
-- built from this migration chain the column already exists and nothing
-- changes. The old column stays, so nothing that still writes it breaks.

alter table public.audit_logs
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'timestamp'
  ) then
    execute 'update public.audit_logs set created_at = "timestamp"::timestamptz where "timestamp" is not null';
  end if;
end;
$$;

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);
