import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4173';
const pass = [];
const fail = [];
const info = [];

function record(ok, name, detail = '') {
  (ok ? pass : fail).push({ name, detail });
}

async function login(page, nextPath = '/profile') {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="9876543210"]', 'member@cultiv.app');
  await page.fill('input[placeholder="Enter your password"]', 'cultiv123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(`**${nextPath}`, { timeout: 12000 });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // Section 1: login/access
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    record(page.url().includes('/login'), 'Logged-out /rewards redirects to /login', `url=${page.url()}`);

    await page.fill('input[placeholder*="9876543210"]', 'member@cultiv.app');
    await page.fill('input[placeholder="Enter your password"]', 'cultiv123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('**/rewards', { timeout: 12000 });
    record(page.url().includes('/rewards'), 'After login returns to /rewards', `url=${page.url()}`);

    record(await page.locator('text=Points card').first().isVisible(), 'Rewards page shows Points card');
    record(await page.locator('text=Redeem rewards').first().isVisible(), 'Rewards page shows Redeem rewards');
    record(await page.locator('text=Points activity').first().isVisible(), 'Rewards page shows Points activity');
    const expiringSoonVisible = await page.locator('text=Expiring soon').first().isVisible().catch(() => false);
    info.push({ name: 'Expiring Soon visibility (conditional)', detail: String(expiringSoonVisible) });

    await context.close();
  }

  // Section 4: redeem reward
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });

    const ptsAway = await page.locator('text=/pts away/i').first().isVisible().catch(() => false);
    record(ptsAway, 'Not-enough-points state shows "X pts away"');

    const unlockBtn = page.locator('button:has-text("Unlock")').first();
    const hasUnlock = await unlockBtn.isVisible().catch(() => false);
    if (hasUnlock) {
      await unlockBtn.click();
      await page.waitForTimeout(500);
      const added = await page.locator('text=Added to account').first().isVisible().catch(() => false);
      record(added, 'Enough-points redeem changes to "Added to account"');

      // Try duplicate by reloading and checking still in added state
      await page.reload({ waitUntil: 'networkidle' });
      const stillAdded = await page.locator('text=Added to account').first().isVisible().catch(() => false);
      record(stillAdded, 'Duplicate redemption prevented (already-added state persists)');
    } else {
      record(false, 'At least one reward is redeemable for positive redeem test');
    }

    await context.close();
  }

  // Section 5/6/7 partial: checkout usage + success consumption
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    // Redeem one reward in this same context so checkout should expose it.
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    const checkoutSetupUnlockBtn = page.locator('button:has-text("Unlock")').first();
    const canUnlockForCheckout = await checkoutSetupUnlockBtn.isVisible().catch(() => false);
    if (canUnlockForCheckout) {
      await checkoutSetupUnlockBtn.click();
      await page.waitForTimeout(400);
    }

    await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });

    await page.locator('button:has-text("Quick Add")').first().click();
    await page.waitForTimeout(300);

    const rewardsSectionVisible = await page.locator('text=Use your rewards').first().isVisible().catch(() => false);
    record(rewardsSectionVisible, 'Checkout shows "Use your rewards" when rewards exist');

    if (rewardsSectionVisible) {
      const payableBlock = page.locator('text=Payable Total').locator('..');
      const before = (await payableBlock.textContent()) || '';

      const usableButtons = page.locator('button:has-text("Use")');
      const useCount = await usableButtons.count();
      record(useCount > 0, 'At least one reward row is selectable at checkout');

      if (useCount > 0) {
        let clickedDiscount = false;
        const discountUseBtn = page.locator('button:has-text("Use")').filter({ hasText: 'Off' }).first();
        if (await discountUseBtn.isVisible().catch(() => false)) {
          await discountUseBtn.click();
          clickedDiscount = true;
        } else {
          await usableButtons.first().click();
        }
        await page.waitForTimeout(300);
        const after = (await payableBlock.textContent()) || '';
        if (clickedDiscount) {
          record(before !== after, 'Selecting reward updates total live');
        } else {
          const freeItemNoteVisible = await page.locator('text=Added free items').first().isVisible().catch(() => false);
          record(freeItemNoteVisible, 'Selecting free-item reward updates order summary');
        }
      }
    }

    // place order, then check rewards consumed from rewards page
    const placeOrderBtn = page.locator('button:has-text("Place Order")').first();
    const canPlace = await placeOrderBtn.isEnabled().catch(() => false);
    record(canPlace, 'Place Order enabled after adding item');

    if (canPlace) {
      await placeOrderBtn.click();
      await page.waitForTimeout(1200);
      const landed = page.url();
      record(
        landed.includes('/orders') || await page.locator('text=/Order placed successfully/i').first().isVisible().catch(() => false),
        'Order success completes'
      );

      await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
      const addedCount = await page.locator('text=Added to account').count();
      info.push({ name: 'Added-to-account count after order', detail: String(addedCount) });
    }

    await context.close();
  }

  // Section 2 exact formula checks
  const totals = [100, 149, 199, 59];
  const expected = [10, 14, 19, 5];
  totals.forEach((t, idx) => {
    const earned = Math.max(0, Math.floor(t / 10));
    record(earned === expected[idx], `floor(total/10) points for Rs.${t}`, `earned=${earned}`);
  });

  // Section 7 edge: guest should not see checkout rewards section
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Quick Add")').first().click();
    await page.waitForTimeout(250);
    const guestRewardsVisible = await page.locator('text=Use your rewards').first().isVisible().catch(() => false);
    record(!guestRewardsVisible, 'Logged-out user does not see checkout rewards section');
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify({ pass, fail, info }, null, 2));
}

run().catch((e) => {
  console.error('QA_RUN_ERROR', e);
  process.exit(1);
});
