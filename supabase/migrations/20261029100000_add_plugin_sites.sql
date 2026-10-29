-- WordPress sites that use an account's API key.
--
-- The plugin sends its home URL, plugin version and WordPress locale with
-- every service request. auth-validate and generate-alt-text record them here
-- so the dashboard can list connected sites, admins can look a user up by
-- site URL, and "WordPress connected" reflects real recent use instead of a
-- one-time marketing event. One API key is shared by all of an account's
-- sites, so disconnecting a site only marks this row; the key stays valid.

create table if not exists public.plugin_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_url text not null,
  plugin_version text,
  wp_locale text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disconnected_at timestamptz,
  constraint plugin_sites_user_site_key unique (user_id, site_url),
  constraint plugin_sites_site_url_length check (char_length(site_url) between 1 and 500),
  constraint plugin_sites_plugin_version_length check (plugin_version is null or char_length(plugin_version) <= 40),
  constraint plugin_sites_wp_locale_length check (wp_locale is null or char_length(wp_locale) <= 20)
);

-- Admin lookup by site URL, case-insensitive.
create index if not exists plugin_sites_site_url_lower_idx
  on public.plugin_sites (lower(site_url));

-- Dashboard listing and "connected" status, newest first per user.
create index if not exists plugin_sites_user_last_seen_idx
  on public.plugin_sites (user_id, last_seen_at desc);

alter table public.plugin_sites enable row level security;

drop policy if exists "Users can view own plugin sites" on public.plugin_sites;
create policy "Users can view own plugin sites"
  on public.plugin_sites for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes go through the service role only.
revoke all on table public.plugin_sites from public, anon, authenticated;
grant select on table public.plugin_sites to authenticated;
grant all on table public.plugin_sites to service_role;

-- Record that a site used the API key. One round trip: insert a new site, or
-- refresh an existing one only when it was last seen over an hour ago, was
-- disconnected, or reports a different plugin version or locale. Frequent
-- generations from the same site therefore do not rewrite the row.
create or replace function public.touch_plugin_site(
  p_user_id uuid,
  p_site_url text,
  p_plugin_version text default null,
  p_wp_locale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_user_id is null or nullif(trim(coalesce(p_site_url, '')), '') is null then
    return;
  end if;

  insert into public.plugin_sites as s (user_id, site_url, plugin_version, wp_locale)
  values (
    p_user_id,
    left(trim(p_site_url), 500),
    left(nullif(trim(coalesce(p_plugin_version, '')), ''), 40),
    left(nullif(trim(coalesce(p_wp_locale, '')), ''), 20)
  )
  on conflict (user_id, site_url) do update
    set last_seen_at = now(),
        disconnected_at = null,
        plugin_version = coalesce(excluded.plugin_version, s.plugin_version),
        wp_locale = coalesce(excluded.wp_locale, s.wp_locale)
    where s.last_seen_at < now() - interval '1 hour'
       or s.disconnected_at is not null
       or (excluded.plugin_version is not null and excluded.plugin_version is distinct from s.plugin_version)
       or (excluded.wp_locale is not null and excluded.wp_locale is distinct from s.wp_locale);
end;
$function$;

revoke all on function public.touch_plugin_site(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.touch_plugin_site(uuid, text, text, text)
  to service_role;
