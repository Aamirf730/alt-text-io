-- Stores product-led growth events used for onboarding, email, and sales automation.
create table if not exists public.marketing_events (
    id uuid primary key default gen_random_uuid(),
    event_name text not null,
    source text not null default 'web_app',
    anonymous_id text,
    user_id uuid references auth.users(id) on delete set null,
    user_email text,
    properties jsonb not null default '{}'::jsonb,
    page_path text,
    referrer text,
    user_agent text,
    ip_address text,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists marketing_events_event_name_idx
    on public.marketing_events (event_name, occurred_at desc);

create index if not exists marketing_events_user_id_idx
    on public.marketing_events (user_id, occurred_at desc);

create index if not exists marketing_events_anonymous_id_idx
    on public.marketing_events (anonymous_id, occurred_at desc);

alter table public.marketing_events enable row level security;

drop policy if exists "No client access" on public.marketing_events;
create policy "No client access"
    on public.marketing_events
    for all
    to anon, authenticated
    using (false)
    with check (false);
