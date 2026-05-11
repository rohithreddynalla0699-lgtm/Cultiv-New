import {
  addFirstQuickItem,
  clearBrowserState,
  customerLogin,
  selectStoreIfPrompted,
  waitForOrderPageReady,
} from './shared/helpers.mjs';
import { isTruthyEnv, missingEnv } from './shared/env.mjs';

const CUSTOMER_ENV = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];

export const scenarios = [
  {
    id: 'mock-checkout-success-history-detail-receipt',
    group: 'order-placement',
    name: 'Mock/local checkout creates an order that is visible in history, detail, and receipt surfaces',
    skip() {
      if (!isTruthyEnv('E2E_ENABLE_MUTATION_TESTS')) {
        return 'Order placement is mutation-gated. Set E2E_ENABLE_MUTATION_TESTS=true to run it.';
      }
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

      const cta = page.getByRole('button', { name: /Pay & Place Order|Order at store for now/i });
      const ctaLabel = (await cta.textContent())?.trim() ?? '';
      if (/Order at store for now/i.test(ctaLabel)) {
        throw new Error('Online/mock checkout is unavailable in this environment. Enable the local mock checkout path before running this scenario.');
      }

      await page.getByRole('button', { name: /^UPI$/ }).click().catch(() => {});
      await cta.click();
      await page.getByRole('heading', { name: /Review before placing/i }).waitFor({ state: 'visible', timeout: 10_000 });
      await page.getByRole('button', { name: /^Pay & Place Order$/ }).last().click();

      await page.getByRole('heading', { name: /Order Confirmed/i }).waitFor({ state: 'visible', timeout: 25_000 });
      const trackOrderLink = page.getByRole('link', { name: /Track Order/i });
      const href = await trackOrderLink.getAttribute('href');
      if (!href) {
        throw new Error('Track Order link is missing from the success screen.');
      }

      await page.getByText(/You can view or print your receipt anytime/i).waitFor({ state: 'visible', timeout: 10_000 });

      await trackOrderLink.click();
      await page.getByRole('button', { name: /View Receipt/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /View Receipt/i }).click();
      await page.getByText(/Receipt|Payment|Total/i).first().waitFor({ state: 'visible', timeout: 15_000 });

      await page.goto(`${baseUrl}/orders`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Order History/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByText(/Order #/i).first().waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
];
