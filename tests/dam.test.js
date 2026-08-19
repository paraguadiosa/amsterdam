import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openFloodgates, withTimeout } from '../src/dam.js';
import { openManualStore, setManualCredit, closeManualStore } from '../src/manual-credits.js';

function mockFetch(body, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

// Pi session logs exist on developer machines; point them at a missing
// dir so the catalog-only assertions stay deterministic.
function noSessions(env = {}) {
  return { ...env, PI_SESSIONS_DIR: join(tmpdir(), 'amsterdam-no-sessions-' + Date.now()) };
}

// ── withTimeout ──────────────────────────────────

describe('withTimeout', () => {
  it('resolves when promise finishes in time', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    assert.equal(result, 42);
  });

  it('rejects when promise exceeds timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));
    await assert.rejects(() => withTimeout(slow, 50), { message: 'timeout' });
  });
});

// ── openFloodgates ───────────────────────────────

describe('openFloodgates', () => {
  it('marks missing keys as not detected', async () => {
    const env = noSessions({});
    const result = await openFloodgates(env, mockFetch({}));
    for (const data of Object.values(result.providers)) {
      assert.equal(data.detected, false);
    }
  });

  it('fetches balance for configured providers', async () => {
    const env = noSessions({
      DEEPSEEK_API_KEY: 'sk-test',
    });
    const body = {
      balance_infos: [{ currency: 'CNY', total_balance: '10.00' }],
      is_available: true,
    };
    const result = await openFloodgates(env, mockFetch(body));
    assert.equal(result.providers.deepseek.detected, true);
    assert.equal(result.providers.deepseek.balance, 10);
    assert.equal(result.providers.openai.detected, false);
  });

  it('records error on fetch failure', async () => {
    const env = noSessions({ DEEPSEEK_API_KEY: 'sk-bad' });
    const failFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const result = await openFloodgates(env, failFetch);
    assert.equal(result.providers.deepseek.detected, true);
    assert.ok(result.providers.deepseek.error);
  });

  it('records error on network exception', async () => {
    const env = noSessions({ KIMI_API_KEY: 'sk-kimi-test' });
    const throwFetch = async () => { throw new Error('ECONNREFUSED'); };
    const result = await openFloodgates(env, throwFetch);
    assert.equal(result.providers.moonshot.detected, true);
    assert.equal(result.providers.moonshot.error, 'ECONNREFUSED');
  });

  it('includes timestamp', async () => {
    const result = await openFloodgates(noSessions({}), mockFetch({}));
    assert.ok(result.timestamp);
    assert.ok(Date.parse(result.timestamp));
  });

  it('uses base URL override from env', async () => {
    let capturedUrl = '';
    const env = noSessions({
      DEEPSEEK_API_KEY: 'sk-test',
      DEEPSEEK_BASE_URL: 'https://custom.deepseek.ai',
    });
    const spy = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ balance_infos: [{ currency: 'USD', total_balance: '5' }], is_available: true }),
      };
    };
    await openFloodgates(env, spy);
    assert.ok(capturedUrl.startsWith('https://custom.deepseek.ai'));
  });

  it('fetches multiple providers in parallel', async () => {
    const env = noSessions({
      DEEPSEEK_API_KEY: 'sk-ds',
      KIMI_API_KEY: 'sk-kimi',
      GROQ_API_KEY: 'sk-gq',
    });
    const result = await openFloodgates(env, mockFetch({ balance_infos: [], data: {} }));
    assert.equal(result.providers.deepseek.detected, true);
    assert.equal(result.providers.moonshot.detected, true);
    assert.equal(result.providers.groq.detected, true);
    assert.equal(result.providers.openai.detected, false);
  });
});

describe('openFloodgates pi provider', () => {
  it('adds a manual pi provider when the store has a pi credit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amsterdam-dam-pi-'));
    const store = openManualStore(join(dir, 'manual-credits.db'));
    setManualCredit(store, 'pi', 42);
    try {
      const result = await openFloodgates(noSessions({}), mockFetch({}), store);
      assert.ok(result.providers.pi);
      assert.equal(result.providers.pi.detected, true);
      assert.equal(result.providers.pi.kind, 'manual');
      assert.equal(result.providers.pi.credit, 42);
      assert.equal(result.providers.pi.spend, null);
      assert.equal(result.providers.pi.remaining, null);
    } finally {
      closeManualStore(store);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('computes remaining as credit minus rounded real spend', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amsterdam-dam-pi2-'));
    const sessionsDir = join(dir, 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, '2026-08-07T00-00-00-000Z_sess.jsonl'),
      '{"type":"session","version":3,"id":"s1","timestamp":"2026-08-07T00:00:00Z","cwd":"/home/eve"}\n' +
      '{"type":"message","id":"m1","timestamp":"2026-08-07T00:01:00Z","message":{"role":"assistant","provider":"deepseek","model":"deepseek-v4-flash","usage":{"input":100,"output":50,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":150,"cost":{"total":1.23456}},"stopReason":"toolUse"}}\n');
    const store = openManualStore(join(dir, 'manual-credits.db'));
    setManualCredit(store, 'pi', 50);
    try {
      const result = await openFloodgates({ PI_SESSIONS_DIR: sessionsDir }, mockFetch({}), store);
      assert.equal(result.providers.pi.spend, 1.2346); // rounded to 4 decimals
      assert.equal(result.providers.pi.credit, 50);
      assert.equal(result.providers.pi.remaining, 48.77); // rounded to 2 decimals
    } finally {
      closeManualStore(store);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stays absent without a pi credit and without spend', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amsterdam-dam-pi3-'));
    const store = openManualStore(join(dir, 'manual-credits.db'));
    try {
      const result = await openFloodgates(noSessions({}), mockFetch({}), store);
      assert.ok(!result.providers.pi);
    } finally {
      closeManualStore(store);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('merges manual credits into catalog provider results', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amsterdam-dam-pi4-'));
    const store = openManualStore(join(dir, 'manual-credits.db'));
    setManualCredit(store, 'anthropic', 12);
    setManualCredit(store, 'xai', 3);
    try {
      const result = await openFloodgates(noSessions({}), mockFetch({}), store);
      assert.equal(result.providers.anthropic.detected, false);
      assert.equal(result.providers.anthropic.credit, 12);
      assert.equal(result.providers.xai.credit, 3);
      assert.ok(!result.providers.pi);
    } finally {
      closeManualStore(store);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opens the default store when none is passed', async () => {
    const result = await openFloodgates(noSessions({}), mockFetch({}));
    assert.ok(result.providers);
    assert.equal(typeof result.providers, 'object');
  });
});
