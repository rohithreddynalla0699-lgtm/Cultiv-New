# CULTIV Production Environment Checklist

This document is the deployment and environment reference for CULTIV across local, staging, and production environments.

It covers:

- frontend environment variables
- Supabase function secrets
- payment configuration rules
- OTP and receipt provider setup
- deployment steps
- smoke tests
- common failure modes
- security warnings

## 1. Frontend Environment Variables

Frontend variables are read through Vite and must use the `VITE_` prefix.

### Required for any Supabase-backed app environment

#### `VITE_SUPABASE_URL`

- Required: Yes
- Purpose: Base URL for Supabase client and edge-function calls
- Example:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
```

#### `VITE_SUPABASE_ANON_KEY`

- Required: Yes
- Purpose: Public anon key for frontend Supabase access
- Example:

```env
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

### Required only if customer online checkout is enabled

#### `VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED`

- Required: Only when customer online checkout should be available
- Allowed values: `true`, `false`
- Example:

```env
VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true
```

#### `VITE_PAYMENT_PROVIDER`

- Required: Yes when checkout is enabled
- Allowed values: `razorpay`, `mock`
- Production rule: must be `razorpay`
- Example:

```env
VITE_PAYMENT_PROVIDER=razorpay
```

#### `VITE_MOCK_PAYMENT_OUTCOME`

- Required: Only for local/staging mock checkout testing
- Allowed values: `succeeded`, `failed`, `cancelled`
- Production rule: do not set for production use
- Example:

```env
VITE_MOCK_PAYMENT_OUTCOME=succeeded
```

### Optional local-only sync variable

#### `VITE_SYNC_SERVER_URL`

- Required: No
- Purpose: Optional local cross-device sync server
- Local example:

```env
VITE_SYNC_SERVER_URL=http://localhost:3747
```

### Recommended frontend env examples by mode

#### Local

```env
VITE_SUPABASE_URL=https://your-local-or-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true
VITE_PAYMENT_PROVIDER=mock
VITE_MOCK_PAYMENT_OUTCOME=succeeded
VITE_SYNC_SERVER_URL=http://localhost:3747
```

#### Staging

```env
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true
VITE_PAYMENT_PROVIDER=razorpay
```

#### Production

```env
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true
VITE_PAYMENT_PROVIDER=razorpay
```

## 2. Supabase Function Secrets

Supabase edge functions use server-side environment variables and secrets.

## Core Secrets

These are required for nearly all edge functions.

#### `SUPABASE_URL`

- Required: Yes
- Purpose: Supabase project URL for service-role function access

#### `SUPABASE_SERVICE_ROLE_KEY`

- Required: Yes
- Purpose: server-side privileged database access for functions

#### `CORS_ALLOWED_ORIGINS`

- Required: Yes in staging/production
- Purpose: comma-separated allowlist of frontend origins for sensitive customer/payment/receipt edge functions
- Example:

```env
CORS_ALLOWED_ORIGINS=https://app.cultiv.com,https://staging.cultiv.com
```

- Local behavior:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  are allowed automatically in local/dev for the hardened customer/payment/receipt functions
- Production rule:
  - set exact origins explicitly
  - do not rely on wildcard CORS behavior

## Payment Secrets

Required when customer online checkout is enabled.

#### `PAYMENT_PROVIDER`

- Required: Yes when checkout is enabled
- Allowed values: `razorpay`, `mock`
- Production rule: must be `razorpay`

#### `RAZORPAY_KEY_ID`

- Required: Yes when `PAYMENT_PROVIDER=razorpay`

#### `RAZORPAY_KEY_SECRET`

- Required: Yes when `PAYMENT_PROVIDER=razorpay`

#### `APP_ENV`

- Required: Strongly recommended
- Purpose: environment detection for payment and logging behavior
- Recommended values: `local`, `development`, `staging`, `production`

#### Optional payment debug flag

```env
CHECKOUT_DEBUG_LOGS=false
```

- Production rule: keep disabled unless actively debugging

## OTP / Phone Secrets

Required if customer phone-update OTP flow or customer signup phone verification is enabled.

#### `OTP_HASH_SECRET`

