import { chromium } from 'playwright';

const baseUrl = process.env.CULTIV_BASE_URL ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const log = {
  navTabPresent: false,
  categoriesVisible: false,
  customizedItemAdded: false,
  tipApplied: false,
  billed: false,
  orderInBoard: false,
  walkInBadgeVisible: false,
  cartCleared: false,
  scopedStoreLabelSeen: false,
};

await page.goto(`${baseUrl}/admin/summary`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Store Login' }).click();
await page.getByRole('combobox').first().selectOption('store-siddipet');
await page.getByPlaceholder('Store PIN').fill('240101');
await page.getByRole('button', { name: 'Open store workspace' }).click();
await page.locator('text=Role: Store').first().waitFor({ timeout: 5000 });

log.navTabPresent = (await page.getByRole('link', { name: 'Counter / Billing' }).count()) > 0;

await page.getByRole('link', { name: 'Counter / Billing' }).click();
await page.waitForURL(/admin\/counter-billing/);
await page.waitForSelector('[data-testid="counter-category-signature-bowls"]', { timeout: 5000 });

log.categoriesVisible = (await page.getByRole('button', { name: /Signature/ }).count()) > 0
  && (await page.getByRole('button', { name: /Breakfast/ }).count()) > 0
  && (await page.getByRole('button', { name: /Drinks/ }).count()) > 0;

await page.getByRole('button', { name: 'Customize' }).first().click();
for (let step = 0; step < 8; step += 1) {
  const nextButton = page.getByRole('button', { name: 'Next' });
  if (await nextButton.count() === 0 || !(await nextButton.isVisible())) {
    break;
  }
  await nextButton.click();
}
await page.getByRole('button', { name: 'Add to Cart' }).click();
await page.locator('text=added to cart').first().waitFor({ timeout: 5000 });
log.customizedItemAdded = (await page.locator('text=Everyday').count()) > 0;

await page.getByTestId('counter-category-drinks-juices').click();
await page.getByRole('button', { name: 'Add' }).first().click();

await page.getByPlaceholder('10-digit phone').fill('9876543210');
await page.getByPlaceholder('Optional').fill('Counter Guest');
await page.getByRole('button', { name: '10%' }).click();
log.tipApplied = (await page.locator('text=Tip').count()) > 0;
await page.getByTestId('payment-option-cash').click();
await page.getByTestId('skip-phone-button').click();
await page.getByTestId('pay-now-button').click();
await page.locator('text=Payment Successful').first().waitFor({ timeout: 5000 });
log.billed = true;

log.cartCleared = (await page.locator('text=Cart is empty. Add real CULTIV items from the left.').count()) > 0;

await page.getByRole('link', { name: 'Orders' }).click();
await page.waitForURL(/admin\/orders/);

log.walkInBadgeVisible = (await page.locator('text=WALK-IN').count()) > 0;
log.orderInBoard = log.walkInBadgeVisible;
log.scopedStoreLabelSeen = (await page.locator('text=Store: Siddipet Central').count()) > 0;

console.log(JSON.stringify(log, null, 2));
await browser.close();
