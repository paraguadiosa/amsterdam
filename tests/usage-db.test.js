import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { exportUsageToSqlite, resolveUsageDbPath } from '../src/usage-db.js';

// sess-a: two counted assistant calls in project amsterdam.
const SESS_A = [
  '{"type":"session","version":3,"id":"sess-a","timestamp":"2026-08-07T00:00:00Z","cwd":"/home/eve/Coding_Projects/amsterdam"}',
  '{"type":"message","id":"m1","timestamp":"2026-08-07T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":1000,"output":200,"cacheRead":50,"cacheWrite":10,"reasoning":30,"totalTokens":1290,"cost":{"total":0.0003}}}}',
  '{"type":"message","id":"m2","timestamp":"2026-08-07T00:02:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":500,"output":100,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":600,"cost":{"total":0.0001}}}}',
  'not json at all',
];

// sess-b: one counted call in the home project on a different day.
const SESS_B = [
  '{"type":"session","version":3,"id":"sess-b","timestamp":"2026-08-08T00:00:00Z","cwd":"/home/eve"}',
  '{"type":"message","id":"m5","timestamp":"2026-08-08T00:01:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-5","usage":{"input":2000,"output":500,"cacheRead":100,"cacheWrite":0,"reasoning":50,"totalTokens":2650,"cost":{"total":0.0031}}}}',
];

describe('usage db export', () => {
  let dir;
  let sessionsDir;
  let dbPath;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-usage-db-'));
    sessionsDir = join(dir, 'sessions');
    dbPath = join(dir, 'out', 'usage.db');
    mkdirSync(join(sessionsDir, '--home-eve-Coding_Projects-amsterdam--'), { recursive: true });
    mkdirSync(join(sessionsDir, '--home-eve--'), { recursive: true });
    writeFileSync(
      join(sessionsDir, '--home-eve-Coding_Projects-amsterdam--', '2026-08-07T00-00-00-000Z_sess-a.jsonl'),
      SESS_A.join('\n') + '\n',
    );
    writeFileSync(
      join(sessionsDir, '--home-eve--', '2026-08-08T00-00-00-000Z_sess-b.jsonl'),
      SESS_B.join('\n') + '\n',
    );
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  // node:sqlite rows are null-prototype objects; spread them into plain
  // objects so deepEqual comparisons work.
  function query(sql) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return db.prepare(sql).all().map((row) => ({ ...row }));
    } finally {
      db.close();
    }
  }

  it('exports one row per counted call and reports stats', () => {
    const stats = exportUsageToSqlite({ sessionsDir, dbPath });
    assert.equal(stats.dbPath, dbPath);
    assert.equal(stats.sessionsDir, sessionsDir);
    assert.equal(stats.sessionsFound, true);
    assert.equal(stats.rows, 3);
    assert.equal(stats.malformedLines, 1);

    const rows = query('SELECT * FROM calls ORDER BY timestamp');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], {
      id: 1,
      timestamp: '2026-08-07T00:01:00Z',
      session_id: 'sess-a',
      project: 'amsterdam',
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
      input_tokens: 1000,
      output_tokens: 200,
      cache_read_tokens: 50,
      reasoning_tokens: 30,
      total_tokens: 1290,
      cost_usd: 0.0003,
      source: 'pi-sessions',
    });
  });

  it('aggregates per day, model, and project in the view', () => {
    exportUsageToSqlite({ sessionsDir, dbPath });
    const view = query('SELECT * FROM daily_model_spend ORDER BY day');
    assert.deepEqual(view, [
      {
        day: '2026-08-07',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        project: 'amsterdam',
        calls: 2,
        total_tokens: 1890,
        cost_usd: 0.0004,
      },
      {
        day: '2026-08-08',
        model: 'gpt-5',
        provider: 'openai',
        project: 'home',
        calls: 1,
        total_tokens: 2650,
        cost_usd: 0.0031,
      },
    ]);
  });

  it('aggregates into 5-minute buckets in the spend_5min view', () => {
    exportUsageToSqlite({ sessionsDir, dbPath });
    const view = query('SELECT * FROM spend_5min ORDER BY bucket');
    assert.deepEqual(view, [
      {
        bucket: '2026-08-07 00:00',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        calls: 2,
        total_tokens: 1890,
        cost_usd: 0.0004,
      },
      {
        bucket: '2026-08-08 00:00',
        model: 'gpt-5',
        provider: 'openai',
        calls: 1,
        total_tokens: 2650,
        cost_usd: 0.0031,
      },
    ]);
  });

  it('is idempotent: a re-run refreshes instead of duplicating', () => {
    exportUsageToSqlite({ sessionsDir, dbPath });
    exportUsageToSqlite({ sessionsDir, dbPath });
    const rows = query('SELECT COUNT(*) AS n, ROUND(SUM(cost_usd), 6) AS usd FROM calls');
    assert.deepEqual(rows, [{ n: 3, usd: 0.0035 }]);
  });

  it('exports an empty table when the sessions dir is missing', () => {
    const stats = exportUsageToSqlite({
      sessionsDir: join(dir, 'missing'),
      dbPath,
    });
    assert.equal(stats.sessionsFound, false);
    assert.equal(stats.rows, 0);
    const rows = query('SELECT COUNT(*) AS n FROM calls');
    assert.deepEqual(rows, [{ n: 0 }]);
  });
});

describe('resolveUsageDbPath', () => {
  it('defaults to the repo data dir', () => {
    assert.ok(resolveUsageDbPath({}).endsWith(join('data', 'usage.db')));
  });

  it('uses USAGE_DB when set', () => {
    assert.equal(resolveUsageDbPath({ USAGE_DB: '/tmp/usage.db' }), '/tmp/usage.db');
  });

  it('expands a leading tilde', () => {
    assert.equal(
      resolveUsageDbPath({ USAGE_DB: '~/usage.db' }),
      join(homedir(), 'usage.db'),
    );
  });
});
