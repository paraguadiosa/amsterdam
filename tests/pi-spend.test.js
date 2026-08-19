import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { readPiCalls, readPiSpend, resolvePiSessionsDir } from '../src/pi-spend.js';

// sess-a: cwd /home/eve/Coding_Projects/amsterdam (project amsterdam).
// Includes a user message, an assistant message without usage, a
// model_change event (ignored), and one malformed line.
const SESS_A = [
  '{"type":"session","version":3,"id":"sess-a","timestamp":"2026-08-07T00:00:00Z","cwd":"/home/eve/Coding_Projects/amsterdam"}',
  '{"type":"message","id":"m1","timestamp":"2026-08-07T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":1000,"output":200,"cacheRead":50,"cacheWrite":10,"reasoning":30,"totalTokens":1290,"cost":{"input":0.0002,"output":0.0001,"cacheRead":0.00001,"cacheWrite":0,"total":0.0003}},"stopReason":"toolUse"}}',
  '{"type":"message","id":"m2","timestamp":"2026-08-07T00:02:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":500,"output":100,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":600,"cost":{"input":0.00005,"output":0.00005,"cacheRead":0,"cacheWrite":0,"total":0.0001}},"stopReason":"toolUse"}}',
  '{"type":"message","id":"m3","timestamp":"2026-08-07T00:03:00Z","message":{"role":"user","content":[{"type":"text","text":"hi"}]}}',
  '{"type":"message","id":"m8","timestamp":"2026-08-07T00:03:30Z","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}',
  'not json at all',
  '{"type":"model_change","provider":"anthropic","modelId":"claude-opus-4-6"}',
  '{"type":"message","id":"m4","timestamp":"2026-08-07T00:04:00Z","message":{"role":"assistant","provider":"anthropic","model":"claude-opus-4-6","usage":{"totalTokens":1110,"cost":{"total":0.012}}}}',
];

// sess-b: cwd /home/eve — the home-directory special case (project home).
const SESS_B = [
  '{"type":"session","version":3,"id":"sess-b","timestamp":"2026-08-08T00:00:00Z","cwd":"/home/eve"}',
  '{"type":"message","id":"m5","timestamp":"2026-08-08T00:01:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-5","usage":{"input":2000,"output":500,"cacheRead":100,"cacheWrite":0,"reasoning":50,"totalTokens":2650,"cost":{"input":0.002,"output":0.001,"cacheRead":0.0001,"cacheWrite":0,"total":0.0031}},"stopReason":"toolUse"}}',
  '{"type":"message","id":"m6","timestamp":"2026-08-08T00:02:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-5","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":0,"cost":{"total":0}},"stopReason":"toolUse"}}',
];

// sess-c: no session header line. Session id comes from the filename,
// cwd from the directory name (nested/deeper -> project deeper).
const SESS_C = [
  '{"type":"message","id":"m7","timestamp":"2026-08-09T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":100,"output":50,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":150,"cost":{"total":0.0001}}}}',
];

