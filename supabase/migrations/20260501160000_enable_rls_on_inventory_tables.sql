alter table public.inventory_items enable row level security;
alter table public.store_inventory enable row level security;
alter table public.inventory_adjustments enable row level security;

drop policy if exists inventory_items_service_role_all on public.inventory_items;
create policy inventory_items_service_role_all
on public.inventory_items
for all
to service_role
using (true)
with check (true);

drop policy if exists store_inventory_service_role_all on public.store_inventory;
create policy store_inventory_service_role_all
on public.store_inventory
for all
to service_role
using (true)
with check (true);

drop policy if exists inventory_adjustments_service_role_all on public.inventory_adjustments;
create policy inventory_adjustments_service_role_all
on public.inventory_adjustments
for all
to service_role
using (true)
with check (true);