- Required: Yes in production
- Purpose: hashes/verifies OTP payloads securely
- Warning: code currently has a development fallback; do not rely on fallback in production
- Production rule: always set this explicitly

#### `TWILIO_ACCOUNT_SID`

- Required: Yes for Twilio SMS sending

#### `TWILIO_AUTH_TOKEN`

- Required: Yes for Twilio SMS sending

#### `TWILIO_PHONE_NUMBER`

- Required: Yes for phone-update OTP sending

## Receipt System Secrets

Required only if order receipts are sent by email and/or SMS.

### Provider selectors

#### `RECEIPT_EMAIL_PROVIDER`

- Allowed values depend on implementation
- Current supported providers in code:
  - `resend`
  - `sendgrid`

#### `RECEIPT_SMS_PROVIDER`

- Current supported provider in code:
  - `twilio`

#### `RECEIPT_FROM_EMAIL`

- Required for email receipts

### Email provider keys

#### `RESEND_API_KEY`

- Required if `RECEIPT_EMAIL_PROVIDER=resend`

#### `SENDGRID_API_KEY`

- Required if `RECEIPT_EMAIL_PROVIDER=sendgrid`

### SMS receipt keys

#### `TWILIO_ACCOUNT_SID`

- Required if `RECEIPT_SMS_PROVIDER=twilio`

#### `TWILIO_AUTH_TOKEN`

- Required if `RECEIPT_SMS_PROVIDER=twilio`

#### `TWILIO_FROM_PHONE`

- Required for Twilio receipt SMS

### Optional receipt debug flag

```env
RECEIPT_DEBUG_LOGS=false
```

- Production rule: keep disabled unless actively debugging

## Password Reset Debug Secret

#### `PASSWORD_RESET_DEBUG_TOKEN_RESPONSE`

- Required: No
- Purpose: local/debug behavior only
- Production rule: must be disabled or unset

## Production Debug Flag Rules

Keep these disabled in production unless there is a short-lived, deliberate debugging window:

```env
CHECKOUT_DEBUG_LOGS=false
RECEIPT_DEBUG_LOGS=false
PASSWORD_RESET_DEBUG_TOKEN_RESPONSE=false
```

## 3. Environment Modes

## Local

Use local for:

- developer setup
- QA scripts
- mock checkout
- optional local sync server

Typical differences:

- `VITE_PAYMENT_PROVIDER=mock`
- `PAYMENT_PROVIDER=mock`
- `APP_ENV=local`
- debug flags may be temporarily enabled
- local shell may include QA PIN variables

## Staging

Use staging for:

- pre-release validation
- real function deployment checks
- production-like payment and SMS/email testing

Typical differences:

- `VITE_PAYMENT_PROVIDER=razorpay`
- `PAYMENT_PROVIDER=razorpay`
- real Twilio / receipt provider keys
- debug flags should usually be off

## Production

Use production for:

- real customer traffic
- real payment processing
- real OTP/receipt delivery

Production rules:

- never use `mock` payment provider
- never rely on OTP fallback secret
- keep debug flags off by default
- verify all secrets are set in the correct Supabase project

## 4. Payment Configuration Rules

Payment provider configuration must match between frontend and backend.

### Required rule

- frontend `VITE_PAYMENT_PROVIDER` must match backend `PAYMENT_PROVIDER`

Examples:

- valid:
  - frontend `razorpay`
  - backend `razorpay`
- valid for local only:
  - frontend `mock`
  - backend `mock`
- invalid:
  - frontend `razorpay`
  - backend `mock`
- invalid:
  - frontend checkout enabled
  - backend payment provider unset

### Production payment rules

- never use `mock` in production
- set `VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true` only when backend payment env is ready
- if `VITE_PAYMENT_PROVIDER` is missing or invalid, frontend checkout stays disabled even when the checkout-enabled flag is `true`
- verify `RAZORPAY_KEY_ID` is present
- verify `RAZORPAY_KEY_SECRET` is present
- verify payment-intent and payment-confirm flows against the production-like environment before launch

### Razorpay readiness checklist

