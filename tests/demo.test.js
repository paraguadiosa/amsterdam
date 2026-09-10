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

  it('shows the pi manual budget with its credit', () => {
    const pi = billing.providers.pi;
    assert.ok(pi);
    assert.equal(pi.detected, true);
    assert.equal(pi.kind, 'manual');
    assert.equal(pi.credit, 42);
  });

  it('carries no spend payload', () => {
    assert.equal(billing.spend, undefined);
    assert.equal(billing.piSpend, undefined);
  });

  it('contains nothing that looks like an API key', () => {
    const raw = JSON.stringify(billing);
    assert.ok(!/sk-[A-Za-z0-9]{8,}/.test(raw));
    assert.ok(!/api[_-]?key/i.test(raw));
  });
});
