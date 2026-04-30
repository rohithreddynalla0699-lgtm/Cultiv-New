-- Revocable customer sessions for web/mobile customer auth.

create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_by_ip text,
  created_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_sessions_expiry_check check (expires_at > created_at)
);

create index if not exists idx_customer_sessions_customer_id
  on public.customer_sessions(customer_id);

create index if not exists idx_customer_sessions_expires_at
  on public.customer_sessions(expires_at);

create index if not exists idx_customer_sessions_active_token
  on public.customer_sessions(session_token)
  where revoked_at is null;

create index if not exists idx_customer_sessions_active_customer
  on public.customer_sessions(customer_id, revoked_at, expires_at desc);

revoke all on table public.customer_sessions from public;
revoke all on table public.customer_sessions from anon, authenticated;
grant select, insert, update, delete on table public.customer_sessions to service_role;

alter table public.customer_sessions enable row level security;

drop policy if exists customer_sessions_service_role_all on public.customer_sessions;
create policy customer_sessions_service_role_all
on public.customer_sessions
for all
to service_role
using (true)
with check (true);

comment on table public.customer_sessions is
  'Revocable customer auth sessions with expiry and device metadata.';
