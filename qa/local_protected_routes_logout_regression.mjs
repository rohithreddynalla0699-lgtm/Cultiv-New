import { chromium } from 'playwright';

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').trim();
const ADMIN_OWNER_PIN = requireEnv('ADMIN_OWNER_PIN');
const STORE_TEST_PIN = requireEnv('STORE_TEST_PIN');

const results = [];

const record = (ok, step, detail = '') => {
  results.push({ step, ok, detail });
};

const logStep = (step, detail = '') => {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[protected-routes-qa] ${step}${suffix}`);
};

const getPageDebugSnapshot = async (page) => {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  return {
    url,
    bodyPreview: bodyText.slice(0, 500),
  };
};

const waitForAnyVisible = async (locators, timeout = 15000) => {
  await Promise.race(
    locators.map((locator) => locator.first().waitFor({ state: 'visible', timeout })),
  );
};

const clearBrowserState = async (page) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
};

const waitForInternalAccessScreen = async (page, timeout = 15000) => {
  await waitForAnyVisible([
    page.getByTestId('mode-owner'),
    page.getByTestId('mode-store'),
    page.getByText(/CULTIV Control/i),
  ], timeout);
};

const waitForStoreShiftReady = async (page, timeout = 15000) => {
  await Promise.race([
    page.waitForFunction(() => window.location.pathname.startsWith('/store/shift'), undefined, { timeout }),
    page.getByRole('button', { name: /^Clock In$/ }).first().waitFor({ state: 'visible', timeout }),
    page.getByRole('button', { name: /^Clock Out$/ }).first().waitFor({ state: 'visible', timeout }),
    page.getByText(/Enter 6-digit PIN/i).first().waitFor({ state: 'visible', timeout }),
  ]);
};

const ensureLoggedOut = async (page) => {
  logStep('reset-state', BASE_URL);
  await clearBrowserState(page);
  await page.goto(`${BASE_URL}/operations/access`, { waitUntil: 'domcontentloaded' });
  await waitForInternalAccessScreen(page);
  record(true, 'reset-state', 'Cleared local/session storage and cookies.');
};

const waitForLoggedOutCustomerLanding = async (page, timeout = 15000) => {
  await Promise.race([
    page.waitForFunction(() => window.location.pathname === '/', undefined, { timeout }),
    page.getByRole('link', { name: /Sign In/i }).first().waitFor({ state: 'visible', timeout }),
    page.getByRole('link', { name: /Create one/i }).first().waitFor({ state: 'visible', timeout }),
    page.getByText(/Start your food journey/i).first().waitFor({ state: 'visible', timeout }),
    page.getByText(/Welcome Back/i).first().waitFor({ state: 'visible', timeout }),
  ]);
};

const verifyLoggedOutCustomerRoutes = async (browser) => {
  const checks = [
    ['/profile', 'customer-logged-out-profile'],
    ['/orders', 'customer-logged-out-orders'],
    ['/rewards', 'customer-logged-out-rewards'],
  ];

  for (const [path, step] of checks) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    const page = await context.newPage();

    logStep(step, path);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await waitForLoggedOutCustomerLanding(page, 10000);
    record(new URL(page.url()).pathname === '/', step, `url=${page.url()}`);
    await context.close();
  }
};

const verifyLoggedOutInternalRoutes = async (page) => {
  const checks = [
    ['/operations/summary', 'internal-logged-out-operations'],
    ['/store/shift', 'internal-logged-out-store-shift'],
  ];

  for (const [path, step] of checks) {
    logStep(step, path);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await waitForInternalAccessScreen(page);
    record(new URL(page.url()).pathname === '/operations/access', step, `url=${page.url()}`);
  }
};

const loginOwner = async (page) => {
  logStep('admin-login', 'owner login');
  await page.goto(`${BASE_URL}/operations/access`, { waitUntil: 'domcontentloaded' });
  await waitForInternalAccessScreen(page);
  await page.getByTestId('mode-owner').click();
  await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
  await page.getByTestId('owner-login-button').click();

  await waitForAnyVisible([
    page.getByText(/Operations Dashboard/i),
    page.getByText(/All stores/i),
    page.getByTestId('admin-signout'),
  ], 15000);

  record(new URL(page.url()).pathname === '/operations/summary', 'admin-login', `url=${page.url()}`);
};

const logoutInternal = async (page, step) => {
  logStep(step, 'signing out');
  await page.getByTestId('admin-signout').click();
  await waitForInternalAccessScreen(page);
  record(new URL(page.url()).pathname === '/operations/access', step, `url=${page.url()}`);
};

const loginStore = async (page) => {
  logStep('store-login', 'store login');
  await page.goto(`${BASE_URL}/operations/access`, { waitUntil: 'domcontentloaded' });
  await waitForInternalAccessScreen(page);
  await page.getByTestId('mode-store').click();
  await page.getByTestId('store-pin-input').fill(STORE_TEST_PIN);
  await page.getByTestId('store-login-button').click();
  await waitForStoreShiftReady(page);
  record(new URL(page.url()).pathname === '/store/shift', 'store-login', `url=${page.url()}`);
};

const verifyStoreCannotOpenOperations = async (page) => {
  logStep('store-operations-redirect', '/operations/summary');
  await page.goto(`${BASE_URL}/operations/summary`, { waitUntil: 'domcontentloaded' });
  await waitForStoreShiftReady(page);
  record(new URL(page.url()).pathname === '/store/shift', 'store-operations-redirect', `url=${page.url()}`);
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  try {
    await ensureLoggedOut(page);
    await verifyLoggedOutCustomerRoutes(browser);
    await verifyLoggedOutInternalRoutes(page);
    await loginOwner(page);
    await logoutInternal(page, 'admin-logout');
    await loginStore(page);
    await verifyStoreCannotOpenOperations(page);
    await logoutInternal(page, 'store-logout');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const debug = await getPageDebugSnapshot(page);
    record(false, 'runtime-error', `${message} | url=${debug.url} | body=${debug.bodyPreview}`);
  } finally {
    console.log(JSON.stringify(results, null, 2));
    await context.close();
    await browser.close();
  }

  const failed = results.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('PROTECTED_ROUTES_QA_FATAL', error);
  process.exit(1);
});
