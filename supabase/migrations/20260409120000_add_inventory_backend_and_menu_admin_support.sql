create table if not exists "public"."inventory_items" (
  "id" uuid not null default gen_random_uuid(),
  "sku" text not null,
  "name" text not null,
  "category" text not null,
  "unit" text not null,
  "default_threshold" numeric not null default 0,
  "is_active" boolean not null default true,
  "sort_order" integer not null default 0,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "inventory_items_pkey" primary key ("id"),
  constraint "inventory_items_sku_key" unique ("sku"),
  constraint "inventory_items_default_threshold_check" check (default_threshold >= 0)
);

create table if not exists "public"."store_inventory" (
  "id" uuid not null default gen_random_uuid(),
  "store_id" uuid not null,
  "inventory_item_id" uuid not null,
  "quantity" numeric not null default 0,
  "threshold" numeric not null default 0,
  "updated_at" timestamp with time zone not null default now(),
  "updated_by" uuid,
  constraint "store_inventory_pkey" primary key ("id"),
  constraint "store_inventory_store_item_key" unique ("store_id", "inventory_item_id"),
  constraint "store_inventory_quantity_check" check (quantity >= 0),
  constraint "store_inventory_threshold_check" check (threshold >= 0),
  constraint "store_inventory_store_id_fkey" foreign key ("store_id") references "public"."stores"("id") on delete cascade,
  constraint "store_inventory_inventory_item_id_fkey" foreign key ("inventory_item_id") references "public"."inventory_items"("id") on delete cascade,
  constraint "store_inventory_updated_by_fkey" foreign key ("updated_by") references "public"."internal_users"("id") on delete set null
);

create table if not exists "public"."inventory_adjustments" (
  "id" uuid not null default gen_random_uuid(),
  "store_id" uuid not null,
  "inventory_item_id" uuid not null,
  "adjustment_type" text not null,
  "quantity_delta" numeric not null default 0,
  "quantity_before" numeric not null default 0,
  "quantity_after" numeric not null default 0,
  "threshold_before" numeric,
  "threshold_after" numeric,
  "notes" text,
  "actor_internal_user_id" uuid,
  "created_at" timestamp with time zone not null default now(),
  constraint "inventory_adjustments_pkey" primary key ("id"),
  constraint "inventory_adjustments_store_id_fkey" foreign key ("store_id") references "public"."stores"("id") on delete cascade,
  constraint "inventory_adjustments_inventory_item_id_fkey" foreign key ("inventory_item_id") references "public"."inventory_items"("id") on delete cascade,
  constraint "inventory_adjustments_actor_internal_user_id_fkey" foreign key ("actor_internal_user_id") references "public"."internal_users"("id") on delete set null,
  constraint "inventory_adjustments_type_check" check (
    adjustment_type = any (
      array[
        'set'::text,
        'add'::text,
        'reduce'::text,
        'threshold_update'::text,
        'receive'::text,
        'manual_correction'::text,
        'out_of_stock'::text
      ]
    )
  )
);

create index if not exists "inventory_items_sort_order_idx" on "public"."inventory_items" using btree ("sort_order", "name");
create index if not exists "store_inventory_store_id_idx" on "public"."store_inventory" using btree ("store_id");
create index if not exists "store_inventory_inventory_item_id_idx" on "public"."store_inventory" using btree ("inventory_item_id");
create index if not exists "inventory_adjustments_store_created_idx" on "public"."inventory_adjustments" using btree ("store_id", "created_at" desc);
create index if not exists "inventory_adjustments_item_created_idx" on "public"."inventory_adjustments" using btree ("inventory_item_id", "created_at" desc);

alter table "public"."menu_items"
  add column if not exists "description" text,
  add column if not exists "image_url" text,
  add column if not exists "calories" integer,
  add column if not exists "protein_grams" integer,
  add column if not exists "badge" text,
  add column if not exists "updated_at" timestamp with time zone not null default now();

alter table "public"."menu_items"
  drop constraint if exists "menu_items_calories_check";
alter table "public"."menu_items"
  drop constraint if exists "menu_items_protein_grams_check";

alter table "public"."menu_items"
  add constraint "menu_items_calories_check" check (calories is null or calories >= 0);
alter table "public"."menu_items"
  add constraint "menu_items_protein_grams_check" check (protein_grams is null or protein_grams >= 0);

