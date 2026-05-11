import playwrightConfig from '../../playwright.config.mjs';
import { loadE2EEnv } from './shared/env.mjs';
import { closeRuntime, createRuntime, runScenario } from './shared/runtime.mjs';
import { scenarios as customerAuthScenarios } from './customer-auth.mjs';
import { scenarios as customerNavigationScenarios } from './customer-navigation.mjs';
import { scenarios as customerCheckoutScenarios } from './customer-checkout.mjs';
import { scenarios as orderPlacementScenarios } from './order-placement.mjs';
import { scenarios as internalAccessScenarios } from './internal-access.mjs';
import { scenarios as storePosScenarios } from './store-pos.mjs';
import { scenarios as inventoryScenarios } from './inventory.mjs';
import { scenarios as receiptScenarios } from './receipts.mjs';

loadE2EEnv(process.cwd());

const allScenarios = [
  ...customerAuthScenarios,
  ...customerNavigationScenarios,
  ...customerCheckoutScenarios,
  ...orderPlacementScenarios,
  ...internalAccessScenarios,
  ...storePosScenarios,
  ...inventoryScenarios,
  ...receiptScenarios,
];

const profiles = {
  all: allScenarios,
  customer: [
    ...customerAuthScenarios,
    ...customerNavigationScenarios,
    ...customerCheckoutScenarios,
    ...orderPlacementScenarios,
    ...receiptScenarios,
  ],
  internal: [
    ...internalAccessScenarios,
    ...inventoryScenarios,
  ],
  pos: [
    ...storePosScenarios,
  ],
  smoke: [
    customerAuthScenarios[0],
    customerAuthScenarios[2],
    customerNavigationScenarios[0],
    customerCheckoutScenarios[0],
    internalAccessScenarios[0],
    internalAccessScenarios[1],
    storePosScenarios[0],
    inventoryScenarios[0],
    receiptScenarios[0],
  ],
};

const profile = process.argv[2] ?? 'all';
const selectedScenarios = profiles[profile];

if (!selectedScenarios) {
  console.error(`Unknown E2E profile "${profile}". Expected one of: ${Object.keys(profiles).join(', ')}`);
  process.exit(1);
}

const env = { ...process.env };

const printResult = (result) => {
  const prefix = result.status === 'passed'
    ? 'PASS'
    : result.status === 'skipped'
      ? 'SKIP'
      : 'FAIL';
  const suffix = result.status === 'failed'
    ? ` — ${result.error}`
    : result.status === 'skipped'
      ? ` — ${result.reason}`
      : '';
  console.log(`[${prefix}] ${result.group}/${result.id} — ${result.name}${suffix}`);
  if (result.status === 'failed') {
    if (result.url) {
      console.log(`  url: ${result.url}`);
    }
    if (result.screenshotFile) {
      console.log(`  screenshot: ${result.screenshotFile}`);
    }
    if (result.diagnostics) {
      const diagnosticSummary = [
        ...result.diagnostics.pageErrors.map((entry) => `pageerror: ${entry}`),
        ...result.diagnostics.hookErrors.map((entry) => `hook: ${entry}`),
        ...result.diagnostics.consoleErrors.map((entry) => `console: ${entry}`),
        ...result.diagnostics.serverErrors.map((entry) => `server: ${entry}`),
      ];
      if (diagnosticSummary.length > 0) {
        console.log(`  diagnostics: ${diagnosticSummary.join(' | ')}`);
      }
    }
  }
};

console.log(`[e2e] profile=${profile} baseURL=${playwrightConfig.baseURL}`);

const runtime = await createRuntime();
const results = [];

try {
  for (const scenario of selectedScenarios) {
    const result = await runScenario(runtime, scenario, env);
    results.push(result);
    printResult(result);
  }
} finally {
  await closeRuntime(runtime);
}

const summary = {
  profile,
  passed: results.filter((result) => result.status === 'passed').length,
  skipped: results.filter((result) => result.status === 'skipped').length,
  failed: results.filter((result) => result.status === 'failed').length,
  total: results.length,
};

console.log(`[e2e] summary ${JSON.stringify(summary)}`);

if (summary.failed > 0) {
  process.exit(1);
}
