export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function clearBrowserState(page, _baseUrl) {
  await page.goto('about:blank', { waitUntil: 'load' });
  await page.context().clearCookies();
}

export async function expectPathname(page, expected) {
  await page.waitForFunction(
    (matcher) => {
      const pathname = window.location.pathname;
      if (matcher.kind === 'string') return pathname === matcher.value;
      return new RegExp(matcher.value, matcher.flags).test(pathname);
    },
    typeof expected === 'string'
      ? { kind: 'string', value: expected }
      : { kind: 'regex', value: expected.source, flags: expected.flags },
    { timeout: 10_000 },
  );
}

export async function expectNoCustomerProfileRequest(page, action) {
  const responses = [];
  const handler = (response) => {
    if (response.url().includes('customer-get-profile')) {
      responses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  };

  page.on('response', handler);
  try {
    await action();
  } finally {
    page.off('response', handler);
  }

  if (responses.length > 0) {
    throw new Error(
      `Expected no customer-get-profile request, but saw: ${responses.map((item) => `${item.status} ${item.url}`).join(', ')}`,
    );
  }
}

export async function customerLogin(page, { baseUrl, email, password }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/Phone number or email/i).fill(email);
  await page.getByLabel(/^Password$/i).fill(password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === '/' || document.body.innerText.includes('Order'),
    undefined,
    { timeout: 15_000 },
  );
  await page.getByRole('banner').waitFor({ state: 'visible', timeout: 10_000 });
  await wait(750);
}

export async function openHeaderUserMenu(page) {
  const header = page.getByRole('banner');
  const profileLink = header.getByRole('link', { name: /^Profile$/ });
  if (await profileLink.isVisible().catch(() => false)) return;

  const menuTrigger = header.getByRole('button').last();
  await menuTrigger.click();
  await profileLink.waitFor({ state: 'visible', timeout: 5_000 });
}

export async function logoutCustomerFromHeader(page) {
  const pageSignOut = page.locator('main').getByRole('button', { name: /^Sign Out$/ }).first();

  if (await pageSignOut.isVisible().catch(() => false)) {
    await pageSignOut.click();
    return;
  }

  await openHeaderUserMenu(page);
  await page.getByRole('button', { name: /^Sign Out$/ }).click();
}

export async function selectStoreIfPrompted(page, preferredStoreName = '') {
  const storeHeading = page.getByRole('heading', { name: /Select your nearest CULTIV store/i });
  if (!(await storeHeading.isVisible().catch(() => false))) return;

  if (preferredStoreName) {
    const namedButton = page.getByRole('button', { name: new RegExp(preferredStoreName, 'i') }).first();
    if (await namedButton.count()) {
      await namedButton.click();
      return;
    }
  }

  const chooseButton = page.getByRole('button', { name: /Tap to choose/i }).first();
  if (await chooseButton.count()) {
    await chooseButton.click();
    return;
  }

  const storeButton = page.locator('button').filter({ hasText: /Current|Tap to choose/i }).first();
  if (await storeButton.count()) {
    await storeButton.click();
  }
}

export async function waitForOrderPageReady(page) {
  await page.locator('#checkout-panel').waitFor({ state: 'visible', timeout: 15_000 });
  await Promise.race([
    page.getByRole('button', { name: /^Quick Add$/ }).first().waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByRole('button', { name: /Pay & Place Order/i }).first().waitFor({ state: 'visible', timeout: 15_000 }),
  ]);
}

export async function addFirstQuickItem(page) {
  const quickAdd = page.getByRole('button', { name: /^Quick Add$/ }).first();
  if (await quickAdd.count()) {
    await quickAdd.click();
  } else {
    const fallback = page.getByRole('button', { name: /^Add$/ }).first();
    await fallback.click();
  }

  await page.waitForFunction(() => {
    const panel = document.getElementById('checkout-panel');
    if (!panel) return false;
    const text = panel.innerText || '';
    return !text.includes('Your cart is empty');
  }, undefined, { timeout: 10_000 });
}

export async function openProfileScreen(page, baseUrl) {
  await page.goto(`${baseUrl}/profile`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Your CULTIV Profile/i }).waitFor({ state: 'visible', timeout: 15_000 });
}

export async function ensureLoggedOutUi(page) {
  await page.getByRole('link', { name: /Login \/ Sign Up|Login/i }).waitFor({ state: 'visible', timeout: 10_000 });
}

export async function waitForCustomerUiToSettle(page) {
  await page.getByRole('banner').waitFor({ state: 'visible', timeout: 10_000 });
  await wait(4000);
}
