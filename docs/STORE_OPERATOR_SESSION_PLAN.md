# Store Operator Session Plan

## Purpose
This document defines the Phase 1 backend foundation for production-safe store operator sessions in CULTIV.

This is a design plan only. It does not change:
- runtime code
- database schema
- Supabase edge functions
- frontend wiring

## Problem
Today, CULTIV has:
- server-backed internal access sessions for owner, admin, and store access
- server-backed employee shift clock-in / clock-out
- browser-only store operator sessions in `StoreSessionContext`

That means the backend knows:
- who is allowed into store tools
- who is clocked in

But it does **not** reliably know:
- which employee is actively operating the terminal right now
- whether that operator session is still active
- which terminal activity belongs to which employee session

This creates production risks around:
- auditability
- session drift
- terminal accountability
- refresh / tab close / browser restore behavior

## Current State

### Existing server-backed session layer
`internal-login` creates rows in `internal_access_sessions`.

These sessions already capture:
- `internal_user_id`
- `role_key`
- `scope_type`
- `scope_store_id`
- `expires_at`
- `revoked_at`
- `created_by_ip`
- `created_user_agent`

This is the source of truth for internal/admin/store access.

### Existing server-backed shift layer
`internal-shift-control` validates employee PINs and creates or closes rows in `employee_shifts`.

These rows already capture:
- `shift_id`
- `employee_id`
- `store_id`
- `shift_date`
- `clock_in_at`
- `clock_out_at`
- `total_hours`

This is the source of truth for labor / shift state.

### Existing browser-only operator layer
`StoreSessionContext` creates a local `sessionStorage` session after a successful shift clock-in.

This local session tracks:
- employee id / name / role
- store id / name
- shift id
- started time
- last activity time
- expiry / inactivity timers

This is currently not server-backed.

## Phase 1 Goal
Add a backend-only operator-session foundation so the backend can know:
- which employee is actively using the store terminal
- which shift that operator session belongs to
- whether the operator session is still active

Phase 1 explicitly does **not** include frontend migration yet.

## Proposed Table
New table: `public.store_operator_sessions`

### Proposed columns
```sql
create table if not exists public.store_operator_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  internal_access_session_id uuid not null references public.internal_access_sessions(id) on delete cascade,
  internal_user_id uuid not null references public.internal_users(id),
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(shift_id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,

  device_id text,
  device_name text,

  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text,
  is_locked boolean not null default false,

  created_by_ip text,
  created_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_operator_sessions_expiry_check check (expires_at > started_at),
  constraint store_operator_sessions_end_check check (
    ended_at is null or ended_at >= started_at
  ),
  constraint store_operator_sessions_ended_reason_check check (
    ended_at is null or ended_reason is not null
  )
);
```

### Proposed indexes
```sql
create index if not exists idx_store_operator_sessions_internal_access_session_id
  on public.store_operator_sessions(internal_access_session_id);

create index if not exists idx_store_operator_sessions_internal_user_id
  on public.store_operator_sessions(internal_user_id);

create index if not exists idx_store_operator_sessions_employee_id
  on public.store_operator_sessions(employee_id);

create index if not exists idx_store_operator_sessions_shift_id
  on public.store_operator_sessions(shift_id);

create index if not exists idx_store_operator_sessions_store_id
  on public.store_operator_sessions(store_id);

create index if not exists idx_store_operator_sessions_expires_at
  on public.store_operator_sessions(expires_at);

create index if not exists idx_store_operator_sessions_active_token
  on public.store_operator_sessions(session_token)
  where ended_at is null;

create unique index if not exists uq_store_operator_sessions_active_internal_access_session
  on public.store_operator_sessions(internal_access_session_id)
  where ended_at is null;

create unique index if not exists uq_store_operator_sessions_active_shift
  on public.store_operator_sessions(shift_id)
  where ended_at is null;
```

### Proposed security
```sql
revoke all on table public.store_operator_sessions from public;
revoke all on table public.store_operator_sessions from anon, authenticated;
grant select, insert, update, delete on table public.store_operator_sessions to service_role;

alter table public.store_operator_sessions enable row level security;

drop policy if exists store_operator_sessions_service_role_all on public.store_operator_sessions;
create policy store_operator_sessions_service_role_all
on public.store_operator_sessions
for all
to service_role
using (true)
with check (true);
```

### Why a separate table
This table should not replace:
- `internal_access_sessions`
- `employee_shifts`

Each layer has a different responsibility:
- `internal_access_sessions`: access control
- `employee_shifts`: labor / clock-in state
- `store_operator_sessions`: active terminal operator state

Keeping these separate reduces regression risk and keeps the model easier to reason about.

## Proposed Edge Functions
Phase 1 backend foundation should add these four functions:

- `store-operator-session-start`
- `store-operator-session-get`
- `store-operator-session-touch`
- `store-operator-session-end`

## Validation Rules
All functions should validate the current internal session using the same rules already used by internal store functions:
- internal session token exists
- session row exists
- `revoked_at is null`
- `expires_at > now`
- `scope_type = 'store'`
- `scope_store_id is not null`

The operator session must always be consistent with:
- internal session scoped store
- employee store assignment
- open shift for that employee in that store

### Employee + shift + store linking
At session start:
1. Validate internal store session.
2. Load employee by `employee_id`.
3. Confirm employee is active.
4. Confirm `employees.store_id = internal_access_session.scope_store_id`.
5. Find open shift for:
   - same `employee_id`
   - same `store_id`
   - `clock_out_at is null`
6. Use that `shift_id` in the operator session row.

Phase 1 should **not** validate employee PIN again in the new functions.
PIN validation already belongs to `internal-shift-control`.

