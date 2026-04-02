
  # CULTIV

  This is a code bundle for CULTIV. The original project is available at https://www.figma.com/design/WcgCnBCqOuXA5ymVttXvzQ/CULTIV.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

    ## Local Setup (Admin/Store Login + Sync)

    1. Install dependencies:
      - `npm install`
    2. Create a local env file from the example:
      - Copy `.env.local.example` to `.env.local`
      - Ensure this value exists in `.env.local`:
       - `VITE_SYNC_SERVER_URL=http://localhost:3747`
    3. Start both servers together:
      - `npm run dev:all`
    4. Open the app:
      - `http://localhost:5173`
  