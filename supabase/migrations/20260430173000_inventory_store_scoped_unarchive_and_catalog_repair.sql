update "public"."inventory_items"
set "is_active" = true,
    "updated_at" = now()
where "is_active" = false;