## Proposed Function Contracts

### 1. `store-operator-session-start`
Start a server-backed operator session after a valid clock-in flow.

#### Input
```json
{
  "internalSessionToken": "string",
  "employeeId": "uuid",
  "deviceId": "optional-string",
  "deviceName": "optional-string"
}
```

#### Behavior
- validate internal store session
- validate employee belongs to the same store and is active
- validate open shift exists for employee + store
- end any currently active operator session tied to the same internal access session using `ended_reason = 'replaced'`
- create a new operator session
- set:
  - `session_token = crypto.randomUUID()`
  - `started_at = now`
  - `last_activity_at = now`
  - `expires_at = now + configured duration`
  - `created_by_ip`
  - `created_user_agent`

#### Return
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "sessionToken": "string",
    "internalAccessSessionId": "uuid",
    "internalUserId": "uuid",
    "employeeId": "uuid",
    "employeeName": "string",
    "employeeRole": "manager|kitchen|counter",
    "shiftId": "uuid",
    "storeId": "uuid",
    "storeName": "string",
    "deviceId": "string|null",
    "deviceName": "string|null",
    "startedAt": "iso-string",
    "lastActivityAt": "iso-string",
    "expiresAt": "iso-string",
    "isLocked": false
  }
}
```

### 2. `store-operator-session-get`
Return the currently active operator session for the internal store session.

#### Input
```json
{
  "internalSessionToken": "string"
}
```

#### Behavior
- validate internal store session
- find active operator session by `internal_access_session_id`
- active means:
  - `ended_at is null`
  - `expires_at > now`

#### Return
When found:
```json
{
  "success": true,
  "session": { "...": "..." }
}
```

When not found:
```json
{
  "success": true,
  "session": null
}
```

### 3. `store-operator-session-touch`
Update operator session activity.

#### Input
```json
{
  "internalSessionToken": "string"
}
```

#### Behavior
- validate internal store session
- find active operator session
- update `last_activity_at = now`
- optionally keep `expires_at` fixed in Phase 1

#### Return
```json
{
  "success": true,
  "lastActivityAt": "iso-string",
  "expiresAt": "iso-string"
}
```

### 4. `store-operator-session-end`
End an active operator session.

#### Input
```json
{
  "internalSessionToken": "string",
  "reason": "clock_out|logout|expired|manual|replaced"
}
```

#### Behavior
- validate internal store session
- find active operator session for that internal access session
- if none exists, return success idempotently
- if found, set:
  - `ended_at = now`
  - `ended_reason = reason`
  - `updated_at = now`

#### Return
```json
{
  "success": true,
  "ended": true
}
```

If no active session:
```json
{
  "success": true,
  "ended": false
}
```

## Error Handling Expectations
Suggested status patterns:
- `400` invalid input
- `401` invalid / expired / revoked internal session
- `403` store-scope mismatch or unauthorized employee/store relation
- `409` missing open shift, active conflict, or other operator-session state conflict
- `500` unexpected server errors

Responses should avoid leaking sensitive internals.

## Risks
Main risks in this backend-only phase:

- Creating multiple active operator sessions if uniqueness constraints are not enforced.
- Starting an operator session against the wrong shift if store validation is incomplete.
- Later frontend migration may assume sliding expiry while backend uses fixed expiry.
- Internal logout could leave operator sessions active unless Phase 2 or later ties them together.
- Touch endpoints could be spammed if later frontend wiring calls them too often.

## Phase 1 Test Plan

### Migration tests
- migration applies cleanly on a fresh project
- indexes and policies are created
- uniqueness constraints behave correctly

### `store-operator-session-start`
- valid store internal session + valid employee open shift -> success
- invalid internal session -> `401`
- global/admin internal session -> `403`
- employee from different store -> `403`
- inactive employee -> `403`
- employee without open shift -> `409`
- existing active operator session for same internal access session -> old session ended and new one created

### `store-operator-session-get`
- active session exists -> session returned
- no active session -> `session: null`
- expired or ended session not returned

### `store-operator-session-touch`
- active session -> `last_activity_at` updated
- no active session -> clean failure
- invalid internal session -> `401`

### `store-operator-session-end`
- active session -> ended successfully
- repeated end -> idempotent success
- invalid internal session -> `401`

### Data integrity checks
- returned `store_id` matches internal session scoped store
- `shift_id` belongs to same employee and same store
- no second active session for same `internal_access_session_id`
- no second active session for same `shift_id`

## Future Phase 2 Frontend Wiring
Phase 2 should migrate the frontend from browser-only operator sessions to the new backend foundation.

Expected frontend updates later:
- `StoreSessionContext` becomes API-backed instead of `sessionStorage`-backed
- `StoreShiftScreen` starts operator session after successful shift clock-in
- `StoreShiftScreen` ends operator session after shift clock-out
- `StoreRouteGuard` requires:
  - valid internal store login
  - valid operator session for store operational routes
- `CounterBillingScreen`, `OrdersBoardScreen`, and `InventoryScreen` continue to call `touchActivity()`, but that call becomes server-backed

Recommended Phase 2 sequencing:
1. wire `StoreSessionContext` to `store-operator-session-get`
2. wire `StoreShiftScreen` to `start` / `end`
3. wire `touchActivity()` to `touch`
4. tighten `StoreRouteGuard`
5. optionally revoke operator sessions from internal logout

## Recommendation
Phase 1 should be implemented as a backend-only foundation with no frontend migration in the same change set.

That gives CULTIV:
- a production-safe source of truth for active store terminal operator sessions
- low regression risk
- a clean path to Phase 2 frontend adoption
