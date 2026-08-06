-- Partial Polar refunds are recorded without clawing back the entire credit
-- pack. Allow the status emitted by the webhook's partial-refund path.
alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'));
