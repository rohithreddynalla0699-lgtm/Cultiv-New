-- Production hardening: canonical operational payments, auth throttling, and privilege cleanup.

create table if not exists public.order_payments (
  payment_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(order_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  recorded_by_internal_user_id uuid null references public.internal_users(id) on delete set null,
  payment_method text not null check (payment_method = any (array['cash'::text, 'upi'::text, 'card'::text])),
  payment_source text not null check (payment_source = any (array['pos_manual'::text, 'customer_checkout'::text])),
  provider_type text not null check (provider_type = any (array['manual'::text, 'gateway'::text])),
  status text not null check (status = any (array['recorded'::text, 'pending'::text, 'failed'::text, 'cancelled'::text])),
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'INR',
  reference text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_payments_one_payment_per_order unique (order_id)
);

create index if not exists idx_order_payments_store_id on public.order_payments(store_id);
create index if not exists idx_order_payments_customer_id on public.order_payments(customer_id);
create index if not exists idx_order_payments_status on public.order_payments(status);
create index if not exists idx_order_payments_payment_method on public.order_payments(payment_method);
create index if not exists idx_order_payments_recorded_at on public.order_payments(recorded_at desc);

create table if not exists public.internal_auth_attempts (
  attempt_key text primary key,
  attempt_scope text not null check (attempt_scope = any (array['internal_login'::text, 'shift_pin'::text])),
  failure_count integer not null default 0 check (failure_count >= 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stores
  add column if not exists legal_name text,
  add column if not exists gstin text;

insert into public.order_payments (
  order_id,
  store_id,
  customer_id,
  payment_method,
  payment_source,
  provider_type,
  status,
  amount,
  currency,
  reference,
  provider_reference,
  metadata,
  recorded_at,
  created_at,
  updated_at
)
select
  cp.order_id,
  cp.store_id,
  cp.customer_id,
  cp.payment_method,
  'customer_checkout',
  'gateway',
  case
    when cp.status = 'succeeded' then 'recorded'
    when cp.status = 'pending_action' or cp.status = 'initiated' then 'pending'
    when cp.status = 'cancelled' then 'cancelled'
    else 'failed'
  end,
  cp.amount,
  cp.currency,
  cp.gateway_order_id,
  cp.gateway_payment_id,
  jsonb_build_object(
    'gateway', cp.gateway,
    'customer_payment_id', cp.payment_id,
    'failure_code', cp.failure_code,
    'failure_message', cp.failure_message
  ),
  coalesce(cp.paid_at, cp.confirmed_at, cp.updated_at, cp.created_at),
  cp.created_at,
  cp.updated_at
from public.customer_payments cp
where cp.order_id is not null
  and not exists (
    select 1
    from public.order_payments op
    where op.order_id = cp.order_id
  );

revoke all on table public.customers from anon, authenticated;
revoke all on table public.employees from anon, authenticated;
revoke all on table public.internal_users from anon, authenticated;
revoke all on table public.order_item_selections from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.permissions from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.order_payments from anon, authenticated;
revoke all on table public.internal_auth_attempts from anon, authenticated;

revoke insert, update, delete, truncate on table public.stores from anon, authenticated;
grant select on table public.stores to anon, authenticated;

grant select, insert, update, delete on table public.order_payments to service_role;
grant select, insert, update, delete on table public.internal_auth_attempts to service_role;
