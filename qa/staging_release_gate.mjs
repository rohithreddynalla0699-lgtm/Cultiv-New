import { spawn } from 'node:child_process';

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').trim();

const REQUIRED_ENV_VARS = [
  'ADMIN_OWNER_PIN',
  'STORE_TEST_PIN',
  'STORE_TEST_EMPLOYEE_NAME',
  'STORE_TEST_EMPLOYEE_PIN',
  'CUSTOMER_TEST_EMAIL',
  'CUSTOMER_TEST_PASSWORD',
];

const QA_STEPS = [
  {
    name: 'protected-routes',
    script: 'qa:protected-routes',
    purpose: 'logout, protected-route, and scope guard validation',
  },
  {
    name: 'store-operator',
    script: 'qa:store-operator',
    purpose: 'store login, shift, operator unlock, end session, and clock-out validation',
  },
  {
    name: 'customer-checkout',
    script: 'qa:customer-checkout',
    purpose: 'customer login and mock checkout success-path validation',
  },
];

const logStep = (message) => {
  console.log(`[staging-release-gate] ${message}`);
};

const runNpmScript = (scriptName) => new Promise((resolve, reject) => {
  const child = spawn('npm', ['run', scriptName], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`${scriptName} exited with code ${code ?? 'unknown'}${signal ? ` (signal: ${signal})` : ''}`));
  });
});

async function main() {
  for (const envName of REQUIRED_ENV_VARS) {
    requireEnv(envName);
  }

  logStep(`BASE_URL=${BASE_URL}`);
  logStep('Starting required staging smoke gate.');

  for (const step of QA_STEPS) {
    logStep(`Running ${step.script} — ${step.purpose}`);
    await runNpmScript(step.script);
    logStep(`Passed ${step.script}`);
  }

  logStep('All required staging smoke checks passed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[staging-release-gate] FAILED — ${message}`);
  process.exit(1);
});
