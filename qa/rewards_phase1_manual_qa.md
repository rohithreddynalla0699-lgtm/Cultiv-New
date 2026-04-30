# Rewards Phase 1 Manual QA

This checklist verifies Phase 1 only:
- backend-authoritative reward catalog
- backend-authoritative loyalty summary
- backend-authoritative reward redemption persistence

Out of scope for this QA:
- checkout reward consumption
- POS reward application
- admin rewards UI

## 1. Apply migrations

Run the new migration in your normal Supabase workflow, then verify the new tables exist:

```sql
select to_regclass('public.reward_catalog') as reward_catalog;
select to_regclass('public.reward_program_settings') as reward_program_settings;
select to_regclass('public.customer_reward_entitlements') as customer_reward_entitlements;
```

Expected:
- all three return non-null table names

## 2. Verify seeded reward catalog

```sql
select
  reward_code,
  title,
  reward_type,
  point_cost,
  discount_amount,
  free_item_title,
  free_item_food_value,
  is_active
from public.reward_catalog
order by sort_order, reward_code;
```

Expected seeded rows:
- `water`
- `drink`
- `30off`
- `50off`
- `100off`
- `kids`
- `family200`

## 3. Verify seeded program settings

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
- `earn_rate_rupees_per_point = 10`
- `points_expiry_days = 90`
- `min_order_subtotal = 99`
- `max_discount_ratio = 0.30`
- `allow_reward_redemption = true`
- `allow_checkout_reward_use = true`

## 4. Prepare a customer with enough points

Pick a real test customer id, then seed one earn batch if needed.

```sql
select id, full_name, phone, reward_points
from public.customers
order by created_at desc
limit 10;
```

If the customer does not have enough points, add a temporary earn batch:

```sql
insert into public.loyalty_points_ledger (
  user_id,
  entry_type,
  points,
  points_remaining,
  earned_at,
  expires_at,
  metadata
)
values (
  'REPLACE_WITH_CUSTOMER_UUID',
  'earn',
  500,
  500,
  now(),
  now() + interval '90 days',
  jsonb_build_object('source', 'phase1_manual_qa')
);

select public.sync_customer_reward_points('REPLACE_WITH_CUSTOMER_UUID');
```

## 5. Login and load rewards page

UI steps:
- log in as the seeded customer
- open `/rewards`

Expected:
- page loads successfully
- available points show correctly
- redeemable rewards list appears
- no visual redesign/regression

Optional DB verification:

```sql
select reward_points
from public.customers
where id = 'REPLACE_WITH_CUSTOMER_UUID';
```

## 6. Redeem a reward with enough points

Use the rewards page to redeem a reward such as `drink` or `50off`.

Expected in UI:
- success message appears
- reward changes to in-account / already-added state
- points total decreases after refresh or immediately after response sync

Expected in DB:

```sql
select
  loyalty_entry_id,
  user_id,
  entry_type,
  points,
  points_remaining,
  metadata,
  created_at
from public.loyalty_points_ledger
where user_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by created_at desc
limit 10;
```

Verify:
- newest redeem row has `entry_type = 'redeem'`
- `points_remaining = 0`
- metadata contains reward code/title

```sql
select
  e.id,
  e.customer_id,
  e.status,
  e.redeemed_at,
  r.reward_code,
  r.title
from public.customer_reward_entitlements e
join public.reward_catalog r
  on r.id = e.reward_id
where e.customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by e.redeemed_at desc;
```

Verify:
- a new row exists
- `status = 'available'`
- reward matches the redeemed item

```sql
select reward_points
from public.customers
where id = 'REPLACE_WITH_CUSTOMER_UUID';
```

Verify:
- `customers.reward_points` now matches the reduced non-expired balance

## 7. Refresh persistence check

UI steps:
- refresh the browser on `/rewards`

Expected:
- redeemed reward still appears as already in account
- points remain reduced

## 8. Logout/login persistence check

UI steps:
- log out
- log back in with the same customer
- return to `/rewards`

Expected:
- redeemed reward still appears in account
- points remain reduced
- profile page still loads normally
- order history still loads normally

## 9. Duplicate redemption protection

UI steps:
- try redeeming the same reward again

Expected:
- duplicate redemption is blocked
- existing entitlement remains the only available row for that reward

DB verification:

```sql
select
  r.reward_code,
  count(*) filter (where e.status = 'available') as available_count
from public.customer_reward_entitlements e
join public.reward_catalog r
  on r.id = e.reward_id
where e.customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
group by r.reward_code
order by r.reward_code;
```

Verify:
- the redeemed reward has `available_count = 1`

## 10. Invalid redemption protection

Turn off redemption temporarily:

```sql
update public.reward_program_settings
set allow_reward_redemption = false,
    updated_at = now();
```

UI steps:
- try redeeming another reward

Expected:
- redemption is blocked with a clear message

Restore setting:

```sql
update public.reward_program_settings
set allow_reward_redemption = true,
    updated_at = now();
```

## 11. Existing flows regression check

Customer app:
- login still works
- profile still works
- order history still works
- checkout page still opens and behaves the same as before

POS:
- internal login still works
- counter billing still opens
- customer lookup still works
- POS checkout still works

Orders:
- existing order board still loads
- status update still works

## 12. Cleanup optional test earn batch

If you inserted a manual QA earn batch, remove only the specific temporary row(s) you added.

Example:

```sql
delete from public.loyalty_points_ledger
where user_id = 'REPLACE_WITH_CUSTOMER_UUID'
  and metadata ->> 'source' = 'phase1_manual_qa';

select public.sync_customer_reward_points('REPLACE_WITH_CUSTOMER_UUID');
```