- frontend `VITE_PAYMENT_PROVIDER=razorpay`
- backend `PAYMENT_PROVIDER=razorpay`
- `RAZORPAY_KEY_ID` set
- `RAZORPAY_KEY_SECRET` set
- checkout enabled on frontend
- payment intent successfully created
- payment confirm/finalize succeeds
- order row created
- payment row created

### Payment reconciliation readiness

- internal Reports should expose customer checkout payment anomalies before launch
- review customer payment attempts for:
  - `initiated` older than 15 minutes
  - `pending_action` older than 15 minutes
  - `failed`
  - `cancelled`
  - `orphaned`
  - `succeeded` without an order link
  - paid orders missing an `order_payments` row
- normal successful mock checkout should not appear in reconciliation anomalies

## 5. OTP / Phone Setup

Phone update flow requires secure OTP configuration.

### Required setup

- set `OTP_HASH_SECRET`
- set `TWILIO_ACCOUNT_SID`
- set `TWILIO_AUTH_TOKEN`
- set `TWILIO_PHONE_NUMBER`

### Important warning

The shared phone-update helper currently has a development fallback for `OTP_HASH_SECRET`.

Production rule:

- never rely on the fallback
- always set a strong `OTP_HASH_SECRET` explicitly

### OTP production checklist

- `OTP_HASH_SECRET` set
- Twilio credentials set
- Twilio sender phone configured
- customer signup verification request succeeds
- customer signup verification confirm succeeds
- pending unverified signup cannot log in before verification
- customer phone update request succeeds
- customer phone update confirm succeeds
- no dev logging or fallback assumptions remain in production

## 6. Receipt System Setup

Receipt delivery is optional but must be fully configured if enabled.

### Email receipts

Supported providers in current code:

- Resend
- SendGrid

Required:

- `RECEIPT_EMAIL_PROVIDER`
- `RECEIPT_FROM_EMAIL`
- `RESEND_API_KEY` or `SENDGRID_API_KEY`

### SMS receipts

Supported provider in current code:

- Twilio

Required:

- `RECEIPT_SMS_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE`

### Receipt checklist

- provider selector set
- matching provider API key set
- sender email or sender phone configured
- receipt retrieval works
- receipt send function works

### Pilot rollout rule

- customer-facing receipt rollout should remain view/print only until digital delivery is separately validated
- internal email/SMS receipt sending is optional and provider-dependent
- do not promise automatic email receipts, SMS receipts, or order-ready notifications yet

## 7. Deployment Checklist

## Frontend Deployment

1. Set frontend env vars
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- checkout vars if needed

2. Install dependencies

```bash
npm ci
```

3. Run verification

```bash
npm run typecheck
npm run build
```

4. Deploy frontend build to hosting target

5. Verify frontend is pointing to the correct Supabase project

## Supabase Deployment

1. Authenticate CLI

```bash
supabase login
```

2. Link to the correct project if needed

3. Apply database migrations

```bash
supabase db push
```

4. Set required function secrets in the target project

5. Deploy edge functions

Examples:

```bash
supabase functions deploy customer-create-payment-intent
supabase functions deploy customer-confirm-payment-and-create-order
supabase functions deploy customer-request-phone-update
supabase functions deploy customer-confirm-phone-update
supabase functions deploy internal-login
supabase functions deploy internal-logout
supabase functions deploy internal-shift-control
supabase functions deploy internal-employees
supabase functions deploy store-operator-session-start
supabase functions deploy store-operator-session-get
supabase functions deploy store-operator-session-touch
supabase functions deploy store-operator-session-end
```

6. Confirm recent migrations are present in the target DB

Important recent examples:

- `20260506140000_add_store_operator_sessions.sql`
- `20260506173000_harden_employee_shifts_and_operator_sessions.sql`

## 8. Staging Release Gate

Before any pilot or public deployment, staging smoke must pass against the actual target environment.

This release gate intentionally uses the existing deterministic local smoke scripts. It does not add a broad browser PR gate.

### Required env vars for the staging gate

