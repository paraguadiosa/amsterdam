#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import providers from './providers/index.js';
import { loadDefaults } from './env.js';
import { readSpend } from './spend.js';
import { formatBillingJs, formatConsoleLine, formatSpendLine } from './format.js';

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

export async function openFloodgates(env = process.env, fetchFn = globalThis.fetch) {
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

  return {
    timestamp: new Date().toISOString(),
    providers: results,
    spend: readSpend(env),
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

  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = resolve(DATA_DIR, 'billing.js');
  writeFileSync(outPath, formatBillingJs(billing));
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
