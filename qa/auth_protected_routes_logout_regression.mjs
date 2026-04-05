import { chromium } from 'playwright';

const baseURL = process.env.CULTIV_BASE_URL || 'http://127.0.0.1:4173';
const pass = [];
const fail = [];

function record(ok, name, detail = '') {
  (ok ? pass : fail).push({ name, detail });
}

async function gotoAndWait(page, path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
}

async function seedAuthenticatedSession(page) {
  await gotoAndWait(page, '/');
  await page.evaluate(() => {
    localStorage.setItem('cultiv_current_user_v2', JSON.stringify('user-seed-1'));
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function clearAuthStorage(page) {
  await page.evaluate(() => {
    localStorage.setItem('cultiv_current_user_v2', JSON.stringify(null));
    localStorage.setItem('cultiv_customer_account_v1', JSON.stringify(null));
    localStorage.setItem('cultiv_customer_session_token_v1', JSON.stringify(null));
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1) Direct access without auth should redirect to home.
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await gotoAndWait(page, '/orders');
    const redirectedHome = new URL(page.url()).pathname === '/';
    record(redirectedHome, 'Logged-out direct /orders access redirects to home', `url=${page.url()}`);

    await gotoAndWait(page, '/profile');
    const profileRedirectHome = new URL(page.url()).pathname === '/';
    record(profileRedirectHome, 'Logged-out direct /profile access redirects to home', `url=${page.url()}`);

    await gotoAndWait(page, '/rewards');
    const rewardsRedirectHome = new URL(page.url()).pathname === '/';
    record(rewardsRedirectHome, 'Logged-out direct /rewards access redirects to home', `url=${page.url()}`);

    await context.close();
  }

  // 2) Logout from a protected page should land on home and back should not reopen protected content.
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await seedAuthenticatedSession(page);
    await gotoAndWait(page, '/orders');
    record(new URL(page.url()).pathname === '/orders', 'Authenticated session can open /orders', `url=${page.url()}`);

    await page.click('button:has-text("Aarav")');
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('**/', { timeout: 10000 });

    const afterLogoutHome = new URL(page.url()).pathname === '/';
    record(afterLogoutHome, 'Logout from header redirects to home', `url=${page.url()}`);

    await page.goBack();
    await page.waitForTimeout(300);
    const backBlocked = new URL(page.url()).pathname !== '/orders';
    record(backBlocked, 'Browser back after logout does not restore /orders', `url=${page.url()}`);

    const staleProtectedHeadingVisible = await page.locator('text=Your history with CULTIV').first().isVisible().catch(() => false);
    record(!staleProtectedHeadingVisible, 'No stale order history page content shown after logout');

    await context.close();
  }

  // 2b) Logout from /order workspace should also land on home after auth loss.
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await seedAuthenticatedSession(page);
    await gotoAndWait(page, '/order');
    record(new URL(page.url()).pathname === '/order', 'Authenticated session can open /order workspace', `url=${page.url()}`);

    await page.click('button:has-text("Aarav")');
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('**/', { timeout: 10000 });

    const afterOrderLogoutHome = new URL(page.url()).pathname === '/';
    record(afterOrderLogoutHome, 'Logout from /order redirects to home', `url=${page.url()}`);

    await context.close();
  }

  // 3) Cross-tab logout should kick user out of protected route in another tab.
  {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await seedAuthenticatedSession(pageA);
    await gotoAndWait(pageA, '/orders');
    record(new URL(pageA.url()).pathname === '/orders', 'Tab A entered protected route with auth', `url=${pageA.url()}`);

    await gotoAndWait(pageB, '/');
    await clearAuthStorage(pageB);

    await pageA.waitForURL('**/', { timeout: 10000 });
    const crossTabRedirected = new URL(pageA.url()).pathname === '/';
    record(crossTabRedirected, 'Cross-tab auth reset redirects protected tab to home', `url=${pageA.url()}`);

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify({ pass, fail }, null, 2));
  if (fail.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('QA_RUN_ERROR', error);
  process.exit(1);
});
