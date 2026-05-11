import {
  clearBrowserState,
  customerLogin,
  expectPathname,
  openHeaderUserMenu,
  waitForCustomerUiToSettle,
} from './shared/helpers.mjs';
import { missingEnv } from './shared/env.mjs';

const CUSTOMER_ENV = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];

export const scenarios = [
  {
    id: 'customer-route-transitions',
    group: 'customer-navigation',
    name: 'Customer route transitions load the expected pages without runtime errors',
    skip() {
      const missing = missingEnv(CUSTOMER_ENV);
      return missing.length > 0 ? `Missing customer credentials: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      const header = page.getByRole('banner');

      await clearBrowserState(page, baseUrl);
      await customerLogin(page, {
        baseUrl,
        email: env.E2E_CUSTOMER_EMAIL,
        password: env.E2E_CUSTOMER_PASSWORD,
      });
      await waitForCustomerUiToSettle(page);

      await header.getByRole('link', { name: /^Menu$/ }).click();
      await expectPathname(page, '/menu');
      await page.getByRole('heading', { name: /Menu|Bowls|Signature/i }).first().waitFor({ state: 'visible', timeout: 15_000 });

      await header.getByRole('link', { name: /^Order$/ }).click();
      await expectPathname(page, '/order');
      await page.locator('#checkout-panel').waitFor({ state: 'visible', timeout: 15_000 });

      await openHeaderUserMenu(page);
      await header.getByRole('link', { name: /^Order History$/ }).click();
      await expectPathname(page, '/orders');
      await page.getByRole('heading', { name: /Order History/i }).waitFor({ state: 'visible', timeout: 15_000 });

      await openHeaderUserMenu(page);
      await header.getByRole('link', { name: /^Rewards$/ }).click();
      await expectPathname(page, '/rewards');
      await page.getByText(/Available Points/i).waitFor({ state: 'visible', timeout: 15_000 });

      await openHeaderUserMenu(page);
      await header.getByRole('link', { name: /^Profile$/ }).click();
      await expectPathname(page, '/profile');
      await page.getByRole('heading', { name: /Your CULTIV Profile/i }).waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
];
