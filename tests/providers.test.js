import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import deepseek from '../src/providers/deepseek.js';
import openrouter from '../src/providers/openrouter.js';
import huggingface from '../src/providers/huggingface.js';
import { createVerifyProvider, anthropic, openai, moonshot, groq, together, mistral, google, fireworks } from '../src/providers/verify.js';
import providers from '../src/providers/index.js';

function mockFetch(body, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function mockFetchFail(status = 401) {
  return async () => ({ ok: false, status, json: async () => ({}) });
}

// ── deepseek ─────────────────────────────────────

describe('deepseek', () => {
  it('parses balance response', async () => {
    const body = {
      balance_infos: [{ currency: 'CNY', total_balance: '42.50', granted_balance: '0', topped_up_balance: '42.50' }],
      is_available: true,
    };
    const result = await deepseek.fetchBalance({ apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com' }, mockFetch(body));
    assert.equal(result.balance, 42.5);
    assert.equal(result.currency, 'CNY');
    assert.equal(result.available, true);
  });

  it('defaults to 0 CNY when balance_infos is empty', async () => {
    const result = await deepseek.fetchBalance({ apiKey: 'sk-test', baseUrl: 'https://x' }, mockFetch({ balance_infos: [] }));
    assert.equal(result.balance, 0);
    assert.equal(result.currency, 'CNY');
  });

  it('throws on non-200', async () => {
    await assert.rejects(
      () => deepseek.fetchBalance({ apiKey: 'bad', baseUrl: 'https://x' }, mockFetchFail(403)),
      { message: 'HTTP 403' },
    );
  });

  it('has correct metadata', () => {
    assert.equal(deepseek.id, 'deepseek');
    assert.equal(deepseek.envKey, 'DEEPSEEK_API_KEY');
  });
});

// ── openrouter ───────────────────────────────────

describe('openrouter', () => {
  it('parses auth/key response', async () => {
    const body = { data: { usage: 3.14, limit: 50, is_free_tier: false } };
    const result = await openrouter.fetchBalance({ apiKey: 'sk-or-test', baseUrl: 'https://openrouter.ai' }, mockFetch(body));
    assert.equal(result.usage, 3.14);
    assert.equal(result.limit, 50);
    assert.equal(result.freeTier, false);
  });

  it('handles null limit', async () => {
    const body = { data: { usage: 0.5, limit: null, is_free_tier: true } };
    const result = await openrouter.fetchBalance({ apiKey: 'k', baseUrl: 'https://x' }, mockFetch(body));
    assert.equal(result.limit, null);
    assert.equal(result.freeTier, true);
  });

  it('handles missing data field', async () => {
    const result = await openrouter.fetchBalance({ apiKey: 'k', baseUrl: 'https://x' }, mockFetch({}));
    assert.equal(result.usage, null);
    assert.equal(result.limit, null);
  });

  it('throws on non-200', async () => {
    await assert.rejects(
      () => openrouter.fetchBalance({ apiKey: 'bad', baseUrl: 'https://x' }, mockFetchFail()),
      { message: 'HTTP 401' },
    );
  });
});

// ── huggingface ──────────────────────────────────

describe('huggingface', () => {
  it('parses whoami response', async () => {
    const body = { name: 'eve', email: 'eve@example.com' };
    const result = await huggingface.fetchBalance({ apiKey: 'hf_test', baseUrl: 'https://huggingface.co' }, mockFetch(body));
    assert.equal(result.username, 'eve');
    assert.equal(result.verified, true);
  });

  it('handles missing name', async () => {
    const result = await huggingface.fetchBalance({ apiKey: 'hf_test', baseUrl: 'https://x' }, mockFetch({}));
    assert.equal(result.username, null);
    assert.equal(result.verified, true);
  });

  it('throws on non-200', async () => {
    await assert.rejects(
      () => huggingface.fetchBalance({ apiKey: 'bad', baseUrl: 'https://x' }, mockFetchFail()),
    );
  });
});

// ── verify factory ───────────────────────────────

describe('createVerifyProvider', () => {
  it('returns verified on 200', async () => {
    const provider = createVerifyProvider({
      id: 'test',
      name: 'Test',
      envKey: 'TEST_KEY',
      defaultBaseUrl: 'https://example.com',
    });
    const result = await provider.fetchBalance({ apiKey: 'k', baseUrl: 'https://example.com' }, mockFetch({}));
    assert.deepEqual(result, { verified: true });
  });

  it('uses custom buildRequest', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    const provider = createVerifyProvider({
      id: 'custom',
      name: 'Custom',
      envKey: 'CUSTOM_KEY',
      defaultBaseUrl: 'https://custom.ai',
      buildRequest: (key, base) => ({
        url: `${base}/special?token=${key}`,
        options: { headers: { 'x-custom': 'yes' } },
      }),
    });
    const spy = async (url, opts) => {
      capturedUrl = url;
      capturedHeaders = opts.headers;
      return { ok: true, json: async () => ({}) };
    };
    await provider.fetchBalance({ apiKey: 'mykey', baseUrl: 'https://custom.ai' }, spy);
    assert.equal(capturedUrl, 'https://custom.ai/special?token=mykey');
    assert.equal(capturedHeaders['x-custom'], 'yes');
  });

  it('throws on non-200', async () => {
    const provider = createVerifyProvider({
      id: 'fail',
      name: 'Fail',
      envKey: 'FAIL_KEY',
      defaultBaseUrl: 'https://x',
    });
    await assert.rejects(
      () => provider.fetchBalance({ apiKey: 'k', baseUrl: 'https://x' }, mockFetchFail(500)),
      { message: 'HTTP 500' },
    );
  });
});

// ── verify-only providers metadata ───────────────

describe('verify-only providers', () => {
  const verifyProviders = [anthropic, openai, moonshot, groq, together, mistral, google, fireworks];

  for (const p of verifyProviders) {
    it(`${p.id} has id and envKey`, () => {
      assert.ok(p.id);
      assert.ok(p.envKey);
      assert.ok(p.defaultBaseUrl);
    });

    it(`${p.id} returns verified on 200`, async () => {
      const result = await p.fetchBalance({ apiKey: 'k', baseUrl: p.defaultBaseUrl }, mockFetch({}));
      assert.deepEqual(result, { verified: true });
    });
  }
});

// ── anthropic uses custom auth header ────────────

describe('anthropic auth', () => {
  it('sends x-api-key header', async () => {
    let headers = {};
    const spy = async (url, opts) => {
      headers = opts.headers;
      return { ok: true, json: async () => ({}) };
    };
    await anthropic.fetchBalance({ apiKey: 'sk-ant-test', baseUrl: 'https://api.anthropic.com' }, spy);
    assert.equal(headers['x-api-key'], 'sk-ant-test');
    assert.equal(headers['anthropic-version'], '2023-06-01');
  });
});

// ── google uses query param auth ─────────────────

describe('google auth', () => {
  it('sends key as query parameter', async () => {
    let capturedUrl = '';
    const spy = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({}) };
    };
    await google.fetchBalance({ apiKey: 'AIza-test', baseUrl: 'https://generativelanguage.googleapis.com' }, spy);
    assert.ok(capturedUrl.includes('?key=AIza-test'));
  });
});

// ── registry ─────────────────────────────────────

describe('provider registry', () => {
  it('exports all providers', () => {
    assert.equal(providers.length, 11);
  });

  it('has unique ids', () => {
    const ids = providers.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('every provider has fetchBalance', () => {
    for (const p of providers) {
      assert.equal(typeof p.fetchBalance, 'function');
    }
  });
});
