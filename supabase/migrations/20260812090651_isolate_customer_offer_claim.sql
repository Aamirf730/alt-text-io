-- Keep the customer-facing RPC in the exposed public schema while moving the
-- privileged implementation into a private schema. The public wrapper runs
-- with caller privileges; the private function performs the tightly scoped,
-- identity-bound claim.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.claim_wpgeared_customer_offer_for_caller(
  caller_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  campaign_key constant text := 'wpgeared_customers_2026_07';
  award_amount constant integer := 1000;
  caller_email text;
  caller_email_confirmed_at timestamptz;
  caller_email_hash text;
  eligibility_row public.campaign_offer_eligibility%rowtype;
  profile_plan text;
  new_credits_remaining integer;
  new_bonus_credits_remaining integer;
begin
  if caller_user_id is null or caller_user_id <> (select auth.uid()) then
    return json_build_object(
      'success', false,
      'status', 'authentication_required',
      'message', 'Please sign in before claiming this offer.'
    );
  end if;

  select u.email, u.email_confirmed_at
  into caller_email, caller_email_confirmed_at
  from auth.users u
  where u.id = caller_user_id;

  if caller_email is null or caller_email_confirmed_at is null then
    return json_build_object(
      'success', false,
      'status', 'confirmed_email_required',
      'message', 'Please confirm your email address before claiming this offer.'
    );
  end if;

  caller_email_hash := encode(
    extensions.digest(lower(btrim(caller_email)), 'sha256'),
    'hex'
  );

  select e.*
  into eligibility_row
  from public.campaign_offer_eligibility e
  where e.campaign = campaign_key
    and e.email_hash = caller_email_hash
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'status', 'not_eligible',
      'message', 'This offer is available only to invited WPGeared customers using their invited email address.'
    );
  end if;

  if eligibility_row.claimed_at is not null then
    select p.credits_remaining, p.bonus_credits_remaining
    into new_credits_remaining, new_bonus_credits_remaining
    from public.profiles p
    where p.id = caller_user_id;

    return json_build_object(
      'success', true,
      'status', 'already_claimed',
      'message', 'This customer offer has already been claimed.',
      'credits_awarded', eligibility_row.credits_awarded,
      'credits_remaining', new_credits_remaining,
      'bonus_credits_remaining', new_bonus_credits_remaining
    );
  end if;

  select p.subscription_plan
  into profile_plan
  from public.profiles p
  where p.id = caller_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'status', 'profile_not_found',
      'message', 'Your Alt Text Pro profile is not ready yet. Please sign out and sign in again.'
    );
  end if;

  if coalesce(profile_plan, 'free') <> 'free' then
    return json_build_object(
      'success', false,
      'status', 'free_plan_required',
      'message', 'This 1,000-credit customer bonus is available on a free Alt Text Pro account.'
    );
  end if;

  update public.profiles
  set
    credits_remaining = coalesce(credits_remaining, 0) + award_amount,
    bonus_credits_remaining = coalesce(bonus_credits_remaining, 0) + award_amount,
    updated_at = now()
  where id = caller_user_id
  returning credits_remaining, bonus_credits_remaining
  into new_credits_remaining, new_bonus_credits_remaining;

  update public.campaign_offer_eligibility
  set
    claimed_by = caller_user_id,
    claimed_at = now(),
    credits_awarded = award_amount
  where campaign = campaign_key
    and email_hash = caller_email_hash;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    action,
    resource_type,
    resource_id,
    details,
    severity
  )
  values (
    caller_user_id,
    caller_email,
    'credit.add',
    'campaign_offer',
    campaign_key,
    jsonb_build_object(
      'credits_awarded', award_amount,
      'credits_remaining', new_credits_remaining,
      'bonus_credits_remaining', new_bonus_credits_remaining
    ),
    'info'
  );

  return json_build_object(
    'success', true,
    'status', 'claimed',
    'message', 'Your 1,000 bonus credits have been added.',
    'credits_awarded', award_amount,
    'credits_remaining', new_credits_remaining,
    'bonus_credits_remaining', new_bonus_credits_remaining
  );
end;
$function$;

revoke all on function private.claim_wpgeared_customer_offer_for_caller(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.claim_wpgeared_customer_offer_for_caller(uuid)
  to authenticated;

create or replace function public.claim_wpgeared_customer_offer()
returns json
language sql
security invoker
set search_path = ''
as $function$
  select private.claim_wpgeared_customer_offer_for_caller((select auth.uid()));
$function$;

revoke all on function public.claim_wpgeared_customer_offer()
  from public, anon, authenticated;
grant execute on function public.claim_wpgeared_customer_offer()
  to authenticated;
