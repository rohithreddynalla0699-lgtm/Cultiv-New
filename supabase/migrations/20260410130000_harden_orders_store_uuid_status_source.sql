-- Phase A: harden orders for canonical transaction-safe order creation.
--
-- This migration intentionally cleans the order schema before introducing the
-- canonical order creation RPC. The site is not live, so we prefer a strict
-- schema and clear preflight failures over carrying legacy text store IDs.

create or replace function public._cultiv_order_store_id_is_uuid(p_value text)
returns boolean
language sql
immutable
as $$
  select p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

create or replace function public._cultiv_resolve_order_store_uuid(p_store_id text)
returns uuid
language plpgsql
stable
as $$
declare
  normalized text;
  legacy_slug text;
  resolved_store_id uuid;
begin
  normalized := nullif(lower(trim(coalesce(p_store_id, ''))), '');

  if normalized is null then
    return null;
  end if;

  if public._cultiv_order_store_id_is_uuid(normalized) then
    return normalized::uuid;
  end if;

  legacy_slug := regexp_replace(normalized, '^store[-_ ]?', '', 'i');

  select stores.id
    into resolved_store_id
  from public.stores
  where lower(stores.code) = normalized
     or lower(stores.name) = normalized
     or lower(stores.city) = normalized
     or lower(stores.code) = legacy_slug
     or lower(stores.name) = legacy_slug
     or lower(stores.city) = legacy_slug
     or lower(replace(stores.name, ' ', '-')) = legacy_slug
     or lower(replace(stores.city, ' ', '-')) = legacy_slug
  order by
    case
      when lower(stores.code) = normalized then 1
      when lower(stores.code) = legacy_slug then 2
      when lower(stores.name) = normalized then 3
      when lower(stores.city) = normalized then 4
      when lower(stores.name) = legacy_slug then 5
      when lower(stores.city) = legacy_slug then 6
      else 7
    end,
    stores.id
  limit 1;

  return resolved_store_id;
end;
$$;

update public.orders
set source_channel = case
  when lower(trim(source_channel)) in ('app', 'online') then 'online'
  when lower(trim(source_channel)) in ('walk-in', 'walk_in', 'in-store', 'in_store', 'phone') then 'walk_in'
  else lower(trim(source_channel))
end;

update public.orders
set order_status = lower(trim(order_status));

do $$
declare
  unresolved_count integer;
  invalid_source_count integer;
  invalid_status_count integer;
  example_store_ids text;
  example_sources text;
  example_statuses text;
begin
  select count(*), string_agg(distinct store_id::text, ', ' order by store_id::text)
    into unresolved_count, example_store_ids
  from public.orders
  where public._cultiv_resolve_order_store_uuid(store_id::text) is null;

  if unresolved_count > 0 then
    raise exception 'Cannot migrate orders.store_id to uuid. % order rows have unmapped store_id values: %',
      unresolved_count,
      example_store_ids;
  end if;

  select count(*), string_agg(distinct source_channel, ', ' order by source_channel)
    into invalid_source_count, example_sources
  from public.orders
  where source_channel is null
     or not (source_channel = any (array['online'::text, 'walk_in'::text]));

  if invalid_source_count > 0 then
    raise exception 'Cannot enforce orders.source_channel. % order rows have invalid values: %',
      invalid_source_count,
      example_sources;
  end if;

  select count(*), string_agg(distinct order_status, ', ' order by order_status)
    into invalid_status_count, example_statuses
  from public.orders
  where order_status is null
     or not (order_status = any (array['placed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'completed'::text, 'cancelled'::text]));

  if invalid_status_count > 0 then
    raise exception 'Cannot enforce orders.order_status. % order rows have invalid values: %',
      invalid_status_count,
      example_statuses;
  end if;
end $$;

alter table public.orders
  drop constraint if exists orders_store_id_fkey,
  drop constraint if exists orders_source_channel_check,
  drop constraint if exists orders_status_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'store_id'
      and data_type <> 'uuid'
  ) then
    alter table public.orders
      alter column store_id type uuid
      using public._cultiv_resolve_order_store_uuid(store_id::text);
  end if;
end $$;

alter table public.orders
  alter column store_id set not null,
  add constraint orders_store_id_fkey
    foreign key (store_id)
    references public.stores(id)
    on delete restrict,
  add constraint orders_source_channel_check
    check (source_channel = any (array['online'::text, 'walk_in'::text])),
  add constraint orders_status_check
    check (order_status = any (array['placed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'completed'::text, 'cancelled'::text]));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status is null or payment_status = any (array['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text]));
  end if;
end $$;

create index if not exists idx_orders_store_id
  on public.orders(store_id);

create index if not exists idx_orders_store_created_at
  on public.orders(store_id, created_at desc);

create index if not exists idx_orders_customer_id
  on public.orders(customer_id);

create index if not exists idx_orders_status
  on public.orders(order_status);

create index if not exists idx_orders_source_channel
  on public.orders(source_channel);

create index if not exists idx_orders_payment_status
  on public.orders(payment_status);

create index if not exists idx_order_payments_order_id
  on public.order_payments(order_id);

create index if not exists idx_order_payments_store_recorded_at
  on public.order_payments(store_id, recorded_at desc);

drop function if exists public._cultiv_resolve_order_store_uuid(text);
drop function if exists public._cultiv_order_store_id_is_uuid(text);
