import playwrightConfig from '../../../playwright.config.mjs';

const isSameOrigin = (baseUrl, targetUrl) => {
  try {
    return new URL(targetUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
};

const shouldIgnoreConsoleMessage = (text) =>
  playwrightConfig.ignoreConsolePatterns.some((pattern) => pattern.test(text));

const isHookError = (text) =>
  playwrightConfig.hookErrorPatterns.some((pattern) => pattern.test(text));

export function attachPageMonitoring(page, baseUrl) {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    serverErrors: [],
    hookErrors: [],
  };

  page.on('pageerror', (error) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    state.pageErrors.push(message);
    if (isHookError(message)) {
      state.hookErrors.push(message);
    }
  });

  page.on('console', (message) => {
    const text = message.text().trim();
    if (!text) return;
    if (shouldIgnoreConsoleMessage(text)) return;
    if (isHookError(text)) {
      state.hookErrors.push(text);
      return;
    }
    if (message.type() === 'error') {
      state.consoleErrors.push(text);
    }
  });

  page.on('response', (response) => {
    if (response.status() < 500) return;
    const url = response.url();
    if (!isSameOrigin(baseUrl, url) && !url.includes('/functions/v1/')) return;
    state.serverErrors.push(`${response.status()} ${url}`);
  });

  return {
    snapshot() {
      return {
        consoleErrors: [...state.consoleErrors],
        pageErrors: [...state.pageErrors],
        serverErrors: [...state.serverErrors],
        hookErrors: [...state.hookErrors],
      };
    },
    assertClean() {
      const issues = [
        ...state.pageErrors.map((message) => `pageerror: ${message}`),
        ...state.hookErrors.map((message) => `hook-error: ${message}`),
        ...state.consoleErrors.map((message) => `console-error: ${message}`),
        ...state.serverErrors.map((message) => `server-error: ${message}`),
      ];

      if (issues.length > 0) {
        throw new Error(`Detected fatal browser/runtime issues:\n${issues.join('\n')}`);
      }
    },
  };
}
