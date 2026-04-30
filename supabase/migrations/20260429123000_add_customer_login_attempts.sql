-- Customer login brute-force protection with IP and identifier buckets.

create table if not exists public.customer_auth_attempts (
  attempt_key text primary key,
  attempt_scope text not null check (attempt_scope = any (array['login_ip'::text, 'login_identifier'::text])),
  failure_count integer not null default 0 check (failure_count >= 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.customer_auth_attempts from public;
revoke all on table public.customer_auth_attempts from anon, authenticated;
grant select, insert, update, delete on table public.customer_auth_attempts to service_role;

alter table public.customer_auth_attempts enable row level security;

drop policy if exists customer_auth_attempts_service_role_all on public.customer_auth_attempts;
create policy customer_auth_attempts_service_role_all
on public.customer_auth_attempts
for all
to service_role
using (true)
with check (true);

comment on table public.customer_auth_attempts is
  'Customer login brute-force protection buckets keyed by IP and hashed identifier.';
