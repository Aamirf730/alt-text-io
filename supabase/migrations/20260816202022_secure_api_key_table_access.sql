-- The API-key table is service-role-only. RLS policies alone do not remove
-- table privileges, so revoke the bootstrap grants for existing databases
-- where the original storage migration has already been applied.
revoke all on table public.api_keys
  from public, anon, authenticated;

revoke select (api_key, api_key_hash, api_key_encrypted)
  on public.api_keys from public, anon, authenticated;
