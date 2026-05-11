import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import playwrightConfig from '../../../playwright.config.mjs';
import { attachPageMonitoring } from './monitoring.mjs';

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export async function createRuntime() {
  const browser = await chromium.launch({ headless: playwrightConfig.headless });
  await fs.mkdir(playwrightConfig.artifactsDir, { recursive: true });
  return { browser, config: playwrightConfig };
}

export async function closeRuntime(runtime) {
  await runtime.browser.close();
}

export async function runScenario(runtime, scenario, env) {
  const skipReason = typeof scenario.skip === 'function' ? scenario.skip(env) : null;
  if (skipReason) {
    return {
      id: scenario.id,
      group: scenario.group,
      name: scenario.name,
      status: 'skipped',
      reason: skipReason,
    };
  }

  const context = await runtime.browser.newContext({
    viewport: runtime.config.viewport,
  });
  const page = await context.newPage();
  const monitor = attachPageMonitoring(page, runtime.config.baseURL);

  try {
    await scenario.run({
      page,
      env,
      baseUrl: runtime.config.baseURL,
      config: runtime.config,
    });
    monitor.assertClean();
    await context.close();
    return {
      id: scenario.id,
      group: scenario.group,
      name: scenario.name,
      status: 'passed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const screenshotFile = path.join(
      runtime.config.artifactsDir,
      `${slugify(`${scenario.group}-${scenario.id}`)}.png`,
    );
    await page.screenshot({ path: screenshotFile, fullPage: true }).catch(() => {});
    const diagnostics = monitor.snapshot();
    const url = page.url();
    await context.close();
    return {
      id: scenario.id,
      group: scenario.group,
      name: scenario.name,
      status: 'failed',
      error: message,
      url,
      screenshotFile,
      diagnostics,
    };
  }
}
