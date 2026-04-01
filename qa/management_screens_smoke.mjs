/**
 * Management Screens Smoke — Stores, Employees, Inventory
 *
 * Runs as admin, exercises each management screen for basic read/write
 * correctness. Requires dev server: npx vite --port 4174
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4174 node qa/management_screens_smoke.mjs
 */

import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4174';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const results = {
  // Stores
  storesListVisible: false,
  storesAddBtnVisible: false,
  storeFormOpens: false,
  storeAdded: false,
  storeEditOpens: false,
  // Employees
  employeesListVisible: false,
  employeesAddBtnVisible: false,
  employeeFormOpens: false,
  employeeAdded: false,
  // Inventory
  inventorySearchVisible: false,
  inventoryItemsVisible: false,
  inventoryStockAdded: false,
  inventoryOutWorks: false,
};

// ── Admin login ───────────────────────────────────────────────────────────────
await page.goto(`${baseUrl}/admin/summary`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('owner-pin-input').fill('240620');
await page.getByTestId('owner-login-button').click();
await page.waitForSelector('[data-testid="admin-store-scope"]', { timeout: 5000 });

// ── Stores screen ─────────────────────────────────────────────────────────────
await page.getByRole('link', { name: 'Stores' }).click();
await page.waitForURL(/admin\/stores/, { timeout: 5000 });
await page.waitForSelector('[data-testid="stores-add-btn"]', { timeout: 5000 });

results.storesListVisible = (await page.locator('[data-testid^="store-row-"]').count()) >= 2;
results.storesAddBtnVisible = await page.getByTestId('stores-add-btn').isVisible();

// Open the add form
await page.getByTestId('stores-add-btn').click();
await page.waitForSelector('[data-testid="store-form-name"]', { timeout: 3000 });
results.storeFormOpens = await page.getByTestId('store-form-name').isVisible();

// Fill and submit
await page.getByTestId('store-form-name').fill('QA Smoke Outlet');
await page.getByTestId('store-form-city').fill('Testville');
await page.getByTestId('store-form-code').fill('QSM-01');
await page.getByTestId('store-form-pin').fill('123456');
await page.getByTestId('store-form-submit').click();
await page.waitForTimeout(400);
results.storeAdded = (await page.locator('text=QA Smoke Outlet').count()) > 0;

// Edit an existing store (first edit button)
const firstEditBtn = page.locator('[data-testid^="store-edit-"]').first();
await firstEditBtn.click();
await page.waitForSelector('[data-testid="store-form-name"]', { timeout: 3000 });
results.storeEditOpens = await page.getByTestId('store-form-name').isVisible();
// Close without saving
await page.getByRole('button', { name: 'Cancel' }).click();
await page.waitForTimeout(200);

// ── Employees screen ──────────────────────────────────────────────────────────
await page.getByRole('link', { name: 'Employees' }).click();
await page.waitForURL(/admin\/employees/, { timeout: 5000 });
await page.waitForSelector('[data-testid="employees-add-btn"]', { timeout: 5000 });

results.employeesListVisible = (await page.locator('[data-testid^="employee-shift-btn-"]').count()) >= 2;
results.employeesAddBtnVisible = await page.getByTestId('employees-add-btn').isVisible();

// Open add form
await page.getByTestId('employees-add-btn').click();
await page.waitForSelector('[data-testid="employee-form-name"]', { timeout: 3000 });
results.employeeFormOpens = await page.getByTestId('employee-form-name').isVisible();

// Fill and submit (role + store already have defaults)
await page.getByTestId('employee-form-name').fill('QA Test Staff');
await page.getByTestId('employee-form-submit').click();
await page.waitForTimeout(400);
results.employeeAdded = (await page.locator('text=QA Test Staff').count()) > 0;

// ── Inventory screen ──────────────────────────────────────────────────────────
await page.getByRole('link', { name: 'Inventory' }).click();
await page.waitForURL(/admin\/inventory/, { timeout: 5000 });
await page.waitForSelector('[data-testid="inventory-search"]', { timeout: 5000 });

results.inventorySearchVisible = await page.getByTestId('inventory-search').isVisible();

const addBtns = page.locator('[data-testid^="inventory-add-"]');
results.inventoryItemsVisible = (await addBtns.count()) > 0;

// Add +1 stock to the first visible item and check the count in DOM changed
const firstItem = addBtns.first();
const itemTestId = await firstItem.getAttribute('data-testid');
const itemId = itemTestId?.replace('inventory-add-', '') ?? '';

// Grab current quantity text before the click (look in same row)
const itemRow = page.locator(`[data-testid="inventory-add-${itemId}"]`).locator('xpath=ancestor::div[contains(@class,"grid")]').first();
const qtyCell = itemRow.locator('p.text-sm.font-medium.text-foreground').first();
const qtyBefore = await qtyCell.textContent().catch(() => '');
await firstItem.click();
await page.waitForTimeout(300);
const qtyAfter = await qtyCell.textContent().catch(() => '');
results.inventoryStockAdded = qtyBefore !== qtyAfter;

// Mark a different item as out-of-stock using its Out button
const outBtns = page.locator('[data-testid^="inventory-out-"]');
if ((await outBtns.count()) > 1) {
  await outBtns.nth(1).click();
  await page.waitForTimeout(300);
}
// Verify out-of-stock badge appears
results.inventoryOutWorks = (await page.locator('text=Out of stock').count()) > 0;

// ── Output ────────────────────────────────────────────────────────────────────
console.log(JSON.stringify(results, null, 2));

const failed = Object.entries(results).filter(([, ok]) => !ok);
await browser.close();

if (failed.length > 0) {
  console.error('\nFailed steps:', failed.map(([k]) => k).join(', '));
  process.exitCode = 1;
}
