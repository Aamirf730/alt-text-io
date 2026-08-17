-- Make API-key creation and rotation single-writer operations.
--
-- The service function locks the profile row before inspecting or replacing
-- the active key. This prevents two concurrent dashboard/connection requests
-- from both creating active keys or rotating the same account independently.

drop function if exists public.issue_api_key(uuid, text, text, text, boolean);

create function public.issue_api_key(
  p_user_id uuid,
  p_api_key_hash text,
  p_api_key_encrypted text,
  p_api_key_last4 text,
  p_rotate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile_id uuid;
  v_existing public.api_keys%rowtype;
  v_created public.api_keys%rowtype;
begin
  if p_user_id is null
    or nullif(trim(coalesce(p_api_key_hash, '')), '') is null
    or nullif(trim(coalesce(p_api_key_encrypted, '')), '') is null
    or nullif(trim(coalesce(p_api_key_last4, '')), '') is null
  then
    return jsonb_build_object('success', false, 'error', 'API-key material is required');
  end if;

  select id
    into v_profile_id
  from public.profiles
  where id = p_user_id
  for update;

  if v_profile_id is null then
    return jsonb_build_object('success', false, 'error', 'User not found');
  end if;

  if not coalesce(p_rotate, false) then
    select *
      into v_existing
    from public.api_keys
    where user_id = p_user_id
      and is_active = true
    order by created_at desc, id desc
    limit 1
    for update;

    if v_existing.id is not null then
      return jsonb_build_object(
        'success', true,
        'created', false,
        'id', v_existing.id,
        'api_key', v_existing.api_key,
        'api_key_hash', v_existing.api_key_hash,
        'api_key_encrypted', v_existing.api_key_encrypted,
        'api_key_last4', v_existing.api_key_last4,
        'is_active', v_existing.is_active
      );
    end if;
  else
    update public.api_keys
    set is_active = false
    where user_id = p_user_id
      and is_active = true;
  end if;

  insert into public.api_keys (
    user_id,
    api_key,
    api_key_hash,
    api_key_encrypted,
    api_key_last4,
    name,
    is_active
  )
  values (
    p_user_id,
    null,
    trim(p_api_key_hash),
    p_api_key_encrypted,
    trim(p_api_key_last4),
    'WordPress Plugin',
    true
  )
  returning * into v_created;

  return jsonb_build_object(
    'success', true,
    'created', true,
    'id', v_created.id,
    'api_key', v_created.api_key,
    'api_key_hash', v_created.api_key_hash,
    'api_key_encrypted', v_created.api_key_encrypted,
    'api_key_last4', v_created.api_key_last4,
    'is_active', v_created.is_active
  );
exception
  when others then
    raise warning 'Error issuing API key for user %: %', p_user_id, sqlerrm;
    return jsonb_build_object('success', false, 'error', 'Database error issuing API key');
end;
$function$;

revoke all on function public.issue_api_key(uuid, text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.issue_api_key(uuid, text, text, text, boolean)
  to service_role;
