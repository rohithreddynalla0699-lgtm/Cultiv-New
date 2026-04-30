-- Fixed-fruit breakfast bowls already include their fruit in the product model.
-- They should not participate in the selectable "fruits" option group.
-- Keep the fruits group mapped only for selectable/power breakfast bowls.

delete from public.item_option_group_map
where group_id = 'fruits'
  and menu_item_id in (
    'banana-chia-yogurt-bowl',
    'apple-chia-yogurt-bowl',
    'mango-chia-yogurt-bowl',
    'berry-chia-yogurt-bowl',
    'banana-overnight-oats',
    'apple-cinnamon-overnight-oats',
    'mango-overnight-oats',
    'berry-overnight-oats'
  );
