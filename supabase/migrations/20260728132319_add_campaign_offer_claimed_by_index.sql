-- Cover the claimed_by foreign key so auth-user deletion does not require a
-- full scan of the campaign eligibility ledger.
create index if not exists campaign_offer_claimed_by_idx
  on public.campaign_offer_eligibility (claimed_by)
  where claimed_by is not null;
