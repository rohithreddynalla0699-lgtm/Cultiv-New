import {
  clearBrowserState,
  customerLogin,
  ensureLoggedOutUi,
  expectNoCustomerProfileRequest,
  expectPathname,
  logoutCustomerFromHeader,
  waitForCustomerUiToSettle,
} from './shared/helpers.mjs';
import { hasEnv, isTruthyEnv, missingEnv } from './shared/env.mjs';

const CUSTOMER_ENV = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];
const SIGNUP_ENV = ['E2E_SIGNUP_FULL_NAME', 'E2E_SIGNUP_PHONE', 'E2E_SIGNUP_EMAIL', 'E2E_SIGNUP_PASSWORD', 'E2E_SIGNUP_OTP'];

export const scenarios = [
  {
    id: 'fresh-load-no-profile-noise',
    group: 'customer-auth',
    name: 'Fresh logged-out load does not call customer profile restore',
    async run({ page, baseUrl }) {
      await clearBrowserState(page, baseUrl);
      await expectNoCustomerProfileRequest(page, async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: /Login \/ Sign Up|Login/i }).waitFor({ state: 'visible', timeout: 10_000 });
      });
    },
  },
  {
    id: 'signup-optional-debug-path',
    group: 'customer-auth',
    name: 'Signup flow works when a test OTP/debug path is configured',
    skip() {
      if (!isTruthyEnv('E2E_ENABLE_MUTATION_TESTS')) {
        return 'Signup is mutation-gated. Set E2E_ENABLE_MUTATION_TESTS=true to run it.';
      }
      const missing = missingEnv(SIGNUP_ENV);
      if (missing.length > 0) {
        return `No test OTP/debug signup path configured. Missing: ${missing.join(', ')}`;
      }
      return null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel(/Full name/i).fill(env.E2E_SIGNUP_FULL_NAME);
      await page.getByLabel(/Phone number/i).fill(env.E2E_SIGNUP_PHONE);
      await page.getByLabel(/^Email$/i).fill(env.E2E_SIGNUP_EMAIL);
      await page.getByLabel(/^Password$/i).fill(env.E2E_SIGNUP_PASSWORD);
      await page.getByRole('button', { name: /Create account|Sign Up/i }).click();
      await page.getByLabel(/Verification code/i).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByLabel(/Verification code/i).fill(env.E2E_SIGNUP_OTP);
      await page.getByRole('button', { name: /Verify|Complete/i }).click();
      await page.getByRole('link', { name: /^Order$/ }).waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
  {
    id: 'login-refresh-logout-protected-routes',
    group: 'customer-auth',
    name: 'Customer login, refresh, logout, and protected route redirect work',
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
      await waitForCustomerUiToSettle(page);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /^Order$/ }).waitFor({ state: 'visible', timeout: 15_000 });
      await waitForCustomerUiToSettle(page);

      await logoutCustomerFromHeader(page);
      await ensureLoggedOutUi(page);
      await waitForCustomerUiToSettle(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ensureLoggedOutUi(page);
      await waitForCustomerUiToSettle(page);

      await page.goto(`${baseUrl}/orders`, { waitUntil: 'domcontentloaded' });
      await expectPathname(page, '/');
      await ensureLoggedOutUi(page);
      await waitForCustomerUiToSettle(page);

      await page.goto(`${baseUrl}/rewards`, { waitUntil: 'domcontentloaded' });
      await expectPathname(page, '/');
      await ensureLoggedOutUi(page);
    },
  },
];
