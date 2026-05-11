const toBoolean = (value, fallback = true) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const baseURL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173').trim();

const playwrightConfig = {
  baseURL,
  browserName: 'chromium',
  headless: toBoolean(process.env.E2E_HEADLESS, true),
  viewport: {
    width: 1440,
    height: 960,
  },
  timeoutMs: 20_000,
  navigationTimeoutMs: 25_000,
  actionTimeoutMs: 10_000,
  artifactsDir: 'qa/e2e/artifacts',
  ignoreConsolePatterns: [
    /Download the React DevTools/i,
    /Cross-Origin Read Blocking \(CORB\)/i,
  ],
  hookErrorPatterns: [
    /Rendered more hooks than during the previous render/i,
    /Rendered fewer hooks than expected/i,
    /change in the order of Hooks/i,
    /Invalid hook call/i,
  ],
};

export default playwrightConfig;
