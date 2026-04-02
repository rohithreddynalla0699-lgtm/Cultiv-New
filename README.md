
## CULTIV

This is a code bundle for CULTIV. The original project is available at https://www.figma.com/design/WcgCnBCqOuXA5ymVttXvzQ/CULTIV.

## Running the code

Run `npm install` to install dependencies.

Run `npm run dev` to start the app.

## Local Setup

1. Copy `.env.local.example` to `.env.local`.
2. Set `VITE_SYNC_SERVER_URL=http://localhost:3747` if you want the optional local sync server.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only if you want Supabase-backed menu/order integrations.
4. Start the frontend:
   - `npm run dev`
5. Start the sync server when needed:
   - `node server/sync-server.mjs`
   - or `npm run dev:all`
6. Open `http://localhost:5173`.

## Internal Admin Access

Internal `/admin` access uses PIN login only.

- Owner PIN default: `240620`
- Seed store PINs:
  - `store-siddipet` → `111111`
  - `store-hyderabad` → `222222`
  - `store-warangal` → `333333`

Internal admin/store login does not use Supabase auth.
  