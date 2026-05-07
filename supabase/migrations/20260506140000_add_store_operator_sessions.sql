create table if not exists public.store_operator_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  internal_access_session_id uuid not null references public.internal_access_sessions(id) on delete cascade,
  internal_user_id uuid not null references public.internal_users(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(shift_id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  device_id text,
  device_name text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text,
  is_locked boolean not null default false,
  created_by_ip text,
  created_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_operator_sessions_expiry_check check (expires_at > started_at),
  constraint store_operator_sessions_end_check check (ended_at is null or ended_at >= started_at),
  constraint store_operator_sessions_ended_reason_check check (ended_at is null or ended_reason is not null)
);

create index if not exists idx_store_operator_sessions_internal_access_session_id
  on public.store_operator_sessions(internal_access_session_id);

create index if not exists idx_store_operator_sessions_internal_user_id
  on public.store_operator_sessions(internal_user_id);

create index if not exists idx_store_operator_sessions_employee_id
  on public.store_operator_sessions(employee_id);

create index if not exists idx_store_operator_sessions_shift_id
  on public.store_operator_sessions(shift_id);

create index if not exists idx_store_operator_sessions_store_id
  on public.store_operator_sessions(store_id);

create index if not exists idx_store_operator_sessions_expires_at
  on public.store_operator_sessions(expires_at);

create index if not exists idx_store_operator_sessions_active_token
  on public.store_operator_sessions(session_token)
  where ended_at is null;

create unique index if not exists uq_store_operator_sessions_active_internal_access_session
  on public.store_operator_sessions(internal_access_session_id)
  where ended_at is null;

create unique index if not exists uq_store_operator_sessions_active_shift
  on public.store_operator_sessions(shift_id)
  where ended_at is null;

revoke all on table public.store_operator_sessions from public;
revoke all on table public.store_operator_sessions from anon, authenticated;
grant select, insert, update, delete on table public.store_operator_sessions to service_role;

alter table public.store_operator_sessions enable row level security;

drop policy if exists store_operator_sessions_service_role_all on public.store_operator_sessions;
create policy store_operator_sessions_service_role_all
on public.store_operator_sessions
for all
to service_role
using (true)
with check (true);

comment on table public.store_operator_sessions is
  'Server-backed store terminal operator sessions linked to internal access sessions and employee shifts.';
