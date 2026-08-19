import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bucket5min, buildTimeline, readUsageSources } from '../src/usage-sources.js';

// Pi fixture: one deepseek call and one claude call in a single session.
const SESS_A = [
  '{"type":"session","version":3,"id":"sess-a","timestamp":"2026-08-07T00:00:00Z","cwd":"/home/eve/Coding_Projects/amsterdam"}',
  '{"type":"message","id":"m1","timestamp":"2026-08-07T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":1000,"output":200,"totalTokens":1290,"cost":{"total":0.0003}}}}',
  '{"type":"message","id":"m2","timestamp":"2026-08-07T00:02:00Z","message":{"role":"assistant","provider":"anthropic","model":"claude-opus-4-6","usage":{"totalTokens":1110,"cost":{"total":0.012}}}}',
];

const HERMES_SCHEMA = `
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

const HERMES_ROWS = [
  ['s1', 'deepseek-v4-flash', 'deepseek', 10, 1000, 500, 100, 50, 25, 1.5, 1.0, 'estimated', '2026-08-01T00:00:00Z'],
  // last_seen as Unix epoch seconds — the format the real Hermes DB uses.
  ['s2', 'kimi-k3', 'kimi-coding', 2, 300, 150, 0, 0, 0, 0, 0, 'unknown', 1785888000],
  // Phantom snapshot: unknown status with a recorded cost must turn n/a.
  ['s3', 'phantom-model', 'huggingface', 1, 100, 50, 0, 0, 0, 99.9, 0, 'unknown', '2026-08-03T00:00:00Z'],
];

describe('usage sources', () => {
  let dir;
  let env;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-usage-sources-'));
    const sessionsDir = join(dir, 'sessions');
    const sessDir = join(sessionsDir, '--home-eve-Coding_Projects-amsterdam--');
    mkdirSync(sessDir, { recursive: true });
    writeFileSync(join(sessDir, '2026-08-07T00-00-00-000Z_sess-a.jsonl'), SESS_A.join('\n') + '\n');

    const dbPath = join(dir, 'state.db');
    const db = new DatabaseSync(dbPath);
    db.exec(HERMES_SCHEMA);
    const insert = db.prepare(`
      INSERT INTO session_model_usage (
        session_id, model, billing_provider, api_call_count, input_tokens,
        output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
        estimated_cost_usd, actual_cost_usd, cost_status, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of HERMES_ROWS) insert.run(...row);
    db.close();

    env = {
      PI_SESSIONS_DIR: sessionsDir,
      HERMES_STATE_DB: dbPath,
      AMSTERDAM_LOCAL_MODELS_DIR: join(dir, 'no-models'),
    };
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it('lists every registered orchestrator', () => {
    const usage = readUsageSources(env);
    assert.equal(usage.source, 'usage-sources');
    assert.ok(Date.parse(usage.generatedAt));
    assert.deepEqual(usage.sources.map((s) => s.id), ['pi', 'hermes']);
    assert.deepEqual(usage.sources.map((s) => s.kind), ['actual', 'estimated']);
  });

  it('normalizes Pi models with actual billed cost', () => {
    const pi = readUsageSources(env).sources.find((s) => s.id === 'pi');
    assert.equal(pi.available, true);
    assert.equal(pi.totalUsd, 0.0123);
    assert.equal(pi.totalCalls, 2);
    assert.equal(pi.totalTokens, 2400);
    assert.equal(pi.sessionCount, 1);
    assert.equal(pi.lastSeen, '2026-08-07T00:02:00Z');

    const claude = pi.models.find((m) => m.model === 'claude-opus-4-6');
    // Monitoring shows the logs as they are — no provider is hidden.
    assert.deepEqual(claude, {
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      calls: 1,
      sessions: 1,
      tokens: 1110,
      costUsd: 0.012,
      costStatus: 'actual',
      lastSeen: '2026-08-07T00:02:00Z',
    });
  });

  it('normalizes Hermes models with estimated cost and token sum', () => {
    const hermes = readUsageSources(env).sources.find((s) => s.id === 'hermes');
    assert.equal(hermes.available, true);
    assert.equal(hermes.totalUsd, 1.5);
    assert.equal(hermes.sessionCount, null); // Hermes has no global count
    // Epoch seconds are normalized to ISO (1785888000 = 2026-08-05).
    assert.equal(hermes.lastSeen, '2026-08-05T00:00:00.000Z');

    const ds = hermes.models.find((m) => m.model === 'deepseek-v4-flash');
    assert.equal(ds.tokens, 1675); // input+output+cacheRead+cacheWrite+reasoning
    assert.equal(ds.costUsd, 1.5);
    assert.equal(ds.costStatus, 'estimated');

    const kimi = hermes.models.find((m) => m.model === 'kimi-k3');
    assert.equal(kimi.costUsd, 0); // a recorded zero is not a snapshot
    assert.equal(kimi.costStatus, 'unknown');
    assert.equal(kimi.lastSeen, '2026-08-05T00:00:00.000Z');

    const phantom = hermes.models.find((m) => m.model === 'phantom-model');
    assert.equal(phantom.costUsd, null); // untrusted snapshot stays n/a
    assert.equal(phantom.costStatus, 'unknown');
  });

  it('sums the grand total across orchestrators', () => {
    assert.equal(readUsageSources(env).totalUsd, 1.5123);
  });

  it('builds a 5-minute timeline from Pi calls', () => {
    const usage = readUsageSources(env);
    assert.equal(usage.timeline.available, true);
    assert.equal(usage.timeline.grain, '5min');
    assert.equal(usage.timeline.timezone, 'UTC');
    assert.deepEqual(usage.timeline.rows, [
      {
        bucket: '2026-08-07 00:00',
        model: 'claude-opus-4-6',
        provider: 'anthropic',
        calls: 1,
        costUsd: 0.012,
      },
      {
        bucket: '2026-08-07 00:00',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        calls: 1,
        costUsd: 0.0003,
      },
    ]);
  });

  it('reports a missing orchestrator as unavailable instead of failing', () => {
    const usage = readUsageSources({
      PI_SESSIONS_DIR: join(dir, 'missing'),
      HERMES_STATE_DB: join(dir, 'missing.db'),
      AMSTERDAM_LOCAL_MODELS_DIR: join(dir, 'no-models'),
    });
    assert.equal(usage.totalUsd, 0);
    for (const src of usage.sources) {
      assert.equal(src.available, false);
      assert.equal(src.totalUsd, 0);
      assert.deepEqual(src.models, []);
      assert.equal(src.lastSeen, null);
    }
    assert.equal(usage.timeline.available, false);
    assert.deepEqual(usage.timeline.rows, []);
  });

  it('can cap the timeline to the newest buckets', () => {
    const capped = buildTimeline(env, 1);
    assert.equal(capped.available, true);
    assert.deepEqual([...new Set(capped.rows.map((r) => r.bucket))], ['2026-08-07 00:00']);
  });
});

describe('bucket5min', () => {
  it('floors an ISO timestamp to a UTC 5-minute label', () => {
    assert.equal(bucket5min('2026-08-07T00:01:00Z'), '2026-08-07 00:00');
    assert.equal(bucket5min('2026-08-07T00:04:59Z'), '2026-08-07 00:00');
    assert.equal(bucket5min('2026-08-07T00:05:00Z'), '2026-08-07 00:05');
  });

  it('returns null for a missing or invalid timestamp', () => {
    assert.equal(bucket5min(null), null);
    assert.equal(bucket5min('not-a-date'), null);
  });
});

describe('buildTimeline', () => {
  it('returns unavailable when the sessions dir is missing', () => {
    const timeline = buildTimeline({ PI_SESSIONS_DIR: '/no/such/sessions' });
    assert.equal(timeline.available, false);
    assert.deepEqual(timeline.rows, []);
  });

});
