/**
 * pickup_only_regression.mjs
 * Final QA regression — verifies pickup-only pricing model.
 *
 * Scenarios:
 *  S1  Checkout summary structure
 *  S2  Order placement — type, no delivery state, total formula
 *  S3  Order detail screen
 *  S4  Order history — fulfillment labels
 *  S5  Home/store copy
 *  S6  Rewards — rules text, no delivery logic
 */

import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const SEED_EMAIL = 'member@cultiv.app';
const SEED_PASSWORD = 'cultiv123';

// ─── helpers ──────────────────────────────────────────────────────────────────

const pass = (id, name, evidence = '') => ({ id, name, ok: true, evidence });
const fail = (id, name, evidence = '') => ({ id, name, ok: false, evidence });

const setupLoggedIn = async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  await page.evaluate((creds) => {
    // Seed users are already in localStorage from buildSeedState.
    // We just need to set the current user pointer.
    const rawUsers = localStorage.getItem('cultiv_users_v2');
    if (!rawUsers) return;
    const users = JSON.parse(rawUsers);
    const user = users.find((u) => u.email === creds.email);
    if (!user) return;
    localStorage.setItem('cultiv_current_user_v2', JSON.stringify(user.id));
  }, { email: SEED_EMAIL });

  await page.reload({ waitUntil: 'domcontentloaded' });
};

const seedCart = async (page, userId) => {
  await page.evaluate((uid) => {
    const scopeKey = `cultiv_active_draft_scope_v1`;
    const scope = `user:${uid}`;
    localStorage.setItem(scopeKey, JSON.stringify(scope));
    const cartKey = `cultiv_order_draft_scope_v1:${scope}`;
    const lines = [
      {
        key: 'item-test-1',
        itemId: 'item-test-1',
        title: 'Brown Rice Bowl',
        categoryName: 'Rice Bowls',
        unitPrice: 209,
        quantity: 2,
        selections: [{ section: 'Rice', choices: ['Brown Rice'] }],
      },
    ];
    localStorage.setItem(cartKey, JSON.stringify(lines));
  }, userId);
  await page.reload({ waitUntil: 'domcontentloaded' });
};

const getCurrentUserId = async (page) => {
  const raw = await page.evaluate(() => localStorage.getItem('cultiv_current_user_v2'));
  return raw ? JSON.parse(raw) : null;
};

// ─── scenario runner ───────────────────────────────────────────────────────────

