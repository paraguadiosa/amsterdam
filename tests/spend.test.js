import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { readSpend, resolveDbPath } from '../src/spend.js';
import { formatSpendLine } from '../src/format.js';

const SCHEMA = `
  CREATE TABLE session_model_usage (
    session_id TEXT,
    model TEXT,
    billing_provider TEXT,
    billing_base_url TEXT,
    billing_mode TEXT,
    task TEXT,
    api_call_count INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_write_tokens INTEGER,
    reasoning_tokens INTEGER,
    estimated_cost_usd REAL,
    actual_cost_usd REAL,
    cost_status TEXT,
    cost_source TEXT,
    first_seen TEXT,
    last_seen TEXT
  );
`;

const ROWS = [
  // deepseek-v4-flash / deepseek — 2 distinct sessions across 3 rows.
  ['s1', 'deepseek-v4-flash', 'deepseek', 10, 1000, 500, 100, 50, 25, 1.1111, 1.0, 'estimated', '2026-08-01T00:00:00Z'],
  ['s2', 'deepseek-v4-flash', 'deepseek', 5, 2000, 1000, 200, 100, 50, 2.2222, 2.0, 'estimated', '2026-08-02T00:00:00Z'],
  ['s1', 'deepseek-v4-flash', 'deepseek', 3, 100, 100, 0, 0, 0, 0.00003, 0.0, 'estimated', '2026-08-03T00:00:00Z'],
  // claude-opus-4-8 — one estimated row, one null-status row.
  ['s9', 'claude-opus-4-8', 'anthropic', 1, 500, 200, 0, 0, 10, 0.16499, null, 'estimated', '2026-08-04T00:00:00Z'],
  ['s9', 'claude-opus-4-8', 'auto', 1, 500, 200, 0, 0, 10, 0, 0, null, '2026-08-04T00:00:00Z'],
  // kimi-k3 — unknown cost status.
  ['s9', 'kimi-k3', 'kimi-coding', 2, 300, 150, 0, 0, 0, 0, 0, 'unknown', '2026-08-05T00:00:00Z'],
  // Local GGUF — null estimated cost, null status.
  ['s9', '/models/local.gguf', 'custom', 1, 100, 100, 0, 0, 0, null, null, null, '2026-08-06T00:00:00Z'],
  // Phantom snapshot — unknown status but a large recorded cost that a
  // bad pricing run polluted. Must not surface anywhere.
  ['sX', 'deepseek-ai/DeepSeek-V3.2', 'huggingface', 12, 8456, 1503, 63296, 0, 0, 1252.287, 0, 'unknown', '2026-08-07T00:00:00Z'],
];

