-- Annual plans: exactly 12 monthly allowances per paid year (audit 4).
--
-- Before: the daily cron refilled any annual profile 30 days after its last
-- refill. Activation grants month 1, so refills landed on days 30, 60, ...,
-- 360 and the yearly renewal on day 365 granted again: 13 allowances a year.
--
-- Now the refill schedule is anchored to the paid period, derived from
-- next_billing_date (the period end Polar reports; activation and renewal
-- both set it, and the renewal also resets credits_last_renewed_at):
--   period_start = next_billing_date - 1 year
--   month n (1..11) is due at period_start + n months
-- A profile is refilled when the current month n is between 1 and 11 and it
-- has not been refilled since that month began. Month 0 is the activation or
-- renewal grant, and nothing is granted in the last month before the
-- renewal: 1 + 11 = 12 allowances.
--
-- Profiles whose next_billing_date is missing or more than a year away
-- (legacy rows with no reliable period) keep the previous 30-day rule.
-- A next_billing_date in the past means the renewal is overdue (for example
-- a failed charge), so nothing is granted until Polar's renewal arrives.
-- past_due profiles are excluded by the status filter.
--
-- Return type, name and grants are unchanged; the 'renew-paid-credits'
-- pg_cron job keeps calling it daily.

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
  with annual_profiles as (
    select
      p.id,
      p.credits_last_renewed_at,
      p.next_billing_date,
      p.next_billing_date - interval '1 year' as period_start
    from public.profiles p
    where p.billing_cycle = 'annual'
      and p.monthly_credit_allowance is not null
      and p.monthly_credit_allowance > 0
      and (
        p.subscription_status = 'active'
        or (
          p.subscription_status = 'cancelled'
          and p.next_billing_date is not null
          and p.next_billing_date > now()
        )
      )
  ),
  schedule as (
    select
      a.id,
      a.credits_last_renewed_at,
      a.next_billing_date,
      a.period_start,
      (
        extract(year from age(now(), a.period_start))::integer * 12
        + extract(month from age(now(), a.period_start))::integer
      ) as months_elapsed
    from annual_profiles a
  ),
  due as (
    select s.id
    from schedule s
    where
      (
        -- No reliable paid period: previous 30-day rule.
        (s.next_billing_date is null or s.next_billing_date > now() + interval '1 year')
        and (
          s.credits_last_renewed_at is null
          or s.credits_last_renewed_at <= now() - interval '30 days'
        )
      )
      or (
        s.next_billing_date > now()
        and s.next_billing_date <= now() + interval '1 year'
        and s.months_elapsed between 1 and 11
        and (
          s.credits_last_renewed_at is null
          or s.credits_last_renewed_at
            < s.period_start + make_interval(months => s.months_elapsed)
        )
      )
  ),
  renewed as (
    update public.profiles as p
    set
      credits_remaining = greatest(
        0,
        coalesce(p.monthly_credit_allowance, 0)
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
      total_processed = 0,
      credits_last_renewed_at = now(),
      updated_at = now()
    from due d
    where p.id = d.id
    returning p.id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  return query
  select renewal_count, coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_paid_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_paid_monthly_credits()
  to service_role;
