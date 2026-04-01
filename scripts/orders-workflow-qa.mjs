import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

const now = Date.now();
const makeOrder = (id, status, mins) => ({
  id,
  storeId: 'store-siddipet',
  category: 'Lunch Bowl',
  items: [
    {
      id: `${id}-i1`,
      orderId: id,
      category: 'Bowls',
      title: 'Classic Chicken Bowl',
      selections: [],
      quantity: 1,
      price: 249,
    },
    {
      id: `${id}-i2`,
      orderId: id,
      category: 'Bowls',
      title: 'Brown Rice Base',
      selections: [],
      quantity: 1,
      price: 0,
    },
  ],
  orderType: 'pickup',
  subtotal: 249,
  rewardDiscount: 0,
  total: 249,
  status,
  createdAt: new Date(now - mins * 60000).toISOString(),
  phone: '9876500099',
  fullName: `QA ${id}`,
  email: 'qa@cultiv.app',
  source: 'app',
  fulfillmentWindow: '12:30 PM - 12:45 PM',
  statusTimeline: [
    {
      status: 'placed',
      label: 'Order Placed',
      description: 'In queue',
      at: new Date(now - mins * 60000).toISOString(),
    },
  ],
});

await page.goto('http://127.0.0.1:5173/admin/summary', { waitUntil: 'domcontentloaded' });

await page.evaluate((orders) => {
  localStorage.setItem('cultiv_orders_v2', JSON.stringify(orders));
}, [
  makeOrder('ord-qa-1', 'placed', 16),
  makeOrder('ord-qa-2', 'preparing', 9),
  makeOrder('ord-qa-3', 'ready_for_pickup', 5),
  makeOrder('ord-qa-4', 'completed', 2),
]);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Owner Login' }).click();
await page.getByPlaceholder('6-digit owner PIN').fill('240620');
await page.getByRole('button', { name: 'Open owner panel' }).click();
await page.locator('text=Role:').first().waitFor({ timeout: 5000 });

const nav = page.locator('aside');
await nav.getByRole('link', { name: 'Orders' }).click();
await page.waitForURL(/admin\/orders/);
await page.locator('h1:has-text("Move pickup orders through the line.")').first().waitFor({ timeout: 5000 });

const before = {
  primaryButtons: await page.locator('button:has-text("Start Preparing"),button:has-text("Mark Ready"),button:has-text("Mark Picked Up")').count(),
  noteLinks: await page.locator('button:has-text("+ Add note"),button:has-text("Edit note")').count(),
  noteInputs: await page.locator('input[placeholder="Add pickup note"]').count(),
  waitingTags: await page.locator('text=/Waiting\\s+\\d+\\s+min/i').count(),
};

let transitions = 0;
for (const label of ['Start Preparing', 'Mark Ready', 'Mark Picked Up']) {
  const button = page.getByRole('button', { name: label }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(220);
    transitions += 1;
  }
}

const after = {
  transitions,
  newCount: await page.locator('section:has-text("New") article').count(),
  preparingCount: await page.locator('section:has-text("Preparing") article').count(),
  readyCount: await page.locator('section:has-text("Ready") article').count(),
  pickedUpCount: await page.locator('section:has-text("Picked Up") article').count(),
};

console.log(JSON.stringify({ before, after }, null, 2));
await browser.close();
