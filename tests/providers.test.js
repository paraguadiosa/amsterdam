import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import deepseek from '../src/providers/deepseek.js';
import huggingface from '../src/providers/huggingface.js';
import moonshot from '../src/providers/moonshot.js';
import { createVerifyProvider, openai, groq, together, mistral, google, fireworks } from '../src/providers/verify.js';
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

// ── moonshot ─────────────────────────────────────

describe('moonshot', () => {
  it('parses balance response', async () => {
    const body = {
      code: 0,
      data: { available_balance: 22.13, voucher_balance: 2.13, cash_balance: 20 },
      status: true,
    };
    const result = await moonshot.fetchBalance({ apiKey: 'sk-kimi-test', baseUrl: 'https://api.moonshot.ai' }, mockFetch(body));
    assert.equal(result.balance, 22.13);
    assert.equal(result.currency, 'USD');
    assert.equal(result.cash, 20);
    assert.equal(result.voucher, 2.13);
  });

  it('uses CNY for the .cn region', async () => {
    const body = { data: { available_balance: '10.00' } };
    const result = await moonshot.fetchBalance({ apiKey: 'k', baseUrl: 'https://api.moonshot.cn' }, mockFetch(body));
    assert.equal(result.balance, 10);
    assert.equal(result.currency, 'CNY');
  });

  it('defaults to 0 when data is missing', async () => {
    const result = await moonshot.fetchBalance({ apiKey: 'k', baseUrl: 'https://x' }, mockFetch({}));
    assert.equal(result.balance, 0);
    assert.equal(result.cash, null);
  });

  it('throws on non-200', async () => {
    await assert.rejects(
      () => moonshot.fetchBalance({ apiKey: 'bad', baseUrl: 'https://x' }, mockFetchFail(401)),
      { message: 'HTTP 401' },
    );
  });

  it('has correct metadata', () => {
    assert.equal(moonshot.id, 'moonshot');
    assert.equal(moonshot.envKey, 'KIMI_API_KEY');
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
    assert.deepEqual(result, { verified: true, models: 0 });
  });

  it('counts models from body data', async () => {
    const provider = createVerifyProvider({
      id: 'test',
      name: 'Test',
      envKey: 'TEST_KEY',
      defaultBaseUrl: 'https://example.com',
    });
    const result = await provider.fetchBalance({ apiKey: 'k', baseUrl: 'https://example.com' }, mockFetch({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }));
    assert.equal(result.models, 3);
  });

  it('counts models from body models array (google)', async () => {
    const provider = createVerifyProvider({
      id: 'test',
      name: 'Test',
      envKey: 'TEST_KEY',
      defaultBaseUrl: 'https://example.com',
    });
    const result = await provider.fetchBalance({ apiKey: 'k', baseUrl: 'https://example.com' }, mockFetch({ models: [{ name: 'a' }] }));
    assert.equal(result.models, 1);
  });

  it('survives a non-JSON body', async () => {
    const provider = createVerifyProvider({
      id: 'test',
      name: 'Test',
      envKey: 'TEST_KEY',
      defaultBaseUrl: 'https://example.com',
    });
    const res = async () => ({ ok: true, json: async () => { throw new Error('bad json'); } });
    const result = await provider.fetchBalance({ apiKey: 'k', baseUrl: 'https://example.com' }, res);
    assert.deepEqual(result, { verified: true, models: 0 });
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
  const verifyProviders = [openai, groq, together, mistral, google, fireworks];

  for (const p of verifyProviders) {
    it(`${p.id} has id and envKey`, () => {
      assert.ok(p.id);
      assert.ok(p.envKey);
      assert.ok(p.defaultBaseUrl);
    });

    it(`${p.id} returns verified with model count on 200`, async () => {
      const result = await p.fetchBalance({ apiKey: 'k', baseUrl: p.defaultBaseUrl }, mockFetch({ data: [{ id: 'm' }] }));
      assert.equal(result.verified, true);
      assert.equal(result.models, 1);
    });
  }
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
    assert.equal(providers.length, 9);
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
