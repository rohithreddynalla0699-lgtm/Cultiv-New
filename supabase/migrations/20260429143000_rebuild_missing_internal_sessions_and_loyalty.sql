-- Rebuild missing runtime tables and security primitives so a fresh project
-- can satisfy current edge-function dependencies from migrations alone.

create table if not exists public.internal_access_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  internal_user_id uuid not null references public.internal_users(id),
  role_key text not null check (role_key = any (array['owner'::text, 'admin'::text, 'store'::text])),
  scope_type text not null check (scope_type = any (array['global'::text, 'owner'::text, 'admin'::text, 'store'::text])),
  scope_store_id uuid null references public.stores(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_by_ip text,
  created_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_access_sessions_expiry_check check (expires_at > created_at),
  constraint internal_access_sessions_store_scope_check check (
    (scope_type = 'store' and scope_store_id is not null)
    or (scope_type <> 'store' and scope_store_id is null)
  )
);

create index if not exists idx_internal_access_sessions_internal_user_id
  on public.internal_access_sessions(internal_user_id);

create index if not exists idx_internal_access_sessions_scope_store_id
  on public.internal_access_sessions(scope_store_id);

create index if not exists idx_internal_access_sessions_expires_at
  on public.internal_access_sessions(expires_at);

create index if not exists idx_internal_access_sessions_active_token
  on public.internal_access_sessions(session_token)
  where revoked_at is null;

create index if not exists idx_internal_access_sessions_active_user
  on public.internal_access_sessions(internal_user_id, revoked_at, expires_at desc);

create table if not exists public.loyalty_points_ledger (
  loyalty_entry_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid null references public.orders(order_id) on delete set null,
  entry_type text not null check (entry_type = any (array['earn'::text, 'redeem'::text, 'adjustment'::text, 'expire'::text])),
  points integer not null check (points > 0),
  points_remaining integer not null default 0 check (points_remaining >= 0),
  earned_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_points_ledger_remaining_check check (
    (entry_type = 'earn' and points_remaining <= points)
    or (entry_type <> 'earn' and points_remaining = 0)
  ),
  constraint loyalty_points_ledger_expiry_check check (
    entry_type <> 'earn'
    or expires_at is null
    or expires_at >= earned_at
  )
);

create index if not exists idx_loyalty_points_ledger_user_created_at
  on public.loyalty_points_ledger(user_id, created_at desc);

create index if not exists idx_loyalty_points_ledger_active_batches
  on public.loyalty_points_ledger(user_id, entry_type, expires_at, earned_at, created_at)
  where entry_type = 'earn' and points_remaining > 0;

create index if not exists idx_loyalty_points_ledger_order_id
  on public.loyalty_points_ledger(order_id);

create unique index if not exists uq_loyalty_points_ledger_earn_order
  on public.loyalty_points_ledger(order_id)
  where entry_type = 'earn' and order_id is not null;

revoke all on table public.internal_access_sessions from public;
revoke all on table public.internal_access_sessions from anon, authenticated;
grant select, insert, update, delete on table public.internal_access_sessions to service_role;

revoke all on table public.loyalty_points_ledger from public;
revoke all on table public.loyalty_points_ledger from anon, authenticated;
grant select, insert, update, delete on table public.loyalty_points_ledger to service_role;

revoke all on table public.customer_payments from public;
revoke all on table public.customer_payments from anon, authenticated;
grant select, insert, update, delete on table public.customer_payments to service_role;

revoke all on table public.order_payments from public;
revoke all on table public.order_payments from anon, authenticated;
grant select, insert, update, delete on table public.order_payments to service_role;

revoke all on table public.internal_auth_attempts from public;
revoke all on table public.internal_auth_attempts from anon, authenticated;
grant select, insert, update, delete on table public.internal_auth_attempts to service_role;

alter table public.internal_access_sessions enable row level security;
alter table public.loyalty_points_ledger enable row level security;
alter table public.customer_payments enable row level security;
alter table public.order_payments enable row level security;
alter table public.internal_auth_attempts enable row level security;

drop policy if exists internal_access_sessions_service_role_all on public.internal_access_sessions;
create policy internal_access_sessions_service_role_all
on public.internal_access_sessions
for all
to service_role
using (true)
with check (true);

drop policy if exists loyalty_points_ledger_service_role_all on public.loyalty_points_ledger;
create policy loyalty_points_ledger_service_role_all
on public.loyalty_points_ledger
for all
to service_role
using (true)
with check (true);

drop policy if exists customer_payments_service_role_all on public.customer_payments;
create policy customer_payments_service_role_all
on public.customer_payments
for all
to service_role
using (true)
with check (true);

drop policy if exists order_payments_service_role_all on public.order_payments;
create policy order_payments_service_role_all
on public.order_payments
for all
to service_role
using (true)
with check (true);

drop policy if exists internal_auth_attempts_service_role_all on public.internal_auth_attempts;
create policy internal_auth_attempts_service_role_all
on public.internal_auth_attempts
for all
to service_role
using (true)
with check (true);

comment on table public.internal_access_sessions is
  'Server-issued internal login sessions for owner, admin, and store access.';

comment on table public.loyalty_points_ledger is
  'Immutable loyalty earn/redeem ledger used for customer rewards and balance views.';
