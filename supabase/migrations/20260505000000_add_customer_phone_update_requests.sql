-- Adds a table for OTP-backed customer phone update requests.

create table if not exists public.customer_phone_update_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  new_phone text not null,
  new_phone_normalized text not null,
  otp_hash text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_otp_sent_at timestamptz not null,
  otp_attempts integer not null default 0,
  resend_attempts integer not null default 0,
  locked_until timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.customer_phone_update_requests
  add constraint customer_phone_update_requests_customer_fk foreign key (customer_id)
  references public.customers(id)
  on delete cascade;

alter table public.customer_phone_update_requests
  add constraint customer_phone_update_requests_status_check
  check (status in ('pending', 'verified', 'cancelled', 'failed'));

create index if not exists idx_customer_phone_update_requests_customer_id
  on public.customer_phone_update_requests(customer_id);

create index if not exists idx_customer_phone_update_requests_new_phone_normalized
  on public.customer_phone_update_requests(new_phone_normalized);

create index if not exists idx_customer_phone_update_requests_status
  on public.customer_phone_update_requests(status);
