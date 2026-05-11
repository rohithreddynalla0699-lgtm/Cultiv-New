import {
  clearBrowserState,
  customerLogin,
  ensureLoggedOutUi,
  expectPathname,
} from './shared/helpers.mjs';
import { hasEnv, isTruthyEnv, missingEnv } from './shared/env.mjs';

const CUSTOMER_ENV = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];

export const scenarios = [
  {
    id: 'receipt-access-protected-when-logged-out',
    group: 'receipts',
    name: 'Logged-out users cannot access customer order detail / receipt routes',
    async run({ page, baseUrl }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/orders/test-receipt-access`, { waitUntil: 'domcontentloaded' });
      await expectPathname(page, '/');
      await ensureLoggedOutUi(page);
    },
  },
  {
    id: 'customer-order-detail-receipt-optional',
    group: 'receipts',
    name: 'Customer can open a receipt from order detail when an order is available',
    skip() {
      const missing = missingEnv(CUSTOMER_ENV);
      if (missing.length > 0) return `Missing customer credentials: ${missing.join(', ')}`;
      if (!hasEnv('E2E_RECEIPT_ORDER_ID') && !isTruthyEnv('E2E_ENABLE_MUTATION_TESTS')) {
        return 'Provide E2E_RECEIPT_ORDER_ID or enable mutation tests to guarantee a receipt-backed order.';
      }
      return null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await customerLogin(page, {
        baseUrl,
        email: env.E2E_CUSTOMER_EMAIL,
        password: env.E2E_CUSTOMER_PASSWORD,
      });

      const targetOrderId = env.E2E_RECEIPT_ORDER_ID?.trim();
      if (targetOrderId) {
        await page.goto(`${baseUrl}/orders/${targetOrderId}`, { waitUntil: 'domcontentloaded' });
      } else {
        await page.goto(`${baseUrl}/orders`, { waitUntil: 'domcontentloaded' });
        const firstOrderLink = page.getByText(/Order #/i).first();
        await firstOrderLink.waitFor({ state: 'visible', timeout: 15_000 });
        await firstOrderLink.click();
      }

      await page.getByRole('button', { name: /View Receipt/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /View Receipt/i }).click();
      await page.getByText(/Receipt|Payment|Total/i).first().waitFor({ state: 'visible', timeout: 15_000 });
    },
  },
];
