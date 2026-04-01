import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4173';
const pass = [];
const fail = [];

function record(ok, name, detail = '') {
  (ok ? pass : fail).push({ name, detail });
}

async function login(page) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="9876543210"]', 'member@cultiv.app');
  await page.fill('input[placeholder="Enter your password"]', 'cultiv123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/profile', { timeout: 12000 });
}

async function getLoyalty(page) {
  return page.evaluate(() => {
    const currentUserId = localStorage.getItem('cultiv_current_user_v2');
    const loyaltyRaw = localStorage.getItem('cultiv_loyalty_v2');
    const loyalty = loyaltyRaw ? JSON.parse(loyaltyRaw) : {};
    return { currentUserId, profile: currentUserId ? loyalty[currentUserId] : null };
  });
}

async function setLoyalty(page, updater) {
  await page.evaluate((fnSource) => {
    const fn = new Function(`return (${fnSource})`)();
    const currentUserId = localStorage.getItem('cultiv_current_user_v2');
    if (!currentUserId) return;
    const loyaltyRaw = localStorage.getItem('cultiv_loyalty_v2');
    const loyalty = loyaltyRaw ? JSON.parse(loyaltyRaw) : {};
    loyalty[currentUserId] = fn(loyalty[currentUserId]);
    localStorage.setItem('cultiv_loyalty_v2', JSON.stringify(loyalty));
  }, updater.toString());
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // A) Expiry purge + expiring soon visibility
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [
        {
          points: 40,
          earnedAt: Date.now() - 95 * 24 * 60 * 60 * 1000,
          expiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        },
        {
          points: 30,
          earnedAt: Date.now() - 80 * 24 * 60 * 60 * 1000,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        },
      ],
      availablePoints: 70,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: [],
      pointsActivity: [],
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });

    const { profile } = await getLoyalty(page);
    record(profile.availablePoints === 30, 'Expired points removed from availablePoints', `available=${profile.availablePoints}`);
    record(profile.expiringSoonPoints === 30, 'Expiring soon points computed for <=14 days', `expSoon=${profile.expiringSoonPoints}`);
    record(profile.pointsActivity.some((i) => i.type === 'expire'), 'Expiry activity log entry added');
    const expiringCardVisible = await page.locator('text=Expiring soon').first().isVisible().catch(() => false);
    record(expiringCardVisible, 'Expiring Soon card shown when expiringSoonPoints > 0');

    await context.close();
  }

  // B) Reward remains when redeemed but not used; remains valid even if points expire later
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [{ points: 500, earnedAt: Date.now() - 1000, expiresAt: Date.now() + 80 * 24 * 60 * 60 * 1000 }],
      availablePoints: 500,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: [],
      pointsActivity: [],
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    const unlockBtn = page.locator('button:has-text("Unlock")').first();
    if (await unlockBtn.isVisible().catch(() => false)) {
      await unlockBtn.click();
      await page.waitForTimeout(300);
    }

    let state = await getLoyalty(page);
    const retainedReward = (state.profile.availableRewards || [])[0];
    record(Boolean(retainedReward), 'Redeemed reward added to availableRewards');

    // Force all points to expire, reward should still remain
    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [{ points: 1, earnedAt: Date.now() - 100 * 24 * 60 * 60 * 1000, expiresAt: Date.now() - 1 }],
      availablePoints: 1,
      expiringSoonPoints: 0,
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    state = await getLoyalty(page);
    record((state.profile.availableRewards || []).includes(retainedReward), 'Redeemed reward remains valid after points expiry');

    await context.close();
  }

  // C) Checkout: selecting reward without placing order should not consume
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [{ points: 500, earnedAt: Date.now() - 1000, expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000 }],
      availablePoints: 500,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: ['reward-free-drink'],
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Quick Add")').first().click();
    await page.waitForTimeout(250);

    const useBtn = page.locator('button:has-text("Use")').first();
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.click();
      await page.waitForTimeout(150);
    }

    let state = await getLoyalty(page);
    record((state.profile.availableRewards || []).includes('reward-free-drink'), 'Reward not consumed on selection alone');

    await context.close();
  }

  // D) Checkout place order consumes selected rewards and logs earn
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [{ points: 500, earnedAt: Date.now() - 1000, expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000 }],
      availablePoints: 500,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: ['reward-free-drink'],
      pointsActivity: [],
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/order`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Quick Add")').first().click();
    await page.waitForTimeout(250);

    const useBtn = page.locator('button:has-text("Use")').first();
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.click();
      await page.waitForTimeout(150);
    }

    const placeBtn = page.locator('button:has-text("Place Order")').first();
    if (await placeBtn.isEnabled().catch(() => false)) {
      await placeBtn.click();
      await page.waitForTimeout(1200);
    }

    const state = await getLoyalty(page);
    record(!(state.profile.availableRewards || []).includes('reward-free-drink'), 'Used reward consumed after successful order');
    record((state.profile.pointsActivity || []).some((i) => i.type === 'earn'), 'Earn activity recorded on order success');

    const ordersState = await page.evaluate(() => {
      const ordersRaw = localStorage.getItem('cultiv_orders_v2');
      return ordersRaw ? JSON.parse(ordersRaw) : [];
    });
    const latest = ordersState[0];
    record(Array.isArray(latest?.items) && latest.items.some((i) => i.category === 'Rewards' && i.price === 0), 'Order history payload includes reward usage item');

    await context.close();
  }

  // E) FIFO redemption check via controlled batches
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);

    await setLoyalty(page, (profile) => ({
      ...profile,
      pointsBatches: [
        {
          points: 120,
          earnedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
        {
          points: 120,
          earnedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          expiresAt: Date.now() + 80 * 24 * 60 * 60 * 1000,
        },
      ],
      availablePoints: 240,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: [],
      pointsActivity: [],
    }));

    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${baseURL}/rewards`, { waitUntil: 'networkidle' });
    const row = page.locator('div').filter({ hasText: 'Free Drink' }).first();
    const unlock = row.locator('button:has-text("Unlock")').first();
    if (await unlock.isVisible().catch(() => false)) {
      await unlock.click();
      await page.waitForTimeout(300);
    }

    const { profile } = await getLoyalty(page);
    const firstBatchPoints = profile.pointsBatches[0]?.points ?? null;
    const secondBatchPoints = profile.pointsBatches[1]?.points ?? null;
    record(firstBatchPoints === 20 && secondBatchPoints === 120, 'FIFO deduction consumed oldest batch first', `b1=${firstBatchPoints}, b2=${secondBatchPoints}`);

    await context.close();
  }

  console.log(JSON.stringify({ pass, fail }, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error('QA_STATE_ERROR', e);
  process.exit(1);
});
