-- Customer password reset: one-time reset tokens plus basic abuse throttling.

create table if not exists public.customer_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_ip text,
  request_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_password_reset_tokens_expiry_check check (expires_at > created_at)
);

create index if not exists idx_customer_password_reset_tokens_customer_id
  on public.customer_password_reset_tokens(customer_id);

create index if not exists idx_customer_password_reset_tokens_expires_at
  on public.customer_password_reset_tokens(expires_at);

create index if not exists idx_customer_password_reset_tokens_active_lookup
  on public.customer_password_reset_tokens(token_hash)
  where consumed_at is null;

create table if not exists public.customer_password_reset_attempts (
  attempt_key text primary key,
  attempt_scope text not null check (attempt_scope = any (array['request_reset'::text, 'complete_reset'::text])),
  request_count integer not null default 0 check (request_count >= 0),
  first_attempted_at timestamptz not null default now(),
  last_attempted_at timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.customer_password_reset_tokens from public;
revoke all on table public.customer_password_reset_tokens from anon, authenticated;
grant select, insert, update, delete on table public.customer_password_reset_tokens to service_role;

revoke all on table public.customer_password_reset_attempts from public;
revoke all on table public.customer_password_reset_attempts from anon, authenticated;
grant select, insert, update, delete on table public.customer_password_reset_attempts to service_role;

alter table public.customer_password_reset_tokens enable row level security;
alter table public.customer_password_reset_attempts enable row level security;

drop policy if exists customer_password_reset_tokens_service_role_all on public.customer_password_reset_tokens;
create policy customer_password_reset_tokens_service_role_all
on public.customer_password_reset_tokens
for all
to service_role
using (true)
with check (true);

drop policy if exists customer_password_reset_attempts_service_role_all on public.customer_password_reset_attempts;
create policy customer_password_reset_attempts_service_role_all
on public.customer_password_reset_attempts
for all
to service_role
using (true)
with check (true);

comment on table public.customer_password_reset_tokens is
  'One-time customer password reset tokens. Store only token hashes, never raw reset tokens.';

comment on table public.customer_password_reset_attempts is
  'Password reset request/complete rate-limit buckets keyed by client IP and reset scope.';
