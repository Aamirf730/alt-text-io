-- Repair databases that recorded the historical renewal migration before the
-- OUT parameter was renamed. PostgreSQL identifies this function by its input
-- signature, so CREATE OR REPLACE cannot change the output-column name.
drop function if exists public.renew_monthly_credits();

create function public.renew_monthly_credits()
returns table (
  renewed_count integer,
  renewed_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  renewed_users uuid[];
  renewal_count integer := 0;
begin
  with renewed as (
    update public.profiles as p
    set
      credits_remaining = greatest(
        0,
        30
          + coalesce(p.bonus_credits_remaining, 0)
          + coalesce(p.purchased_credits_remaining, 0)
          - coalesce((
            select count(*)::integer
            from public.credit_reservations r
            where r.user_id = p.id
              and r.status = 'reserved'
              and r.credit_source = 'plan'
              and r.expires_at > now()
          ), 0)
      ),
      credits_last_renewed_at = now(),
      updated_at = now()
    where p.subscription_plan = 'free'
      and p.subscription_status = 'active'
      and (
        p.credits_last_renewed_at is null
        or p.credits_last_renewed_at <= now() - interval '30 days'
      )
    returning p.id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  return query
  select
    renewal_count,
    coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_monthly_credits()
  to service_role;
