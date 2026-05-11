import { clearBrowserState } from './shared/helpers.mjs';
import { hasEnv, isTruthyEnv, missingEnv } from './shared/env.mjs';

const OWNER_ENV = ['E2E_OWNER_PIN'];

async function loginOwner(page, baseUrl, ownerPin) {
  await clearBrowserState(page, baseUrl);
  await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('owner-pin-input').fill(ownerPin);
  await page.getByTestId('owner-login-button').click();
  await page.getByTestId('admin-store-scope').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(4000);
}

export const scenarios = [
  {
    id: 'inventory-screen-loads',
    group: 'inventory',
    name: 'Inventory screen loads for internal users',
    skip() {
      const missing = missingEnv(OWNER_ENV);
      return missing.length > 0 ? `Missing owner credential: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await loginOwner(page, baseUrl, env.E2E_OWNER_PIN);
      await page.goto(`${baseUrl}/operations/inventory`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('inventory-search').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByText(/Recent Inventory History/i).waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
  {
    id: 'inventory-manual-adjustment-optional',
    group: 'inventory',
    name: 'A manual inventory adjustment can be made on a dedicated QA item when enabled',
    skip() {
      if (!isTruthyEnv('E2E_ENABLE_MUTATION_TESTS')) {
        return 'Inventory mutation tests are disabled. Set E2E_ENABLE_MUTATION_TESTS=true to run this scenario.';
      }
      const missing = missingEnv([...OWNER_ENV, 'E2E_INVENTORY_ITEM_QUERY']);
      return missing.length > 0 ? `Missing inventory mutation inputs: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await loginOwner(page, baseUrl, env.E2E_OWNER_PIN);
      await page.goto(`${baseUrl}/operations/inventory`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('inventory-search').fill(env.E2E_INVENTORY_ITEM_QUERY);
      const row = page.locator('text=' + env.E2E_INVENTORY_ITEM_QUERY).first().locator('..').locator('..').first();
      await row.waitFor({ state: 'visible', timeout: 10_000 });
      await row.getByPlaceholder(/Qty in/i).fill('1');
      await row.getByRole('button', { name: /Add Entered/i }).click();
      await page.getByText(new RegExp(env.E2E_INVENTORY_ITEM_QUERY, 'i')).last().waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
];
