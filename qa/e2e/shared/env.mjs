import fs from 'node:fs';
import path from 'node:path';

const ENV_FILES = ['.env.e2e.local', '.env.e2e'];

const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const parseEnvFile = (content) => {
  const entries = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = stripQuotes(line.slice(equalsIndex + 1).trim());
    if (!key) continue;
    entries[key] = value;
  }
  return entries;
};

let envLoaded = false;

export function loadE2EEnv(rootDir = process.cwd()) {
  if (envLoaded) return;

  for (const relativeFile of ENV_FILES) {
    const filePath = path.join(rootDir, relativeFile);
    if (!fs.existsSync(filePath)) continue;
    const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }

  envLoaded = true;
}

export function getEnv(name, fallback = '') {
  return (process.env[name] ?? fallback).trim();
}

export function hasEnv(name) {
  return Boolean(getEnv(name));
}

export function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isTruthyEnv(name) {
  return getEnv(name).toLowerCase() === 'true';
}

export function missingEnv(names) {
  return names.filter((name) => !hasEnv(name));
}
