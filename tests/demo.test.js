import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../demo/billing.js';

// The demo fixture powers the public demo (?demo). It must keep the
// exact shape the dashboard renders, and must never contain anything
// that looks like a real credential.

const billing = globalThis.BILLING;

describe('demo fixture', () => {
  it('sets globalThis.BILLING with a timestamp and the demo flag', () => {
    assert.ok(billing);
    assert.equal(typeof billing.timestamp, 'string');
    assert.ok(!Number.isNaN(Date.parse(billing.timestamp)));
    assert.equal(billing.demo, true);
  });

  it('has a mix of balance, verified, error, and undetected providers', () => {
    const p = billing.providers;
    const list = Object.values(p);
    assert.ok(list.some((r) => r.detected && r.balance != null));
    assert.ok(list.some((r) => r.detected && r.verified));
    assert.ok(list.some((r) => r.detected && r.error));
    assert.ok(list.some((r) => !r.detected));
    for (const r of list) assert.equal(typeof r.detected, 'boolean');
  });

  it('spend rows carry the fields the table renders', () => {
    assert.ok(billing.spend.models.length >= 3);
    for (const m of billing.spend.models) {
      assert.equal(typeof m.model, 'string');
      assert.equal(typeof m.provider, 'string');
      assert.equal(typeof m.sessions, 'number');
      assert.equal(typeof m.calls, 'number');
      assert.ok(['estimated', 'local', 'unknown', 'no usage'].includes(m.costStatus));
    }
  });

  it('spend total matches the estimated rows', () => {
    const sum = billing.spend.models
      .filter((m) => m.costStatus === 'estimated' && m.estimatedCostUsd != null)
      .reduce((acc, m) => acc + m.estimatedCostUsd, 0);
    assert.ok(Math.abs(sum - billing.spend.totalEstimatedUsd) < 1e-9);
    assert.equal(billing.spend.modelCount, billing.spend.models.length);
  });

  it('pi spend rows and totals are consistent', () => {
    const pi = billing.piSpend;
    assert.ok(pi.models.length >= 1);
    const cost = pi.models.reduce((acc, m) => acc + m.costUsd, 0);
    assert.ok(Math.abs(cost - pi.totalUsd) < 1e-9);
    assert.equal(pi.modelCount, pi.models.length);
    assert.ok(pi.sessionCount >= pi.models.length);
  });

  it('keeps the anthropic purge: no claude models in spend', () => {
    for (const m of billing.spend.models) {
      assert.ok(!m.model.toLowerCase().startsWith('claude'));
      assert.notEqual(m.provider, 'anthropic');
    }
  });

  it('contains nothing that looks like an API key', () => {
    const raw = JSON.stringify(billing);
    assert.ok(!/sk-[A-Za-z0-9]{8,}/.test(raw));
    assert.ok(!/api[_-]?key/i.test(raw));
  });
});
