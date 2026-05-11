import {
  addFirstQuickItem,
  clearBrowserState,
  customerLogin,
  logoutCustomerFromHeader,
  openProfileScreen,
  selectStoreIfPrompted,
  waitForOrderPageReady,
} from './shared/helpers.mjs';
import { missingEnv } from './shared/env.mjs';

const CUSTOMER_ENV = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];

export const scenarios = [
  {
    id: 'logged-out-checkout-cta',
    group: 'customer-checkout',
    name: 'Logged-out checkout shows Login / Sign Up CTAs',
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/order`, { waitUntil: 'domcontentloaded' });
      await waitForOrderPageReady(page);
      await selectStoreIfPrompted(page, env.E2E_STORE_NAME ?? '');
      await waitForOrderPageReady(page);
      await addFirstQuickItem(page);
      await page.getByRole('link', { name: /^Sign In$/ }).waitFor({ state: 'visible', timeout: 10_000 });
      await page.getByRole('link', { name: /^Create Account$/ }).waitFor({ state: 'visible', timeout: 10_000 });
    },
  },
  {
    id: 'checkout-contact-modes-and-stale-pii-reset',
    group: 'customer-checkout',
    name: 'My Details, Other Pickup, and stale pickup reset behavior work',
    skip() {
      const missing = missingEnv(CUSTOMER_ENV);
      return missing.length > 0 ? `Missing customer credentials: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await customerLogin(page, {
        baseUrl,
        email: env.E2E_CUSTOMER_EMAIL,
        password: env.E2E_CUSTOMER_PASSWORD,
      });

      await page.goto(`${baseUrl}/order`, { waitUntil: 'domcontentloaded' });
      await waitForOrderPageReady(page);
      await selectStoreIfPrompted(page, env.E2E_STORE_NAME ?? '');
      await addFirstQuickItem(page);

      await page.getByRole('button', { name: /^My Details$/ }).click();
      await page.getByText(new RegExp(env.E2E_CUSTOMER_EMAIL, 'i')).waitFor({ state: 'visible', timeout: 10_000 });

      await page.getByRole('button', { name: /^Other Pickup$/ }).click();
      await page.getByLabel(/Full name/i).fill('Alt Pickup User');
      await page.getByLabel(/Phone number/i).fill('9999988888');
      await page.getByLabel(/Email address/i).fill('pickup.alt@example.com');

      await logoutCustomerFromHeader(page);
      await page.getByText(/Discard cart\?/i).waitFor({ state: 'visible', timeout: 10_000 });
      await page.getByRole('button', { name: /^Stay$/ }).click();
      await page.getByText(/Discard cart\?/i).waitFor({ state: 'hidden', timeout: 10_000 });

      await logoutCustomerFromHeader(page);
      await page.getByRole('button', { name: /^Sign Out$/ }).click();
      await page.getByRole('link', { name: /Login \/ Sign Up|Login/i }).waitFor({ state: 'visible', timeout: 10_000 });

      await customerLogin(page, {
        baseUrl,
        email: env.E2E_CUSTOMER_EMAIL,
        password: env.E2E_CUSTOMER_PASSWORD,
      });

      await page.goto(`${baseUrl}/order`, { waitUntil: 'domcontentloaded' });
      await waitForOrderPageReady(page);
      await selectStoreIfPrompted(page, env.E2E_STORE_NAME ?? '');
      await addFirstQuickItem(page);
      await page.getByRole('button', { name: /^Other Pickup$/ }).click();

      const nameValue = await page.getByLabel(/Full name/i).inputValue();
      const phoneValue = await page.getByLabel(/Phone number/i).inputValue();
      const emailValue = await page.getByLabel(/Email address/i).inputValue();

      if (nameValue.trim() || phoneValue.trim() || emailValue.trim()) {
        throw new Error(`Expected blank Other Pickup fields after logout/login, but got name="${nameValue}" phone="${phoneValue}" email="${emailValue}"`);
      }
    },
  },
  {
    id: 'empty-cart-logout-skips-confirmation',
    group: 'customer-checkout',
    name: 'Empty-cart sign-out does not show the discard-cart modal',
    skip() {
      const missing = missingEnv(CUSTOMER_ENV);
      return missing.length > 0 ? `Missing customer credentials: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await customerLogin(page, {
        baseUrl,
        email: env.E2E_CUSTOMER_EMAIL,
        password: env.E2E_CUSTOMER_PASSWORD,
      });

      await openProfileScreen(page, baseUrl);
      await page.getByText(/^Sign Out$/).last().click();
      await page.getByRole('link', { name: /Login \/ Sign Up|Login/i }).waitFor({ state: 'visible', timeout: 10_000 });
      const modalVisible = await page.getByText(/Discard cart\?/i).isVisible().catch(() => false);
      if (modalVisible) {
        throw new Error('Discard-cart modal should not appear when the cart is empty.');
      }
    },
  },
];
