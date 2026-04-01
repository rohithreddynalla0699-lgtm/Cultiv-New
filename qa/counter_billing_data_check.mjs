import { chromium } from 'playwright';

const baseUrl = process.env.CULTIV_BASE_URL ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${baseUrl}/admin/summary`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Store Login' }).click();
await page.getByRole('combobox').first().selectOption('store-siddipet');
await page.getByPlaceholder('Store PIN').fill('240101');
await page.getByRole('button', { name: 'Open store workspace' }).click();
await page.locator('text=Role: Store').first().waitFor({ timeout: 5000 });

await page.getByRole('link', { name: 'Counter / Billing' }).click();
await page.waitForURL(/admin\/counter-billing/);

await page.getByRole('button', { name: 'Customize' }).first().click();
for (let step = 0; step < 8; step += 1) {
  const nextButton = page.getByRole('button', { name: 'Next' });
  if (await nextButton.count() === 0 || !(await nextButton.isVisible())) {
    break;
  }
  await nextButton.click();
}
await page.getByRole('button', { name: 'Add to Cart' }).click();

await page.getByRole('button', { name: 'Drinks & Juices' }).click();
await page.getByRole('button', { name: 'Add' }).first().click();

await page.getByPlaceholder('10-digit phone').fill('9876543210');
await page.getByPlaceholder('Optional').fill('Counter Guest');
await page.getByRole('button', { name: '10%' }).click();
await page.getByRole('button', { name: 'UPI' }).click();
await page.getByRole('button', { name: 'Pay Now' }).click();
await page.locator('text=Payment Successful').first().waitFor({ timeout: 5000 });

const latest = await page.evaluate(() => {
  const orders = JSON.parse(localStorage.getItem('cultiv_orders_v2') || '[]');
  return orders[0] ?? null;
});

console.log(JSON.stringify(latest ? {
  source: latest.source,
  orderType: latest.orderType,
  status: latest.status,
  paymentMethod: latest.paymentMethod,
  storeId: latest.storeId,
  phone: latest.phone,
  fullName: latest.fullName,
  tipPercentage: latest.tipPercentage,
  tipAmount: latest.tipAmount,
  itemCount: latest.items?.length ?? 0,
  total: latest.total,
} : null, null, 2));

await browser.close();