- `BASE_URL`
- `ADMIN_OWNER_PIN`
- `STORE_TEST_PIN`
- `STORE_TEST_EMPLOYEE_NAME`
- `STORE_TEST_EMPLOYEE_PIN`
- `CUSTOMER_TEST_EMAIL`
- `CUSTOMER_TEST_PASSWORD`

### Required command

```bash
npm run qa:staging-release-gate
```

### What it runs

The release gate runs these scripts in order and stops on first failure:

1. `qa:protected-routes`
2. `qa:store-operator`
3. `qa:customer-checkout`

### Pass / fail rules

- All three scripts must exit with code `0`
- Any script failure blocks pilot/public deployment
- Any missing env var blocks the release gate immediately
- Typecheck and build must also pass before deployment

### Required pre-release sequence

```bash
npm run typecheck
npm run build
npm run qa:staging-release-gate
```

### Release discipline rule

Do not promote staging to pilot or public if any of the above commands fail.

## 9. Post-deploy Smoke Tests

## Customer Flows

- signup
- login
- logout
- stale session restore cleanup
- profile load
- profile name update
- order history load
- loyalty summary load
- phone update request
- phone update confirm

## Admin / Store Flows

- owner login
- admin login
- store login
- logout
- store lands on `/store/shift`
- employee clock in
- employee clock out
- employee deactivate while on shift

## Operator Session Flows

- operational route requires unlock when no operator is active
- unlock modal works
- operator session restores on refresh
- end session does not clock out employee
- logout ends operator session
- clock-out ends linked operator session

## Payment Flows

- payment intent creation
- successful checkout
- failed/cancelled checkout behavior
- payment confirm/finalize creates order and payment records

## Integrity Checks

- no duplicate open shifts exist
- no active operator session remains linked to a closed shift
- `shift_status` matches actual open-shift truth

## 10. Common Failure Modes

### Payment provider mismatch

Symptoms:

- checkout UI enabled but payment intent fails
- gateway mismatch or unsupported provider errors

Cause:

- `VITE_PAYMENT_PROVIDER` and `PAYMENT_PROVIDER` do not match

### Missing payment secrets

Symptoms:

- payment intent returns backend errors
- Razorpay env missing messages

Cause:

- missing `RAZORPAY_KEY_ID`
- missing `RAZORPAY_KEY_SECRET`

### Wrong Supabase project

Symptoms:

- frontend loads but data is inconsistent
- auth/session/order screens behave strangely
- migrations/functions appear “missing”

Cause:

- frontend env points to one project
- deployed functions or DB changes are in another project

### Missing core secrets

Symptoms:

- edge functions fail with server configuration errors

Cause:

- missing `SUPABASE_URL`
- missing `SUPABASE_SERVICE_ROLE_KEY`

### OTP misconfiguration

Symptoms:

- phone update request fails
- SMS sending fails

Cause:

- missing Twilio secrets
- missing `OTP_HASH_SECRET`

### Receipt provider misconfiguration

Symptoms:

- receipt send fails
- email or SMS provider rejects requests

Cause:

- provider selector set without matching key
- wrong sender email/phone variable

### Debug flags left enabled

Symptoms:

- extra debug output
- unsafe debug responses in non-dev environments

Cause:

- `PASSWORD_RESET_DEBUG_TOKEN_RESPONSE=true`
- `CHECKOUT_DEBUG_LOGS=true`
- `RECEIPT_DEBUG_LOGS=true`

## 11. Security Warnings

- Never commit secrets to the repository.
- Never commit production `.env` files.
- Never use `mock` payment provider in production.
- Never rely on development fallback values in production.
- Always set `OTP_HASH_SECRET` explicitly in production.
- Always verify the deployed frontend and deployed Supabase functions point to the same project.
- Keep debug flags disabled in production unless temporarily needed for incident response.
- Restrict access to service-role secrets and provider API keys.

## 12. Recommended Documentation Follow-up

If we want to keep this guide in sync long-term, the best companion files to maintain are:

- [README.md](/Users/rohith/Desktop/Personal%20Business/Cultiv%20New/README.md:1)
- [.env.local.example](/Users/rohith/Desktop/Personal%20Business/Cultiv%20New/.env.local.example:1)
- `supabase/.env.example` if added later
