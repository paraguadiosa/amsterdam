import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import './providers/catalog.js';

// Hermes credential pool provider id → amsterdam env var.
// Derived from catalog.js so a new provider inherits its mapping
// automatically (hermesId → envKey / baseUrlEnv).
const POOL_PROVIDER_TO_ENV = {};
const POOL_PROVIDER_TO_BASE_URL_ENV = {};
for (const meta of globalThis.AMS_PROVIDERS) {
  if (!meta.hermesId || !meta.envKey) continue;
  POOL_PROVIDER_TO_ENV[meta.hermesId] = meta.envKey;
  if (meta.baseUrlEnv) POOL_PROVIDER_TO_BASE_URL_ENV[meta.hermesId] = meta.baseUrlEnv;
}

// Pool base urls follow the OpenAI convention and end in /v1.
// Amsterdam appends its own paths, so strip the suffix.
function normalizeBaseUrl(url) {
  return url.replace(/\/v1\/?$/, '');
}

export function parseHermesPool(content) {
  const vars = {};
  try {
    const data = JSON.parse(content);
    const pool = data.credential_pool || {};
    for (const [providerId, creds] of Object.entries(pool)) {
      const envKey = POOL_PROVIDER_TO_ENV[providerId];
      if (!envKey || !Array.isArray(creds)) continue;
      for (const cred of creds) {
        // Only manual credentials carry an inline token.
        // env-sourced credentials resolve through .env files.
        if (cred && cred.source === 'manual' && cred.access_token) {
          vars[envKey] = cred.access_token;
          const baseUrlEnv = POOL_PROVIDER_TO_BASE_URL_ENV[providerId];
          if (baseUrlEnv && cred.base_url) {
            vars[baseUrlEnv] = normalizeBaseUrl(cred.base_url);
          }
          break;
        }
      }
    }
  } catch {
    // Invalid JSON means no pool credentials.
  }
  return vars;
}

export function loadHermesPool(filePath, target = process.env) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = parseHermesPool(content);
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in target)) target[key] = value;
    }
    return Object.keys(vars);
  } catch {
    return [];
  }
}

// Codex stores credentials in ~/.codex/auth.json. Its file keys are
// env-var names (e.g. OPENAI_API_KEY); only keys that match a catalog
// envKey are accepted, so a new provider inherits the mapping for free.
const CODEX_FILE_KEY_TO_ENV = {};
for (const meta of globalThis.AMS_PROVIDERS) {
  if (meta.envKey) CODEX_FILE_KEY_TO_ENV[meta.envKey] = meta.envKey;
}

export function parseCodexAuth(content) {
  const vars = {};
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (CODEX_FILE_KEY_TO_ENV[key] && typeof value === 'string' && value) {
          vars[key] = value;
        }
      }
    }
  } catch {
    // Invalid JSON means no codex credentials.
  }
  return vars;
}

export function loadCodexAuth(filePath, target = process.env) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = parseCodexAuth(content);
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in target)) target[key] = value;
    }
    return Object.keys(vars);
  } catch {
    return [];
  }
}

export function parseEnvFile(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    vars[key] = value;
  }
  return vars;
}

export function loadEnvFile(filePath, target = process.env) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = parseEnvFile(content);
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in target)) target[key] = value;
    }
    return Object.keys(vars);
  } catch {
    return [];
  }
}

export function loadDefaults(target = process.env, { cwd = process.cwd(), home = homedir() } = {}) {
  const codexPath = target.CODEX_AUTH_FILE || resolve(home, '.codex', 'auth.json');
  const paths = [
    resolve(cwd, '.env'),
    resolve(home, '.hermes', '.env'),
    resolve(home, '.hermes', 'auth.json'),
    codexPath,
  ];
  const loaded = [];
  const isPool = (p) => p.endsWith('.hermes/auth.json');
  const isCodex = (p) => p === codexPath;
  for (const p of paths) {
    const keys = isPool(p)
      ? loadHermesPool(p, target)
      : isCodex(p)
        ? loadCodexAuth(p, target)
        : loadEnvFile(p, target);
    if (keys.length) loaded.push(p);
  }
  return loaded;
}
