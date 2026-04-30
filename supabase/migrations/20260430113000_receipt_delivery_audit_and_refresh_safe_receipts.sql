create table if not exists public.receipt_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(order_id) on delete cascade,
  delivery_method text not null,
  recipient text,
  status text not null,
  provider text,
  error_code text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_receipt_deliveries_order_id
  on public.receipt_deliveries(order_id);

create index if not exists idx_receipt_deliveries_created_at
  on public.receipt_deliveries(created_at desc);

revoke all on table public.receipt_deliveries from public;
revoke all on table public.receipt_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.receipt_deliveries to service_role;

alter table public.receipt_deliveries enable row level security;

drop policy if exists receipt_deliveries_service_role_all on public.receipt_deliveries;
create policy receipt_deliveries_service_role_all
on public.receipt_deliveries
for all
to service_role
using (true)
with check (true);
