// Read-only per-model spend aggregation from the local Hermes state DB.
// The Hermes agent owns ~/.hermes/state.db; Amsterdam only reads it.
import { DatabaseSync } from 'node:sqlite';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';

const DEFAULT_DB_PATH = join(homedir(), '.hermes', 'state.db');
const DEFAULT_LOCAL_MODELS_DIR = join(homedir(), 'models');

// Cost status is trustworthy only when every row in the group says so.
// A single missing or unknown status makes the whole group unknown.
const AGGREGATE_SQL = `
  SELECT
    model,
    billing_provider AS provider,
    COUNT(DISTINCT session_id) AS sessions,
    SUM(api_call_count) AS calls,
    SUM(input_tokens) AS inputTokens,
    SUM(output_tokens) AS outputTokens,
    SUM(cache_read_tokens) AS cacheReadTokens,
    SUM(cache_write_tokens) AS cacheWriteTokens,
    SUM(reasoning_tokens) AS reasoningTokens,
    ROUND(SUM(estimated_cost_usd), 4) AS estimatedCostUsd,
    ROUND(SUM(actual_cost_usd), 4) AS actualCostUsd,
    CASE
      WHEN SUM(CASE WHEN cost_status = 'estimated' THEN 1 ELSE 0 END) = COUNT(*)
        THEN 'estimated'
      ELSE 'unknown'
    END AS costStatus,
    MAX(last_seen) AS lastSeen
  FROM session_model_usage
  WHERE LOWER(billing_provider) <> 'anthropic'
    AND LOWER(model) NOT LIKE 'claude%'
  GROUP BY model, billing_provider
  ORDER BY estimatedCostUsd DESC, model ASC, billing_provider ASC
`;

const TOTAL_SQL = `
  SELECT
    ROUND(SUM(CASE WHEN cost_status = 'estimated' THEN estimated_cost_usd ELSE 0 END), 4) AS estimated,
    ROUND(SUM(actual_cost_usd), 4) AS actual
  FROM session_model_usage
  WHERE LOWER(billing_provider) <> 'anthropic'
    AND LOWER(model) NOT LIKE 'claude%'
`;

// Resolve the state DB path from an env-like object.
// HERMES_STATE_DB overrides the default ~/.hermes/state.db.
export function resolveDbPath(env = process.env) {
  const raw = env.HERMES_STATE_DB || DEFAULT_DB_PATH;
  return raw.replace(/^~(?=\/|$)/, homedir());
}

// Resolve the local models directory from an env-like object.
// AMSTERDAM_LOCAL_MODELS_DIR overrides the default ~/models (tests point it
// at a fixture dir).
export function resolveLocalModelsDir(env = process.env) {
  return env.AMSTERDAM_LOCAL_MODELS_DIR || DEFAULT_LOCAL_MODELS_DIR;
}

// GGUF files in the local models dir. Missing dir = empty list, never throws.
function listLocalModels(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.gguf') || f.endsWith('.ggml'))
      .sort();
  } catch {
    return [];
  }
}

// USD per 1M tokens, mirroring the rates Hermes uses for its own estimates.
// Only models with an authoritative rate are listed; unknown models keep n/a.
const PRICING = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28, cacheRead: 0.0028 },
  'deepseek-v4-pro': { input: 0.435, output: 0.87, cacheRead: 0.003625 },
};

function isLocalModel(model, provider) {
  return model.includes('.gguf') && (provider === 'custom' || provider === 'local' || provider === '');
}

// Fill cost gaps for groups that have usage but no trustworthy estimate:
// local GGUF runs are free, priced cloud models get a token-based estimate.
// Groups without a known rate (or a recorded-but-untrusted cost) stay n/a.
function fillMissingCosts(models) {
  for (const m of models) {
    if (m.costStatus === 'estimated' || m.costStatus === 'no usage') continue;
    if (isLocalModel(m.model, m.provider)) {
      m.costStatus = 'local';
      m.estimatedCostUsd = 0;
      continue;
    }
    const price = PRICING[m.model];
    if (!price || (!m.inputTokens && !m.outputTokens)) continue;
    const usd =
      (m.inputTokens / 1e6) * price.input +
      (m.outputTokens / 1e6) * price.output +
      ((m.cacheReadTokens || 0) / 1e6) * (price.cacheRead || 0) +
      ((m.cacheWriteTokens || 0) / 1e6) * (price.cacheWrite || 0);
    if (usd > 0) {
      m.costStatus = 'estimated';
      m.estimatedCostUsd = Math.round(usd * 10000) / 10000;
    }
  }
  return models;
}

// A recorded cost is only trustworthy when the whole group is 'estimated'.
// Groups marked 'unknown' (for example a bad pricing snapshot) keep their
// tokens and actual cost but drop the estimated number, so no phantom
// figure leaks into the totals or the table. A recorded zero is not a
// snapshot, so it stays as-is.
function dropUntrustedCosts(models) {
  for (const m of models) {
    if (m.costStatus === 'unknown' && m.estimatedCostUsd) m.estimatedCostUsd = null;
  }
  return models;
}

// The SQL orders by the raw recorded cost, which an untrusted snapshot can
// pollute. Re-sort so null/unknown costs land last, matching the UI sort.
function sortByCost(models) {
  return models.sort((a, b) => {
    const av = a.estimatedCostUsd;
    const bv = b.estimatedCostUsd;
    const aNa = av == null;
    const bNa = bv == null;
    if (aNa && bNa) return String(a.model).localeCompare(String(b.model));
    if (aNa) return 1;
    if (bNa) return -1;
    return bv - av || String(a.model).localeCompare(String(b.model));
  });
}

// Read spend from the Hermes state DB. Never throws: any failure returns
// null so the rest of Amsterdam keeps working (CI and Docker have no DB).
// Accepts either a plain path or an env-like object with HERMES_STATE_DB.
export function readSpend(arg) {
  const env = typeof arg === 'string' ? process.env : arg;
  const dbPath = typeof arg === 'string' ? arg : resolveDbPath(arg);
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const totals = db.prepare(TOTAL_SQL).get();
    const rows = db.prepare(AGGREGATE_SQL).all();
    db.close();
    db = null;
    const models = rows.map((row) => ({
      model: row.model,
      provider: row.provider,
      sessions: row.sessions,
      calls: row.calls,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadTokens: row.cacheReadTokens,
      cacheWriteTokens: row.cacheWriteTokens,
      reasoningTokens: row.reasoningTokens,
      estimatedCostUsd: row.estimatedCostUsd,
      actualCostUsd: row.actualCostUsd,
      costStatus: row.costStatus,
      lastSeen: row.lastSeen,
    }));
    // Local GGUF files without recorded usage still appear, so the inventory
    // is complete. Basename match prevents duplicates with used models.
    const seen = new Set(models.map((m) => basename(m.model)));
    for (const file of listLocalModels(resolveLocalModelsDir(env))) {
      if (seen.has(file)) continue;
      models.push({
        model: file,
        provider: 'local',
        sessions: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: null,
        actualCostUsd: null,
        costStatus: 'no usage',
        lastSeen: null,
      });
    }
    fillMissingCosts(models);
    dropUntrustedCosts(models);
    sortByCost(models);
    return {
      source: 'hermes-state-db',
      generatedAt: new Date().toISOString(),
      totalEstimatedUsd: totals.estimated,
      totalActualUsd: totals.actual,
      modelCount: models.length,
      models,
    };
  } catch {
    try {
      if (db) db.close();
    } catch {
      // Close failure is irrelevant — the DB stays untouched.
    }
    return null;
  }
}
