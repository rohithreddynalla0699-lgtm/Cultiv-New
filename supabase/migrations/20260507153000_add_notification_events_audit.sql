create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms')),
  purpose text not null check (purpose in ('receipt', 'signup_verification', 'password_reset')),
  status text not null check (status in ('sent', 'failed', 'not_delivered')),
  provider text,
  recipient text,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(order_id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notification_events_created_at
  on public.notification_events(created_at desc);

create index if not exists idx_notification_events_status_created_at
  on public.notification_events(status, created_at desc);

create index if not exists idx_notification_events_purpose_created_at
  on public.notification_events(purpose, created_at desc);

create index if not exists idx_notification_events_order_id
  on public.notification_events(order_id);

create index if not exists idx_notification_events_store_id
  on public.notification_events(store_id);

create index if not exists idx_notification_events_customer_id
  on public.notification_events(customer_id);

revoke all on table public.notification_events from public;
revoke all on table public.notification_events from anon, authenticated;
grant select, insert, update, delete on table public.notification_events to service_role;

alter table public.notification_events enable row level security;

drop policy if exists notification_events_service_role_all on public.notification_events;
create policy notification_events_service_role_all
on public.notification_events
for all
to service_role
using (true)
with check (true);

comment on table public.notification_events is
  'Append-only audit log for notification attempts and prepared-but-not-delivered events across channels and purposes.';
