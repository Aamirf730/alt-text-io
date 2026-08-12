-- Close client-side write paths that could alter billing state or forge service
-- records. This migration is safe to replay against production and brings the
-- separate staging project up to the same RLS baseline.

alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;
alter table public.payments enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.marketing_events enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.usage_logs from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;
revoke all on table public.subscription_plans from public, anon, authenticated;
revoke all on table public.marketing_events from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.usage_logs to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.subscription_plans to anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.usage_logs to service_role;
grant all on table public.payments to service_role;
grant all on table public.subscription_plans to service_role;
grant all on table public.marketing_events to service_role;

-- Remove every historical policy on these tables before rebuilding the exact
-- client-facing policy set. Table grants already prevent writes, and this also
-- prevents an unexpectedly named legacy SELECT policy from widening reads.
do $policies$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'usage_logs',
        'payments',
        'subscription_plans',
        'marketing_events'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$policies$;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can view own usage logs"
  on public.usage_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view own payments"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Anyone can view subscription plans"
  on public.subscription_plans for select to anon, authenticated
  using (true);

create policy "No client access"
  on public.marketing_events for all to anon, authenticated
  using (false)
  with check (false);

-- Cover every known user foreign key. The guarded reconciliation index keeps
-- this migration replayable against the intentionally smaller staging schema.
create index if not exists payments_user_id_idx
  on public.payments(user_id);

create index if not exists usage_logs_user_id_idx
  on public.usage_logs(user_id);

do $index$
begin
  if to_regclass('public.payment_reconciliation') is not null then
    execute 'create index if not exists payment_reconciliation_resolved_user_id_idx on public.payment_reconciliation(resolved_user_id)';
  end if;
end;
$index$;

-- Security-definer functions must not inherit a caller-controlled schema path.
do $functions$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'alter function public.handle_new_user() set search_path = ''''';
  end if;

  if to_regprocedure('public.generate_api_key()') is not null then
    execute 'alter function public.generate_api_key() set search_path = ''''';
  end if;
end;
$functions$;

-- Staging deliberately omits the API-key table. Only replace the validator
-- where the complete API-key schema exists.
do $validator$
begin
  if to_regclass('public.api_keys') is not null then
    execute $sql$
      create or replace function public.validate_api_key(p_api_key text)
      returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $function$
      declare
          v_key_hash text;
          v_key_id uuid;
          v_user_id uuid;
      begin
          if p_api_key is null or p_api_key = '' then
              return null;
          end if;

          v_key_hash := encode(extensions.digest(p_api_key, 'sha256'), 'hex');

          select id, user_id
            into v_key_id, v_user_id
          from public.api_keys
          where is_active = true
            and (
              api_key_hash = v_key_hash
              or (api_key_hash is null and api_key = p_api_key)
            )
          limit 1;

          if v_user_id is not null then
              update public.api_keys
              set last_used_at = now(),
                  api_key_hash = coalesce(api_key_hash, v_key_hash),
                  api_key_last4 = coalesce(api_key_last4, right(p_api_key, 4))
              where id = v_key_id;
          end if;

          return v_user_id;
      end;
      $function$
    $sql$;

    revoke all on function public.validate_api_key(text)
      from public, anon, authenticated;
    grant execute on function public.validate_api_key(text) to service_role;
  end if;
end;
$validator$;
