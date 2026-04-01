import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4174';
const CUSTOMER_EMAIL = 'member@cultiv.app';
const CUSTOMER_PHONE = '9876543210';

const ADMIN_PIN = '240620';
const STORE_PIN_BY_ID = {
  'store-siddipet': '240101',
  'store-hyderabad': '240202',
};

const results = [];

const pass = (id, name, evidence = '') => results.push({ id, name, ok: true, evidence });
const fail = (id, name, evidence = '') => results.push({ id, name, ok: false, evidence });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readOrders = async (page) => page.evaluate(() => {
  const raw = localStorage.getItem('cultiv_orders_v2');
  return raw ? JSON.parse(raw) : [];
});

const seedAdminStores = async (page) => page.evaluate(() => {
  localStorage.setItem('cultiv_admin_stores_v1', JSON.stringify([
    {
      id: 'store-siddipet',
      name: 'Siddipet Central',
      city: 'Siddipet',
      code: 'SID-CEN',
      pin: '240101',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'store-hyderabad',
      name: 'Banjara Hills',
      city: 'Hyderabad',
      code: 'HYD-BAN',
      pin: '240202',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]));
});

const getCustomerId = async (page) => page.evaluate((email) => {
  const raw = localStorage.getItem('cultiv_users_v2');
  if (!raw) return null;
  const users = JSON.parse(raw);
  const user = users.find((entry) => entry.email === email);
  return user?.id ?? null;
}, CUSTOMER_EMAIL);

const loginCustomerByStorage = async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((email) => {
    const rawUsers = localStorage.getItem('cultiv_users_v2');
    if (!rawUsers) return;
    const users = JSON.parse(rawUsers);
    const user = users.find((entry) => entry.email === email);
    if (user) localStorage.setItem('cultiv_current_user_v2', JSON.stringify(user.id));
  }, CUSTOMER_EMAIL);
  await page.reload({ waitUntil: 'domcontentloaded' });
};

const seedCart = async (page, userId, index = 1) => {
  await page.evaluate(({ uid, idx }) => {
    const scopeKey = 'cultiv_active_draft_scope_v1';
    const scope = `user:${uid}`;
    localStorage.setItem(scopeKey, JSON.stringify(scope));
    const cartKey = `cultiv_order_draft_scope_v1:${scope}`;
    const lines = [
      {
        key: `item-smoke-${idx}`,
        itemId: `item-smoke-${idx}`,
        title: `Smoke Bowl ${idx}`,
        categoryName: 'Rice Bowls',
        unitPrice: 199 + idx,
        quantity: 1,
        selections: [{ section: 'Rice', choices: ['Brown Rice'] }],
      },
    ];
    localStorage.setItem(cartKey, JSON.stringify(lines));
  }, { uid: userId, idx: index });
};

const createWebsiteOrder = async (page, idx, { doubleClick = false, storeId = null } = {}) => {
  const before = await readOrders(page);
  const userId = await getCustomerId(page);
  await seedCart(page, userId, idx);

  await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
  if (storeId) {
    await page.getByTestId('order-store-select').selectOption(storeId);
  }
  await page.fill('input[placeholder="Full Name"]', `Website User ${idx}`);
  await page.fill('input[placeholder="Phone Number"]', CUSTOMER_PHONE);
  await page.fill('input[placeholder="Email Address"]', CUSTOMER_EMAIL);

  const placeBtn = page.getByRole('button', { name: /Place Order/i }).first();
  if (doubleClick) {
    await Promise.all([placeBtn.click(), placeBtn.click()]);
  } else {
    await placeBtn.click();
  }

  await sleep(1200);
  const after = await readOrders(page);
  const created = after.filter((entry) => !before.some((prev) => prev.id === entry.id));
  return { before, after, created, latest: created[0] ?? null };
};

const ensureAdminAccessGate = async (page) => {
  await page.goto(`${BASE}/admin/summary`, { waitUntil: 'networkidle' });

  const signOutVisible = await page.getByTestId('admin-signout').count();
  if (signOutVisible > 0) {
    await page.getByTestId('admin-signout').click();
    await page.waitForTimeout(250);
  }

  await page.goto(`${BASE}/admin/summary`, { waitUntil: 'networkidle' });
};

const loginAdminOwner = async (page) => {
  await ensureAdminAccessGate(page);
  await page.getByTestId('owner-pin-input').fill(ADMIN_PIN);
  await page.getByTestId('owner-login-button').click();
  await page.waitForSelector('[data-testid="admin-store-scope"]', { timeout: 5000 });
};

const loginStoreAdmin = async (page, storeId) => {
  await ensureAdminAccessGate(page);
  await page.getByTestId('mode-store').click();
  await page.getByTestId('store-select').selectOption(storeId);
  await page.getByTestId('store-pin-input').fill(STORE_PIN_BY_ID[storeId]);
  await page.getByTestId('store-login-button').click();
  await page.waitForURL(/\/admin\/summary/, { timeout: 5000 });
};

