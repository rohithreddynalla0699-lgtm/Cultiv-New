alter table public.orders
  add column if not exists cancellation_reason text;

create index if not exists idx_orders_cancellation_reason
  on public.orders(order_status)
  where cancellation_reason is not null;
