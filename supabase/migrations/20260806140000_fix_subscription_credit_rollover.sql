-- Subscription plan credits are a per-cycle allowance.
-- Bonus and purchased ledgers are persistent; unspent plan allowance does not
-- roll into the next cycle and must not make the aggregate balance unusable.

-- Normalize paid profiles that were accumulated by the previous renewal logic.
-- Usage logs are the source of truth for the current cycle, while the two
-- persistent ledgers are preserved exactly as recorded.
with paid_profile_state as (
  select
    p.id,
    greatest(
      0,
      coalesce(nullif(p.monthly_credit_allowance, 0), sp.credits, 0)
        - coalesce(cycle_usage.credits_used, 0)
    )::integer as plan_credits_remaining,
    coalesce(p.bonus_credits_remaining, 0)::integer as bonus_credits_remaining,
    coalesce(p.purchased_credits_remaining, 0)::integer as purchased_credits_remaining,
    coalesce(cycle_usage.credits_used, 0)::integer as cycle_credits_used
  from public.profiles p
  left join public.subscription_plans sp
    on sp.id = p.subscription_plan
  left join lateral (
    select coalesce(sum(ul.credits_used), 0)::integer as credits_used
    from public.usage_logs ul
    where ul.user_id = p.id
      and ul.created_at >= coalesce(
        p.credits_last_renewed_at,
        date_trunc('month', now())
      )
  ) cycle_usage on true
  where p.subscription_plan in ('tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro')
    and (
      p.subscription_status = 'active'
      or (
        p.subscription_status = 'cancelled'
        and p.next_billing_date is not null
        and p.next_billing_date > now()
      )
    )
)
update public.profiles p
set
  credits_remaining = state.plan_credits_remaining
    + state.bonus_credits_remaining
    + state.purchased_credits_remaining,
  total_processed = state.cycle_credits_used,
  updated_at = now()
from paid_profile_state state
where p.id = state.id;

-- Keep the paid annual drip inside the same non-rollover model. A renewal
-- releases one allowance and preserves only bonus/purchased balances.
create or replace function public.renew_paid_monthly_credits()
returns table(
  renewed_count integer,
  user_ids uuid[]
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
    update public.profiles
    set
      credits_remaining = coalesce(monthly_credit_allowance, 0)
        + coalesce(bonus_credits_remaining, 0)
        + coalesce(purchased_credits_remaining, 0),
      total_processed = 0,
      credits_last_renewed_at = now(),
      updated_at = now()
    where billing_cycle = 'annual'
      and monthly_credit_allowance is not null
      and monthly_credit_allowance > 0
      and (
        subscription_status = 'active'
        or (
          subscription_status = 'cancelled'
          and next_billing_date is not null
          and next_billing_date > now()
        )
      )
      and (
        credits_last_renewed_at is null
        or credits_last_renewed_at <= now() - interval '30 days'
      )
    returning id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  if renewal_count > 0 then
    raise notice 'Monthly drip: reset plan allowance for % annual subscribers', renewal_count;
  end if;

  return query
  select renewal_count, coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_paid_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_paid_monthly_credits()
  to service_role;
