import { chromium } from 'playwright';

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4174').trim();
const STORE_TEST_PIN = requireEnv('STORE_TEST_PIN');
const STORE_TEST_EMPLOYEE_NAME = requireEnv('STORE_TEST_EMPLOYEE_NAME');
const STORE_TEST_EMPLOYEE_PIN = requireEnv('STORE_TEST_EMPLOYEE_PIN');

const results = [];

const record = (ok, step, detail = '') => {
  results.push({ step, ok, detail });
};

const logStep = (step, detail = '') => {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[store-operator-qa] ${step}${suffix}`);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPageDebugSnapshot = async (page) => {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  return {
    url,
    bodyPreview: bodyText.slice(0, 500),
  };
};

const waitForStoreShiftReady = async (page, timeout = 15000) => {
  const employeeNamePattern = new RegExp(escapeRegExp(STORE_TEST_EMPLOYEE_NAME), 'i');
  await Promise.race([
    page.waitForFunction(
      () => window.location.pathname.startsWith('/store/shift'),
      undefined,
      { timeout },
    ),
    page.getByText(employeeNamePattern).first().waitFor({ timeout }),
    page.getByRole('button', { name: /^Clock In$/ }).first().waitFor({ timeout }),
    page.getByRole('button', { name: /^Clock Out$/ }).first().waitFor({ timeout }),
  ]);
};

const waitForOperatorRequirement = async (page, timeout = 15000) => {
  await Promise.race([
    page.getByRole('heading', { name: 'Who is operating?' }).waitFor({ timeout }),
    page.getByRole('button', { name: 'End Session' }).waitFor({ timeout }),
  ]);
};

const findEmployeeCard = (page, employeeName) => {
  const employeeText = page.locator('article').filter({ has: page.locator(`text=${employeeName}`) });
  return employeeText.first();
};

const fillShiftPin = async (card, employeePin) => {
  const pinInput = card.locator('[data-testid^="store-shift-pin-input-"]').first();
  await pinInput.fill(employeePin);
};

const getShiftActionLabel = async (card) => {
  const button = card.locator('[data-testid^="store-shift-submit-"]').first();
  const text = ((await button.textContent()) ?? '').trim();
  return text;
};

const clickShiftAction = async (card) => {
  const button = card.locator('[data-testid^="store-shift-submit-"]').first();
  await button.click();
};

const waitForShiftFeedback = async (card, pattern) => {
  await card.locator(`text=/${pattern}/i`).first().waitFor({ timeout: 10000 });
};

const ensureLoggedOut = async (page) => {
  logStep('ensure-logged-out', BASE_URL);
  await page.goto(`${BASE_URL}/operations/access`, { waitUntil: 'domcontentloaded' });
  const signOutButton = page.getByTestId('admin-signout');
  if (await signOutButton.count()) {
    logStep('ensure-logged-out', 'existing internal session found; signing out');
    await signOutButton.click();
    await wait(400);
  }
  await page.goto(`${BASE_URL}/operations/access`, { waitUntil: 'domcontentloaded' });
};

const normalizeShiftState = async (page, employeeName, employeePin) => {
  logStep('normalize-shift-state', employeeName);
  const employeeCard = findEmployeeCard(page, employeeName);
  await employeeCard.waitFor({ timeout: 10000 });
  const initialAction = await getShiftActionLabel(employeeCard);

  if (initialAction === 'Clock Out') {
    await fillShiftPin(employeeCard, employeePin);
    await clickShiftAction(employeeCard);
    await waitForShiftFeedback(employeeCard, 'Clocked out successfully');
    await page.waitForTimeout(500);
    record(true, 'normalize-shift-state', 'Employee was already on shift; clocked out to normalize.');
  } else if (initialAction === 'Clock In') {
    record(true, 'normalize-shift-state', 'Employee already off shift.');
  } else {
    throw new Error(`Unexpected shift action label during normalization: "${initialAction}"`);
  }
};

const ensureNoActiveOperatorSession = async (page) => {
  logStep('normalize-operator-session', 'opening /store/pos');
  await page.goto(`${BASE_URL}/store/pos`, { waitUntil: 'domcontentloaded' });
  await waitForOperatorRequirement(page);
  const endSessionButton = page.getByRole('button', { name: 'End Session' });

  if (await endSessionButton.count()) {
    logStep('normalize-operator-session', 'ending pre-existing operator session');
    await endSessionButton.click();
    await page.getByRole('heading', { name: 'Who is operating?' }).waitFor({ timeout: 10000 });
    record(true, 'normalize-operator-session', 'Ended pre-existing operator session.');
    return;
  }

  await page.getByRole('heading', { name: 'Who is operating?' }).waitFor({ timeout: 10000 });
  record(true, 'normalize-operator-session', 'No active operator session to clear.');
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await ensureLoggedOut(page);

    logStep('store-login', 'selecting store login mode');
    await page.getByTestId('mode-store').click();
    await page.getByTestId('store-pin-input').fill(STORE_TEST_PIN);
    logStep('store-login', 'submitting store PIN');
    await page.getByTestId('store-login-button').click();
    logStep('store-login', 'waiting for shift screen');
    await waitForStoreShiftReady(page);
    logStep('store-login', 'shift screen ready');
    record(new URL(page.url()).pathname === '/store/shift', 'store-login', `url=${page.url()}`);

    await normalizeShiftState(page, STORE_TEST_EMPLOYEE_NAME, STORE_TEST_EMPLOYEE_PIN);

    logStep('clock-in', STORE_TEST_EMPLOYEE_NAME);
    const employeeCard = findEmployeeCard(page, STORE_TEST_EMPLOYEE_NAME);
    await employeeCard.waitFor({ timeout: 10000 });
    await fillShiftPin(employeeCard, STORE_TEST_EMPLOYEE_PIN);
    await clickShiftAction(employeeCard);
    await waitForShiftFeedback(employeeCard, 'Clocked in successfully');
    record(true, 'clock-in', `Employee ${STORE_TEST_EMPLOYEE_NAME} clocked in.`);

    await ensureNoActiveOperatorSession(page);

    logStep('operator-unlock', STORE_TEST_EMPLOYEE_NAME);
    const employeeSelector = page.getByRole('button').filter({
      has: page.locator(`text=${STORE_TEST_EMPLOYEE_NAME}`),
    }).first();
    await employeeSelector.click();
    await page.locator('#store-operator-pin').fill(STORE_TEST_EMPLOYEE_PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();

    const operatorChipRegex = new RegExp(`Operator:\\s*${escapeRegExp(STORE_TEST_EMPLOYEE_NAME)}`);
    await page.getByText(operatorChipRegex).waitFor({ timeout: 15000 });
    record(true, 'operator-unlock', `Operator chip visible for ${STORE_TEST_EMPLOYEE_NAME}.`);

    logStep('end-operator-session');
    await page.getByRole('button', { name: 'End Session' }).click();
    await page.getByRole('heading', { name: 'Who is operating?' }).waitFor({ timeout: 10000 });
    record(true, 'end-operator-session', 'Unlock modal reappeared after ending session.');

    logStep('return-to-shift');
    await page.goto(`${BASE_URL}/store/shift`, { waitUntil: 'domcontentloaded' });
    await waitForStoreShiftReady(page, 10000);

    logStep('clock-out', STORE_TEST_EMPLOYEE_NAME);
    const employeeCardAfter = findEmployeeCard(page, STORE_TEST_EMPLOYEE_NAME);
    await employeeCardAfter.waitFor({ timeout: 10000 });
    await fillShiftPin(employeeCardAfter, STORE_TEST_EMPLOYEE_PIN);
    await clickShiftAction(employeeCardAfter);
    await waitForShiftFeedback(employeeCardAfter, 'Clocked out successfully');
    record(true, 'clock-out', `Employee ${STORE_TEST_EMPLOYEE_NAME} clocked out.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const debug = await getPageDebugSnapshot(page);
    record(false, 'runtime-error', `${message} | url=${debug.url} | body=${debug.bodyPreview}`);
  } finally {
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }

  const failed = results.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('STORE_OPERATOR_QA_FATAL', error);
  process.exit(1);
});
