import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright';

const SYNC_PORT = Number(process.env.SYNC_PORT ?? 3748);
const APP_PORT = Number(process.env.APP_PORT ?? 4176);
const SYNC_URL = `http://127.0.0.1:${SYNC_PORT}`;
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;

const ADMIN_PIN = '240620';
const CUSTOMER_EMAIL = 'member@cultiv.app';
const CUSTOMER_PHONE = '9876543210';

const waitForUrl = async (url, timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timeout waiting for ${url}`);
};

const seedStores = async (page) => {
  await page.evaluate(() => {
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
};

const loginCustomerByStorage = async (page) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((email) => {
    const rawUsers = localStorage.getItem('cultiv_users_v2');
    if (!rawUsers) return;
    const users = JSON.parse(rawUsers);
    const user = users.find((entry) => entry.email === email);
    if (user) localStorage.setItem('cultiv_current_user_v2', JSON.stringify(user.id));
  }, CUSTOMER_EMAIL);
  await page.reload({ waitUntil: 'domcontentloaded' });
};

const seedCart = async (page, idx = 1) => {
  await page.evaluate((index) => {
    const userIdRaw = localStorage.getItem('cultiv_current_user_v2');
    if (!userIdRaw) return;
    const userId = JSON.parse(userIdRaw);
    const scope = `user:${userId}`;

    localStorage.setItem('cultiv_active_draft_scope_v1', JSON.stringify(scope));
    localStorage.setItem(`cultiv_order_draft_scope_v1:${scope}`, JSON.stringify([
      {
        key: `sync-item-${index}`,
        itemId: `sync-item-${index}`,
        title: `Sync Bowl ${index}`,
        categoryName: 'Rice Bowls',
        unitPrice: 209,
        quantity: 1,
        selections: [{ section: 'Rice', choices: ['Brown Rice'] }],
      },
    ]));
  }, idx);
};

const readOrders = async (page) => page.evaluate(() => {
  const raw = localStorage.getItem('cultiv_orders_v2');
  return raw ? JSON.parse(raw) : [];
});

const placeWebsiteOrder = async (page, { storeId }) => {
  const before = await readOrders(page);
  await seedCart(page, 1);
  await page.goto(`${BASE_URL}/order`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('order-store-select').selectOption(storeId);
  await page.fill('input[placeholder="Full Name"]', 'Sync Proof User');
  await page.fill('input[placeholder="Phone Number"]', CUSTOMER_PHONE);
  await page.fill('input[placeholder="Email Address"]', CUSTOMER_EMAIL);
  await page.getByRole('button', { name: /Place Order/i }).first().click();
  let created = [];
  let after = before;
  const start = Date.now();
  while (Date.now() - start < 10000) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    after = await readOrders(page);
    created = after.filter((entry) => !before.some((prev) => prev.id === entry.id));
    if (created.length === 1) break;
  }

  if (created.length !== 1) {
    const submitErrors = await page.locator('p.text-xs.text-red-600').allTextContents().catch(() => []);
    throw new Error(`Expected exactly 1 created website order, got ${created.length}. errors=${submitErrors.join(' | ')}`);
  }
  return created[0];
};

const loginAdminOwner = async (page) => {
  await page.goto(`${BASE_URL}/admin/summary`, { waitUntil: 'domcontentloaded' });
  const alreadyIn = await page.getByTestId('admin-signout').count();
  if (alreadyIn > 0) {
    await page.getByTestId('admin-signout').click();
    await page.waitForTimeout(200);
    await page.goto(`${BASE_URL}/admin/summary`, { waitUntil: 'domcontentloaded' });
  }

  await page.getByTestId('owner-pin-input').fill(ADMIN_PIN);
  await page.getByTestId('owner-login-button').click();
  await page.waitForSelector('[data-testid="admin-store-scope"]', { timeout: 5000 });
};

const proof = {
  websiteOrderCreated: false,
  adminSawOrderRealtime: false,
  adminStoreScopeCorrect: false,
  adminWrongStoreHidden: false,
  statusChangedInAdmin: false,
  statusSyncedToWebsiteClient: false,
  duplicateOrderIds: false,
  staleStateDetected: false,
};

let syncProc;
let viteProc;
let browser;

try {
  syncProc = spawn('node', ['server/sync-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(SYNC_PORT) },
    stdio: 'ignore',
  });

  viteProc = spawn('npx', ['vite', '--port', String(APP_PORT), '--strictPort'], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_SYNC_SERVER_URL: SYNC_URL },
    stdio: 'ignore',
  });

  await waitForUrl(`${SYNC_URL}/api/state`, 20000);
  await waitForUrl(BASE_URL, 40000);

  browser = await chromium.launch({ headless: true });

  const websiteCtx = await browser.newContext();
  const adminCtx = await browser.newContext();

  const websitePage = await websiteCtx.newPage();
  const adminPage = await adminCtx.newPage();

  await websitePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await adminPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await websitePage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await adminPage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await seedStores(websitePage);
  await seedStores(adminPage);

  await loginCustomerByStorage(websitePage);
  const createdOrder = await placeWebsiteOrder(websitePage, { storeId: 'store-hyderabad' });
  proof.websiteOrderCreated = createdOrder.source === 'app' && createdOrder.status === 'placed' && createdOrder.storeId === 'store-hyderabad';

  await loginAdminOwner(adminPage);
  await adminPage.getByTestId('admin-store-scope').selectOption('store-hyderabad');
  await adminPage.getByRole('link', { name: 'Orders' }).click();
  await adminPage.waitForURL(/\/admin\/orders/, { timeout: 5000 });

  await adminPage.waitForSelector(`[data-testid="order-action-${createdOrder.id}"]`, { timeout: 10000 });
  proof.adminSawOrderRealtime = (await adminPage.getByTestId(`order-action-${createdOrder.id}`).count()) > 0;

  const scopeText = await adminPage.locator('text=Store: Banjara Hills').count();
  proof.adminStoreScopeCorrect = scopeText > 0;

  await adminPage.getByTestId('admin-store-scope').selectOption('store-siddipet');
  await adminPage.waitForTimeout(500);
  proof.adminWrongStoreHidden = (await adminPage.getByTestId(`order-action-${createdOrder.id}`).count()) === 0;

  await adminPage.getByTestId('admin-store-scope').selectOption('store-hyderabad');
  await adminPage.waitForTimeout(500);

  await adminPage.getByTestId(`order-action-${createdOrder.id}`).first().click(); // placed -> preparing
  await adminPage.waitForTimeout(700);

  const adminOrdersAfter = await readOrders(adminPage);
  const updated = adminOrdersAfter.find((entry) => entry.id === createdOrder.id);
  proof.statusChangedInAdmin = updated?.status === 'preparing';

  await websitePage.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded' });
  await websitePage.waitForTimeout(1200);
  const websiteOrdersAfter = await readOrders(websitePage);
  const websiteSeen = websiteOrdersAfter.find((entry) => entry.id === createdOrder.id);
  proof.statusSyncedToWebsiteClient = websiteSeen?.status === 'preparing';

  const adminCount = adminOrdersAfter.filter((entry) => entry.id === createdOrder.id).length;
  const webCount = websiteOrdersAfter.filter((entry) => entry.id === createdOrder.id).length;
  proof.duplicateOrderIds = adminCount === 1 && webCount === 1;

  proof.staleStateDetected = !proof.statusSyncedToWebsiteClient;

  const result = {
    ...proof,
    orderId: createdOrder.id,
    evidence: {
      source: createdOrder.source,
      initialStatus: createdOrder.status,
      mappedStore: createdOrder.storeId,
      adminStatusAfterTransition: updated?.status,
      websiteStatusAfterSync: websiteSeen?.status,
      adminOrderOccurrences: adminCount,
      websiteOrderOccurrences: webCount,
    },
  };

  console.log(JSON.stringify(result, null, 2));

  const requiredChecks = [
    proof.websiteOrderCreated,
    proof.adminSawOrderRealtime,
    proof.adminStoreScopeCorrect,
    proof.adminWrongStoreHidden,
    proof.statusChangedInAdmin,
    proof.statusSyncedToWebsiteClient,
    proof.duplicateOrderIds,
    !proof.staleStateDetected,
  ];

  if (requiredChecks.some((ok) => !ok)) {
    process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill('SIGTERM');
  if (syncProc && !syncProc.killed) syncProc.kill('SIGTERM');
}