const openOrders = async (page, { requireOrders = true } = {}) => {
  await page.getByRole('link', { name: 'Orders' }).click();
  await page.waitForURL(/\/admin\/orders/, { timeout: 5000 });
  if (requireOrders) {
    await page.waitForSelector('[data-testid^="order-action-"]', { timeout: 5000 });
  }
};

const createWalkInOrder = async (page, idx) => {
  const before = await readOrders(page);

  await page.getByRole('link', { name: 'Counter / Billing' }).click();
  await page.waitForURL(/\/admin\/counter-billing/, { timeout: 5000 });
  await page.waitForSelector('[data-testid="counter-category-signature-bowls"]', { timeout: 5000 });

  await page.getByRole('button', { name: 'Customize' }).first().click();
  for (let step = 0; step < 8; step += 1) {
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if ((await nextBtn.count()) === 0 || !(await nextBtn.isVisible())) break;
    await nextBtn.click();
  }
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  await page.getByPlaceholder('10-digit phone').fill(`9000000${String(100 + idx).slice(-3)}`);
  await page.getByPlaceholder('Optional').fill(`Walkin ${idx}`);
  await page.getByTestId('payment-option-cash').click();
  await page.getByTestId('pay-now-button').click();
  await page.locator('text=Payment successful').first().waitFor({ timeout: 6000 });

  const after = await readOrders(page);
  const created = after.filter((entry) => !before.some((prev) => prev.id === entry.id));
  return { before, after, created, latest: created[0] ?? null };
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage({ viewport: { width: 1366, height: 860 } });

  // Reset local app state for deterministic run.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await seedAdminStores(page);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 1) Single website order
  try {
    await loginCustomerByStorage(page);
    const created = await createWebsiteOrder(page, 1, { storeId: 'store-hyderabad' });
    const order = created.latest;
    const ok = created.created.length === 1
      && order?.source === 'app'
      && order?.status === 'placed'
      && order?.storeId === 'store-hyderabad';
    const evidence = `created=${created.created.length}, source=${order?.source}, status=${order?.status}, store=${order?.storeId}`;
    ok ? pass('I1', 'Single website order', evidence) : fail('I1', 'Single website order', evidence);
  } catch (error) {
    fail('I1', 'Single website order', String(error?.message ?? error));
  }

  // 2) Multiple website orders
  try {
    await loginCustomerByStorage(page);
    const first = await createWebsiteOrder(page, 2);
    const second = await createWebsiteOrder(page, 3);
    const ok = first.created.length === 1 && second.created.length === 1;
    const evidence = `run1=${first.created.length}, run2=${second.created.length}`;
    ok ? pass('I2', 'Multiple website orders', evidence) : fail('I2', 'Multiple website orders', evidence);
  } catch (error) {
    fail('I2', 'Multiple website orders', String(error?.message ?? error));
  }

  // 3) Single walk-in order
  try {
    await loginStoreAdmin(page, 'store-siddipet');
    const created = await createWalkInOrder(page, 1);
    const order = created.latest;
    const ok = created.created.length === 1 && order?.source === 'walk-in' && order?.storeId === 'store-siddipet';
    const evidence = `created=${created.created.length}, source=${order?.source}, store=${order?.storeId}, payment=${order?.paymentMethod}`;
    ok ? pass('I3', 'Single walk-in order', evidence) : fail('I3', 'Single walk-in order', evidence);
  } catch (error) {
    fail('I3', 'Single walk-in order', String(error?.message ?? error));
  }

  // 4) Multiple walk-in orders
  try {
    await loginStoreAdmin(page, 'store-siddipet');
    const first = await createWalkInOrder(page, 2);
    const second = await createWalkInOrder(page, 3);
    const ok = first.created.length === 1 && second.created.length === 1;
    const evidence = `run1=${first.created.length}, run2=${second.created.length}`;
    ok ? pass('I4', 'Multiple walk-in orders', evidence) : fail('I4', 'Multiple walk-in orders', evidence);
  } catch (error) {
    fail('I4', 'Multiple walk-in orders', String(error?.message ?? error));
  }

  // 5) Website + walk-in together in same Orders board with clear source
  let mixedTargetOrderId = null;
  try {
    await loginAdminOwner(page);
    await openOrders(page);

    const allOrders = await readOrders(page);
    const websiteCount = allOrders.filter((entry) => entry.source === 'app').length;
    const walkinCount = allOrders.filter((entry) => entry.source === 'walk-in').length;
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasWebsiteBadgeCopy = /website/i.test(pageText);
    const hasWalkInBadgeCopy = /walk-?in/i.test(pageText);

    mixedTargetOrderId = allOrders.find((entry) => entry.storeId === 'store-siddipet' && entry.source === 'app')?.id ?? null;

    const ok = websiteCount > 0 && walkinCount > 0 && hasWebsiteBadgeCopy && hasWalkInBadgeCopy;
    const evidence = `websiteOrders=${websiteCount}, walkinOrders=${walkinCount}, hasWebsiteText=${hasWebsiteBadgeCopy}, hasWalkinText=${hasWalkInBadgeCopy}`;
    ok ? pass('I5', 'Website + walk-in together', evidence) : fail('I5', 'Website + walk-in together', evidence);
  } catch (error) {
    fail('I5', 'Website + walk-in together', String(error?.message ?? error));
  }

  // 6) Refresh during transitions
  try {
    await loginAdminOwner(page);
    await openOrders(page);

    const allOrders = await readOrders(page);
    const target = allOrders.find((entry) => entry.storeId === 'store-siddipet' && entry.source === 'app' && entry.status === 'placed');
    if (!target) throw new Error('No placed website order available for transition test.');

    await page.getByTestId(`order-action-${target.id}`).first().click();
    await sleep(500);
    await page.reload({ waitUntil: 'networkidle' });

    const after = await readOrders(page);
    const updated = after.find((entry) => entry.id === target.id);
    const ok = updated?.status === 'preparing';
    const evidence = `order=${target.id}, statusAfterReload=${updated?.status}`;
    ok ? pass('I6', 'Refresh during transitions', evidence) : fail('I6', 'Refresh during transitions', evidence);
  } catch (error) {
    fail('I6', 'Refresh during transitions', String(error?.message ?? error));
  }

  // 7) Wrong store protection
  try {
    await loginStoreAdmin(page, 'store-hyderabad');
    await openOrders(page, { requireOrders: false });

    const allOrders = await readOrders(page);
    const siddipetOrder = allOrders.find((entry) => entry.storeId === 'store-siddipet');
    if (!siddipetOrder) throw new Error('No Siddipet order found for store-scope isolation check.');

    const visible = (await page.getByTestId(`order-action-${siddipetOrder.id}`).count()) > 0;
    const ok = !visible;
    const evidence = `siddipetOrderVisibleInHyderabadScope=${visible}`;
    ok ? pass('I7', 'Wrong store protection', evidence) : fail('I7', 'Wrong store protection', evidence);
  } catch (error) {
    fail('I7', 'Wrong store protection', String(error?.message ?? error));
  }

  // 8) Duplicate click prevention (website)
  try {
    await loginCustomerByStorage(page);
    const created = await createWebsiteOrder(page, 9, { doubleClick: true });
    const ok = created.created.length === 1;
    const evidence = `ordersCreatedOnDoubleClick=${created.created.length}`;
    ok ? pass('I8', 'Duplicate click prevention', evidence) : fail('I8', 'Duplicate click prevention', evidence);
  } catch (error) {
    fail('I8', 'Duplicate click prevention', String(error?.message ?? error));
  }

  // 9) Status persistence after reload
  let completionTarget = null;
  try {
    await loginAdminOwner(page);
    await openOrders(page);

    const allOrders = await readOrders(page);
    const target = allOrders.find((entry) => entry.storeId === 'store-siddipet' && entry.status === 'preparing')
      ?? allOrders.find((entry) => entry.storeId === 'store-siddipet' && entry.status === 'placed');
    if (!target) throw new Error('No transitionable order found for persistence scenario.');

    if (target.status === 'placed') {
      await page.getByTestId(`order-action-${target.id}`).first().click();
      await sleep(500);
    }
    await page.getByTestId(`order-action-${target.id}`).first().click(); // preparing -> ready_for_pickup
    await sleep(500);

    await page.reload({ waitUntil: 'networkidle' });
    const after = await readOrders(page);
    const updated = after.find((entry) => entry.id === target.id);
    completionTarget = updated?.id ?? null;

    const ok = updated?.status === 'ready_for_pickup';
    const evidence = `order=${target.id}, statusAfterReload=${updated?.status}`;
    ok ? pass('I9', 'Status persistence after reload', evidence) : fail('I9', 'Status persistence after reload', evidence);
  } catch (error) {
    fail('I9', 'Status persistence after reload', String(error?.message ?? error));
  }

  // 10) Final pickup completion flow
  try {
    await loginAdminOwner(page);
    await openOrders(page);

    if (!completionTarget) {
      const all = await readOrders(page);
      completionTarget = all.find((entry) => entry.status === 'ready_for_pickup')?.id ?? null;
    }
    if (!completionTarget) throw new Error('No ready_for_pickup order found for completion flow.');

    await page.getByTestId(`order-action-${completionTarget}`).first().click(); // open confirm panel
    await page.getByRole('button', { name: 'Confirm Picked Up' }).click();
    await sleep(500);

    const after = await readOrders(page);
    const updated = after.find((entry) => entry.id === completionTarget);
    const ok = updated?.status === 'completed';
    const evidence = `order=${completionTarget}, finalStatus=${updated?.status}`;
    ok ? pass('I10', 'Final pickup completion flow', evidence) : fail('I10', 'Final pickup completion flow', evidence);
  } catch (error) {
    fail('I10', 'Final pickup completion flow', String(error?.message ?? error));
  }

  await browser.close();

  console.log(JSON.stringify(results, null, 2));

  const failed = results.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await run();
