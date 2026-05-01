alter table public.loyalty_points_ledger
  add column if not exists updated_at timestamptz not null default now();
