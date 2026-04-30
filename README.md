
## CULTIV

This is a code bundle for CULTIV. The original project is available at https://www.figma.com/design/WcgCnBCqOuXA5ymVttXvzQ/CULTIV.

## Running the code

Run `npm install` to install dependencies.

Run `npm run dev` to start the app.

## Local Setup

1. Copy `.env.local.example` to `.env.local`.
2. Set `VITE_SYNC_SERVER_URL=http://localhost:3747` if you want the optional local sync server.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only if you want Supabase-backed menu/order integrations.
4. If you want to run internal access QA scripts locally, set your own non-production test PINs in `.env.local` or your shell environment.
5. For local or staging checkout without Razorpay keys, use mock payments:
   - Frontend: set `VITE_CUSTOMER_ONLINE_CHECKOUT_ENABLED=true`
   - Frontend: set `VITE_PAYMENT_PROVIDER=mock`
   - Frontend: optionally set `VITE_MOCK_PAYMENT_OUTCOME=succeeded|failed|cancelled`
   - Edge functions: set `PAYMENT_PROVIDER=mock`
   - Edge functions: keep `APP_ENV=development`, `staging`, `test`, or `local`
   - Never set mock payments in production
6. Start the frontend:
   - `npm run dev`
7. Start the sync server when needed:
   - `node server/sync-server.mjs`
   - or `npm run dev:all`
8. Open `http://localhost:5173`.

## Internal Admin Access

Internal `/admin` access uses PIN login only.

Internal admin/store login does not use Supabase auth.
Internal login should be backed only by hashed PINs stored in the database.

Recommended local setup:
- Provision internal users in Supabase with bcrypt-hashed PINs.
- Keep raw PINs out of app code, docs, and committed env files.
- Export local-only QA variables in your shell when you need scripted login, for example:

```bash
export ADMIN_OWNER_PIN=your-local-test-owner-pin
export STORE_PIN_SIDDIPET=your-local-test-store-pin
export STORE_PIN_HYDERABAD=your-local-test-store-pin
export STORE_PIN_WARANGAL=your-local-test-store-pin
```

If you need seed data for local development, create it only in local Supabase seed SQL or dashboard inserts using placeholder values that are never committed back into the repo.
  
