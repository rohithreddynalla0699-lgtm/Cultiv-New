# Rewards Phase 3B Manual Point Adjustments QA

This QA covers:
- admin customer reward lookup
- admin add/remove reward points
- ledger writes
- customer reward_points cache sync

This phase does **not** cover:
- customer reward redemption logic changes
- checkout reward consumption changes
- POS reward application

## 1. Permissions

Verify owner/admin has rewards access:

```sql
select r.role_key, p.permission_key
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where p.permission_key = 'can_manage_rewards'
order by r.role_key;
```

Expected:
- `owner`
- `admin`

Verify store does not:

```sql
select r.role_key, p.permission_key
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where r.role_key = 'store'
  and p.permission_key = 'can_manage_rewards';
```

Expected:
- no rows

## 2. Owner/Admin screen access

1. Log in as owner or admin.
2. Open `/operations/rewards`.
3. Confirm `Customer Rewards` section is visible.

Expected:
- rewards admin screen loads
- catalog/settings still work
- customer rewards section is visible

## 3. Store access blocked

1. Log in as store.
2. Try opening `/operations/rewards`.

Expected:
- route is blocked or redirected

## 4. Search customer

Use the Customer Rewards section and search by:
- full name
- phone
- email

Expected:
- matching customers appear
- selecting a customer loads:
  - current reward points
  - recent loyalty ledger activity
  - available entitlements
  - used entitlements

## 5. Add points

1. Select a customer.
2. Choose `Add`.
3. Enter `25`.
4. Enter reason: `QA add points`.
5. Submit.

Verify SQL:

```sql
select loyalty_entry_id, entry_type, points, points_remaining, expires_at, metadata
from loyalty_points_ledger
where user_id = '<CUSTOMER_ID>'
order by created_at desc
limit 5;
```

Expected:
- newest row has:
  - `entry_type = 'earn'`
  - `points = 25`
  - `points_remaining = 25`
  - metadata contains:
    - `source = admin_manual_adjustment`
    - `adjustment_direction = add`
    - `reason = QA add points`

Verify cache:

```sql
select id, reward_points
from customers
where id = '<CUSTOMER_ID>';
```

Expected:
- `reward_points` increased by 25

## 6. Remove points

1. Select the same customer.
2. Choose `Remove`.
3. Enter `10`.
4. Enter reason: `QA remove points`.
5. Submit.

Verify SQL:

```sql
select loyalty_entry_id, entry_type, points, points_remaining, metadata
from loyalty_points_ledger
where user_id = '<CUSTOMER_ID>'
order by created_at desc
limit 5;
```

Expected:
- newest audit row has:
  - `entry_type = 'adjustment'`
  - `points = 10`
  - `points_remaining = 0`
  - metadata contains:
    - `source = admin_manual_adjustment`
    - `adjustment_direction = remove`
    - `reason = QA remove points`

Also verify older active earn batches had `points_remaining` reduced FIFO.

Verify cache:

```sql
select id, reward_points
from customers
where id = '<CUSTOMER_ID>';
```

Expected:
- `reward_points` decreased by 10

## 7. Reject missing reason

1. Select a customer.
2. Try add or remove points with blank reason.

Expected:
- UI blocks or backend rejects
- no ledger change

## 8. Reject zero or invalid amount

1. Try amount `0`
2. Try negative or non-integer input

Expected:
- request rejected
- no ledger change

## 9. Reject removing too many points

1. Attempt to remove more points than the customer currently has available.

Expected:
- backend rejects
- no batch points go below zero
- `customers.reward_points` unchanged

## 10. Regression checks

After manual adjustments:

1. Customer rewards page still loads.
2. Customer reward redemption still works.
3. Checkout still opens and uses rewards as before.
4. POS still works unchanged.
5. Rewards catalog/settings admin still works.

Expected:
- no regressions outside customer point adjustment features