insert into "public"."inventory_items" (
  "sku",
  "name",
  "category",
  "unit",
  "default_threshold",
  "sort_order"
)
values
  ('white_basmati_rice', 'White Basmati Rice', 'rice', 'kg', 5, 10),
  ('brown_rice', 'Brown Rice', 'rice', 'kg', 3, 20),
  ('classic_chicken', 'Classic Chicken', 'proteins', 'kg', 3, 30),
  ('spicy_chicken', 'Spicy Chicken', 'proteins', 'kg', 3, 40),
  ('rajma', 'Rajma', 'proteins', 'kg', 2, 50),
  ('channa', 'Channa', 'proteins', 'kg', 2, 60),
  ('eggs', 'Eggs', 'proteins', 'trays', 2, 70),
  ('cheese', 'Cheese', 'proteins', 'bags', 2, 80),
  ('onion', 'Onion', 'veggies', 'bags', 2, 90),
  ('cucumber', 'Cucumber', 'veggies', 'bags', 2, 100),
  ('lettuce', 'Lettuce', 'veggies', 'bags', 2, 110),
  ('capsicum', 'Capsicum', 'veggies', 'bags', 2, 120),
  ('green_cabbage', 'Green Cabbage', 'veggies', 'bags', 2, 130),
  ('red_cabbage', 'Red Cabbage', 'veggies', 'bags', 2, 140),
  ('carrots', 'Carrots', 'veggies', 'bags', 2, 150),
  ('tomato', 'Tomato', 'veggies', 'bags', 2, 160),
  ('lemon', 'Lemon', 'veggies', 'bags', 2, 170),
  ('sweet_corn', 'Sweet Corn', 'veggies', 'bags', 2, 180),
  ('small_chilli', 'Small Chilli', 'veggies', 'bags', 1, 190),
  ('big_chilli', 'Big Chilli', 'veggies', 'bags', 1, 200),
  ('dried_red_chilli', 'Dried Red Chilli', 'veggies', 'bags', 1, 210),
  ('avocado', 'Avocado', 'veggies', 'bags', 2, 220),
  ('ginger', 'Ginger', 'veggies', 'bags', 1, 230),
  ('yogurt', 'Yogurt', 'breakfast', 'boxes', 2, 240),
  ('chia_seeds', 'Chia Seeds', 'breakfast', 'bags', 1, 250),
  ('banana', 'Banana', 'breakfast', 'boxes', 1, 260),
  ('apple', 'Apple', 'breakfast', 'bags', 1, 270),
  ('mixed_berries', 'Mixed Berries', 'breakfast', 'bags', 1, 280),
  ('mango', 'Mango', 'breakfast', 'bags', 1, 290),
  ('granola', 'Granola', 'breakfast', 'bags', 1, 300),
  ('honey', 'Honey', 'breakfast', 'bottles', 2, 310),
  ('watermelon', 'Watermelon', 'breakfast', 'pcs', 2, 320),
  ('water_bottles', 'Water Bottles', 'drinks', 'cases', 2, 330),
  ('coke', 'Coke', 'drinks', 'cases', 2, 340),
  ('regular_bowl', 'Regular Bowl', 'packaging', 'pcs', 50, 350),
  ('regular_bowl_lid', 'Regular Bowl Lid', 'packaging', 'pcs', 50, 360),
  ('breakfast_bowl', 'Breakfast Bowl', 'packaging', 'pcs', 40, 370),
  ('breakfast_bowl_lid', 'Breakfast Bowl Lid', 'packaging', 'pcs', 40, 380),
  ('paper_cup', 'Paper Cup', 'packaging', 'pcs', 50, 390),
  ('paper_cup_lid', 'Paper Cup Lid', 'packaging', 'pcs', 50, 400),
  ('spoon', 'Spoon', 'packaging', 'pcs', 100, 410),
  ('paper_bag', 'Paper Bag', 'packaging', 'pcs', 50, 420),
  ('tissue_pack', 'Tissue Pack', 'packaging', 'packs', 20, 430)
on conflict ("sku") do update
set
  "name" = excluded."name",
  "category" = excluded."category",
  "unit" = excluded."unit",
  "default_threshold" = excluded."default_threshold",
  "sort_order" = excluded."sort_order",
  "updated_at" = now();

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
    case
      when item.category = 'packaging' then item.default_threshold + 20
      else item.default_threshold + 3
    end,
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
  returning id, quantity, threshold, updated_at
  into next_store_inventory_id, quantity, threshold, next_updated_at;

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

  store_inventory_id := next_store_inventory_id;
  adjustment_id := next_adjustment_id;
  updated_at := next_updated_at;

  return next;
end;
$$;

create or replace function "public"."sync_item_option_group_map"(
  "p_menu_item_id" text,
  "p_group_ids" text[]
)
returns void
language plpgsql
as $$
begin
  delete from public.item_option_group_map
  where menu_item_id = p_menu_item_id;

  if coalesce(array_length(p_group_ids, 1), 0) = 0 then
    return;
  end if;

  insert into public.item_option_group_map (
    menu_item_id,
    group_id,
    sort_order
  )
  select
    p_menu_item_id,
    mapped.group_id,
    mapped.ordinality - 1
  from unnest(p_group_ids) with ordinality as mapped(group_id, ordinality);
end;
$$;

do $$
declare
  store_row record;
begin
  for store_row in
    select id
    from public.stores
    where is_active = true
  loop
    perform public.ensure_store_inventory(store_row.id);
  end loop;
end;
$$;

grant select, insert, update, delete on table "public"."inventory_items" to "service_role";
grant select, insert, update, delete on table "public"."store_inventory" to "service_role";
grant select, insert, update, delete on table "public"."inventory_adjustments" to "service_role";

grant execute on function "public"."ensure_store_inventory"(uuid) to "service_role";
grant execute on function "public"."apply_inventory_adjustment"(uuid, uuid, text, numeric, numeric, numeric, text, uuid) to "service_role";
grant execute on function "public"."sync_item_option_group_map"(text, text[]) to "service_role";
