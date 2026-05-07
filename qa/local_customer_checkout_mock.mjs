import { chromium } from 'playwright';

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').trim();
const CUSTOMER_TEST_EMAIL = requireEnv('CUSTOMER_TEST_EMAIL');
const CUSTOMER_TEST_PASSWORD = requireEnv('CUSTOMER_TEST_PASSWORD');
const CUSTOMER_TEST_PHONE = process.env.CUSTOMER_TEST_PHONE?.trim() ?? '';

const results = [];

const record = (ok, step, detail = '') => {
  results.push({ step, ok, detail });
};

const logStep = (step, detail = '') => {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[customer-checkout-qa] ${step}${suffix}`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPageDebugSnapshot = async (page) => {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  return {
    url,
    bodyPreview: bodyText.slice(0, 500),
  };
};

const getCheckoutContactDiagnostics = async (page) => {
  const nameInput = page.getByPlaceholder('Full Name');
  const phoneInput = page.getByPlaceholder('Phone Number');
  const emailInput = page.getByPlaceholder('Email Address');

  const nameValue = await nameInput.inputValue().catch(() => '');
  const phoneValue = await phoneInput.inputValue().catch(() => '');
  const emailValue = await emailInput.inputValue().catch(() => '');

  const sectionText = await page.evaluate(() => {
    const phoneInputEl = document.querySelector('#checkout-phone');
    if (!phoneInputEl) {
      return document.body?.innerText?.slice(0, 500) ?? '';
    }

    const container = phoneInputEl.closest('.space-y-2, .space-y-3, .mt-3') ?? phoneInputEl.parentElement;
    return container?.textContent?.trim()?.slice(0, 500) ?? '';
  }).catch(() => '');

  return {
    nameValue,
    phoneValue,
    emailValue,
    sectionText,
  };
};

const waitForAnyVisible = async (locators, timeout = 15000) => {
  await Promise.race(
    locators.map((locator) => locator.first().waitFor({ state: 'visible', timeout })),
  );
};

const waitForLoggedInUi = async (page, timeout = 15000) => {
  await Promise.race([
    page.getByRole('button', { name: /Profile/i }).first().waitFor({ state: 'visible', timeout }),
    page.getByRole('link', { name: /^Order$/ }).first().waitFor({ state: 'visible', timeout }),
    page.getByRole('link', { name: /^Menu$/ }).first().waitFor({ state: 'visible', timeout }),
    page.waitForFunction(() => window.location.pathname === '/', undefined, { timeout }),
  ]);
};

const waitForOrderPageReady = async (page, timeout = 15000) => {
  await Promise.race([
    page.getByRole('button', { name: /^Quick Add$/ }).first().waitFor({ state: 'visible', timeout }),
    page.getByRole('button', { name: /Pay & Place Order/i }).first().waitFor({ state: 'visible', timeout }),
    page.waitForFunction(() => window.location.pathname.startsWith('/order'), undefined, { timeout }),
  ]);
};

const waitForStoreReady = async (page, timeout = 15000) => {
  const checkoutPanel = page.locator('#checkout-panel');
  await checkoutPanel.waitFor({ state: 'visible', timeout });

  const storeReady = await page.waitForFunction(() => {
    const panel = document.getElementById('checkout-panel');
    if (!panel) return false;

    const text = panel.innerText || '';
    if (!text.includes('Cart')) return false;
    if (!text.includes('Pickup')) return false;
    if (text.includes('No stores available')) return false;
    if (text.includes('Select location')) return false;

    return true;
  }, undefined, { timeout }).catch(() => null);

  if (storeReady) {
    return;
  }

  const panelText = await checkoutPanel.innerText().catch(() => '');
  throw new Error(
    `Store readiness did not resolve before checkout. `
    + `checkoutPanel="${panelText.slice(0, 500)}"`,
  );
};

const ensureLoggedOut = async (page) => {
  logStep('ensure-logged-out', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.reload({ waitUntil: 'domcontentloaded' });
  record(true, 'ensure-logged-out', 'Started in a fresh browser context and cleared local storage.');
};

const selectStoreIfPrompted = async (page) => {
  const storeSelectorHeading = page.getByRole('heading', { name: /Select your nearest CULTIV store/i });
  if (!(await storeSelectorHeading.count())) {
    return;
  }

  if (!(await storeSelectorHeading.first().isVisible().catch(() => false))) {
    return;
  }

  logStep('select-store', 'store selector modal detected');
  const currentStoreButton = page.getByRole('button', { name: /Current/i }).first();
  if (await currentStoreButton.count()) {
    await currentStoreButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  const chooseStoreButton = page.getByRole('button', { name: /Tap to choose/i }).first();
  if (await chooseStoreButton.count()) {
    await chooseStoreButton.click();
  } else {
    const firstStoreCard = page.locator('button').filter({
      has: page.locator('text=Tap to choose'),
    }).first();
    await firstStoreCard.click();
  }

  await wait(500);
  record(true, 'select-store', 'Selected the first available active store.');
};

const navigateToCustomerLogin = async (page) => {
  logStep('customer-login', 'opening login screen');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('9876543210 or member@cultiv.app').waitFor({ state: 'visible', timeout: 10000 });
};

const loginCustomer = async (page) => {
  logStep('customer-login', 'submitting email/password');
  await page.getByPlaceholder('9876543210 or member@cultiv.app').fill(CUSTOMER_TEST_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(CUSTOMER_TEST_PASSWORD);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await waitForLoggedInUi(page);
  record(true, 'customer-login', `Logged in successfully at ${page.url()}`);
};

const goToOrderPage = async (page) => {
  logStep('checkout', 'opening order page');
  await page.goto(`${BASE_URL}/order`, { waitUntil: 'domcontentloaded' });
  await waitForOrderPageReady(page);
  await selectStoreIfPrompted(page);
  await waitForOrderPageReady(page);
  await waitForStoreReady(page);
  record(true, 'checkout', `Order page ready at ${page.url()}`);
};

const addSimpleItem = async (page) => {
  logStep('add-item', 'adding first available menu item');
  const quickAddButton = page.getByRole('button', { name: /^Quick Add$/ }).first();

  if (await quickAddButton.count()) {
    await quickAddButton.click();
  } else {
    const fallbackAddButton = page.getByRole('button', { name: /Add/i }).filter({
      hasNot: page.locator('text=Customize'),
    }).first();
    await fallbackAddButton.click();
  }

  const checkoutPanel = page.locator('#checkout-panel');
  const cartLineRemoveButton = checkoutPanel.getByRole('button', { name: /^Remove$/ }).first();
  const emptyCartMessage = checkoutPanel.getByText(/Your cart is empty\. Add items from the middle panel\./i);
  const buildingNowPanel = checkoutPanel.getByText(/Building now/i).first();

  await Promise.race([
    cartLineRemoveButton.waitFor({ state: 'visible', timeout: 10000 }),
    buildingNowPanel.waitFor({ state: 'visible', timeout: 10000 }),
  ]).catch(async () => {
    const debug = await getPageDebugSnapshot(page);
    const panelText = await checkoutPanel.innerText().catch(() => '');
    throw new Error(
      `Cart did not update after add-item click. `
      + `checkoutPanel="${panelText.slice(0, 500)}" `
      + `url=${debug.url} body="${debug.bodyPreview}"`,
    );
  });

  if (await buildingNowPanel.isVisible().catch(() => false)) {
    const panelText = await checkoutPanel.innerText().catch(() => '');
    throw new Error(
      `Add-item step opened customization instead of adding directly to cart. `
      + `checkoutPanel="${panelText.slice(0, 500)}"`,
    );
  }

  if (await emptyCartMessage.isVisible().catch(() => false)) {
    const panelText = await checkoutPanel.innerText().catch(() => '');
    throw new Error(
      `Cart still shows empty state after add-item click. `
      + `checkoutPanel="${panelText.slice(0, 500)}"`,
    );
  }

  record(true, 'add-item', 'Added one item to the cart.');
};

const ensureCheckoutFieldsReady = async (page) => {
  const nameInput = page.getByPlaceholder('Full Name');
  const phoneInput = page.getByPlaceholder('Phone Number');
  const emailInput = page.getByPlaceholder('Email Address');

  await nameInput.waitFor({ state: 'visible', timeout: 10000 });

  const currentName = (await nameInput.inputValue()).trim();
  if (!currentName) {
    const fallbackName = CUSTOMER_TEST_EMAIL.split('@')[0] || 'CULTIV Test';
    await nameInput.fill(fallbackName);
  }

  logStep('checkout', 'waiting for contact hydration');

  const contactHydrated = await page.waitForFunction(
    ({ fallbackPhone }) => {
      const phoneInputEl = document.querySelector('#checkout-phone');
      const emailInputEl = document.querySelector('#checkout-email');
      const nameInputEl = document.querySelector('#checkout-full-name');
      const phoneValue = (phoneInputEl instanceof HTMLInputElement ? phoneInputEl.value : '').replace(/\D/g, '');
      const emailValue = emailInputEl instanceof HTMLInputElement ? emailInputEl.value.trim() : '';
      const nameValue = nameInputEl instanceof HTMLInputElement ? nameInputEl.value.trim() : '';
      const contactSection = phoneInputEl?.closest('.space-y-2, .space-y-3, .mt-3')?.textContent ?? '';
      const hasVisibleVerifiedPhone = /\b\d{10}\b/.test(contactSection.replace(/\D/g, ''));

      return Boolean(
        (phoneValue && phoneValue.length === 10)
          || hasVisibleVerifiedPhone
          || (fallbackPhone && fallbackPhone.replace(/\D/g, '').length === 10 && emailValue && nameValue),
      );
    },
    { fallbackPhone: CUSTOMER_TEST_PHONE },
    { timeout: 10000 },
  ).catch(() => null);

  let currentPhone = (await phoneInput.inputValue()).replace(/\D/g, '');
  if (!currentPhone && CUSTOMER_TEST_PHONE) {
    const normalizedFallbackPhone = CUSTOMER_TEST_PHONE.replace(/\D/g, '').slice(-10);
    if (normalizedFallbackPhone.length === 10) {
      await phoneInput.fill(normalizedFallbackPhone);
      currentPhone = normalizedFallbackPhone;
    }
  }

  if (!contactHydrated && currentPhone.length !== 10) {
    const diagnostics = await getCheckoutContactDiagnostics(page);
    throw new Error(
      `Checkout phone field is empty after hydration wait. `
      + `name="${diagnostics.nameValue}" phone="${diagnostics.phoneValue}" email="${diagnostics.emailValue}" `
      + `contactSection="${diagnostics.sectionText}". `
      + `If this test account does not hydrate a phone automatically, set CUSTOMER_TEST_PHONE.`,
    );
  }

  if (!currentPhone) {
    const diagnostics = await getCheckoutContactDiagnostics(page);
    const visibleVerifiedPhone = diagnostics.sectionText.replace(/\D/g, '').match(/\d{10}/)?.[0] ?? '';
    if (!visibleVerifiedPhone) {
      throw new Error(
        `Checkout phone is still unavailable. `
        + `name="${diagnostics.nameValue}" phone="${diagnostics.phoneValue}" email="${diagnostics.emailValue}" `
        + `contactSection="${diagnostics.sectionText}".`,
      );
    }
  }

  const currentEmail = (await emailInput.inputValue()).trim();
  if (!currentEmail) {
    await emailInput.fill(CUSTOMER_TEST_EMAIL);
  }
};

const openCheckoutReview = async (page) => {
  logStep('checkout', 'opening checkout review');
  await ensureCheckoutFieldsReady(page);
  await waitForStoreReady(page);

  const primaryCheckoutButton = page.getByRole('button', { name: /Pay & Place Order/i }).first();
  await primaryCheckoutButton.waitFor({ state: 'visible', timeout: 10000 });
  await primaryCheckoutButton.click();

  const reviewHeading = page.getByRole('heading', { name: /Review before placing/i });
  const checkoutUnavailableBanner = page.getByText(/Online checkout unavailable|Online checkout coming soon/i).first();

  try {
    await Promise.race([
      reviewHeading.waitFor({ state: 'visible', timeout: 15000 }),
      checkoutUnavailableBanner.waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  } catch {
    const diagnostics = await getCheckoutContactDiagnostics(page);
    const debug = await getPageDebugSnapshot(page);
    throw new Error(
      `Checkout review modal did not open after clicking checkout. `
      + `name="${diagnostics.nameValue}" phone="${diagnostics.phoneValue}" email="${diagnostics.emailValue}" `
      + `contactSection="${diagnostics.sectionText}" `
      + `url=${debug.url} body="${debug.bodyPreview}"`,
    );
  }

  if (await checkoutUnavailableBanner.isVisible().catch(() => false)) {
    const debug = await getPageDebugSnapshot(page);
    throw new Error(
      `Checkout is unavailable in the preview build. `
      + `url=${debug.url} body="${debug.bodyPreview}"`,
    );
  }

  record(true, 'checkout', 'Checkout review modal opened.');
};

const placeMockOrder = async (page) => {
  logStep('place-order', 'confirming mock payment');
  const confirmButton = page.getByRole('button', { name: /Pay & Place Order/i }).last();
  await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
  await confirmButton.click();

  await waitForAnyVisible([
    page.getByRole('heading', { name: /Order Confirmed/i }),
    page.getByText(/Thank you for your order!/i),
    page.getByText(/Order #/i),
  ], 20000);

  record(true, 'place-order', 'Mock checkout completed.');
};

const verifySuccess = async (page) => {
  logStep('verify-success', 'checking success screen');
  await waitForAnyVisible([
    page.getByRole('heading', { name: /Order Confirmed/i }),
    page.getByText(/Thank you for your order!/i),
    page.getByText(/Order #/i),
  ], 15000);

  const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
  const orderNumberMatch = bodyText.match(/Order\s*#\s*([A-Za-z0-9-]+)/i);
  const orderNumber = orderNumberMatch?.[1] ?? 'unknown';

  record(true, 'verify-success', `Success screen visible. order=${orderNumber}`);
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await ensureLoggedOut(page);
    await navigateToCustomerLogin(page);
    await loginCustomer(page);
    await goToOrderPage(page);
    await addSimpleItem(page);
    await openCheckoutReview(page);
    await placeMockOrder(page);
    await verifySuccess(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const debug = await getPageDebugSnapshot(page);
    console.error(`[customer-checkout-qa] failure-url=${debug.url}`);
    console.error(`[customer-checkout-qa] failure-body=${debug.bodyPreview}`);
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
  console.error('CUSTOMER_CHECKOUT_QA_FATAL', error);
  process.exit(1);
});
