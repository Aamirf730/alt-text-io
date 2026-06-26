-- Fix signup trigger to match the current profiles schema.
-- The previous function inserted removed columns (`api_key`, `usage_count`),
-- which caused "Database error creating new user" during Auth user creation.

alter table public.profiles
  alter column credits_remaining set default 30;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  insert into public.profiles (
    id,
    email,
    subscription_plan,
    subscription_status,
    credits_remaining,
    total_processed,
    credits_last_renewed_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    'active',
    30,
    0,
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
