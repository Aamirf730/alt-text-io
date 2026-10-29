-- Audit 2026-10-29 §6: lifecycle send retries and reports that do not load
-- every marketing event row.
--
-- 1. marketing_automation_sends.attempts / last_attempt_at so a failed or
--    stuck send can be retried a bounded number of times.
-- 2. marketing_event_aggregates(start, end): event counts, unique actors,
--    daily series and top sources/pages/referrers computed in SQL. The funnel
--    report previously read every row (page views included) into the
--    function and failed once a period passed 100,000 rows.

-- ---------------------------------------------------------------------------
-- 1. Send attempts
-- ---------------------------------------------------------------------------
alter table public.marketing_automation_sends
  add column if not exists attempts integer not null default 1,
  add column if not exists last_attempt_at timestamptz;

update public.marketing_automation_sends
set last_attempt_at = coalesce(updated_at, created_at)
where last_attempt_at is null;

do $attempts_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketing_automation_sends'::regclass
      and conname = 'marketing_automation_sends_attempts_positive'
  ) then
    alter table public.marketing_automation_sends
      add constraint marketing_automation_sends_attempts_positive
      check (attempts >= 1);
  end if;
end;
$attempts_check$;

comment on column public.marketing_automation_sends.attempts is
  'Number of send attempts. lifecycle-automation retries failed and stuck pending rows up to a fixed limit.';

-- ---------------------------------------------------------------------------
-- 2. Event aggregates
-- ---------------------------------------------------------------------------
-- Actor identity follows the report's JavaScript rules closely: an event's
-- actor is its user, else the user seen with the same anonymous ID in the
-- range, else its email, else its anonymous ID.
create or replace function public.marketing_event_aggregates(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_top_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_top integer := least(greatest(coalesce(p_top_limit, 8), 1), 50);
  v_result jsonb;
begin
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'A valid time range is required';
  end if;

  with ev as (
    select
      e.id,
      e.event_name,
      coalesce(nullif(e.source, ''), 'unknown') as source,
      e.anonymous_id,
      e.user_id,
      nullif(lower(e.user_email), '') as user_email,
      coalesce(e.page_path, e.properties ->> 'path', 'unknown') as page,
      coalesce(e.referrer, e.properties ->> 'referrer', 'direct') as referrer,
      (e.occurred_at at time zone 'UTC')::date as day
    from public.marketing_events e
    where e.occurred_at >= p_start_at
      and e.occurred_at < p_end_at
  ),
  anon_users as (
    select anonymous_id, min(user_id::text) as user_key
    from ev
    where anonymous_id is not null and user_id is not null
    group by anonymous_id
  ),
  keyed as (
    select
      ev.*,
      coalesce(
        'user:' || ev.user_id::text,
        'user:' || au.user_key,
        'email:' || ev.user_email,
        'anon:' || ev.anonymous_id,
        'event:' || ev.id::text
      ) as actor_key
    from ev
    left join anon_users au on au.anonymous_id = ev.anonymous_id
  ),
  by_event as (
    select event_name, count(*) as events, count(distinct actor_key) as unique_actors
    from keyed
    group by event_name
  ),
  daily_totals as (
    select day, count(*) as total_events, count(distinct actor_key) as unique_actors
    from keyed
    group by day
  ),
  daily_events as (
    select day, jsonb_object_agg(event_name, events) as events
    from (
      select day, event_name, count(*) as events
      from keyed
      group by day, event_name
    ) per_day
    group by day
  )
  select jsonb_build_object(
    'events', (select count(*) from keyed),
    'unique_actors', (select count(distinct actor_key) from keyed),
    'known_users', (select count(distinct actor_key) from keyed where actor_key like 'user:%'),
    'by_event', coalesce((
      select jsonb_object_agg(event_name, jsonb_build_object('events', events, 'unique_actors', unique_actors))
      from by_event
    ), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(t.day, 'YYYY-MM-DD'),
        'total_events', t.total_events,
        'unique_actors', t.unique_actors,
        'events', coalesce(d.events, '{}'::jsonb)
      ) order by t.day)
      from daily_totals t
      left join daily_events d on d.day = t.day
    ), '[]'::jsonb),
    'top_sources', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label)
      from (select source as label, count(*) as n from keyed group by source order by n desc, source limit v_top) s
    ), '[]'::jsonb),
    'top_referrers', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label)
      from (select referrer as label, count(*) as n from keyed group by referrer order by n desc, referrer limit v_top) r
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label)
      from (select page as label, count(*) as n from keyed group by page order by n desc, page limit v_top) pg
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.marketing_event_aggregates(timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.marketing_event_aggregates(timestamptz, timestamptz, integer)
  to service_role;

-- The report's range scan.
create index if not exists marketing_events_occurred_at_idx
  on public.marketing_events (occurred_at);
