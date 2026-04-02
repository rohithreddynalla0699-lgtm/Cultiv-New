import { chromium } from 'playwright';

const ADMIN_OWNER_PIN = process.env.ADMIN_OWNER_PIN ?? '240620';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.goto('http://127.0.0.1:5173/admin/summary', { waitUntil: 'domcontentloaded' });
await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
await page.getByTestId('owner-login-button').click();
await page.locator('text=Role:').first().waitFor({ timeout: 5000 });

const nav = page.locator('aside');
await nav.getByRole('link', { name: 'Employees' }).click();
await page.waitForURL(/admin\/employees/);
await page.locator('h1:has-text("Track shifts with one tap.")').first().waitFor({ timeout: 5000 });

const startButtons = page.getByRole('button', { name: 'Start Shift' });
const endButtons = page.getByRole('button', { name: 'End Shift' });
const showHistoryButtons = page.getByRole('button', { name: 'Show history' });

const startCount = await startButtons.count();
const endCount = await endButtons.count();
const showHistoryCount = await showHistoryButtons.count();

if (startCount > 0) {
  await startButtons.first().click();
  await page.waitForTimeout(220);
}
if (endCount > 0) {
  await endButtons.first().click();
  await page.waitForTimeout(220);
}

if (showHistoryCount > 0) {
  await showHistoryButtons.first().click();
  await page.waitForTimeout(220);
}

const loginWordButtons = await page.getByRole('button', { name: /Log In|Log Out/ }).count();
const hoursMetricsVisible =
  (await page.locator('text=Today').count()) > 0 &&
  (await page.locator('text=This week').count()) > 0 &&
  (await page.locator('text=This month').count()) > 0;

console.log(JSON.stringify({
  startCount,
  endCount,
  showHistoryCount,
  loginWordButtons,
  hoursMetricsVisible,
  historyExpandedNow: await page.getByRole('button', { name: 'Hide history' }).count() > 0,
}, null, 2));

await browser.close();
