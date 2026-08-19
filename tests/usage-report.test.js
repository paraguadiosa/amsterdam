import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { exportUsageToSqlite } from '../src/usage-db.js';
import {
  readBuckets,
  renderUsageReport,
  resolveUsageReportPath,
} from '../src/usage-report.js';

// Two calls in one 5-minute bucket on day 1, one call on day 2.
const SESS_A = [
  '{"type":"session","version":3,"id":"sess-a","timestamp":"2026-08-07T00:00:00Z","cwd":"/home/eve/Coding_Projects/amsterdam"}',
  '{"type":"message","id":"m1","timestamp":"2026-08-07T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":1000,"output":200,"totalTokens":1290,"cost":{"total":0.0003}}}}',
  '{"type":"message","id":"m2","timestamp":"2026-08-07T00:02:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":500,"output":100,"totalTokens":600,"cost":{"total":0.0001}}}}',
];
const SESS_B = [
  '{"type":"session","version":3,"id":"sess-b","timestamp":"2026-08-08T00:00:00Z","cwd":"/home/eve"}',
  '{"type":"message","id":"m5","timestamp":"2026-08-08T00:01:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-5","usage":{"input":2000,"output":500,"totalTokens":2650,"cost":{"total":0.0031}}}}',
];

describe('usage report', () => {
  let dir;
  let sessionsDir;
  let dbPath;
  let outPath;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-usage-report-'));
    sessionsDir = join(dir, 'sessions');
    dbPath = join(dir, 'usage.db');
    outPath = join(dir, 'report.html');
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
    exportUsageToSqlite({ sessionsDir, dbPath });
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it('reads non-empty buckets with cost per model and provider', () => {
    const rows = readBuckets(dbPath);
    assert.deepEqual(rows, [
      { bucket: '2026-08-07 00:00', model: 'deepseek-v4-flash', provider: 'deepseek', calls: 2, costUsd: 0.0004 },
      { bucket: '2026-08-08 00:00', model: 'gpt-5', provider: 'openai', calls: 1, costUsd: 0.0031 },
    ]);
  });

  it('keeps only the last maxBuckets distinct buckets', () => {
    const rows = readBuckets(dbPath, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bucket, '2026-08-08 00:00');
  });

  it('renders a self-contained HTML chart with one series per model', () => {
    const stats = renderUsageReport({ dbPath, outPath });
    assert.equal(stats.outPath, outPath);
    assert.equal(stats.buckets, 2);
    assert.deepEqual(stats.series, ['gpt-5 · openai', 'deepseek-v4-flash · deepseek']);
    assert.equal(stats.totalUsd, 0.0035);

    const html = readFileSync(outPath, 'utf8');
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('gpt-5 · openai'));
    assert.ok(html.includes('deepseek-v4-flash · deepseek'));
    assert.ok(html.includes('2026-08-08 00:00')); // bucket label in a segment title
    assert.ok(html.includes('total $0.0035'));
    assert.ok(!html.includes('script')); // static file, no JavaScript
  });

  it('renders an empty state when there is no spend', () => {
    const emptyDir = join(dir, 'empty-sessions');
    const emptyDb = join(dir, 'empty.db');
    const emptyOut = join(dir, 'empty.html');
    mkdirSync(emptyDir, { recursive: true });
    exportUsageToSqlite({ sessionsDir: emptyDir, dbPath: emptyDb });
    const stats = renderUsageReport({ dbPath: emptyDb, outPath: emptyOut });
    assert.equal(stats.buckets, 0);
    assert.equal(stats.totalUsd, 0);
    const html = readFileSync(emptyOut, 'utf8');
    assert.ok(html.includes('No spend recorded yet'));
  });
});

describe('resolveUsageReportPath', () => {
  it('defaults to the repo data dir', () => {
    assert.ok(resolveUsageReportPath({}).endsWith(join('data', 'usage-report.html')));
  });

  it('uses USAGE_REPORT when set', () => {
    assert.equal(resolveUsageReportPath({ USAGE_REPORT: '/tmp/r.html' }), '/tmp/r.html');
  });

  it('expands a leading tilde', () => {
    assert.equal(resolveUsageReportPath({ USAGE_REPORT: '~/r.html' }), join(homedir(), 'r.html'));
  });
});
