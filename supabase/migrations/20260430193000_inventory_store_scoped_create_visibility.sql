alter table "public"."inventory_items"
  add column if not exists "auto_provision_all_stores" boolean not null default true;

update "public"."inventory_items"
set "auto_provision_all_stores" = true
where "auto_provision_all_stores" is distinct from true;

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
    is_deleted,
    updated_at
  )
  select
    p_store_id,
    item.id,
    0,
    item.default_threshold,
    true,
    false,
    now()
  from public.inventory_items item
  where item.is_active = true
    and item.auto_provision_all_stores = true
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
