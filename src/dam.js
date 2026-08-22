#!/usr/bin/env node
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import providers from './providers/index.js';
import { loadDefaults } from './env.js';
import { readSpend } from './spend.js';
import { readPiSpend } from './pi-spend.js';
import { formatBillingJs, formatConsoleLine, formatSpendLine, formatPiSpendLine } from './format.js';
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

function round2(n) {
  return Math.round(n * 100) / 100;
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
  const piSpend = readPiSpend(env);

  // Pi has no catalog entry: it is a manual budget minus the real
  // billed spend from the pi session logs.
  if (manualCredits.pi != null || piSpend) {
    const credit = manualCredits.pi != null ? Number(manualCredits.pi) : null;
    const spend = piSpend && Number.isFinite(piSpend.totalUsd)
      ? Math.round(piSpend.totalUsd * 10000) / 10000
      : null;
    const remaining = credit != null && spend != null ? round2(credit - spend) : null;
    results.pi = { detected: true, kind: 'manual', spend, credit, remaining };
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
    spend: readSpend(env),
    piSpend,
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

  if (billing.spend) {
    console.log('\nSpend by model');
    if (billing.spend.models.length) {
      for (const model of billing.spend.models) console.log(formatSpendLine(model));
    } else {
      console.log('  No usage recorded yet.');
    }
  }

  if (billing.piSpend) {
    console.log('\nSpend by Pi');
    console.log(`  Pi total: $${billing.piSpend.totalUsd.toFixed(2)} (actual)`);
    if (billing.piSpend.models.length) {
      for (const model of billing.piSpend.models) console.log(formatPiSpendLine(model));
    } else {
      console.log('  No usage recorded yet.');
    }
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