const results = [];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ─────────────────────────────────────────────────────────────────────────────
  // S1 — Checkout summary structure
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await setupLoggedIn(page);
    const userId = await getCurrentUserId(page);
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
    await seedCart(page, userId);
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });

    const html = await page.content();
    const lower = html.toLowerCase();

    const hasItemsTotal    = lower.includes('food subtotal') || lower.includes('items total') || lower.includes('items\n') || /items.*₹/i.test(html);
    const hasTotalPayable  = lower.includes('payable total') || lower.includes('total payable') || /payable/i.test(html);
    const noDeliveryFeeRow = !lower.includes('delivery fee');
    const noAddressField   = !html.includes('placeholder="Street') && !html.includes('delivery address') && !html.includes('Delivery Address');
    const noDeliveryText   = !/\bdelivery\b/i.test(html.replace(/pickup-only|no fees|pickup/gi, ''));

    // Food subtotal is visible on page
    const subtotalVisible = await page.locator('text=/Food subtotal/i').count() > 0;
    // Payable total visible
    const payableVisible  = await page.locator('text=/Payable Total/i').count() > 0;
    // Delivery fee NOT visible
    const deliveryFeeRow  = await page.locator('text=/Delivery fee/i').count() === 0;

    const evidence = `subtotalRow=${subtotalVisible}, payableRow=${payableVisible}, noDeliveryFeeRow=${deliveryFeeRow}, noAddressField=${noAddressField}`;

    if (subtotalVisible && payableVisible && deliveryFeeRow && noAddressField) {
      results.push(pass('S1', 'Checkout summary structure', evidence));
    } else {
      results.push(fail('S1', 'Checkout summary structure', evidence));
    }
  } catch (e) {
    results.push(fail('S1', 'Checkout summary structure', `error: ${e.message}`));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S2 — Order placement: type, formula, no delivery state
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await setupLoggedIn(page);
    const userId = await getCurrentUserId(page);
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
    await seedCart(page, userId);
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });

    // Fill customer details and place order
    await page.fill('input[placeholder="Full Name"]', 'Aarav Menon');
    await page.fill('input[placeholder="Phone Number"]', '9876543210');
    await page.fill('input[placeholder="Email Address"]', SEED_EMAIL);

    const preOrders = await page.evaluate(() => {
      const raw = localStorage.getItem('cultiv_orders_v2');
      return raw ? JSON.parse(raw) : [];
    });

    await page.click('button:has-text("Place Order")');
    await page.waitForTimeout(1500);

    const postOrders = await page.evaluate(() => {
      const raw = localStorage.getItem('cultiv_orders_v2');
      return raw ? JSON.parse(raw) : [];
    });

    const newOrders = postOrders.filter((o) => !preOrders.find((p) => p.id === o.id));
    const placed = newOrders[0];

    if (!placed) {
      results.push(fail('S2', 'Order placement', 'No new order found in storage'));
    } else {
      const orderTypeIsPickup      = placed.orderType === 'pickup';
      const noDeliveryFee          = !Object.prototype.hasOwnProperty.call(placed, 'deliveryFee');
      const hasRewardDiscount      = Object.prototype.hasOwnProperty.call(placed, 'rewardDiscount');
      const noAddress              = !placed.address;
      const formulaCorrect         = Math.abs(placed.total - (placed.subtotal - placed.rewardDiscount)) < 0.01;
      const validPickupStatus      = ['placed', 'preparing', 'ready_for_pickup', 'completed'].includes(placed.status);
      const timelineNoDelivery     = !placed.statusTimeline?.some((e) => e.status === 'out_for_delivery');

      const evidence = `orderType=${placed.orderType}, hasDeliveryFee=${!noDeliveryFee}, hasRewardDiscount=${hasRewardDiscount}, address=${placed.address ?? 'none'}, total=${placed.total}, subtotal=${placed.subtotal}, rewardDiscount=${placed.rewardDiscount}, formulaOk=${formulaCorrect}, status=${placed.status}, timelineNoDelivery=${timelineNoDelivery}`;

      if (orderTypeIsPickup && noDeliveryFee && hasRewardDiscount && noAddress && formulaCorrect && validPickupStatus && timelineNoDelivery) {
        results.push(pass('S2', 'Order placement', evidence));
      } else {
        results.push(fail('S2', 'Order placement', evidence));
      }
    }
  } catch (e) {
    results.push(fail('S2', 'Order placement', `error: ${e.message}`));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S3 — Order detail screen
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await setupLoggedIn(page);
    const orders = await page.evaluate(() => {
      const raw = localStorage.getItem('cultiv_orders_v2');
      return raw ? JSON.parse(raw) : [];
    });
    const targetOrder = orders.find((o) => o.source === 'app') ?? orders[0];
    if (!targetOrder) throw new Error('No orders in storage');

    await page.goto(`${BASE}/orders/${targetOrder.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const html = await page.content();

    const hasItemsTotal   = await page.locator('text=/Items total|Subtotal/i').count() > 0;
    const noDeliveryFee   = (await page.locator('text=/Delivery fee/i').count()) === 0;
    const noDeliveryText  = !/\bdelivery fee\b/i.test(html);
    // Reward discount row only shown for orders with rewardDiscount > 0
    const willShowReward  = targetOrder.rewardDiscount > 0;
    const rewardRowOk     = !willShowReward || await page.locator('text=/Reward discount/i').count() > 0;

    const evidence = `itemsTotalRow=${hasItemsTotal}, noDeliveryFeeRow=${noDeliveryFee && noDeliveryText}, rewardRowOk=${rewardRowOk}, orderId=${targetOrder.id}`;

    if (hasItemsTotal && noDeliveryFee && noDeliveryText && rewardRowOk) {
      results.push(pass('S3', 'Order detail screen', evidence));
    } else {
      results.push(fail('S3', 'Order detail screen', evidence));
    }
  } catch (e) {
    results.push(fail('S3', 'Order detail screen', `error: ${e.message}`));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S4 — Order history: fulfillment labels
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await setupLoggedIn(page);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const html = await page.content();

    // "Delivery" as a fulfillment label (distinct from "order placed" text etc.)
    const deliveryLabelCount = (html.match(/\bDelivery\b/g) ?? []).length;
    const hasPickupLabel     = /\bPickup\b/i.test(html);
    const hasInStoreLabel    = /\bIn-Store\b/i.test(html);
    const noDeliveryLabel    = deliveryLabelCount === 0;

    const evidence = `pickupLabel=${hasPickupLabel}, inStoreLabel=${hasInStoreLabel}, deliveryLabelOccurrences=${deliveryLabelCount}`;

    if (noDeliveryLabel) {
      results.push(pass('S4', 'Order history fulfillment labels', evidence));
    } else {
      results.push(fail('S4', 'Order history fulfillment labels', evidence));
    }
  } catch (e) {
    results.push(fail('S4', 'Order history fulfillment labels', `error: ${e.message}`));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S5 — Home/store copy
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const html = await page.content();

    // Extract just visible text to avoid script content
    const visibleText = await page.evaluate(() => document.body.innerText);
    const noDeliveryInCopy = !/\bdelivery\b/i.test(visibleText);
    const hasPickupCopy    = /\bpickup\b/i.test(visibleText);

    const deliveryMatches = (visibleText.match(/\bdelivery\b/gi) ?? []);
    const evidence = `noDeliveryInVisibleCopy=${noDeliveryInCopy}, hasPickupCopy=${hasPickupCopy}, deliveryMatches="${deliveryMatches.join(', ')}"`;

    if (noDeliveryInCopy && hasPickupCopy) {
      results.push(pass('S5', 'Home/store copy', evidence));
    } else {
      results.push(fail('S5', 'Home/store copy', evidence));
    }
  } catch (e) {
    results.push(fail('S5', 'Home/store copy', `error: ${e.message}`));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S6 — Rewards rules text & no delivery logic
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    await setupLoggedIn(page);
    const userId = await getCurrentUserId(page);

    // Seed loyalty profile with an available reward so the rewards panel renders
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((uid) => {
      const loyaltyKey = 'cultiv_loyalty_v2';
      const raw = localStorage.getItem(loyaltyKey);
      const profiles = raw ? JSON.parse(raw) : {};
      const existing = profiles[uid] ?? {
        userId: uid,
        pointsBatches: [{ points: 500, earnedAt: Date.now(), expiresAt: Date.now() + 90 * 86400000 }],
        availablePoints: 500,
        expiringSoonPoints: 0,
        expiredPoints: 0,
        pointsActivity: [],
        totalOrders: 5,
        totalSpend: 800,
        currentTier: 'Founding Member',
      };
      existing.availableRewards = ['50off'];
      existing.availablePoints = Math.max(existing.availablePoints ?? 0, 500);
      profiles[uid] = { ...existing, userId: uid };
      localStorage.setItem(loyaltyKey, JSON.stringify(profiles));
    }, userId);

    await seedCart(page, userId);
    await page.goto(`${BASE}/order`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const visibleText = await page.evaluate(() => document.body.innerText);

    const correctRulesText  = /rewards apply to your items total/i.test(visibleText);
    const noDeliveryInRules = !/delivery fee/i.test(visibleText);
    const minimumOrderText  = /minimum order.*₹99|₹99/i.test(visibleText);

    const evidence = `correctRulesText=${correctRulesText}, noDeliveryInRules=${noDeliveryInRules}, minimumOrderText=${minimumOrderText}`;

    if (correctRulesText && noDeliveryInRules && minimumOrderText) {
      results.push(pass('S6', 'Rewards rules text', evidence));
    } else {
      results.push(fail('S6', 'Rewards rules text', evidence));
    }
  } catch (e) {
    results.push(fail('S6', 'Rewards rules text', `error: ${e.message}`));
  }

  await browser.close();

  // ─── Print report ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  PICKUP-ONLY PRICING MODEL — QA REGRESSION REPORT');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('PART A — PASSED CHECKS\n');
  if (passed.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const r of passed) {
      console.log(`  ✓ [${r.id}] ${r.name}`);
      console.log(`        ${r.evidence}\n`);
    }
  }

  console.log('PART B — FAILED CHECKS\n');
  if (failed.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const r of failed) {
      console.log(`  ✗ [${r.id}] ${r.name}`);
      console.log(`        ${r.evidence}\n`);
    }
  }

  console.log('PART C — STATIC DELIVERY REFERENCE SCAN\n');
  console.log('  (see grep results appended below)\n');

  console.log('PART D — VERDICT\n');
  if (failed.length === 0) {
    console.log(`  ✅ ALL ${results.length}/${results.length} SCENARIOS PASS.`);
    console.log('  Pickup-only pricing model is fully validated and ready.\n');
  } else {
    console.log(`  ❌ ${failed.length} SCENARIO(S) FAILED out of ${results.length}.`);
    console.log('  Not ready for release until failures are resolved.\n');
  }

  console.log('════════════════════════════════════════════════════════════\n');

  // Machine-readable summary
  console.log('JSON_SUMMARY:' + JSON.stringify({ passed: passed.length, failed: failed.length, total: results.length, results }));
}

run().catch((e) => {
  console.error('Fatal QA runner error:', e);
  process.exit(1);
});
