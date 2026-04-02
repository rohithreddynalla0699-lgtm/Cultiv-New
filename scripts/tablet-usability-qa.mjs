import { chromium } from 'playwright';

const ADMIN_OWNER_PIN = process.env.ADMIN_OWNER_PIN ?? '240620';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

await page.goto('http://127.0.0.1:5173/admin/summary', { waitUntil: 'domcontentloaded' });
await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
await page.getByTestId('owner-login-button').click();
await page.locator('text=Role:').first().waitFor({ timeout: 5000 });

const nav = page.locator('aside');

await nav.getByRole('link', { name: 'Inventory' }).click();
await page.waitForURL(/admin\/inventory/);
const inventoryPrimaryHeights = await page.locator('button:has-text("+1"), button:has-text("+5"), button:has-text("+10"), button:has-text("+20")').evaluateAll((nodes) => nodes.slice(0, 8).map((n) => getComputedStyle(n).height));

await nav.getByRole('link', { name: 'Employees' }).click();
await page.waitForURL(/admin\/employees/);
const employeePrimaryHeight = await page.getByRole('button', { name: /Start Shift|End Shift/ }).first().evaluate((n) => getComputedStyle(n).height).catch(() => null);

await nav.getByRole('link', { name: 'Orders' }).click();
await page.waitForURL(/admin\/orders/);
const pageHeight = await page.evaluate(() => document.body.scrollHeight);

console.log(JSON.stringify({
  viewport: { width: 1024, height: 768 },
  inventoryPrimaryHeights,
  employeePrimaryHeight,
  ordersScrollHeight: pageHeight,
  contextVisible: (await page.locator('text=Store:').count()) > 0 && (await page.locator('text=Role:').count()) > 0 && (await page.locator('text=Page:').count()) > 0,
}, null, 2));

await browser.close();
