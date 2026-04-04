-- Prepaid checkout primitives for customer website.

alter table public.orders
  add column if not exists payment_status text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists payment_gateway text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status is null or payment_status = any (array['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text]));
  end if;
end $$;

create table if not exists public.customer_payments (
  payment_id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  customer_id uuid null references public.customers(id) on delete set null,
  user_id uuid null,
  order_id uuid null references public.orders(order_id) on delete set null,
  store_id uuid not null references public.stores(id),
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'INR',
  payment_method text not null check (payment_method = any (array['upi'::text, 'card'::text])),
  gateway text not null,
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  status text not null check (status = any (array['initiated'::text, 'pending_action'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'orphaned'::text])),
  failure_code text,
  failure_message text,
  order_payload jsonb not null,
  items_payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  paid_at timestamptz
);

create unique index if not exists uq_customer_payments_idempotency_key
  on public.customer_payments using btree (idempotency_key);

create unique index if not exists uq_customer_payments_gateway_order_id
  on public.customer_payments using btree (gateway_order_id)
  where gateway_order_id is not null;

create unique index if not exists uq_customer_payments_gateway_payment_id
  on public.customer_payments using btree (gateway_payment_id)
  where gateway_payment_id is not null;

create index if not exists idx_customer_payments_status
  on public.customer_payments using btree (status);

create index if not exists idx_customer_payments_customer_id
  on public.customer_payments using btree (customer_id);

alter table public.customer_payments enable row level security;
