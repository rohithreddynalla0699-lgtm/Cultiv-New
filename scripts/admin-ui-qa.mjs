import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const base = 'http://127.0.0.1:5173';
const ADMIN_OWNER_PIN = process.env.ADMIN_OWNER_PIN ?? '240620';
const result = {
  login: {},
  orders: {},
  inventory: {},
  employees: {},
  summary: {},
  nav: {},
  tablet: {},
  notes: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

try {
  await page.goto(`${base}/admin/summary`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('owner-pin-input').fill(ADMIN_OWNER_PIN);
  await page.getByTestId('owner-login-button').click();
  await page.waitForURL(/\/admin\/summary/);
  result.login.ownerPinLogin = 'pass';

  const contextText = await page.locator('text=Store:').first().textContent();
  const roleVisible = await page.locator('text=Role:').first().isVisible();
  const pageVisible = await page.locator('text=Page:').first().isVisible();
  const signOutVisible = await page.getByRole('button', { name: 'Sign Out' }).first().isVisible();
  result.nav.contextBar = !!contextText && roleVisible && pageVisible && signOutVisible ? 'pass' : 'fail';

  const kpi = {
    ready: await page.locator('text=Ready for pickup').count(),
    active: await page.locator('text=Active orders').count(),
    low: await page.locator('text=Low stock items').count(),
    staff: await page.locator('text=On shift now').count(),
  };
  result.summary.priorityCardsVisible = Object.values(kpi).every((n) => n > 0) ? 'pass' : 'fail';
  result.summary.compactChartVisible = await page.locator('text=Orders by hour').first().isVisible() ? 'pass' : 'fail';

  await page.getByRole('link', { name: 'Orders' }).click();
  await page.waitForURL(/\/admin\/orders/);

  result.orders.cardCount = await page.locator('article:has-text("Waiting")').count();
  const primaryButtonsCount = await page.locator('article:has-text("Waiting") button:has-text("Start Preparing"), article:has-text("Waiting") button:has-text("Mark Ready"), article:has-text("Waiting") button:has-text("Mark Picked Up")').count();
  result.orders.primaryActionsPresent = primaryButtonsCount > 0 ? 'pass' : 'warn';

  const noteLinks = await page.locator('article:has-text("Waiting") button:has-text("+ Add note"), article:has-text("Waiting") button:has-text("Edit note")').count();
  const noteInputs = await page.locator('article:has-text("Waiting") input[placeholder="Add pickup note"]').count();
  result.orders.notesCollapsedDefault = noteLinks > 0 && noteInputs === 0 ? 'pass' : 'fail';
  result.orders.waitingVisible = result.orders.cardCount > 0 ? 'pass' : 'fail';

  let transitions = 0;
  for (const label of ['Start Preparing', 'Mark Ready', 'Mark Picked Up']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(220);
      transitions += 1;
    }
  }
  result.orders.quickTransitionsAttempted = transitions;

  await page.getByRole('link', { name: 'Inventory' }).click();
  await page.waitForURL(/\/admin\/inventory/);

  result.inventory.lowStockQueueVisible = await page.locator('text=Low Stock Action Queue').first().isVisible() ? 'pass' : 'fail';
  result.inventory.lowStockCardCount = await page.locator('section:has-text("Low Stock Action Queue") article').count();
  result.inventory.quickRestockButtons = (await page.locator('section:has-text("Low Stock Action Queue") button:has-text("+1"), section:has-text("Low Stock Action Queue") button:has-text("+5"), section:has-text("Low Stock Action Queue") button:has-text("+10"), section:has-text("Low Stock Action Queue") button:has-text("+20")').count()) > 0 ? 'pass' : 'fail';
  result.inventory.allInventorySectionVisible = await page.locator('text=All Inventory Items').first().isVisible() ? 'pass' : 'fail';
  result.inventory.thresholdSecondaryVisible = await page.locator('button:has-text("Threshold")').first().isVisible() ? 'pass' : 'fail';

  const firstLowStockCard = page.locator('section:has-text("Low Stock Action Queue") article').first();
  if (await firstLowStockCard.isVisible().catch(() => false)) {
    const firstCardText = (await firstLowStockCard.textContent()) ?? '';
    result.inventory.firstCardStatus = /out of stock/i.test(firstCardText) ? 'out_of_stock_first' : 'not_out_of_stock_first';
  }

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.waitForURL(/\/admin\/employees/);

  const startShiftCount = await page.getByRole('button', { name: 'Start Shift' }).count();
  const endShiftCount = await page.getByRole('button', { name: 'End Shift' }).count();
  result.employees.shiftButtons = startShiftCount + endShiftCount > 0 ? 'pass' : 'fail';
  result.employees.hoursVisible = (await page.locator('text=Today').count()) > 0 && (await page.locator('text=This week').count()) > 0 && (await page.locator('text=This month').count()) > 0 ? 'pass' : 'fail';

  const historyToggleCount = await page.getByRole('button', { name: /Show history|Hide history/ }).count();
  result.employees.historyCollapsible = historyToggleCount > 0 ? 'pass' : 'fail';
  const showHistory = page.getByRole('button', { name: 'Show history' }).first();
  if (await showHistory.isVisible().catch(() => false)) {
    await showHistory.click();
    await page.waitForTimeout(180);
    result.employees.historyToggleInteraction = 'pass';
  } else {
    result.employees.historyToggleInteraction = 'warn';
  }

  await page.getByRole('link', { name: 'Summary' }).click();
  await page.waitForURL(/\/admin\/summary/);

  const scopeSelect = page.locator('label:has-text("Store scope") select').first();
  if (await scopeSelect.isVisible().catch(() => false)) {
    await scopeSelect.selectOption('store-siddipet');
    await page.waitForTimeout(180);
    result.nav.storeSwitchClear = (await page.locator('text=Store: Siddipet Central').count()) > 0 ? 'pass' : 'warn';
  } else {
    result.nav.storeSwitchClear = 'warn';
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${base}/admin/orders`, { waitUntil: 'domcontentloaded' });
  result.tablet.primaryButtonHeight = await page.locator('article button').first().evaluate((el) => getComputedStyle(el).height).catch(() => null);
  result.tablet.cardsVisible = (await page.locator('article:has-text("Waiting")').count()) > 0 ? 'pass' : 'warn';
} catch (error) {
  result.notes.push(String(error?.message || error));
}

writeFileSync('/Users/rohith/Desktop/Personal Business/Cultiv New/scripts/admin-ui-qa-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
await browser.close();
