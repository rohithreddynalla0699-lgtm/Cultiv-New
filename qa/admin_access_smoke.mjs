import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4174';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];

await page.goto(`${baseUrl}/admin/summary`, { waitUntil: 'networkidle' });
results.push({ step: 'access-gate', ok: await page.locator('text=CULTIV Control').isVisible() });

await page.getByTestId('owner-pin-input').fill('240620');
await page.getByTestId('owner-login-button').click();
await page.waitForURL(/\/admin\/summary/, { timeout: 5000 });
await page.waitForSelector('[data-testid="admin-store-scope"]', { timeout: 5000 });
results.push({
  step: 'admin-summary',
  ok: await page.locator('text=Store: All stores').first().isVisible() && await page.locator('a:has-text("Stores")').isVisible(),
});

await page.getByTestId('admin-store-scope').selectOption('store-hyderabad');
await page.waitForTimeout(250);
results.push({ step: 'admin-store-scope', ok: await page.locator('text=Store: Banjara Hills').first().isVisible() });

await page.getByTestId('admin-signout').click();
await page.waitForTimeout(250);
results.push({ step: 'sign-out', ok: await page.locator('text=CULTIV Control').isVisible() });

await page.getByTestId('mode-store').click();
await page.getByTestId('store-select').selectOption('store-siddipet');
await page.getByTestId('store-pin-input').fill('240101');
await page.getByTestId('store-login-button').click();
await page.waitForURL(/\/admin\/summary/, { timeout: 5000 });
results.push({ step: 'store-summary', ok: await page.locator('text=Store: Siddipet Central').first().isVisible() });
results.push({ step: 'store-nav-no-stores-tab', ok: await page.locator('a:has-text("Stores")').count() === 0 });

await page.goto(`${baseUrl}/admin/stores`, { waitUntil: 'networkidle' });
await page.waitForTimeout(250);
results.push({ step: 'store-route-redirect', ok: page.url().endsWith('/admin/summary') });

console.log(JSON.stringify(results, null, 2));

const failed = results.filter((result) => !result.ok);
await browser.close();

if (failed.length > 0) {
  process.exitCode = 1;
}