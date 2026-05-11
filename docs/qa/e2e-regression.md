# CULTIV E2E Regression Suite

This repo now includes a Playwright-based E2E regression harness under `qa/e2e/`.

It is intentionally small and release-focused:
- grouped by domain instead of one giant flow
- fails on page errors, hook-order/runtime errors, same-origin 500s, and console errors
- ignores only documented non-blocking noise:
  - React DevTools suggestion
  - known CORB warnings from external image assets
- uses env-driven credentials and skips env-dependent coverage cleanly

## Foundation

The suite uses the existing `playwright` package already installed in the repo.

It does **not** currently depend on `@playwright/test`.
That keeps the setup lightweight and aligned with the repo’s existing QA scripts.

Shared files:
- `playwright.config.mjs`
- `qa/e2e/shared/env.mjs`
- `qa/e2e/shared/monitoring.mjs`
- `qa/e2e/shared/helpers.mjs`
- `qa/e2e/shared/runtime.mjs`

## Profiles

Available npm scripts:

```bash
npm run e2e
npm run e2e:customer
npm run e2e:internal
npm run e2e:pos
npm run e2e:smoke
```

Profile intent:
- `e2e`: all registered scenarios
- `e2e:customer`: customer auth, navigation, checkout, order placement, receipts
- `e2e:internal`: owner/admin access plus inventory
- `e2e:pos`: store login, shift, operator unlock, POS
- `e2e:smoke`: smallest release gate that is still useful on local/dev data

## Environment Setup

1. Copy the example file:

```bash
cp .env.e2e.example .env.e2e.local
```

2. Fill in the credentials for your local/staging QA environment.

Core variables:
- `E2E_BASE_URL`
- `E2E_CUSTOMER_EMAIL`
- `E2E_CUSTOMER_PASSWORD`
- `E2E_OWNER_PIN`
- `E2E_ADMIN_PIN`
- `E2E_STORE_PIN`
- `E2E_STORE_NAME`

Additional variables required for fuller store/POS coverage:
- `E2E_STORE_EMPLOYEE_NAME`
- `E2E_STORE_EMPLOYEE_PIN`

Optional mutation/test-data variables:
- `E2E_ENABLE_MUTATION_TESTS=true`
- `E2E_INVENTORY_ITEM_QUERY`
- `E2E_RECEIPT_ORDER_ID`

Optional local signup test path:
- `E2E_SIGNUP_FULL_NAME`
- `E2E_SIGNUP_PHONE`
- `E2E_SIGNUP_EMAIL`
- `E2E_SIGNUP_PASSWORD`
- `E2E_SIGNUP_OTP`

## Starting the App

The suite expects the app to already be running.
It also expects the app environment to be able to hydrate the live menu successfully.
If the app is rendering the `Menu Sync Error / Could not load Supabase menu` screen, customer-facing E2E tests will fail immediately, which is the intended signal.

Recommended local preview flow:

```bash
npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

Then run a profile in another terminal:

```bash
npm run e2e:smoke
```

## Current Coverage

### Customer auth
- fresh logged-out load
- no `customer-get-profile` restore request on a clean session
- login
- refresh after login
- logout
- refresh after logout
- protected route redirect for `/orders` and `/rewards`
- optional signup path if a test OTP/debug path is explicitly configured

### Customer navigation / loading
- Home → Menu
- Menu → Order
- Profile menu → Order History
- Orders → Rewards
- Rewards → Profile
- runtime/hook/console guards during route changes

### Customer checkout
- logged-out checkout CTA
- `My Details` vs `Other Pickup`
- stale pickup contact reset after logout/login
- sign-out warning when cart has items
- empty-cart logout path

### Order placement
- mock/local customer checkout only
- success screen
- order history
- order detail
- receipt visibility on created order

### Internal access
- invalid PIN
- mode-switch PIN reset hygiene
- owner login / logout
- admin login / logout when configured

### Store / POS
- store login
- shift screen
- operator unlock
- end session
- clock-out cleanup
- optional simple cash POS order when mutation testing is enabled

### Inventory
- inventory screen load
- optional manual inventory mutation on a dedicated QA item

### Receipts
- protected receipt/order-detail access while logged out
- optional customer receipt opening when an order is available

## What Is Intentionally Skipped Or Conditional

These flows are **not** claimed as always-covered:

- real Razorpay flows
  - intentionally excluded
  - local/mock checkout only
- webhook / payment recovery
  - backend production gap, not a local E2E target yet
- signup without a real test OTP/debug path
  - skipped unless explicit OTP envs are provided
- inventory mutation without a dedicated safe QA item
  - skipped unless `E2E_ENABLE_MUTATION_TESTS=true` and `E2E_INVENTORY_ITEM_QUERY` is set
- receipt sending through real providers
  - only safe if your local/staging environment is explicitly configured
- full “no auto inventory deduction” proof across every order path
  - manual inventory is the business rule
  - this should be verified with a dedicated mutation-safe QA item and environment before making it part of a hard release gate

## Release-Gate Recommendation

Before a commit/release:

```bash
npm run typecheck
npm run build
npm run e2e:smoke
```

Before a staging/public release candidate:

```bash
npm run e2e:customer
npm run e2e:internal
npm run e2e:pos
```

Only enable mutation scenarios on data you are comfortable changing.
