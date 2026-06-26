-- RLS policies now protect api_keys by authenticated owner, so this RPC no
-- longer needs SECURITY DEFINER for dashboard use.
alter function public.get_or_create_api_key(uuid)
  security invoker;

grant execute on function public.get_or_create_api_key(uuid)
  to authenticated, service_role;
