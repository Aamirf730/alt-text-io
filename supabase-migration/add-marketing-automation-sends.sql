-- Tracks lifecycle email automation attempts so each user receives each trigger once.
create table if not exists public.marketing_automation_sends (
    id uuid primary key default gen_random_uuid(),
    automation_key text not null,
    actor_key text not null,
    user_id uuid references auth.users(id) on delete set null,
    user_email text not null,
    source_event_id uuid references public.marketing_events(id) on delete set null,
    status text not null default 'pending'
        check (status in ('pending', 'sent', 'failed', 'skipped')),
    subject text,
    error_message text,
    metadata jsonb not null default '{}'::jsonb,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (automation_key, actor_key)
);

create index if not exists marketing_automation_sends_email_idx
    on public.marketing_automation_sends (user_email, created_at desc);

create index if not exists marketing_automation_sends_status_idx
    on public.marketing_automation_sends (status, created_at desc);

create index if not exists marketing_automation_sends_user_id_idx
    on public.marketing_automation_sends (user_id, created_at desc);

create index if not exists marketing_automation_sends_source_event_id_idx
    on public.marketing_automation_sends (source_event_id);

alter table public.marketing_automation_sends enable row level security;

drop policy if exists "No client access" on public.marketing_automation_sends;
create policy "No client access"
    on public.marketing_automation_sends
    for all
    to anon, authenticated
    using (false)
    with check (false);
