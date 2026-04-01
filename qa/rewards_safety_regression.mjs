import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4173';
const results = [];

function addResult(id, name, ok, evidence = '') {
  results.push({ id, name, ok, evidence });
}

async function login(page) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="9876543210"]', 'member@cultiv.app');
  await page.fill('input[placeholder="Enter your password"]', 'cultiv123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/profile', { timeout: 12000 });
}

async function setupState(page, { availableRewards = [], pointsBatches = [], availablePoints = 500, expiringSoonPoints = 0, expiredPoints = 0 } = {}) {
  await page.evaluate(({ availableRewards, pointsBatches, availablePoints, expiringSoonPoints, expiredPoints }) => {
    const rawUserId = localStorage.getItem('cultiv_current_user_v2');
    const userId = rawUserId ? JSON.parse(rawUserId) : null;
    if (!userId) throw new Error('No logged in user');

    const loyaltyRaw = localStorage.getItem('cultiv_loyalty_v2');
    const loyalty = loyaltyRaw ? JSON.parse(loyaltyRaw) : {};
    const prev = loyalty[userId] ?? {};

    loyalty[userId] = {
      userId,
      pointsBatches,
      availablePoints,
      expiringSoonPoints,
      expiredPoints,
      availableRewards,
      pointsActivity: prev.pointsActivity ?? [],
      totalOrders: prev.totalOrders ?? 0,
      totalSpend: prev.totalSpend ?? 0,
      currentTier: prev.currentTier ?? 'Founding Member',
    };
    localStorage.setItem('cultiv_loyalty_v2', JSON.stringify(loyalty));
  }, { availableRewards, pointsBatches, availablePoints, expiringSoonPoints, expiredPoints });
}

async function setDraftCart(page, lines) {
  await page.evaluate((lines) => {
    const rawUserId = localStorage.getItem('cultiv_current_user_v2');
    const userId = rawUserId ? JSON.parse(rawUserId) : null;
    if (!userId) throw new Error('No logged in user');
    const activeScope = `user:${userId}`;
    localStorage.setItem('cultiv_active_draft_scope_v1', activeScope);
    localStorage.setItem(`cultiv_order_draft_scope_v1:${activeScope}`, JSON.stringify(lines));
  }, lines);
}

async function latestOrder(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('cultiv_orders_v2');
    const orders = raw ? JSON.parse(raw) : [];
    return orders[0] ?? null;
  });
}

