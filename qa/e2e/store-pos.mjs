import { clearBrowserState, expectPathname } from './shared/helpers.mjs';
import { isTruthyEnv, missingEnv } from './shared/env.mjs';

const STORE_ENV = ['E2E_STORE_PIN', 'E2E_STORE_NAME', 'E2E_STORE_EMPLOYEE_NAME', 'E2E_STORE_EMPLOYEE_PIN'];

const normalizeStoreOptionText = (value) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[·-]/g, ' ')
    .replace(/\s+/g, ' ')
);

const waitForShiftScreen = async (page, employeeName) => {
  await Promise.race([
    page.getByText(new RegExp(employeeName, 'i')).first().waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByRole('button', { name: /^Clock In$/ }).first().waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByRole('button', { name: /^Clock Out$/ }).first().waitFor({ state: 'visible', timeout: 15_000 }),
  ]);
};

const findEmployeeCard = (page, employeeName) =>
  page.locator('article').filter({ has: page.locator(`text=${employeeName}`) }).first();

const fillEmployeePin = async (card, pin) => {
  await card.locator('[data-testid^="store-shift-pin-input-"]').first().fill(pin);
};

const selectStoreOption = async (page, preferredStoreName) => {
  const select = page.getByTestId('store-select');
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="store-select"]');
    return Boolean(element && element.querySelectorAll('option').length > 0);
  }, undefined, { timeout: 15_000 });
  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.getAttribute('value') ?? '',
      label: (node.textContent ?? '').trim(),
    }))
  );

  const exactLabelMatch = options.find((option) => option.label === preferredStoreName);
  if (exactLabelMatch) {
    await select.selectOption({ label: exactLabelMatch.label });
    return;
  }

  const exactValueMatch = options.find((option) => option.value === preferredStoreName);
  if (exactValueMatch) {
    await select.selectOption(exactValueMatch.value);
    return;
  }

  const normalizedPreferredName = normalizeStoreOptionText(preferredStoreName);
  const partialLabelMatch = options.find((option) =>
    normalizeStoreOptionText(option.label).includes(normalizedPreferredName)
  );
  if (partialLabelMatch) {
    await select.selectOption(partialLabelMatch.value || { label: partialLabelMatch.label });
    return;
  }

  throw new Error(`Could not find store option matching "${preferredStoreName}". Available options: ${options.map((option) => option.label).join(', ')}`);
};

const clickShiftAction = async (card) => {
  await card.locator('[data-testid^="store-shift-submit-"]').first().click();
};

const getShiftActionLabel = async (card) =>
  (((await card.locator('[data-testid^="store-shift-submit-"]').first().textContent()) ?? '').trim());

const normalizeShiftState = async (page, employeeName, employeePin) => {
  const card = findEmployeeCard(page, employeeName);
  await card.waitFor({ state: 'visible', timeout: 10_000 });
  const label = await getShiftActionLabel(card);
  if (label === 'Clock Out') {
    await fillEmployeePin(card, employeePin);
    await clickShiftAction(card);
    await page.getByText(/Clocked out successfully/i).waitFor({ state: 'visible', timeout: 10_000 });
  }
};

const unlockStoreOperator = async (page, employeeName, employeePin) => {
  await page.goto(`${page.url().split('/store/')[0]}/store/pos`, { waitUntil: 'domcontentloaded' });
  const endSessionButton = page.getByRole('button', { name: /^End Session$/ });
  if (await endSessionButton.count()) {
    await endSessionButton.click();
    await page.getByRole('heading', { name: /Who is operating\?/i }).waitFor({ state: 'visible', timeout: 10_000 });
  }
  await page.getByRole('button').filter({ hasText: new RegExp(employeeName, 'i') }).first().click();
  await page.locator('#store-operator-pin').fill(employeePin);
  await page.getByRole('button', { name: /^Unlock$/ }).click();
  await page.getByText(new RegExp(`Operator:\\s*${employeeName}`, 'i')).waitFor({ state: 'visible', timeout: 15_000 });
};

