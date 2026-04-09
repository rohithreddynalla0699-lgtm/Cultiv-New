-- 20260409200000_fix_inventory_quantity_ambiguity.sql
-- Fix ambiguous column reference in inventory mutation (apply_inventory_adjustment)

create or replace function "public"."apply_inventory_adjustment"(
  "p_store_id" uuid,
  "p_inventory_item_id" uuid,
  "p_adjustment_type" text,
  "p_quantity_delta" numeric default 0,
  "p_next_quantity" numeric default null,
  "p_next_threshold" numeric default null,
  "p_notes" text default null,
  "p_actor_internal_user_id" uuid default null
)
returns table (
  "store_inventory_id" uuid,
  "adjustment_id" uuid,
  "quantity" numeric,
  "threshold" numeric,
  "updated_at" timestamp with time zone
)
language plpgsql
as $$
declare
  current_inventory public.store_inventory%rowtype;
  resolved_quantity_before numeric := 0;
  resolved_quantity_after numeric := 0;
  resolved_threshold_before numeric := 0;
  resolved_threshold_after numeric := 0;
  resolved_delta numeric := coalesce(p_quantity_delta, 0);
  next_adjustment_id uuid;
  next_store_inventory_id uuid;
  next_updated_at timestamptz;
begin
  if p_adjustment_type not in (
    'set',
    'add',
    'reduce',
    'threshold_update',
    'receive',
    'manual_correction',
    'out_of_stock'
  ) then
    raise exception 'Unsupported adjustment type: %', p_adjustment_type;
  end if;

  perform public.ensure_store_inventory(p_store_id);

  select *
  into current_inventory
  from public.store_inventory
  where store_id = p_store_id
    and inventory_item_id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Store inventory row not found for store % and inventory item %.', p_store_id, p_inventory_item_id;
  end if;

  resolved_quantity_before := coalesce(current_inventory.quantity, 0);
  resolved_threshold_before := coalesce(current_inventory.threshold, 0);
  resolved_quantity_after := resolved_quantity_before;
  resolved_threshold_after := resolved_threshold_before;

  case p_adjustment_type
    when 'add', 'receive' then
      if resolved_delta <= 0 then
        raise exception 'quantity_delta must be greater than 0 for % adjustments.', p_adjustment_type;
      end if;
      resolved_quantity_after := resolved_quantity_before + resolved_delta;
    when 'reduce' then
      if resolved_delta <= 0 then
        raise exception 'quantity_delta must be greater than 0 for reduce adjustments.';
      end if;
      resolved_quantity_after := greatest(0, resolved_quantity_before - resolved_delta);
      resolved_delta := resolved_quantity_after - resolved_quantity_before;
    when 'set' then
      if p_next_quantity is null or p_next_quantity < 0 then
        raise exception 'next_quantity must be provided and non-negative for set adjustments.';
      end if;
      resolved_quantity_after := p_next_quantity;
      resolved_delta := resolved_quantity_after - resolved_quantity_before;
    when 'out_of_stock' then
      resolved_quantity_after := 0;
      resolved_delta := resolved_quantity_after - resolved_quantity_before;
    when 'threshold_update' then
      if p_next_threshold is null or p_next_threshold < 0 then
        raise exception 'next_threshold must be provided and non-negative for threshold updates.';
      end if;
      resolved_threshold_after := p_next_threshold;
      resolved_delta := 0;
    when 'manual_correction' then
      if p_next_quantity is not null then
        if p_next_quantity < 0 then
          raise exception 'next_quantity must be non-negative for manual corrections.';
        end if;
        resolved_quantity_after := p_next_quantity;
        resolved_delta := resolved_quantity_after - resolved_quantity_before;
      else
        resolved_quantity_after := greatest(0, resolved_quantity_before + resolved_delta);
        resolved_delta := resolved_quantity_after - resolved_quantity_before;
      end if;

      if p_next_threshold is not null then
        if p_next_threshold < 0 then
          raise exception 'next_threshold must be non-negative for manual corrections.';
        end if;
        resolved_threshold_after := p_next_threshold;
      end if;
  end case;

  update public.store_inventory
  set
    quantity = resolved_quantity_after,
    threshold = resolved_threshold_after,
    updated_at = now(),
    updated_by = p_actor_internal_user_id
  where id = current_inventory.id
  returning id, public.store_inventory.quantity, public.store_inventory.threshold, public.store_inventory.updated_at
  into next_store_inventory_id, resolved_quantity_after, resolved_threshold_after, next_updated_at;

  insert into public.inventory_adjustments (
    store_id,
    inventory_item_id,
    adjustment_type,
    quantity_delta,
    quantity_before,
    quantity_after,
    threshold_before,
    threshold_after,
    notes,
    actor_internal_user_id,
    created_at
  )
  values (
    p_store_id,
    p_inventory_item_id,
    p_adjustment_type,
    resolved_delta,
    resolved_quantity_before,
    resolved_quantity_after,
    resolved_threshold_before,
    resolved_threshold_after,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_actor_internal_user_id,
    now()
  )
  returning id into next_adjustment_id;

  return query select next_store_inventory_id, next_adjustment_id, resolved_quantity_after, resolved_threshold_after, next_updated_at;
end;
$$;
