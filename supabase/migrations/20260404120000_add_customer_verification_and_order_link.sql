-- Minimal customer/account evolution for verification, rewards, and customer-linked orders.

alter table public.customers
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_verified boolean not null default false,
  add column if not exists reward_points integer not null default 0;

alter table public.orders
  add column if not exists customer_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end $$;
