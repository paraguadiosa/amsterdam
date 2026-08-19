// Unified usage across orchestrators (Pi, Hermes, and whatever comes
// next). Every orchestrator normalizes its own data into one shape, so
// the Amsterdam Monitor page and /api/usage treat all of them alike.
// Adding an orchestrator = one entry in SOURCES with a read(env) that
// returns { models, totalUsd, sessionCount } or null when unavailable.
import { readSpend } from './spend.js';
import { readPiCalls, readPiSpend } from './pi-spend.js';

// Normalized model row: model, provider, calls, sessions, tokens,
// costUsd (null = unknown), costStatus, lastSeen (ISO or null).
const SOURCES = [
  {
    id: 'pi',
    label: 'Pi sessions',
    kind: 'actual', // real billed USD parsed from the session logs
    read: readPiSource,
  },
  {
    id: 'hermes',
    label: 'Hermes',
    kind: 'estimated', // estimated USD from the agent state DB
    read: readHermesSource,
  },
];

function readPiSource(env) {
  const pi = readPiSpend(env);
  if (!pi) return null;
  return {
    models: pi.models.map((m) => ({
      model: m.model,
      provider: m.provider,
      calls: m.calls,
      sessions: m.sessions,
      tokens: m.totalTokens,
      costUsd: m.costUsd,
      costStatus: 'actual',
      lastSeen: m.lastSeen,
    })),
    totalUsd: pi.totalUsd,
    sessionCount: pi.sessionCount,
  };
}

// Hermes stores last_seen as Unix epoch seconds; Pi logs use ISO
// strings. Normalize to ISO so the page can sort and format either.
function toIso(value) {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isFinite(num)) {
    const ms = num > 1e12 ? num : num * 1000;
    return new Date(ms).toISOString();
  }
  return String(value);
}

function readHermesSource(env) {
  const spend = readSpend(env);
  if (!spend) return null;
  const models = spend.models
    .filter((m) => m.calls > 0)
    .map((m) => ({
      model: m.model,
      provider: m.provider,
      calls: m.calls,
      sessions: m.sessions,
      tokens:
        (m.inputTokens || 0) +
        (m.outputTokens || 0) +
        (m.cacheReadTokens || 0) +
        (m.cacheWriteTokens || 0) +
        (m.reasoningTokens || 0),
      costUsd: m.estimatedCostUsd,
      costStatus: m.costStatus || 'unknown',
      lastSeen: toIso(m.lastSeen),
    }));
  // Hermes has no cross-model distinct session count; null means n/a.
  return { models, totalUsd: spend.totalEstimatedUsd || 0, sessionCount: null };
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

// Floor an ISO timestamp to a UTC 5-minute bucket label: 'YYYY-MM-DD HH:MM'.
export function bucket5min(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 5) * 5);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

// Build a 5-minute spend timeline from Pi calls. The full history ships
// to the page, which filters by time range client-side (Grafana style).
// Hermes has no per-call timestamps, so it cannot contribute. Missing
// logs return available:false. maxBuckets caps the newest buckets kept.
export function buildTimeline(env = process.env, maxBuckets = Infinity) {
  const found = readPiCalls(env);
  if (!found) return { available: false, grain: '5min', timezone: 'UTC', rows: [] };
  const map = new Map();
  for (const call of found.calls) {
    const bucket = bucket5min(call.timestamp);
    if (!bucket) continue;
    const key = bucket + '\u0000' + call.model + '\u0000' + call.provider;
    let row = map.get(key);
    if (!row) {
      row = { bucket, model: call.model, provider: call.provider, calls: 0, costUsd: 0 };
      map.set(key, row);
    }
    row.calls += 1;
    row.costUsd += call.costUsd;
  }
  let all = [...map.values()];
  if (Number.isFinite(maxBuckets)) {
    const kept = new Set([...new Set(all.map((r) => r.bucket))].sort().slice(-maxBuckets));
    all = all.filter((r) => kept.has(r.bucket));
  }
  const rows = all
    .map((r) => ({ ...r, costUsd: round4(r.costUsd) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || b.costUsd - a.costUsd);
  return { available: true, grain: '5min', timezone: 'UTC', rows };
}

function summarize(models) {
  let calls = 0;
  let tokens = 0;
  let lastSeen = null;
  for (const m of models) {
    calls += m.calls;
    tokens += m.tokens;
    if (m.lastSeen && (!lastSeen || m.lastSeen > lastSeen)) lastSeen = m.lastSeen;
  }
  return { calls, tokens, lastSeen };
}

// Read every orchestrator. Never throws: an unavailable source is
// reported with available:false, so the monitor shows what is down
// instead of failing entirely.
export function readUsageSources(env = process.env) {
  const sources = SOURCES.map((entry) => {
    let data = null;
    try {
      data = entry.read(env);
    } catch {
      data = null; // a broken source counts as unavailable
    }
    const models = data ? data.models : [];
    const { calls, tokens, lastSeen } = summarize(models);
    return {
      id: entry.id,
      label: entry.label,
      kind: entry.kind,
      available: data !== null,
      totalUsd: data ? round4(data.totalUsd || 0) : 0,
      totalCalls: calls,
      totalTokens: tokens,
      modelCount: models.length,
      sessionCount: data ? data.sessionCount : null,
      lastSeen,
      models,
    };
  });
  return {
    source: 'usage-sources',
    generatedAt: new Date().toISOString(),
    totalUsd: round4(sources.reduce((sum, s) => sum + s.totalUsd, 0)),
    sources,
    timeline: buildTimeline(env),
  };
}
