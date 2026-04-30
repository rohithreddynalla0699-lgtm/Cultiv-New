# Rewards Phase 3A Admin Management QA

This QA covers only Phase 3A foundation:
- admin rewards catalog management
- admin reward program settings management
- permission enforcement

This phase does **not** cover:
- manual customer point adjustment
- POS reward application
- customer checkout behavior changes

## 1. Apply migration

Run the new migration so the rewards permission is available:

```sql
select permission_key, permission_name
from public.permissions
where permission_key = 'can_manage_rewards';
```

Expected:
- one row exists for `can_manage_rewards`

Verify role grants:

```sql
select
  r.role_key,
  p.permission_key,
  rp.is_allowed
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where p.permission_key = 'can_manage_rewards'
order by r.role_key;
```

Expected:
- `owner` present with `is_allowed = true`
- `admin` present with `is_allowed = true`
- `store` not present

## 2. Owner/admin access

1. Log in to `/operations/access` as owner.
2. Confirm the left navigation shows `Rewards`.
3. Open `/operations/rewards`.

Expected:
- page loads
- reward catalog appears
- reward program settings appear

Repeat as admin.

Expected:
- admin can access if their role has `can_manage_rewards`

## 3. Store access blocked

1. Log in with store access.
2. Try opening `/operations/rewards` directly.

Expected:
- UI redirects away from the page
- store user does not see `Rewards` in nav

Optional API check:

```bash
curl -i "$VITE_SUPABASE_URL/functions/v1/internal-rewards" \
  -H "Content-Type: application/json" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -d '{
    "internalSessionToken": "STORE_SESSION_TOKEN",
    "action": "dashboard"
  }'
```

Expected:
- `403`

## 4. View reward catalog

1. Open `/operations/rewards`.
2. Verify existing rewards from `reward_catalog` are visible.

Verify SQL:

```sql
select reward_code, title, reward_type, point_cost, is_active, sort_order
from public.reward_catalog
order by sort_order asc, created_at asc;
```

Expected:
- admin UI matches DB rows

## 5. Add a new reward

Use the admin UI to create a new reward.

Suggested test reward:
- reward code: `phase3a-test`
- title: `Phase 3A Test Reward`
- type: `discount`
- point cost: `180`
- discount amount: `40`
- badge: `180 pts`
- sort order: `999`
- active: checked

Expected:
- success message appears
- reward shows in catalog list

Verify SQL:

```sql
select reward_code, title, reward_type, point_cost, discount_amount, is_active
from public.reward_catalog
where reward_code = 'phase3a-test';
```

Expected:
- one row exists

## 6. Edit an existing reward

1. Edit `phase3a-test`.
2. Change title to `Phase 3A Test Reward Updated`.
3. Change point cost to `190`.
4. Save.

Verify SQL:

```sql
select reward_code, title, point_cost, updated_at
from public.reward_catalog
where reward_code = 'phase3a-test';
```

Expected:
- updated title
- updated point cost
- `updated_at` changed

## 7. Disable and re-enable reward

1. Use the `Disable` action in the catalog.
2. Confirm status changes to inactive.
3. Use the `Enable` action.

Verify SQL:

```sql
select reward_code, is_active
from public.reward_catalog
where reward_code = 'phase3a-test';
```

Expected:
- `is_active` toggles correctly

## 8. Update reward program settings

From the admin UI, change:
- `earn_rate_rupees_per_point` to `12`
- `points_expiry_days` to `120`
- `min_order_subtotal` to `149`
- `max_discount_ratio` to `0.25`
- toggle `allow_reward_redemption`
- toggle `allow_checkout_reward_use`

Verify SQL:

```sql
select
  earn_rate_rupees_per_point,
  points_expiry_days,
  min_order_subtotal,
  max_discount_ratio,
  allow_reward_redemption,
  allow_checkout_reward_use
from public.reward_program_settings
order by created_at asc
limit 1;
```

Expected:
- values match the admin form save

## 9. Regression checks

After admin rewards changes:

1. Customer login still works.
2. Rewards page still loads.
3. Existing checkout still opens.
4. Existing POS still works.
5. Existing order history still works.
6. Admin stores/menu/orders screens still load.

Expected:
- no regressions outside the new rewards admin screen

## 10. Cleanup test reward

Optional cleanup:

```sql
delete from public.reward_catalog
where reward_code = 'phase3a-test';
```

Only do this if the reward was created just for QA and is not needed.
