import { clearBrowserState } from './shared/helpers.mjs';
import { hasEnv, missingEnv } from './shared/env.mjs';

export const scenarios = [
  {
    id: 'invalid-pin-and-mode-switch-reset',
    group: 'internal-access',
    name: 'Invalid PIN errors appear and mode switching clears prior PIN state',
    async run({ page, baseUrl }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('owner-pin-input').fill('1111');
      await page.getByTestId('owner-login-button').click();
      await page.getByText(/valid 6-digit PIN|Invalid PIN/i).waitFor({ state: 'visible', timeout: 10_000 });

      await page.getByTestId('mode-admin').click();
      await page.getByTestId('mode-owner').click();
      const ownerValue = await page.getByTestId('owner-pin-input').inputValue();
      if (ownerValue !== '') {
        throw new Error(`Expected owner PIN input to clear on mode switch, but found "${ownerValue}"`);
      }

      await page.getByTestId('mode-store').click();
      await page.getByTestId('mode-owner').click();
      const ownerValueAfterStore = await page.getByTestId('owner-pin-input').inputValue();
      if (ownerValueAfterStore !== '') {
        throw new Error(`Expected owner PIN input to stay cleared after store-mode roundtrip, but found "${ownerValueAfterStore}"`);
      }
    },
  },
  {
    id: 'owner-login-dashboard-logout',
    group: 'internal-access',
    name: 'Owner login loads the dashboard and logout returns to access gate',
    skip() {
      const missing = missingEnv(['E2E_OWNER_PIN']);
      return missing.length > 0 ? `Missing internal credential: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('owner-pin-input').fill(env.E2E_OWNER_PIN);
      await page.getByTestId('owner-login-button').click();
      await page.getByTestId('admin-store-scope').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByTestId('admin-signout').click();
      await page.getByTestId('mode-owner').waitFor({ state: 'visible', timeout: 10_000 });
    },
  },
  {
    id: 'admin-login-dashboard-logout',
    group: 'internal-access',
    name: 'Admin login loads the dashboard and logout returns to access gate',
    skip() {
      if (!hasEnv('E2E_ADMIN_PIN')) return 'E2E_ADMIN_PIN is not configured.';
      return null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('mode-admin').click();
      await page.getByTestId('admin-pin-input').fill(env.E2E_ADMIN_PIN);
      await page.getByTestId('admin-login-button').click();
      await page.getByTestId('admin-store-scope').waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByTestId('admin-signout').click();
      await page.getByTestId('mode-owner').waitFor({ state: 'visible', timeout: 10_000 });
    },
  },
];
