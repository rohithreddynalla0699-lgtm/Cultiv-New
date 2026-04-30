# Rewards Phase 2 Checkout QA

This checklist verifies checkout reward validation and entitlement consumption only.

Out of scope:
- admin rewards UI
- POS reward application
- public checkout enablement changes

## 1. Preconditions

- Apply the Phase 1 rewards migration and the Phase 2 checkout migration.
- Ensure `PAYMENT_PROVIDER=mock` and `APP_ENV=local` for local testing.
- Use a real customer account with:
  - enough points to redeem at least one reward
  - an available entitlement created through the rewards page

## 2. Verify available entitlement before checkout

```sql
select
  e.id,
  e.status,
  e.redeemed_at,
  e.used_at,
  e.order_id,
  r.reward_code,
  r.title
from public.customer_reward_entitlements e
join public.reward_catalog r
  on r.id = e.reward_id
where e.customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by e.redeemed_at desc;
```

Expected:
- the test entitlement exists
- `status = 'available'`
- `used_at is null`
- `order_id is null`

## 3. Checkout page shows reward normally

UI steps:
- log in as the customer
- add enough food items to meet the minimum subtotal rule
- open checkout
- select one available reward

Expected:
- checkout UI looks the same as before
- reward can still be selected normally
- total updates live as before

## 4. Payment intent stores canonical selected reward payload

Start checkout with the reward selected and let the mock payment launch begin.

```sql
select
  payment_id,
  status,
  amount,
  metadata,
  order_payload
from public.customer_payments
where customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by created_at desc
limit 3;
```

Expected in newest row:
- `status = 'initiated'` before confirmation finishes
- `metadata.selected_reward_entitlements` contains the selected entitlement id and reward code
- `order_payload.selected_reward_entitlements` contains the same canonical reward payload
- `discount_amount` in `order_payload` matches backend-calculated reward discount, not merely the client request

## 5. Successful payment consumes entitlement exactly once

Complete mock checkout successfully.

UI expected:
- order succeeds normally
- success screen loads
- no checkout regression

DB checks:

```sql
select
  payment_id,
  status,
  order_id,
  confirmed_at,
  paid_at
from public.customer_payments
where customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by created_at desc
limit 3;
```

Expected:
- newest relevant payment row is `succeeded`
- `order_id` is populated

```sql
select
  e.id,
  e.status,
  e.used_at,
  e.order_id,
  r.reward_code
from public.customer_reward_entitlements e
join public.reward_catalog r
  on r.id = e.reward_id
where e.customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by e.redeemed_at desc;
```

Expected:
- selected entitlement is now `used`
- `used_at` is populated
- `order_id` matches finalized order id

## 6. Duplicate finalization does not double-consume

Use the same successful `payment_id` and hit confirm again through your existing local/manual flow if available, or re-run the confirmation request manually.

Expected:
- backend returns the existing successful order
- no second entitlement is consumed
- the same entitlement row remains the only used row for that checkout

Verification:

```sql
select
  id,
  status,
  used_at,
  order_id
from public.customer_reward_entitlements
where customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by redeemed_at desc;
```

Expected:
- no duplicate used rows are created from the same entitlement

## 7. Failed or cancelled payment leaves entitlement available

Repeat with a fresh available entitlement and force mock checkout to fail or cancel.

Expected:
- order is not created
- entitlement remains `available`

Verification:

```sql
select
  payment_id,
  status,
  order_id,
  failure_message
from public.customer_payments
where customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by created_at desc
limit 5;
```

Expected:
- payment row ends as `failed` or `cancelled`
- `order_id` is null

```sql
select
  id,
  status,
  used_at,
  order_id
from public.customer_reward_entitlements
where customer_id = 'REPLACE_WITH_CUSTOMER_UUID'
order by redeemed_at desc;
```

Expected:
- selected entitlement remains `available`
- `used_at` stays null
- `order_id` stays null

## 8. Stale or already-used entitlement is blocked

Try to reuse an entitlement already consumed in step 5.

Expected:
- checkout fails safely
- no second order is finalized from that used entitlement

## 9. Canonical pricing still wins over frontend values

Tamper manually if you are testing with DevTools or request replay:
- wrong reward discount
- wrong free reward title
- wrong free reward value
- wrong extra reward line

Expected:
- backend rejects invalid reward selection or total mismatch
- backend never trusts the client reward title or free item value

## 10. Regression checks

Customer app:
- rewards page still loads
- redeemed entitlements still show correctly before checkout
- order history still loads
- mock checkout still works without rewards

POS:
- counter billing still opens
- POS checkout still works
- no reward application UI appears in POS

Auth:
- customer login/logout still works

## 11. Useful SQL spot checks

Latest checkout payment payload:

```sql
select payment_id, status, metadata, order_payload, items_payload
from public.customer_payments
order by created_at desc
limit 1;
```

Latest order totals:

```sql
select order_id, subtotal_amount, discount_amount, tax_amount, tip_amount, total_amount
from public.orders
order by created_at desc
limit 5;
```

Latest entitlement state:

```sql
select id, customer_id, reward_id, status, redeemed_at, used_at, order_id
from public.customer_reward_entitlements
order by updated_at desc
limit 10;
```
