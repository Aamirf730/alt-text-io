-- Keep unmatched provider billing events instead of silently discarding paid
-- orders and subscription lifecycle events. The webhook worker is the only
-- writer; an operator can resolve rows later after matching the provider
-- identity to a profile.
create table if not exists public.payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'polar',
  event_name text not null,
  provider_object_id text not null,
  candidate_user_id text,
  customer_id text,
  customer_email text,
  subscription_id text,
  payment_id text,
  reason text not null,
  payload jsonb not null,
  status text not null default 'open',
  resolved_user_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_reconciliation_status_check
    check (status in ('open', 'resolved', 'ignored'))
);

create unique index if not exists payment_reconciliation_provider_event_uidx
  on public.payment_reconciliation(provider, event_name, provider_object_id);

create index if not exists payment_reconciliation_status_created_idx
  on public.payment_reconciliation(status, created_at);

create index if not exists payment_reconciliation_customer_email_idx
  on public.payment_reconciliation(lower(customer_email));

alter table public.payment_reconciliation enable row level security;
revoke all on table public.payment_reconciliation from public, anon, authenticated;
grant all on table public.payment_reconciliation to service_role;

comment on table public.payment_reconciliation is
  'Unmatched Polar billing payloads awaiting an operator identity reconciliation.';

comment on column public.payment_reconciliation.payload is
  'The provider payload needed to resolve and replay the billing event.';
