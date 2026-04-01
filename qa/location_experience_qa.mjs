import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';

const checks = [];
const pass = (id, detail) => checks.push({ id, ok: true, detail });
const fail = (id, detail) => checks.push({ id, ok: false, detail });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    geolocation: { latitude: 10, longitude: 10 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    await page.click('button:has-text("Store")');
    await page.waitForSelector('text=Select your nearest CULTIV store');

    const hasSelectButton = (await page.locator('button:has-text("Select")').count()) > 0;
    if (!hasSelectButton) {
      pass('L1', 'No explicit Select button in modal cards');
    } else {
      fail('L1', 'Found Select button in location modal');
    }

    await page.click('button:has-text("Banjara Hills")');
    await page.waitForTimeout(200);

    const headerLabel = (await page.locator('header').innerText()).toLowerCase();
    if (headerLabel.includes('banjara hills')) {
      pass('L2', 'Header store label updates after card click');
    } else {
      fail('L2', 'Header store label did not update to Banjara Hills');
    }

    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
    const pickupText = (await page.locator('[data-testid="order-store-select"]').innerText()).toLowerCase();
    if (pickupText.includes('banjara hills') && pickupText.includes('500034')) {
      pass('L3', 'Order checkout pickup block reflects selected store');
    } else {
      fail('L3', `Order pickup block not synced. text=${pickupText}`);
    }

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("Banjara Hills")');
    await page.waitForSelector('text=Select your nearest CULTIV store');
    await page.click('button:has-text("Use My Location")');
    await page.waitForTimeout(400);

    const message = (await page.locator('text=No stores nearby for your current location.').count()) > 0;
    if (message) {
      pass('L4', 'Use my location shows no nearby stores when out-of-range');
    } else {
      fail('L4', 'No-nearby-stores message not shown for out-of-range geolocation');
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('\nLOCATION EXPERIENCE QA REPORT');
  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✗'} [${check.id}] ${check.detail}`);
  }
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
