import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openFloodgates, withTimeout } from '../src/dam.js';

function mockFetch(body, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
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
    const env = {};
    const result = await openFloodgates(env, mockFetch({}));
    for (const data of Object.values(result.providers)) {
      assert.equal(data.detected, false);
    }
  });

  it('fetches balance for configured providers', async () => {
    const env = {
      DEEPSEEK_API_KEY: 'sk-test',
    };
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
    const env = { DEEPSEEK_API_KEY: 'sk-bad' };
    const failFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const result = await openFloodgates(env, failFetch);
    assert.equal(result.providers.deepseek.detected, true);
    assert.ok(result.providers.deepseek.error);
  });

  it('records error on network exception', async () => {
    const env = { OPENROUTER_API_KEY: 'sk-or-test' };
    const throwFetch = async () => { throw new Error('ECONNREFUSED'); };
    const result = await openFloodgates(env, throwFetch);
    assert.equal(result.providers.openrouter.detected, true);
    assert.equal(result.providers.openrouter.error, 'ECONNREFUSED');
  });

  it('includes timestamp', async () => {
    const result = await openFloodgates({}, mockFetch({}));
    assert.ok(result.timestamp);
    assert.ok(Date.parse(result.timestamp));
  });

  it('uses base URL override from env', async () => {
    let capturedUrl = '';
    const env = {
      DEEPSEEK_API_KEY: 'sk-test',
      DEEPSEEK_BASE_URL: 'https://custom.deepseek.ai',
    };
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
    const env = {
      DEEPSEEK_API_KEY: 'sk-ds',
      OPENROUTER_API_KEY: 'sk-or',
      ANTHROPIC_API_KEY: 'sk-ant',
    };
    const result = await openFloodgates(env, mockFetch({ balance_infos: [], data: {} }));
    assert.equal(result.providers.deepseek.detected, true);
    assert.equal(result.providers.openrouter.detected, true);
    assert.equal(result.providers.anthropic.detected, true);
    assert.equal(result.providers.openai.detected, false);
  });
});