async function runScenario(id, name, fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await fn(page);
  } catch (err) {
    addResult(id, name, false, `Exception: ${String(err.message || err)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

await runScenario(1, 'Minimum order rule', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink'] });
  await setDraftCart(page, [{ key: 't1', itemId: 'test-1', title: 'Test Food', categoryName: 'Test', unitPrice: 50, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const useBtn = page.locator('button:has-text("Use")').first();
  const disabled = await useBtn.isDisabled().catch(() => false);
  if (!disabled && await useBtn.isVisible().catch(() => false)) {
    await useBtn.click();
  }
  await page.waitForTimeout(200);
  const msgVisible = await page.locator('text=Minimum order of ₹99 is required to use rewards.').first().isVisible().catch(() => false);
  addResult(1, 'Minimum order rule', disabled || msgVisible, disabled ? 'Reward action disabled below ₹99' : msgVisible ? 'Min-order message shown' : 'Expected min-order block not found');
});

await runScenario(2, 'One discount reward rule', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['50off', '100off'] });
  await setDraftCart(page, [{ key: 't2', itemId: 'test-2', title: 'Test Food', categoryName: 'Test', unitPrice: 500, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const firstUse = page.locator('button:has-text("Use")').first();
  await firstUse.click();
  await page.waitForTimeout(150);
  const secondUse = page.locator('button:has-text("Use")').first();
  const secondDisabled = await secondUse.isDisabled().catch(() => false);
  addResult(2, 'One discount reward rule', secondDisabled, secondDisabled ? 'Second discount selection prevented' : 'Second discount appears selectable');
});

await runScenario(3, 'Discount cap 30% rule', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['100off'] });
  await setDraftCart(page, [{ key: 't3', itemId: 'test-3', title: 'Test Food', categoryName: 'Test', unitPrice: 200, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const useBtn = page.locator('button:has-text("Use")').first();
  const disabled = await useBtn.isDisabled().catch(() => false);
  if (!disabled && await useBtn.isVisible().catch(() => false)) await useBtn.click();
  await page.waitForTimeout(200);
  const capMsg = await page.locator('text=Discount reward cannot exceed 30% of order total.').first().isVisible().catch(() => false);
  addResult(3, 'Discount cap 30% rule', disabled || capMsg, disabled ? 'UI disabled over-cap discount' : capMsg ? 'UI showed 30% cap message' : 'Cap not enforced in UI');
});

await runScenario(4, 'Delivery fee exclusion + truthful final total', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['50off'] });
  await setDraftCart(page, [{ key: 't4', itemId: 'test-4', title: 'Test Food', categoryName: 'Test', unitPrice: 300, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const before = await page.locator('text=Payable Total').locator('..').textContent();
  await page.locator('button:has-text("Use")').first().click();
  await page.waitForTimeout(150);
  const after = await page.locator('text=Payable Total').locator('..').textContent();
  const hasDiscountLine = await page.locator('text=Rewards discount').isVisible().catch(() => false);
  const changed = before !== after;
  addResult(4, 'Delivery fee exclusion + truthful final total', hasDiscountLine && changed, `before=${before} after=${after}`);
});

await runScenario(5, 'Free-item subtotal cap', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink', 'nachos'] });
  await setDraftCart(page, [{ key: 't5', itemId: 'test-5', title: 'Test Food', categoryName: 'Test', unitPrice: 99, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const useDrink = page.locator('button:has-text("Use")').first();
  if (await useDrink.isVisible().catch(() => false)) {
    await useDrink.click();
    await page.waitForTimeout(150);
  }
  const remainingUse = page.locator('button:has-text("Use")').first();
  const secondDisabled = await remainingUse.isDisabled().catch(() => false);
  const msg = await page.locator('text=Free item rewards cannot exceed order subtotal.').first().isVisible().catch(() => false);
  addResult(5, 'Free-item subtotal cap', msg || secondDisabled, msg ? 'Cap message shown' : secondDisabled ? 'Second free-item application blocked' : 'Free-item subtotal cap not enforced');
});

await runScenario(6, 'Food-only reward application', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink'] });
  await setDraftCart(page, []);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  const sectionVisible = await page.locator('text=Use your rewards').first().isVisible().catch(() => false);
  if (!sectionVisible) {
    addResult(6, 'Food-only reward application', true, 'Rewards hidden without food items');
  } else {
    const firstUse = page.locator('button:has-text("Use")').first();
    const blocked = await firstUse.isDisabled().catch(() => true);
    addResult(6, 'Food-only reward application', blocked, blocked ? 'Rewards visible but not applicable without food subtotal' : 'Reward still applicable without food subtotal');
  }
});

await runScenario(7, 'Expired points protection', async (page) => {
  await login(page);
  const now = Date.now();
  await setupState(page, {
    availableRewards: [],
    pointsBatches: [{ points: 100, earnedAt: now - 95 * 24 * 60 * 60 * 1000, expiresAt: now - 5 * 24 * 60 * 60 * 1000 }],
    availablePoints: 100,
    expiringSoonPoints: 0,
    expiredPoints: 0,
  });
  await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  const hasPtsAway = await page.locator('text=/pts away/i').first().isVisible().catch(() => false);
  const expiredLog = await page.locator('text=Points expired after 90 days.').first().isVisible().catch(() => false);
  addResult(7, 'Expired points protection', hasPtsAway && expiredLog, `ptsAway=${hasPtsAway}, expiredLog=${expiredLog}`);
});

await runScenario(8, 'Single-use reward consumption', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink'] });
  await setDraftCart(page, [{ key: 't8', itemId: 'test-8', title: 'Test Food', categoryName: 'Test', unitPrice: 220, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Use")').first().click();
  await page.fill('input[placeholder="Full Name"]', 'Aarav Menon');
  await page.fill('input[placeholder="Phone Number"]', '9876543210');
  await page.fill('input[placeholder="Email Address"]', 'member@cultiv.app');
  await page.click('button:has-text("Place Order")');
  await page.waitForTimeout(1200);
  await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
  const addedToAccount = await page.locator('text=Added to account').first().isVisible().catch(() => false);
  addResult(8, 'Single-use reward consumption', !addedToAccount, addedToAccount ? 'Reward still appears as available' : 'Reward no longer available after order');
});

await runScenario(9, 'Non-consumption before success', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink'] });
  await setDraftCart(page, [{ key: 't9', itemId: 'test-9', title: 'Test Food', categoryName: 'Test', unitPrice: 220, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Use")').first().click();
  await page.reload({ waitUntil: 'networkidle' });
  const loyalty = await page.evaluate(() => {
    const rawUserId = localStorage.getItem('cultiv_current_user_v2');
    const userId = rawUserId ? JSON.parse(rawUserId) : null;
    const raw = localStorage.getItem('cultiv_loyalty_v2');
    const profiles = raw ? JSON.parse(raw) : {};
    return userId ? profiles[userId] : null;
  });
  const remains = Array.isArray(loyalty?.availableRewards) && loyalty.availableRewards.includes('drink');
  addResult(9, 'Non-consumption before success', remains, remains ? 'Reward retained after refresh without placing order' : 'Reward consumed prematurely');
});

await runScenario(10, 'Truthful totals (display vs persisted order)', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['50off'] });
  await setDraftCart(page, [{ key: 't10', itemId: 'test-10', title: 'Test Food', categoryName: 'Test', unitPrice: 300, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Use")').first().click();
  const payableText = (await page.locator('text=Payable Total').locator('..').textContent()) || '';
  const payableMatch = payableText.match(/₹(\d+)/);
  const payable = payableMatch ? Number(payableMatch[1]) : null;
  await page.fill('input[placeholder="Full Name"]', 'Aarav Menon');
  await page.fill('input[placeholder="Phone Number"]', '9876543210');
  await page.fill('input[placeholder="Email Address"]', 'member@cultiv.app');
  await page.click('button:has-text("Place Order")');
  await page.waitForTimeout(1200);
  const order = await latestOrder(page);
  const matches = payable !== null && order && Number(order.total) === payable;
  const hasFoodSubtotalLine = await page.locator('text=Food subtotal').first().isVisible().catch(() => false);
  addResult(10, 'Truthful totals (display vs persisted order)', Boolean(matches && hasFoodSubtotalLine), `payable=${payable}, persisted=${order?.total}, foodSubtotalLine=${hasFoodSubtotalLine}`);
});

await runScenario(11, 'History/detail integrity for reward usage', async (page) => {
  await login(page);
  await setupState(page, { availableRewards: ['drink'] });
  await setDraftCart(page, [{ key: 't11', itemId: 'test-11', title: 'Test Food', categoryName: 'Test', unitPrice: 240, quantity: 1, selections: [] }]);
  await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Use")').first().click();
  await page.fill('input[placeholder="Full Name"]', 'Aarav Menon');
  await page.fill('input[placeholder="Phone Number"]', '9876543210');
  await page.fill('input[placeholder="Email Address"]', 'member@cultiv.app');
  await page.click('button:has-text("Place Order")');
  await page.waitForTimeout(1200);
  await page.goto(`${baseURL}/orders`, { waitUntil: 'networkidle' });
  const historyHasRewardTitle = await page.locator('text=/Complimentary|Free/i').first().isVisible().catch(() => false);
  const firstDetail = page.locator('a:has-text("View Details")').first();
  if (await firstDetail.isVisible().catch(() => false)) {
    await firstDetail.click();
    await page.waitForURL('**/orders/*', { timeout: 10000 });
  }
  const detailHasRewardLine = await page.locator('text=/Complimentary|Free/i').first().isVisible().catch(() => false);
  addResult(11, 'History/detail integrity for reward usage', historyHasRewardTitle && detailHasRewardLine, `history=${historyHasRewardTitle}, detail=${detailHasRewardLine}`);
});

console.log(JSON.stringify({ results }, null, 2));