export const scenarios = [
  {
    id: 'store-login-shift-unlock-end-session',
    group: 'store-pos',
    name: 'Store login, shift screen, operator unlock, and session cleanup work',
    skip() {
      const missing = missingEnv(STORE_ENV);
      return missing.length > 0 ? `Missing store/POS credentials: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('mode-store').click();
      await selectStoreOption(page, env.E2E_STORE_NAME);
      await page.getByTestId('store-pin-input').fill(env.E2E_STORE_PIN);
      await page.getByTestId('store-login-button').click();
      await expectPathname(page, '/store/shift');
      await waitForShiftScreen(page, env.E2E_STORE_EMPLOYEE_NAME);

      await normalizeShiftState(page, env.E2E_STORE_EMPLOYEE_NAME, env.E2E_STORE_EMPLOYEE_PIN);

      const employeeCard = findEmployeeCard(page, env.E2E_STORE_EMPLOYEE_NAME);
      await fillEmployeePin(employeeCard, env.E2E_STORE_EMPLOYEE_PIN);
      await clickShiftAction(employeeCard);
      await page.getByText(/Clocked in successfully/i).waitFor({ state: 'visible', timeout: 10_000 });

      await unlockStoreOperator(page, env.E2E_STORE_EMPLOYEE_NAME, env.E2E_STORE_EMPLOYEE_PIN);
      await page.getByRole('button', { name: /^End Session$/ }).click();
      await page.getByRole('heading', { name: /Who is operating\?/i }).waitFor({ state: 'visible', timeout: 10_000 });

      await page.goto(`${baseUrl}/store/shift`, { waitUntil: 'domcontentloaded' });
      await waitForShiftScreen(page, env.E2E_STORE_EMPLOYEE_NAME);
      const clockedInCard = findEmployeeCard(page, env.E2E_STORE_EMPLOYEE_NAME);
      await fillEmployeePin(clockedInCard, env.E2E_STORE_EMPLOYEE_PIN);
      await clickShiftAction(clockedInCard);
      await page.getByText(/Clocked out successfully/i).waitFor({ state: 'visible', timeout: 10_000 });
    },
  },
  {
    id: 'store-pos-cash-order-optional',
    group: 'store-pos',
    name: 'Store POS can complete a simple cash order when mutation tests are enabled',
    skip() {
      if (!isTruthyEnv('E2E_ENABLE_MUTATION_TESTS')) {
        return 'POS order creation is mutation-gated. Set E2E_ENABLE_MUTATION_TESTS=true to run it.';
      }
      const missing = missingEnv(STORE_ENV);
      return missing.length > 0 ? `Missing store/POS credentials: ${missing.join(', ')}` : null;
    },
    async run({ page, baseUrl, env }) {
      await clearBrowserState(page, baseUrl);
      await page.goto(`${baseUrl}/operations/access`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('mode-store').click();
      await selectStoreOption(page, env.E2E_STORE_NAME);
      await page.getByTestId('store-pin-input').fill(env.E2E_STORE_PIN);
      await page.getByTestId('store-login-button').click();
      await waitForShiftScreen(page, env.E2E_STORE_EMPLOYEE_NAME);

      await normalizeShiftState(page, env.E2E_STORE_EMPLOYEE_NAME, env.E2E_STORE_EMPLOYEE_PIN);
      const employeeCard = findEmployeeCard(page, env.E2E_STORE_EMPLOYEE_NAME);
      await fillEmployeePin(employeeCard, env.E2E_STORE_EMPLOYEE_PIN);
      await clickShiftAction(employeeCard);
      await page.getByText(/Clocked in successfully/i).waitFor({ state: 'visible', timeout: 10_000 });

      await unlockStoreOperator(page, env.E2E_STORE_EMPLOYEE_NAME, env.E2E_STORE_EMPLOYEE_PIN);
      await page.getByRole('button', { name: /Customize/i }).first().click();
      await page.getByRole('button', { name: /^Next$/ }).click().catch(() => {});
      await page.getByRole('button', { name: /^Add to Cart$/ }).click();
      await page.getByRole('button', { name: /Complete Payment/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /^Skip$/ }).click();
      await page.getByRole('button', { name: /^Cash$/ }).click();
      await page.getByRole('button', { name: /Complete Payment/i }).click();
      await page.getByText(/Ready to finish receipt actions|Payment successful/i).waitFor({ state: 'visible', timeout: 20_000 });
    },
  },
];
