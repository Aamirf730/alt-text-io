-- Persist lifecycle-email opt-outs so unsubscribe links are durable and
-- enforceable across scheduled and admin test-send paths.

alter table public.profiles
  add column if not exists marketing_unsubscribed_at timestamptz;

create index if not exists profiles_marketing_unsubscribed_idx
  on public.profiles (marketing_unsubscribed_at)
  where marketing_unsubscribed_at is not null;
