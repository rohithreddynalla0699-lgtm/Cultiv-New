alter table public.orders
  add column if not exists tax_amount integer not null default 0,
  add column if not exists tip_amount integer not null default 0;