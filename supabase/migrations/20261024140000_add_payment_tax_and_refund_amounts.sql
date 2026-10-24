-- Store the tax and refunded amounts Polar reports on each order so revenue
-- can be reported net of tax and refunds.
--
-- amount stays the gross order total (tax included), as before. Older rows
-- have no recorded tax (treated as 0) and no recorded refund amount; a
-- fully refunded older row still counts as zero revenue because of its
-- status.

alter table public.payments
  add column if not exists tax_amount numeric(10, 2) not null default 0,
  add column if not exists refunded_amount numeric(10, 2),
  add column if not exists refunded_tax_amount numeric(10, 2);

comment on column public.payments.tax_amount is
  'Tax included in amount, from the Polar order (taxAmount).';
comment on column public.payments.refunded_amount is
  'Cumulative amount refunded on the Polar order, tax included (refundedAmount).';
comment on column public.payments.refunded_tax_amount is
  'Cumulative tax refunded on the Polar order (refundedTaxAmount).';

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_tax_and_refunds_nonnegative'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_tax_and_refunds_nonnegative
      check (
        tax_amount >= 0
        and (refunded_amount is null or refunded_amount >= 0)
        and (refunded_tax_amount is null or refunded_tax_amount >= 0)
      );
  end if;
end
$constraints$;
