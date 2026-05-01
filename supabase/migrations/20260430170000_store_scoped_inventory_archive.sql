alter table "public"."store_inventory"
  add column if not exists "is_active" boolean not null default true;

update "public"."store_inventory"
set "is_active" = true
where "is_active" is distinct from true;

create index if not exists "store_inventory_store_active_idx"
  on "public"."store_inventory" using btree ("store_id", "is_active");

create or replace function "public"."ensure_store_inventory"("p_store_id" uuid)
returns integer
language plpgsql
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.store_inventory (
    store_id,
    inventory_item_id,
    quantity,
    threshold,
    is_active,
    updated_at
  )
  select
    p_store_id,
    item.id,
    0,
    item.default_threshold,
    true,
    now()
  from public.inventory_items item
  where item.is_active = true
    and not exists (
      select 1
      from public.store_inventory existing
      where existing.store_id = p_store_id
        and existing.inventory_item_id = item.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
