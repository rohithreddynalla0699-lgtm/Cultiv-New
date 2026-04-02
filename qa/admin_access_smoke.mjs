import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4174';
const ADMIN_OWNER_PIN = process.env.ADMIN_OWNER_PIN ?? '240620';
const STORE_PIN_BY_ID = {
  'store-siddipet': process.env.STORE_PIN_SIDDIPET ?? '111111',
  'store-hyderabad': process.env.STORE_PIN_HYDERABAD ?? '222222',
  'store-warangal': process.env.STORE_PIN_WARANGAL ?? '333333',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.removeItem('cultiv_admin_access_session_v1');
});

await page.goto(`${baseUrl}/admin/summary`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="mode-owner"]', { timeout: 5000 });
results.push({ step: 'access-gate', ok: await page.getByTestId('mode-owner').isVisible() && await page.getByTestId('mode-store').isVisible() });

await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
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
await page.getByTestId('store-pin-input').fill(STORE_PIN_BY_ID['store-siddipet']);
await page.getByTestId('store-login-button').click();
await page.waitForURL(/\/admin\/summary/, { timeout: 5000 });
results.push({ step: 'store-summary', ok: await page.locator('text=Store: Siddipet Central').first().isVisible() });
results.push({ step: 'store-nav-no-stores-tab', ok: await page.locator('a:has-text("Stores")').count() === 0 });

await page.goto(`${baseUrl}/admin/stores`, { waitUntil: 'domcontentloaded' });
await page.waitForURL(/\/admin\/summary/, { timeout: 5000 }).catch(() => {});
results.push({ step: 'store-route-redirect', ok: page.url().endsWith('/admin/summary') });

console.log(JSON.stringify(results, null, 2));

const failed = results.filter((result) => !result.ok);
await browser.close();

if (failed.length > 0) {
  process.exitCode = 1;
}