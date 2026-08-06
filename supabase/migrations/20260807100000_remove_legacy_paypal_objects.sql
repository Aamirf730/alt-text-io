-- Remove PayPal-era database objects that have no active application callers.
-- The users table is dropped only when it is empty; a populated legacy table
-- must be archived and reviewed before this migration can proceed.

drop function if exists public.upgrade_subscription(uuid, text, text, text);
drop function if exists public.cancel_subscription(uuid);

do $$
declare
  legacy_user_count bigint;
begin
  if to_regclass('public.users') is null then
    return;
  end if;

  execute 'select count(*) from public.users' into legacy_user_count;

  if legacy_user_count > 0 then
    raise exception 'Refusing to drop public.users: % rows remain; archive and review the legacy data first', legacy_user_count;
  end if;

  execute 'drop table public.users';
end;
$$;
