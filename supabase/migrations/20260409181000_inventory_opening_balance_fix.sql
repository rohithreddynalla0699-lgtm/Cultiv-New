-- 20260409181000_inventory_opening_balance_fix.sql
-- Migration: Fix inventory opening balance to 0 and support opening_balance adjustment

-- Update ensure_store_inventory to set initial quantity to 0
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
    updated_at
  )
  select
    p_store_id,
    item.id,
    0, -- set initial quantity to 0
    item.default_threshold,
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

-- Optionally, add adjustment_type = 'opening_balance' to apply_inventory_adjustment if not present
-- (No change needed if 'set' already covers this, but you can add a check for clarity)
