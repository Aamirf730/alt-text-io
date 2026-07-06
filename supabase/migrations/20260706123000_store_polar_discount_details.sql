alter table public.payments
  add column if not exists polar_product_id text,
  add column if not exists product_name text,
  add column if not exists discount_id text,
  add column if not exists discount_code text,
  add column if not exists discount_name text,
  add column if not exists discount_amount decimal(10,2);

create index if not exists payments_polar_product_id_idx
  on public.payments (polar_product_id);

create index if not exists payments_discount_code_idx
  on public.payments (discount_code)
  where discount_code is not null;
