import { chromium } from 'playwright';

const STORE_TEST_PIN = process.env.STORE_TEST_PIN?.trim();

if (!STORE_TEST_PIN) {
  throw new Error('Missing required environment variable: STORE_TEST_PIN');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173/operations', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });

await page.getByTestId('mode-store').click();
await page.getByTestId('store-pin-input').fill(STORE_TEST_PIN);
await page.getByTestId('store-login-button').click();
await page.waitForTimeout(1500);

const url = page.url();

const message = await page.locator('text=workspace is ready').first().textContent().catch(() => null);
const session = await page.evaluate(() => localStorage.getItem('cultiv_admin_access_session_v1'));

console.log('url=', url);
console.log('message=', message);
console.log('session_present=', Boolean(session));

await browser.close();
