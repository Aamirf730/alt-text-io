-- Harden public schema RPCs, RLS policies, and advisor findings.
-- The dashboard still needs authenticated users to manage their own API key.
-- WordPress/plugin API validation and credit deduction remain service-role only.

-- Security definer functions must use a fixed search_path.
alter function public.generate_api_key()
  set search_path = public, extensions;

alter function public.handle_new_user()
  set search_path = public, extensions;

alter function public.renew_monthly_credits()
  set search_path = public, extensions;

alter function public.renew_paid_monthly_credits()
  set search_path = public, extensions;

alter function public.upgrade_subscription(uuid, text, text, text)
  set search_path = public, extensions;

alter function public.use_credit(uuid, text, text)
  set search_path = public, extensions;

alter function public.validate_api_key(text)
  set search_path = public, extensions;

-- Keep dashboard key creation available, but prevent users from requesting
-- keys for another account when this RPC is called from an authenticated client.
create or replace function public.get_or_create_api_key(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
    existing_key text;
    new_key text;
    caller_user_id uuid := auth.uid();
    key_exists boolean;
begin
    if p_user_id is null then
        raise exception 'p_user_id is required' using errcode = '22004';
    end if;

    if caller_user_id is not null and caller_user_id <> p_user_id then
        raise exception 'Not authorized to access API key for this user' using errcode = '42501';
    end if;

    select api_key into existing_key
    from public.api_keys
    where user_id = p_user_id
      and is_active = true
    order by created_at desc
    limit 1;

    if existing_key is not null then
        return existing_key;
    end if;

    loop
        new_key := 'alt_' || encode(extensions.gen_random_bytes(32), 'base64');
        new_key := replace(new_key, '/', '_');
        new_key := replace(new_key, '+', '-');

        select exists(
            select 1
            from public.api_keys
            where api_key = new_key
        ) into key_exists;

        exit when not key_exists;
    end loop;

    insert into public.api_keys (user_id, api_key, name)
    values (p_user_id, new_key, 'WordPress Plugin')
    returning api_key into new_key;

    return new_key;
end;
$function$;

-- Remove broad public execution from security-definer RPCs.
revoke all on function public.generate_api_key() from public, anon, authenticated;
revoke all on function public.get_or_create_api_key(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.renew_monthly_credits() from public, anon, authenticated;
revoke all on function public.renew_paid_monthly_credits() from public, anon, authenticated;
revoke all on function public.upgrade_subscription(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.use_credit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.validate_api_key(text) from public, anon, authenticated;

grant execute on function public.get_or_create_api_key(uuid) to authenticated, service_role;
grant execute on function public.generate_api_key() to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.renew_monthly_credits() to service_role;
grant execute on function public.renew_paid_monthly_credits() to service_role;
grant execute on function public.upgrade_subscription(uuid, text, text, text) to service_role;
grant execute on function public.use_credit(uuid, text, text) to service_role;
grant execute on function public.validate_api_key(text) to service_role;

-- Prevent the aggregate view from bypassing caller RLS context.
alter view public.user_usage_stats
  set (security_invoker = true);

revoke all on public.user_usage_stats from public, anon, authenticated;
grant select on public.user_usage_stats to service_role;
grant select on public.usage_logs to service_role;

-- Replace public-role RLS policies with authenticated owner policies and
-- select-wrapped auth.uid() predicates to avoid per-row initplan warnings.
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter table public.api_keys enable row level security;
drop policy if exists "Users can view their own API keys" on public.api_keys;
drop policy if exists "Users can insert their own API keys" on public.api_keys;
drop policy if exists "Users can update their own API keys" on public.api_keys;
drop policy if exists "Users can delete their own API keys" on public.api_keys;
create policy "Users can view their own API keys"
  on public.api_keys
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their own API keys"
  on public.api_keys
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own API keys"
  on public.api_keys
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own API keys"
  on public.api_keys
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.usage_logs enable row level security;
drop policy if exists "Users can view own usage logs" on public.usage_logs;
drop policy if exists "Users can insert own usage logs" on public.usage_logs;
create policy "Users can view own usage logs"
  on public.usage_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own usage logs"
  on public.usage_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.payments enable row level security;
drop policy if exists "Users can view own payments" on public.payments;
drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own payments"
  on public.payments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- The old public.users table was part of the hand-applied schema but is not
-- used by the current application. Keep this historical hardening step
-- conditional so a fresh bootstrap does not need to recreate that retired,
-- broadly writable table just to replay an unrelated security migration.
do $users_policy$
begin
  if to_regclass('public.users') is not null then
    execute 'alter table public.users enable row level security';
    execute 'drop policy if exists "Allow all operations for users" on public.users';
    execute $policy$
      create policy "Users can view own legacy user"
        on public.users
        for select
        to authenticated
        using ((select auth.uid()) = id)
    $policy$;
    execute $policy$
      create policy "Users can update own legacy user"
        on public.users
        for update
        to authenticated
        using ((select auth.uid()) = id)
        with check ((select auth.uid()) = id)
    $policy$;
  end if;
end
$users_policy$;

-- Cover the only remaining unindexed foreign key advisor.
create index if not exists payments_plan_id_idx
  on public.payments (plan_id);
