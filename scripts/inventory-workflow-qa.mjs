import { chromium } from 'playwright';

const ADMIN_OWNER_PIN = process.env.ADMIN_OWNER_PIN ?? '240620';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.goto('http://127.0.0.1:5173/admin/summary', { waitUntil: 'domcontentloaded' });
await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
await page.getByTestId('owner-login-button').click();
await page.locator('text=Role:').first().waitFor({ timeout: 5000 });

const nav = page.locator('aside');
await nav.getByRole('link', { name: 'Inventory' }).click();
await page.waitForURL(/admin\/inventory/);
await page.locator('h1:has-text("Keep the line stocked without clutter.")').first().waitFor({ timeout: 5000 });

const queue = page.locator('section:has-text("Low Stock Action Queue")');
const cards = queue.locator('article');
const cardCount = await cards.count();
let firstCardText = '';
if (cardCount > 0) {
  firstCardText = (await cards.first().textContent()) ?? '';
}

const beforeShowingText = await page.locator('text=/Showing\\s+\\d+/').first().textContent();

const firstPlusFive = queue.getByRole('button', { name: '+5' }).first();
if (await firstPlusFive.isVisible().catch(() => false)) {
  await firstPlusFive.click();
  await page.waitForTimeout(220);
}

const secondPlusTen = queue.getByRole('button', { name: '+10' }).nth(1);
if (await secondPlusTen.isVisible().catch(() => false)) {
  await secondPlusTen.click();
  await page.waitForTimeout(220);
}

const adjustButtons = await queue.getByRole('button', { name: 'Adjust' }).count();
const thresholdButtons = await page.getByRole('button', { name: 'Threshold' }).count();
const afterShowingText = await page.locator('text=/Showing\\s+\\d+/').first().textContent();

console.log(JSON.stringify({
  cardCount,
  outOfStockFirst: /out of stock/i.test(firstCardText),
  quickAdjustPresent: cardCount > 0,
  adjustButtons,
  thresholdButtons,
  allInventoryVisible: await page.locator('text=All Inventory Items').count() > 0,
  beforeShowingText,
  afterShowingText,
}, null, 2));

await browser.close();
