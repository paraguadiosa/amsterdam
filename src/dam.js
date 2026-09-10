#!/usr/bin/env node
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import providers from './providers/index.js';
import { loadDefaults } from './env.js';
import { formatBillingJs, formatConsoleLine } from './format.js';
import { getManualCredits, openDefaultManualStore, closeManualStore } from './manual-credits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const TIMEOUT_MS = 10_000;

export async function withTimeout(promise, ms) {
  let timer;
  const race = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([promise, race]);
  } finally {
    clearTimeout(timer);
  }
}

// Read the manual-credit map, opening the default store when none is
// passed. Never throws: an unavailable store reads as an empty map.
function readManualCredits(store) {
  if (store) {
    try {
      return getManualCredits(store) || {};
    } catch {
      return {};
    }
  }
  let opened = null;
  try {
    opened = openDefaultManualStore();
    return getManualCredits(opened) || {};
  } catch {
    return {};
  } finally {
    if (opened) closeManualStore(opened);
  }
}

export async function openFloodgates(env = process.env, fetchFn = globalThis.fetch, manualStore) {
  const results = {};

  const tasks = providers.map(async (provider) => {
    const apiKey = env[provider.envKey];
    if (!apiKey) {
      results[provider.id] = { detected: false };
      return;
    }
    const baseUrl = (provider.baseUrlEnv && env[provider.baseUrlEnv]) || provider.defaultBaseUrl;
    try {
      const data = await withTimeout(
        provider.fetchBalance({ apiKey, baseUrl }, fetchFn),
        TIMEOUT_MS,
      );
      results[provider.id] = { detected: true, ...data };
    } catch (err) {
      results[provider.id] = { detected: true, error: err.message };
    }
  });

  await Promise.allSettled(tasks);

  const manualCredits = readManualCredits(manualStore);

  // Pi has no catalog entry: it is a manual budget, editable from the
  // chip. Without a credit there is nothing to show.
  if (manualCredits.pi != null) {
    results.pi = { detected: true, kind: 'manual', credit: Number(manualCredits.pi) };
  }

  // Other manual credits ride along on their provider result so the
  // dashboard reads them from the payload instead of localStorage.
  for (const [id, amount] of Object.entries(manualCredits)) {
    if (id === 'pi') continue;
    if (!results[id]) results[id] = { detected: false };
    results[id].credit = Number(amount);
  }

  return {
    timestamp: new Date().toISOString(),
    providers: results,
  };
}

async function main() {
  console.log('Opening the floodgates...\n');

  const loaded = loadDefaults();
  if (loaded.length) {
    for (const p of loaded) console.log(`  ${p}`);
    console.log();
  }

  const billing = await openFloodgates();

  for (const [id, result] of Object.entries(billing.providers)) {
    console.log(formatConsoleLine(id, result));
  }

  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = resolve(DATA_DIR, 'billing.js');
  writeFileSync(outPath, formatBillingJs(billing));
  // Billing figures are private: keep the snapshot owner-only.
  chmodSync(outPath, 0o600);
  console.log(`\nSaved ${outPath}`);
}

const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