describe('spend', () => {
  let dir;
  let dbPath;

  function createFixture(rows = ROWS, schema = SCHEMA) {
    const db = new DatabaseSync(dbPath);
    db.exec(schema);
    const insert = db.prepare(`
      INSERT INTO session_model_usage (
        session_id, model, billing_provider, api_call_count, input_tokens,
        output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
        estimated_cost_usd, actual_cost_usd, cost_status, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) insert.run(...row);
    db.close();
  }

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-spend-'));
    dbPath = join(dir, 'state.db');
    createFixture();
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  // Isolate the local-models scan so the real ~/models never leaks in.
  function readFromDb(path = dbPath, modelsDir = join(dir, 'no-models')) {
    return readSpend({
      HERMES_STATE_DB: path,
      AMSTERDAM_LOCAL_MODELS_DIR: modelsDir,
    });
  }

  it('aggregates by model and provider', () => {
    const spend = readFromDb();
    assert.equal(spend.source, 'hermes-state-db');
    assert.ok(Date.parse(spend.generatedAt));

    const ds = spend.models.find((m) => m.model === 'deepseek-v4-flash');
    assert.equal(ds.provider, 'deepseek');
    assert.equal(ds.sessions, 2); // distinct sessions across 3 rows
    assert.equal(ds.calls, 18);
    assert.equal(ds.inputTokens, 3100);
    assert.equal(ds.outputTokens, 1600);
    assert.equal(ds.cacheReadTokens, 300);
    assert.equal(ds.cacheWriteTokens, 150);
    assert.equal(ds.reasoningTokens, 75);
    assert.equal(ds.estimatedCostUsd, 3.3333);
    assert.equal(ds.actualCostUsd, 3);
    assert.equal(ds.costStatus, 'estimated');
    assert.equal(ds.lastSeen, '2026-08-03T00:00:00Z');
  });

  it('marks groups with any non-estimated row as unknown', () => {
    const spend = readFromDb();

    const gguf = spend.models.find((m) => m.model === '/models/local.gguf');
    assert.equal(gguf.costStatus, 'local');
    assert.equal(gguf.estimatedCostUsd, 0);

    const kimi = spend.models.find((m) => m.model === 'kimi-k3');
    assert.equal(kimi.costStatus, 'unknown'); // no authoritative rate
  });

  it('nulls untrusted recorded costs from bad pricing snapshots', () => {
    const spend = readFromDb();

    const phantom = spend.models.find((m) => m.model === 'deepseek-ai/DeepSeek-V3.2');
    assert.ok(phantom);
    assert.equal(phantom.provider, 'huggingface');
    assert.equal(phantom.costStatus, 'unknown');
    assert.equal(phantom.estimatedCostUsd, null);
    // Tokens, actual cost, and lastSeen survive the purge.
    assert.equal(phantom.calls, 12);
    assert.equal(phantom.inputTokens, 8456);
    assert.equal(phantom.outputTokens, 1503);
    assert.equal(phantom.cacheReadTokens, 63296);
    assert.equal(phantom.actualCostUsd, 0);
    assert.equal(phantom.lastSeen, '2026-08-07T00:00:00Z');
    // No model carries the polluted snapshot anywhere.
    assert.ok(!spend.models.some((m) => m.estimatedCostUsd === 1252.287));
  });

  it('purges anthropic and claude models from the aggregation', () => {
    const spend = readFromDb();
    const leftovers = spend.models.filter(
      (m) => m.model.includes('claude') || m.provider === 'anthropic',
    );
    assert.equal(leftovers.length, 0);
    assert.equal(spend.models.some((m) => m.model === 'claude-opus-4-8'), false);
  });

  it('orders models by estimated cost descending with nulls last', () => {
    const spend = readFromDb();
    const costs = spend.models.map((m) => m.estimatedCostUsd);
    // Null cost sorts last; local and unknown models price as zero, and
    // the phantom snapshot is nulled before sorting.
    assert.deepEqual(costs, [3.3333, 0, 0, null]);
  });

  it('computes totals across all rows', () => {
    const spend = readFromDb();
    assert.equal(spend.modelCount, 4);
    // The phantom row is untrusted, so it is excluded from the total.
    assert.equal(spend.totalEstimatedUsd, 3.3333);
    assert.equal(spend.totalActualUsd, 3);
  });

  it('honors HERMES_STATE_DB env override', () => {
    const spend = readFromDb();
    assert.equal(spend.modelCount, 4);
  });

  it('returns null when the DB file is missing', () => {
    assert.equal(readFromDb(join(dir, 'missing.db')), null);
  });

  it('returns null when the path is unreadable', () => {
    assert.equal(readFromDb(dir), null); // a directory is not openable
  });

  it('returns null when the DB has no usage table', () => {
    const emptyPath = join(dir, 'empty.db');
    const db = new DatabaseSync(emptyPath);
    db.exec('CREATE TABLE other (id INTEGER)');
    db.close();
    assert.equal(readFromDb(emptyPath), null);
  });

  it('returns empty models for a DB with no rows', () => {
    const emptyPath = join(dir, 'norows.db');
    const db = new DatabaseSync(emptyPath);
    db.exec(SCHEMA);
    db.close();
    const spend = readFromDb(emptyPath);
    assert.ok(spend);
    assert.equal(spend.modelCount, 0);
    assert.deepEqual(spend.models, []);
    assert.equal(spend.totalEstimatedUsd, null);
  });
});

describe('local model inventory', () => {
  let dir;
  let dbPath;

  function fixtureDb(modelsDir) {
    return readSpend({
      HERMES_STATE_DB: dbPath,
      AMSTERDAM_LOCAL_MODELS_DIR: modelsDir,
    });
  }

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-local-'));
    dbPath = join(dir, 'state.db');
    const db = new DatabaseSync(dbPath);
    db.exec(SCHEMA);
    const insert = db.prepare(`
      INSERT INTO session_model_usage (
        session_id, model, billing_provider, api_call_count, input_tokens,
        output_tokens, estimated_cost_usd, actual_cost_usd, cost_status, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('s9', '/models/local.gguf', 'custom', 1, 100, 100, null, null, null, '2026-08-06T00:00:00Z');
    db.close();
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it('appends local GGUF files with no usage', () => {
    const modelsDir = join(dir, 'models');
    mkdirSync(modelsDir, { recursive: true });
    writeFileSync(join(modelsDir, 'Hermes-3-8B.Q8_0.gguf'), 'x');
    writeFileSync(join(modelsDir, 'Gemma4-12B.Q4_K_M.gguf'), 'x');

    const spend = fixtureDb(modelsDir);
    const local = spend.models.find((m) => m.model === 'Hermes-3-8B.Q8_0.gguf');
    assert.ok(local);
    assert.equal(local.provider, 'local');
    assert.equal(local.sessions, 0);
    assert.equal(local.calls, 0);
    assert.equal(local.costStatus, 'no usage');
    assert.equal(local.estimatedCostUsd, null);
    assert.equal(spend.modelCount, 3); // 1 DB group + 2 local
  });

  it('does not duplicate a GGUF file that already has usage', () => {
    const modelsDir = join(dir, 'models2');
    mkdirSync(modelsDir, { recursive: true });
    writeFileSync(join(modelsDir, 'local.gguf'), 'x'); // matches /models/local.gguf

    const spend = fixtureDb(modelsDir);
    assert.equal(spend.models.filter((m) => m.model === 'local.gguf').length, 0);
    const used = spend.models.find((m) => m.model === '/models/local.gguf');
    assert.ok(used);
    assert.equal(used.sessions, 1);
    assert.equal(spend.modelCount, 1);
  });

  it('ignores a missing models dir', () => {
    const spend = fixtureDb(join(dir, 'does-not-exist'));
    assert.equal(spend.modelCount, 1);
  });
});

describe('cost estimation fill', () => {
  let dir;
  let dbPath;

  const FILL_ROWS = [
    // deepseek-v4-flash routed as 'auto' — no recorded cost.
    ['s1', 'deepseek-v4-flash', 'auto', 1, 10000, 5000, 0, 0, 0, 0, 0, null, '2026-08-07T00:00:00Z'],
    // claude-opus-4-8 routed as 'auto' — no recorded cost.
    ['s2', 'claude-opus-4-8', 'auto', 1, 500, 200, 0, 0, 0, 0, 0, null, '2026-08-07T00:00:00Z'],
    // kimi-k3 — no authoritative rate in the pricing table.
    ['s3', 'kimi-k3', 'auto', 1, 100, 100, 0, 0, 0, 0, 0, null, '2026-08-07T00:00:00Z'],
    // Local GGUF with usage — free.
    ['s4', '/models/local.gguf', 'custom', 1, 1000, 500, 0, 0, 0, null, null, null, '2026-08-07T00:00:00Z'],
  ];

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-fill-'));
    dbPath = join(dir, 'state.db');
    const db = new DatabaseSync(dbPath);
    db.exec(SCHEMA);
    const insert = db.prepare(`
      INSERT INTO session_model_usage (
        session_id, model, billing_provider, api_call_count, input_tokens,
        output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
        estimated_cost_usd, actual_cost_usd, cost_status, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of FILL_ROWS) insert.run(...row);
    db.close();
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  function read() {
    return readSpend({
      HERMES_STATE_DB: dbPath,
      AMSTERDAM_LOCAL_MODELS_DIR: join(dir, 'no-models'),
    });
  }

  it('estimates deepseek-v4-flash from tokens', () => {
    const m = read().models.find((x) => x.model === 'deepseek-v4-flash');
    assert.equal(m.costStatus, 'estimated');
    assert.equal(m.estimatedCostUsd, 0.0028); // 10k in * 0.14 + 5k out * 0.28
  });

  it('purges claude even when tokens would fill a cost', () => {
    const models = read().models;
    assert.equal(models.some((x) => x.model === 'claude-opus-4-8'), false);
    assert.equal(models.length, 3); // deepseek, kimi, local gguf
  });

  it('keeps kimi-k3 as unknown (no authoritative rate)', () => {
    const m = read().models.find((x) => x.model === 'kimi-k3');
    assert.equal(m.costStatus, 'unknown');
    assert.equal(m.estimatedCostUsd, 0);
  });

  it('marks used local GGUF as free', () => {
    const m = read().models.find((x) => x.model === '/models/local.gguf');
    assert.equal(m.costStatus, 'local');
    assert.equal(m.estimatedCostUsd, 0);
  });
});

describe('resolveDbPath', () => {
  it('defaults to ~/.hermes/state.db', () => {
    assert.equal(resolveDbPath({}), join(homedir(), '.hermes', 'state.db'));
  });

  it('uses HERMES_STATE_DB when set', () => {
    assert.equal(resolveDbPath({ HERMES_STATE_DB: '/tmp/custom.db' }), '/tmp/custom.db');
  });

  it('expands a leading tilde', () => {
    assert.equal(
      resolveDbPath({ HERMES_STATE_DB: '~/custom.db' }),
      join(homedir(), 'custom.db'),
    );
  });
});

describe('formatSpendLine', () => {
  it('shows estimated cost with two decimals', () => {
    const line = formatSpendLine({
      model: 'deepseek-v4-flash',
      sessions: 59,
      costStatus: 'estimated',
      estimatedCostUsd: 1.0222,
    });
    assert.ok(line.includes('deepseek-v4-flash'));
    assert.ok(line.includes('$1.02'));
    assert.ok(line.includes('(59 sessions)'));
  });

  it('shows n/a for unknown status even with a zero cost', () => {
    const line = formatSpendLine({
      model: 'kimi-k3',
      sessions: 2,
      costStatus: 'unknown',
      estimatedCostUsd: 0,
    });
    assert.ok(line.includes('n/a'));
    assert.ok(!line.includes('$0.00'));
  });

  it('shows n/a for null estimated cost', () => {
    const line = formatSpendLine({
      model: '/models/local.gguf',
      sessions: 1,
      costStatus: 'estimated',
      estimatedCostUsd: null,
    });
    assert.ok(line.includes('n/a'));
  });

  it('shows free for local status', () => {
    const line = formatSpendLine({
      model: '/models/local.gguf',
      sessions: 1,
      costStatus: 'local',
      estimatedCostUsd: 0,
    });
    assert.ok(line.includes('free'));
    assert.ok(!line.includes('n/a'));
  });
});
