-- M5: issue API keys with cryptographic randomness and stop using the raw key
-- as the authoritative database lookup value.
--
-- Existing api_key values are retained temporarily for a lazy, encrypted
-- migration by the Netlify key endpoint/validator. New rows leave api_key
-- NULL and use api_key_hash for validation plus api_key_encrypted for the
-- authorized dashboard/connection flow that must be able to reveal the key.

alter table public.api_keys
  add column if not exists api_key_hash text,
  add column if not exists api_key_encrypted text,
  add column if not exists api_key_last4 text;

alter table public.api_keys
  alter column api_key drop not null;

-- Seed the non-reversible lookup value for legacy rows. The raw column is not
-- nulled here because the database cannot access the application encryption
-- secret; the Netlify service migrates each legacy key on authorized use.
update public.api_keys
set api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex'),
    api_key_last4 = right(api_key, 4)
where api_key is not null
  and api_key_hash is null;

create unique index if not exists idx_api_keys_active_api_key_hash
  on public.api_keys (api_key_hash)
  where is_active = true and api_key_hash is not null;

-- The browser no longer needs any secret-bearing column. Keep retrieval and
-- legacy migration behind the service-role Netlify endpoint.
revoke all on table public.api_keys
  from public, anon, authenticated;

revoke select (api_key, api_key_hash, api_key_encrypted)
  on public.api_keys from anon, authenticated;

create or replace function public.validate_api_key(p_api_key text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
    v_key_hash text;
    v_key_id uuid;
    v_user_id uuid;
begin
    if p_api_key is null or p_api_key = '' then
        return null;
    end if;

    v_key_hash := encode(digest(p_api_key, 'sha256'), 'hex');

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
$function$;

-- The old RPC returned or inserted raw secrets. The application now uses the
-- service-role get-api-key function, which encrypts recoverable values before
-- storage. Leave the signature for migration compatibility but close the old
-- plaintext creation route for every role.
revoke all on function public.get_or_create_api_key(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.validate_api_key(text) to service_role;
