-- CULTIV local seed
-- Safe for local Supabase only. Do not reuse these credentials anywhere else.
--
-- Test internal PINs after `supabase db reset`:
-- Owner login: 111111
-- Admin login: 222222
-- Store login (SID-CEN / Siddipet): 333333
-- Store login (HYD-BAN / Hyderabad): 444444
-- Store login (WRG-HNM / Warangal): 555555
--
-- Test employee PINs for Siddipet shift control:
-- Priya Manager: 777777
-- Kiran Counter: 888888
-- Sandeep Kitchen: 999999
--
-- Easiest customer checkout tests:
-- Water Bottle
-- Classic Chicken Cup (Small)
-- Banana Chia Yogurt Bowl

begin;

insert into public.stores (
  id,
  code,
  name,
  phone,
  email,
  address_line_1,
  city,
  state,
  postal_code,
  country,
  is_active,
  created_at,
  updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', 'SID-CEN', 'CULTIV Siddipet', '+91 90000 10001', 'siddipet.local@cultiv.test', 'Market Road, Central Block', 'Siddipet', 'Telangana', '502103', 'India', true, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'HYD-BAN', 'CULTIV Hyderabad', '+91 90000 10002', 'hyderabad.local@cultiv.test', 'Banjara Hills Main Road', 'Hyderabad', 'Telangana', '500034', 'India', true, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'WRG-HNM', 'CULTIV Warangal', '+91 90000 10003', 'warangal.local@cultiv.test', 'Hanamkonda Junction', 'Warangal', 'Telangana', '506001', 'India', true, now(), now())
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  phone = excluded.phone,
  email = excluded.email,
  address_line_1 = excluded.address_line_1,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  country = excluded.country,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.roles (
  role_key,
  role_name,
  scope_type,
  is_active,
  created_at,
  updated_at
)
values
  ('owner', 'Owner', 'global', true, now(), now()),
  ('admin', 'Admin', 'global', true, now(), now()),
  ('store', 'Store', 'store', true, now(), now())
on conflict (role_key) do update
set
  role_name = excluded.role_name,
  scope_type = excluded.scope_type,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.permissions (
  permission_key,
  permission_name,
  description,
  created_at
)
values
  ('can_manage_stores', 'Manage Stores', 'Create, edit, and archive stores.', now()),
  ('can_manage_employees', 'Manage Employees', 'Create employees and manage their status.', now()),
  ('can_manage_menu', 'Manage Menu', 'Manage menu items and option groups.', now()),
  ('can_view_reports', 'View Reports', 'Access revenue and operations reporting.', now()),
  ('can_access_orders', 'Access Orders', 'View and update internal order board.', now()),
  ('can_access_pos', 'Access POS', 'Create in-store POS orders and manual payments.', now()),
  ('can_access_inventory', 'Access Inventory', 'View and adjust store inventory.', now()),
  ('can_switch_stores', 'Switch Stores', 'Change active store scope in admin UI.', now()),
  ('can_view_all_stores', 'View All Stores', 'See data across all stores.', now())
on conflict (permission_key) do update
set
  permission_name = excluded.permission_name,
  description = excluded.description;

with desired_permissions(role_key, permission_key) as (
  values
    ('owner', 'can_manage_stores'),
    ('owner', 'can_manage_employees'),
    ('owner', 'can_manage_menu'),
    ('owner', 'can_view_reports'),
    ('owner', 'can_access_orders'),
    ('owner', 'can_access_pos'),
    ('owner', 'can_access_inventory'),
    ('owner', 'can_switch_stores'),
    ('owner', 'can_view_all_stores'),
    ('admin', 'can_manage_stores'),
    ('admin', 'can_manage_employees'),
    ('admin', 'can_manage_menu'),
    ('admin', 'can_view_reports'),
    ('admin', 'can_access_orders'),
    ('admin', 'can_access_pos'),
    ('admin', 'can_access_inventory'),
    ('admin', 'can_switch_stores'),
    ('admin', 'can_view_all_stores'),
    ('store', 'can_manage_employees'),
    ('store', 'can_access_orders'),
    ('store', 'can_access_pos'),
    ('store', 'can_access_inventory')
)
insert into public.role_permissions (
  role_id,
  permission_id,
  is_allowed,
  granted_at
)
select
  roles.id,
  permissions.id,
  true,
  now()
from desired_permissions
join public.roles on roles.role_key = desired_permissions.role_key
join public.permissions on permissions.permission_key = desired_permissions.permission_key
on conflict (role_id, permission_id) do update
set
  is_allowed = excluded.is_allowed,
  granted_at = now();

insert into public.internal_users (
  id,
  role_id,
  full_name,
  pin_hash,
  store_id,
  is_active,
  created_at,
  updated_at
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    (select id from public.roles where role_key = 'owner'),
    'Local Owner',
    '$2b$10$UFL1XQl.hnNLTSgst/W0Tu3fqXqRTQJ3s9FC7IbC/Wdcrm4txP98i',
    null,
    true,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    (select id from public.roles where role_key = 'admin'),
    'Local Admin',
    '$2b$10$ZxdGmSukGmus3FeXUuAhgOfEFigp3MH6ilesTEKupODyu8UyHjkt2',
    null,
    true,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444443',
    (select id from public.roles where role_key = 'store'),
    'Siddipet Store Lead',
    '$2b$10$QGQvc0iYMkjYrec0p8LEOO/rvQL0BAXMGiAZmwIbWrG2f4808Onla',
    '11111111-1111-4111-8111-111111111111',
    true,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    (select id from public.roles where role_key = 'store'),
    'Hyderabad Store Lead',
    '$2b$10$.9JpBCsgM9BvXnik3mJmieaVDOqZZgkvJekFWckoSGJ8TndOyOGkK',
    '22222222-2222-4222-8222-222222222222',
    true,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444445',
    (select id from public.roles where role_key = 'store'),
    'Warangal Store Lead',
    '$2b$10$lICGFm8dCUMNUUzzFjhNY.r2QSGuEYxHEU3hH4OTQ.SXAVQe.rInK',
    '33333333-3333-4333-8333-333333333333',
    true,
    now(),
    now()
  )
on conflict (id) do update
set
  role_id = excluded.role_id,
  full_name = excluded.full_name,
  pin_hash = excluded.pin_hash,
  store_id = excluded.store_id,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.employees (
  id,
  employee_code,
  full_name,
  employee_role,
  store_id,
  pin_hash,
  phone,
  shift_status,
  is_active,
  is_deleted,
  deleted_at,
  created_at,
  updated_at
)
values
  (
    '55555555-5555-4555-8555-555555555551',
    'EMP-SID-001',
    'Priya Manager',
    'manager',
    '11111111-1111-4111-8111-111111111111',
    '$2b$10$ojl5HRCxbzRT092NTsOWleJX/ChzVBTfm0aFLbPKhTQ164vnmEKvK',
    '9000011101',
    'on_shift',
    true,
    false,
    null,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    'EMP-SID-002',
    'Kiran Counter',
    'counter',
    '11111111-1111-4111-8111-111111111111',
    '$2b$10$IJjZbuvgXGGY.ofv3s/.debfzv4M2355xR2dkGvV6FAmWqNtblb6q',
    '9000011102',
    'off_shift',
    true,
    false,
    null,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    'EMP-SID-003',
    'Sandeep Kitchen',
    'kitchen',
    '11111111-1111-4111-8111-111111111111',
    '$2b$10$7XqiQUsJrlgsGzOx78HAm.wIlLLYTC1oI/kP6K1W5Jx2M4xii2j.G',
    '9000011103',
    'off_shift',
    true,
    false,
    null,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555554',
    'EMP-HYD-001',
    'Neha Counter',
    'counter',
    '22222222-2222-4222-8222-222222222222',
    '$2b$10$BkhHYMQzAdh8qODh.c6r7.urqUrg9Kusn6A5URjgKp4Vd3D6SM8Qe',
    '9000011104',
    'off_shift',
    true,
    false,
    null,
    now(),
    now()
  )
on conflict (id) do update
set
  employee_code = excluded.employee_code,
  full_name = excluded.full_name,
  employee_role = excluded.employee_role,
  store_id = excluded.store_id,
  pin_hash = excluded.pin_hash,
  phone = excluded.phone,
  shift_status = excluded.shift_status,
  is_active = excluded.is_active,
  is_deleted = excluded.is_deleted,
  deleted_at = excluded.deleted_at,
  updated_at = now();

insert into public.employee_shifts (
  shift_id,
  employee_id,
  store_id,
  shift_date,
  clock_in_at,
  clock_out_at,
  total_hours,
  created_at,
  updated_at
)
values
  (
    '66666666-6666-4666-8666-666666666661',
    '55555555-5555-4555-8555-555555555551',
    '11111111-1111-4111-8111-111111111111',
    current_date,
    date_trunc('hour', now()) - interval '3 hours',
    null,
    0,
    now(),
    now()
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    '55555555-5555-4555-8555-555555555552',
    '11111111-1111-4111-8111-111111111111',
    current_date - 1,
    date_trunc('hour', now()) - interval '1 day' - interval '8 hours',
    date_trunc('hour', now()) - interval '1 day' - interval '1 hour',
    7.00,
    now(),
    now()
  )
on conflict (shift_id) do update
set
  employee_id = excluded.employee_id,
  store_id = excluded.store_id,
  shift_date = excluded.shift_date,
  clock_in_at = excluded.clock_in_at,
  clock_out_at = excluded.clock_out_at,
  total_hours = excluded.total_hours,
  updated_at = now();

insert into public.option_groups (
  group_id,
  name,
  selection_type,
  is_required,
  min_select,
  max_select,
  sort_order
)
values
  ('base', 'Base', 'multiple', false, 0, 2, 10),
  ('protein', 'Protein', 'multiple', false, 0, 4, 20),
  ('toppings', 'Toppings', 'multiple', false, 0, 10, 30),
  ('sauce', 'Sauce', 'multiple', false, 0, 10, 40),
  ('extras', 'Extras', 'multiple', false, 0, 10, 50),
  ('fruits', 'Fruits', 'multiple', false, 0, 10, 60),
  ('crunch', 'Crunch', 'single', false, 0, 1, 70),
  ('add-ons', 'Add-ons', 'multiple', false, 0, 10, 80)
on conflict (group_id) do update
set
  name = excluded.name,
  selection_type = excluded.selection_type,
  is_required = excluded.is_required,
  min_select = excluded.min_select,
  max_select = excluded.max_select,
  sort_order = excluded.sort_order;

insert into public.option_items (
  option_item_id,
  group_id,
  name,
  price_modifier,
  is_available,
  sort_order
)
values
  ('light-rice', 'base', 'Light Rice', 0, true, 10),
  ('power-rice', 'base', 'Power Rice', 0, true, 20),
  ('rajma', 'protein', 'Rajma', 0, true, 10),
  ('channa', 'protein', 'Channa', 0, true, 20),
  ('classic-chicken', 'protein', 'Classic Chicken', 0, true, 30),
  ('spicy-chicken', 'protein', 'Spicy Chicken', 0, true, 40),
  ('onion', 'toppings', 'Onion', 0, true, 10),
  ('cucumber', 'toppings', 'Cucumber', 0, true, 20),
  ('lettuce', 'toppings', 'Lettuce', 0, true, 30),
  ('sauteed-veggies', 'toppings', 'Sautéed Veggies', 0, true, 40),
  ('shredded-green-cabbage', 'toppings', 'Shredded Green Cabbage', 0, true, 50),
  ('shredded-red-cabbage', 'toppings', 'Shredded Red Cabbage', 0, true, 60),
  ('shredded-carrot', 'toppings', 'Shredded Carrot', 0, true, 70),
  ('fresh-salsa', 'sauce', 'Fresh Salsa', 0, true, 10),
  ('roasted-chilli-corn-salsa', 'sauce', 'Roasted Chilli Corn Salsa', 0, true, 20),
  ('tomato-green-chilli-salsa', 'sauce', 'Tomato Green Chilli Salsa', 0, true, 30),
  ('tomato-red-chilli-salsa', 'sauce', 'Tomato Red Chilli Salsa', 0, true, 40),
  ('extra-chicken', 'extras', 'Extra Chicken', 40, true, 10),
  ('extra-rajma', 'extras', 'Extra Rajma', 20, true, 20),
  ('extra-channa', 'extras', 'Extra Channa', 20, true, 30),
  ('scrambled-egg', 'extras', 'Scrambled Egg', 20, true, 40),
  ('guacamole', 'extras', 'Guacamole', 40, true, 50),
  ('cheese', 'extras', 'Cheese', 15, true, 60),
  ('banana', 'fruits', 'Banana', 0, true, 10),
  ('apple', 'fruits', 'Apple', 0, true, 20),
  ('mango', 'fruits', 'Mango (Seasonal)', 0, true, 30),
  ('mixed-berries', 'fruits', 'Mixed Berries', 0, true, 40),
  ('granola', 'crunch', 'Granola', 0, true, 10),
  ('honey', 'add-ons', 'Honey', 20, true, 10),
  ('extra-fruit', 'add-ons', 'Extra Fruit', 30, true, 20),
  ('extra-granola', 'add-ons', 'Extra Granola', 20, true, 30)
on conflict (option_item_id) do update
set
  group_id = excluded.group_id,
  name = excluded.name,
  price_modifier = excluded.price_modifier,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;

insert into public.menu_items (
  menu_item_id,
  category_slug,
  subcategory_slug,
  name,
  description,
  base_price,
  is_available,
  sort_order,
  image_url,
  calories,
  protein_grams,
  badge,
  created_at,
  updated_at
)
values
  ('table-veg', 'build-your-own-bowl', 'table-bowls', 'Veg Table Bowl', 'Legacy local alias for the veg table bowl.', 599, true, 11, null, 1600, 70, null, now(), now()),
  ('table-chicken', 'build-your-own-bowl', 'table-bowls', 'Chicken Table Bowl', 'Legacy local alias for the chicken table bowl.', 699, true, 21, null, 2100, 115, null, now(), now()),
  ('table-both', 'build-your-own-bowl', 'table-bowls', 'Power Table Bowl', 'Legacy local alias for the power table bowl.', 799, true, 31, null, 2400, 140, 'Power Pick', now(), now()),
  ('table-power', 'build-your-own-bowl', 'table-bowls', 'Power Table Bowl', 'Legacy local alias for the power table bowl.', 799, true, 32, null, 2400, 140, 'Power Pick', now(), now()),
  ('veg-table-bowl', 'build-your-own-bowl', 'table-bowls', 'Veg Table Bowl', 'Shareable plant-forward table bowl for 4-5 people.', 599, true, 10, null, 1600, 70, null, now(), now()),
  ('chicken-table-bowl', 'build-your-own-bowl', 'table-bowls', 'Chicken Table Bowl', 'Shareable chicken-led table bowl for 4-5 people.', 699, true, 20, null, 2100, 115, null, now(), now()),
  ('power-table-bowl', 'build-your-own-bowl', 'table-bowls', 'Power Table Bowl', 'All-protein table bowl for 4-5 people.', 799, true, 30, null, 2400, 140, 'Power Pick', now(), now()),

  ('banana-chia-yogurt-bowl', 'breakfast-bowls', 'chia-yogurt', 'Banana Chia Yogurt Bowl', 'Yogurt + chia + banana + honey + granola.', 119, true, 110, null, 250, 10, null, now(), now()),
  ('apple-chia-yogurt-bowl', 'breakfast-bowls', 'chia-yogurt', 'Apple Chia Yogurt Bowl', 'Yogurt + chia + apple + honey + granola.', 119, true, 120, null, 250, 10, null, now(), now()),
  ('mango-chia-yogurt-bowl', 'breakfast-bowls', 'chia-yogurt', 'Mango Chia Yogurt Bowl', 'Yogurt + chia + mango + honey + granola.', 129, true, 130, null, 260, 10, 'Seasonal', now(), now()),
  ('berry-chia-yogurt-bowl', 'breakfast-bowls', 'chia-yogurt', 'Berry Chia Yogurt Bowl', 'Yogurt + chia + mixed berries + honey + granola.', 139, true, 140, null, 280, 11, null, now(), now()),
  ('power-chia-yogurt-bowl', 'breakfast-bowls', 'chia-yogurt', 'Power Chia Yogurt Bowl', 'Yogurt + chia + all available fruits + honey + granola.', 159, true, 150, null, 330, 13, 'Power Pick', now(), now()),
  ('banana-overnight-oats', 'breakfast-bowls', 'overnight-oats', 'Banana Overnight Oats', 'Oats + milk + chia + banana + honey.', 109, true, 160, null, 240, 9, null, now(), now()),
  ('apple-cinnamon-overnight-oats', 'breakfast-bowls', 'overnight-oats', 'Apple Cinnamon Overnight Oats', 'Oats + milk + chia + apple + cinnamon + honey.', 119, true, 170, null, 260, 9, null, now(), now()),
  ('mango-overnight-oats', 'breakfast-bowls', 'overnight-oats', 'Mango Overnight Oats', 'Oats + milk + chia + mango + honey.', 129, true, 180, null, 270, 9, 'Seasonal', now(), now()),
  ('berry-overnight-oats', 'breakfast-bowls', 'overnight-oats', 'Berry Overnight Oats', 'Oats + milk + chia + mixed berries + honey.', 139, true, 190, null, 280, 10, null, now(), now()),
  ('power-overnight-oats', 'breakfast-bowls', 'overnight-oats', 'Power Overnight Oats', 'Oats + milk + chia + all available fruits + honey.', 159, true, 200, null, 330, 13, 'Power Pick', now(), now()),

  ('everyday-veg-bowl', 'signature-bowls', 'everyday', 'Everyday Veg Bowl', 'Light rice, veg protein, onion, cucumber, and fresh salsa.', 169, true, 210, null, 410, 18, 'Best Seller', now(), now()),
  ('everyday-chicken-bowl', 'signature-bowls', 'everyday', 'Everyday Chicken Bowl', 'Light rice, classic chicken, onion, cucumber, and fresh salsa.', 189, true, 220, null, 460, 30, null, now(), now()),
  ('everyday-power-bowl', 'signature-bowls', 'everyday', 'Everyday Power Bowl', 'Light rice, mixed proteins, lettuce, and green chilli salsa.', 199, true, 230, null, 510, 34, 'Power Pick', now(), now()),

  ('classic-chicken-cup-small', 'high-protein-cups', 'small-cups', 'Classic Chicken Cup (Small)', 'Lightly seasoned classic chicken.', 40, true, 310, null, 80, 14, null, now(), now()),
  ('classic-chicken-cup-large', 'high-protein-cups', 'large-cups', 'Classic Chicken Cup (Large)', 'A larger portion of classic chicken.', 70, true, 320, null, 160, 28, 'Large', now(), now()),
  ('spicy-chicken-cup-small', 'high-protein-cups', 'small-cups', 'Spicy Chicken Cup (Small)', 'Spiced chicken with a gentle kick.', 40, true, 330, null, 85, 14, null, now(), now()),
  ('spicy-chicken-cup-large', 'high-protein-cups', 'large-cups', 'Spicy Chicken Cup (Large)', 'A larger portion of spicy chicken.', 70, true, 340, null, 170, 28, 'Large', now(), now()),
  ('rajma-cup-small', 'high-protein-cups', 'small-cups', 'Rajma Cup (Small)', 'Slow-cooked kidney beans.', 30, true, 350, null, 70, 5, null, now(), now()),
  ('rajma-cup-large', 'high-protein-cups', 'large-cups', 'Rajma Cup (Large)', 'A larger serving of rajma.', 55, true, 360, null, 140, 10, 'Large', now(), now()),
  ('channa-cup-small', 'high-protein-cups', 'small-cups', 'Channa Cup (Small)', 'Warm spiced chickpeas.', 30, true, 370, null, 65, 5, null, now(), now()),
  ('channa-cup-large', 'high-protein-cups', 'large-cups', 'Channa Cup (Large)', 'A larger cup of channa.', 55, true, 380, null, 130, 10, 'Large', now(), now()),
  ('egg-protein-cup', 'high-protein-cups', 'specialty-cups', 'Egg Protein Cup', 'Two scrambled eggs, soft and protein-packed.', 35, true, 390, null, 140, 12, null, now(), now()),
  ('mixed-protein-cup', 'high-protein-cups', 'specialty-cups', 'Mixed Protein Cup', 'Chicken, rajma, and channa together.', 75, true, 400, null, 180, 20, 'Best Mix', now(), now()),

  ('veg-salad-bowl', 'salad-bowls', 'salad', 'Veg Salad Bowl', 'Greens, veg proteins, crunchy toppings, and fresh salsa.', 169, true, 410, null, 310, 16, 'Fresh', now(), now()),
  ('chicken-salad-bowl', 'salad-bowls', 'salad', 'Chicken Salad Bowl', 'Greens, chicken proteins, fresh toppings, and salsa.', 189, true, 420, null, 360, 28, null, now(), now()),
  ('power-salad-bowl', 'salad-bowls', 'salad', 'Power Salad Bowl', 'Greens with both veg and chicken proteins.', 199, true, 430, null, 410, 34, 'Power Pick', now(), now()),

  ('soft-rice-chicken', 'kids-meal', 'kids', 'Soft Rice & Chicken', 'Soft white rice with mild grilled chicken.', 139, true, 510, null, 270, 18, 'Popular', now(), now()),
  ('egg-rice-kids', 'kids-meal', 'kids', 'Egg Rice Bowl', 'Soft white rice with scrambled egg and sweet corn.', 129, true, 520, null, 240, 14, null, now(), now()),
  ('veggie-soft-bowl', 'kids-meal', 'kids', 'Veggie Soft Bowl', 'Veggie base with a soft, lighter build.', 119, true, 530, null, 200, 10, 'Veggie', now(), now()),

  ('lemon-mint-soda', 'drinks-juices', 'dispenser', 'Lemon Mint Soda', 'Lemon + mint + soda.', 69, true, 610, null, 110, 0, null, now(), now()),
  ('orange-spark', 'drinks-juices', 'dispenser', 'Orange Spark', 'Sweet orange soda.', 69, true, 620, null, 120, 0, null, now(), now()),
  ('ginger-lemon-fizz', 'drinks-juices', 'dispenser', 'Ginger Lemon Fizz', 'Ginger + lemon + soda.', 69, true, 630, null, 95, 0, null, now(), now()),
  ('fresh-lemon-cooler', 'drinks-juices', 'fresh', 'Fresh Lemon Cooler', 'Fresh lemon + chilled water.', 29, true, 640, null, 35, 0, null, now(), now()),
  ('classic-buttermilk', 'drinks-juices', 'fresh', 'Classic Buttermilk', 'Spiced yogurt drink.', 39, true, 650, null, 65, 3, null, now(), now()),
  ('watermelon-fresh', 'drinks-juices', 'fresh', 'Watermelon Fresh', 'Fresh watermelon juice.', 49, true, 660, null, 55, 1, null, now(), now()),
  ('cucumber-mint-cooler', 'drinks-juices', 'fresh', 'Cucumber Mint Cooler', 'Cucumber + mint cooler.', 49, true, 670, null, 40, 0, null, now(), now()),
  ('water-bottle', 'drinks-juices', 'packaged', 'Water Bottle', 'Still packaged drinking water.', 20, true, 680, null, 0, 0, null, now(), now()),
  ('flavoured-water', 'drinks-juices', 'packaged', 'Flavoured Water', 'Lightly flavoured packaged water.', 40, true, 690, null, 20, 0, null, now(), now()),
  ('coke-zero', 'drinks-juices', 'packaged', 'Coke Zero', 'Zero-sugar carbonated drink.', 60, true, 700, null, 1, 0, null, now(), now())
on conflict (menu_item_id) do update
set
  category_slug = excluded.category_slug,
  subcategory_slug = excluded.subcategory_slug,
  name = excluded.name,
  description = excluded.description,
  base_price = excluded.base_price,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order,
  image_url = excluded.image_url,
  calories = excluded.calories,
  protein_grams = excluded.protein_grams,
  badge = excluded.badge,
  updated_at = now();

insert into public.item_option_group_map (
  menu_item_id,
  group_id,
  sort_order
)
values
  ('table-veg', 'base', 10),
  ('table-veg', 'protein', 20),
  ('table-veg', 'toppings', 30),
  ('table-veg', 'sauce', 40),
  ('table-veg', 'extras', 50),
  ('table-chicken', 'base', 10),
  ('table-chicken', 'protein', 20),
  ('table-chicken', 'toppings', 30),
  ('table-chicken', 'sauce', 40),
  ('table-chicken', 'extras', 50),
  ('table-both', 'base', 10),
  ('table-both', 'protein', 20),
  ('table-both', 'toppings', 30),
  ('table-both', 'sauce', 40),
  ('table-both', 'extras', 50),
  ('table-power', 'base', 10),
  ('table-power', 'protein', 20),
  ('table-power', 'toppings', 30),
  ('table-power', 'sauce', 40),
  ('table-power', 'extras', 50),
  ('veg-table-bowl', 'base', 10),
  ('veg-table-bowl', 'protein', 20),
  ('veg-table-bowl', 'toppings', 30),
  ('veg-table-bowl', 'sauce', 40),
  ('veg-table-bowl', 'extras', 50),
  ('chicken-table-bowl', 'base', 10),
  ('chicken-table-bowl', 'protein', 20),
  ('chicken-table-bowl', 'toppings', 30),
  ('chicken-table-bowl', 'sauce', 40),
  ('chicken-table-bowl', 'extras', 50),
  ('power-table-bowl', 'base', 10),
  ('power-table-bowl', 'protein', 20),
  ('power-table-bowl', 'toppings', 30),
  ('power-table-bowl', 'sauce', 40),
  ('power-table-bowl', 'extras', 50),

  ('everyday-veg-bowl', 'base', 10),
  ('everyday-veg-bowl', 'protein', 20),
  ('everyday-veg-bowl', 'toppings', 30),
  ('everyday-veg-bowl', 'sauce', 40),
  ('everyday-veg-bowl', 'extras', 50),
  ('everyday-chicken-bowl', 'base', 10),
  ('everyday-chicken-bowl', 'protein', 20),
  ('everyday-chicken-bowl', 'toppings', 30),
  ('everyday-chicken-bowl', 'sauce', 40),
  ('everyday-chicken-bowl', 'extras', 50),
  ('everyday-power-bowl', 'base', 10),
  ('everyday-power-bowl', 'protein', 20),
  ('everyday-power-bowl', 'toppings', 30),
  ('everyday-power-bowl', 'sauce', 40),
  ('everyday-power-bowl', 'extras', 50),

  ('veg-salad-bowl', 'protein', 20),
  ('veg-salad-bowl', 'toppings', 30),
  ('veg-salad-bowl', 'sauce', 40),
  ('veg-salad-bowl', 'extras', 50),
  ('chicken-salad-bowl', 'protein', 20),
  ('chicken-salad-bowl', 'toppings', 30),
  ('chicken-salad-bowl', 'sauce', 40),
  ('chicken-salad-bowl', 'extras', 50),
  ('power-salad-bowl', 'protein', 20),
  ('power-salad-bowl', 'toppings', 30),
  ('power-salad-bowl', 'sauce', 40),
  ('power-salad-bowl', 'extras', 50),

  ('soft-rice-chicken', 'base', 10),
  ('soft-rice-chicken', 'protein', 20),
  ('soft-rice-chicken', 'toppings', 30),
  ('soft-rice-chicken', 'sauce', 40),
  ('egg-rice-kids', 'base', 10),
  ('egg-rice-kids', 'protein', 20),
  ('egg-rice-kids', 'toppings', 30),
  ('veggie-soft-bowl', 'base', 10),
  ('veggie-soft-bowl', 'protein', 20),
  ('veggie-soft-bowl', 'toppings', 30),

  ('banana-chia-yogurt-bowl', 'fruits', 10),
  ('banana-chia-yogurt-bowl', 'crunch', 20),
  ('banana-chia-yogurt-bowl', 'add-ons', 30),
  ('apple-chia-yogurt-bowl', 'fruits', 10),
  ('apple-chia-yogurt-bowl', 'crunch', 20),
  ('apple-chia-yogurt-bowl', 'add-ons', 30),
  ('mango-chia-yogurt-bowl', 'fruits', 10),
  ('mango-chia-yogurt-bowl', 'crunch', 20),
  ('mango-chia-yogurt-bowl', 'add-ons', 30),
  ('berry-chia-yogurt-bowl', 'fruits', 10),
  ('berry-chia-yogurt-bowl', 'crunch', 20),
  ('berry-chia-yogurt-bowl', 'add-ons', 30),
  ('power-chia-yogurt-bowl', 'fruits', 10),
  ('power-chia-yogurt-bowl', 'crunch', 20),
  ('power-chia-yogurt-bowl', 'add-ons', 30),
  ('banana-overnight-oats', 'fruits', 10),
  ('banana-overnight-oats', 'crunch', 20),
  ('banana-overnight-oats', 'add-ons', 30),
  ('apple-cinnamon-overnight-oats', 'fruits', 10),
  ('apple-cinnamon-overnight-oats', 'crunch', 20),
  ('apple-cinnamon-overnight-oats', 'add-ons', 30),
  ('mango-overnight-oats', 'fruits', 10),
  ('mango-overnight-oats', 'crunch', 20),
  ('mango-overnight-oats', 'add-ons', 30),
  ('berry-overnight-oats', 'fruits', 10),
  ('berry-overnight-oats', 'crunch', 20),
  ('berry-overnight-oats', 'add-ons', 30),
  ('power-overnight-oats', 'fruits', 10),
  ('power-overnight-oats', 'crunch', 20),
  ('power-overnight-oats', 'add-ons', 30)
on conflict (menu_item_id, group_id) do update
set
  sort_order = excluded.sort_order;

-- Re-assert a small useful inventory catalog in case earlier migration data was skipped.
insert into public.inventory_items (
  sku,
  name,
  category,
  unit,
  default_threshold,
  is_active,
  sort_order,
  created_at,
  updated_at
)
values
  ('white_basmati_rice', 'White Basmati Rice', 'rice', 'kg', 5, true, 10, now(), now()),
  ('brown_rice', 'Brown Rice', 'rice', 'kg', 3, true, 20, now(), now()),
  ('classic_chicken', 'Classic Chicken', 'proteins', 'kg', 3, true, 30, now(), now()),
  ('spicy_chicken', 'Spicy Chicken', 'proteins', 'kg', 3, true, 40, now(), now()),
  ('rajma', 'Rajma', 'proteins', 'kg', 2, true, 50, now(), now()),
  ('channa', 'Channa', 'proteins', 'kg', 2, true, 60, now(), now()),
  ('eggs', 'Eggs', 'proteins', 'trays', 2, true, 70, now(), now()),
  ('cheese', 'Cheese', 'proteins', 'bags', 2, true, 80, now(), now()),
  ('onion', 'Onion', 'veggies', 'bags', 2, true, 90, now(), now()),
  ('cucumber', 'Cucumber', 'veggies', 'bags', 2, true, 100, now(), now()),
  ('lettuce', 'Lettuce', 'veggies', 'bags', 2, true, 110, now(), now()),
  ('water_bottles', 'Water Bottles', 'drinks', 'cases', 2, true, 120, now(), now()),
  ('regular_bowl', 'Regular Bowl', 'packaging', 'pcs', 50, true, 130, now(), now()),
  ('paper_bag', 'Paper Bag', 'packaging', 'pcs', 50, true, 140, now(), now()),
  ('tissue_pack', 'Tissue Pack', 'packaging', 'packs', 20, true, 150, now(), now())
on conflict (sku) do update
set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  default_threshold = excluded.default_threshold,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

select public.ensure_store_inventory('11111111-1111-4111-8111-111111111111');
select public.ensure_store_inventory('22222222-2222-4222-8222-222222222222');
select public.ensure_store_inventory('33333333-3333-4333-8333-333333333333');

commit;
