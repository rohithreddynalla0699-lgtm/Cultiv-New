-- Secure public.customers behind RLS and add claim-match indexes for guest order linking.

revoke all on table public.customers from public;
revoke all on table public.customers from anon, authenticated;
grant select, insert, update, delete on table public.customers to service_role;

alter table public.customers enable row level security;

drop policy if exists customers_service_role_all on public.customers;

create policy customers_service_role_all
on public.customers
for all
to service_role
using (true)
with check (true);

comment on table public.customers is
  'Customer records are backend-managed. Client access must go through edge functions until a safe auth.uid() mapping exists.';

create index if not exists idx_orders_guest_claim_phone
on public.orders (customer_phone)
where customer_id is null and source_channel = 'app';

create index if not exists idx_orders_guest_claim_email
on public.orders (customer_email)
where customer_id is null and source_channel = 'app' and customer_email is not null;
