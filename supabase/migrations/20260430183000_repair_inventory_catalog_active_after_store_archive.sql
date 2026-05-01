-- Inventory archive is store-scoped via store_inventory.is_active.
-- If older archive flows incorrectly disabled the global catalog row,
-- restore those items so store-level active flags are the source of truth.
update public.inventory_items
set
  is_active = true,
  updated_at = now()
where is_active = false
  and exists (
    select 1
    from public.store_inventory si
    where si.inventory_item_id = inventory_items.id
  );
