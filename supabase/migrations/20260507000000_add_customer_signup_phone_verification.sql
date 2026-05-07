-- Customer signup phone verification: pending accounts plus unauthenticated OTP challenges.

alter table public.customers
  add column if not exists phone_verification_required boolean not null default false;

create table if not exists public.customer_signup_verification_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  phone_normalized text not null,
  otp_hash text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_otp_sent_at timestamptz not null,
  otp_attempts integer not null default 0,
  resend_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_signup_verification_requests_status_check
    check (status in ('pending', 'verified', 'cancelled', 'failed'))
);

create index if not exists idx_customer_signup_verification_requests_customer_id
  on public.customer_signup_verification_requests(customer_id);

create index if not exists idx_customer_signup_verification_requests_status
  on public.customer_signup_verification_requests(status);

create index if not exists idx_customer_signup_verification_requests_phone_normalized
  on public.customer_signup_verification_requests(phone_normalized);

revoke all on table public.customer_signup_verification_requests from public;
revoke all on table public.customer_signup_verification_requests from anon, authenticated;
grant select, insert, update, delete on table public.customer_signup_verification_requests to service_role;

alter table public.customer_signup_verification_requests enable row level security;

drop policy if exists customer_signup_verification_requests_service_role_all on public.customer_signup_verification_requests;
create policy customer_signup_verification_requests_service_role_all
on public.customer_signup_verification_requests
for all
to service_role
using (true)
with check (true);

comment on table public.customer_signup_verification_requests is
  'Unauthenticated OTP challenges for new customer signup phone verification.';