function buildFixture(dir) {
  const amsterdam = join(dir, '--home-eve-Coding_Projects-amsterdam--');
  const home = join(dir, '--home-eve--');
  const nested = join(dir, 'nested', 'deeper');
  mkdirSync(amsterdam, { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(amsterdam, '2026-08-07T00-00-00-000Z_sess-a.jsonl'), SESS_A.join('\n') + '\n');
  writeFileSync(join(home, '2026-08-08T00-00-00-000Z_sess-b.jsonl'), SESS_B.join('\n') + '\n');
  writeFileSync(join(nested, '2026-08-09T00-00-00-000Z_sess-c.jsonl'), SESS_C.join('\n') + '\n');
}

describe('pi spend', () => {
  let dir;
  let sessionsDir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-pi-'));
    sessionsDir = join(dir, 'sessions');
    buildFixture(sessionsDir);
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  function read(env) {
    return readPiSpend({ PI_SESSIONS_DIR: sessionsDir, ...env });
  }

  it('aggregates by model and provider', () => {
    const pi = read();
    assert.equal(pi.source, 'pi-sessions');
    assert.ok(Date.parse(pi.generatedAt));
    assert.equal(pi.sessionsDir, sessionsDir);

    const ds = pi.models.find((m) => m.model === 'deepseek-v4-flash');
    assert.equal(ds.provider, 'deepseek');
    assert.equal(ds.calls, 3); // m1, m2, m7
    assert.equal(ds.inputTokens, 1600);
    assert.equal(ds.outputTokens, 350);
    assert.equal(ds.cacheReadTokens, 50);
    assert.equal(ds.reasoningTokens, 30);
    assert.equal(ds.totalTokens, 2040);
    assert.equal(ds.costUsd, 0.0005); // 0.0003 + 0.0001 + 0.0001
    assert.equal(ds.lastSeen, '2026-08-09T00:01:00Z'); // max message timestamp

    const gpt = pi.models.find((m) => m.model === 'gpt-5');
    assert.equal(gpt.calls, 2); // m5, m6 (m6 is zero-cost but has usage)
    assert.equal(gpt.totalTokens, 2650);
    assert.equal(gpt.costUsd, 0.0031);

    const claude = pi.models.find((m) => m.model === 'claude-opus-4-6');
    assert.equal(claude.provider, 'anthropic');
    assert.equal(claude.calls, 1); // m4 — counted via usage.cost even with no input
    assert.equal(claude.inputTokens, 0);
    assert.equal(claude.totalTokens, 1110);
    assert.equal(claude.costUsd, 0.012);
  });

  it('counts distinct sessions across files', () => {
    const pi = read();
    assert.equal(pi.sessionCount, 3); // sess-a, sess-b, sess-c
    const ds = pi.models.find((m) => m.model === 'deepseek-v4-flash');
    assert.equal(ds.sessions, 2); // sess-a and sess-c
    const gpt = pi.models.find((m) => m.model === 'gpt-5');
    assert.equal(gpt.sessions, 1);
  });

  it('maps projects from the session cwd', () => {
    const pi = read();

    const ds = pi.models.find((m) => m.model === 'deepseek-v4-flash');
    assert.deepEqual(ds.projects, [
      { project: 'amsterdam', calls: 2, costUsd: 0.0004 },
      { project: 'deeper', calls: 1, costUsd: 0.0001 },
    ]);

    const gpt = pi.models.find((m) => m.model === 'gpt-5');
    assert.deepEqual(gpt.projects, [{ project: 'home', calls: 2, costUsd: 0.0031 }]);

    // Home-directory cwd maps to the 'home' project.
    assert.deepEqual(pi.projects, [
      { project: 'amsterdam', sessionCount: 1, calls: 3, costUsd: 0.0124 },
      { project: 'home', sessionCount: 1, calls: 2, costUsd: 0.0031 },
      { project: 'deeper', sessionCount: 1, calls: 1, costUsd: 0.0001 },
    ]);
  });

  it('tolerates malformed lines without crashing', () => {
    const pi = read();
    assert.equal(pi.malformedLines, 1);
    assert.equal(pi.modelCount, 3); // deepseek, gpt-5, claude still counted
  });

  it('ignores non-message and non-usage events', () => {
    const pi = read();
    const calls = pi.models.reduce((sum, m) => sum + m.calls, 0);
    assert.equal(calls, 6); // m1, m2, m4, m5, m6, m7 only
  });

  it('computes totals', () => {
    const pi = read();
    assert.equal(pi.totalUsd, 0.0156);
    assert.equal(pi.totalTokens, 5800);
    assert.equal(pi.modelCount, 3);
  });

  it('sorts models by cost descending then model ascending', () => {
    const pi = read();
    assert.deepEqual(pi.models.map((m) => m.model), ['claude-opus-4-6', 'gpt-5', 'deepseek-v4-flash']);
  });

  it('returns null when the sessions dir is missing', () => {
    assert.equal(readPiSpend(join(dir, 'missing')), null);
  });

  it('returns null when the path is not a directory', () => {
    const file = join(dir, 'not-a-dir');
    writeFileSync(file, 'x');
    assert.equal(readPiSpend(file), null);
  });

  it('returns the empty shape for an existing empty dir', () => {
    const emptyDir = join(dir, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    const pi = readPiSpend({ PI_SESSIONS_DIR: emptyDir });
    assert.ok(pi);
    assert.equal(pi.source, 'pi-sessions');
    assert.equal(pi.sessionCount, 0);
    assert.equal(pi.totalUsd, 0);
    assert.equal(pi.totalTokens, 0);
    assert.equal(pi.modelCount, 0);
    assert.equal(pi.malformedLines, 0);
    assert.deepEqual(pi.models, []);
    assert.deepEqual(pi.projects, []);
  });

  it('honors the PI_SESSIONS_DIR env override', () => {
    const viaEnv = readPiSpend({ PI_SESSIONS_DIR: sessionsDir });
    const viaPath = readPiSpend(sessionsDir);
    assert.ok(viaEnv);
    assert.equal(viaEnv.sessionCount, 3);
    assert.equal(viaEnv.totalUsd, viaPath.totalUsd);
    assert.equal(viaEnv.sessionsDir, sessionsDir);
  });
});

describe('readPiCalls', () => {
  let dir;
  let sessionsDir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-pi-calls-'));
    sessionsDir = join(dir, 'sessions');
    buildFixture(sessionsDir);
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it('returns one record per counted message, sorted by timestamp', () => {
    const found = readPiCalls({ PI_SESSIONS_DIR: sessionsDir });
    assert.equal(found.sessionsDir, sessionsDir);
    assert.equal(found.calls.length, 6); // m1, m2, m4, m5, m6, m7
    assert.equal(found.malformedLines, 1);
    const stamps = found.calls.map((c) => c.timestamp);
    const sorted = [...stamps].sort();
    assert.deepEqual(stamps, sorted);
  });

  it('carries session, project, model, tokens, and cost per call', () => {
    const found = readPiCalls(sessionsDir);
    const m1 = found.calls.find((c) => c.timestamp === '2026-08-07T00:01:00Z');
    assert.deepEqual(m1, {
      timestamp: '2026-08-07T00:01:00Z',
      sessionId: 'sess-a',
      project: 'amsterdam',
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
      inputTokens: 1000,
      outputTokens: 200,
      cacheReadTokens: 50,
      reasoningTokens: 30,
      totalTokens: 1290,
      costUsd: 0.0003,
    });
  });

  it('falls back to the filename id and dir-name cwd without a header', () => {
    const found = readPiCalls(sessionsDir);
    const m7 = found.calls.find((c) => c.timestamp === '2026-08-09T00:01:00Z');
    assert.equal(m7.sessionId, 'sess-c');
    assert.equal(m7.project, 'deeper');
  });

  it('returns null when the sessions dir is missing', () => {
    assert.equal(readPiCalls(join(dir, 'missing')), null);
  });
});

describe('resolvePiSessionsDir', () => {
  it('defaults to ~/.pi/agent/sessions', () => {
    assert.equal(resolvePiSessionsDir({}), join(homedir(), '.pi', 'agent', 'sessions'));
  });

  it('uses PI_SESSIONS_DIR when set', () => {
    assert.equal(resolvePiSessionsDir({ PI_SESSIONS_DIR: '/tmp/pi-sessions' }), '/tmp/pi-sessions');
  });

  it('expands a leading tilde', () => {
    assert.equal(
      resolvePiSessionsDir({ PI_SESSIONS_DIR: '~/pi-sessions' }),
      join(homedir(), 'pi-sessions'),
    );
  });
});
