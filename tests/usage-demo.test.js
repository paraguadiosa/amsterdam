import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../demo/usage.js';

// The monitor demo fixture powers /usage.html?demo. It must keep the
// exact shape GET /api/usage returns, and carry no key-shaped strings.
const usage = globalThis.AMS_USAGE;

describe('monitor demo fixture', () => {
  it('sets globalThis.AMS_USAGE with sources and a timeline', () => {
    assert.ok(usage);
    assert.equal(usage.source, 'usage-sources');
    assert.ok(!Number.isNaN(Date.parse(usage.generatedAt)));
    assert.ok(Array.isArray(usage.sources));
    assert.ok(usage.timeline);
    assert.equal(usage.timeline.grain, '5min');
    assert.equal(usage.timeline.timezone, 'UTC');
  });

  it('reports pi and hermes as available with model rows', () => {
    const ids = usage.sources.map((s) => s.id);
    assert.deepEqual(ids, ['pi', 'hermes']);
    for (const src of usage.sources) {
      assert.equal(src.available, true);
      assert.ok(src.models.length >= 1);
      for (const m of src.models) {
        assert.equal(typeof m.model, 'string');
        assert.equal(typeof m.provider, 'string');
        assert.equal(typeof m.calls, 'number');
        assert.equal(typeof m.tokens, 'number');
        assert.equal(typeof m.costUsd, 'number');
        assert.equal(typeof m.costStatus, 'string');
      }
    }
  });

  it('keeps per-source totals consistent with the model rows', () => {
    for (const src of usage.sources) {
      const sum = Math.round(src.models.reduce((acc, m) => acc + m.costUsd, 0) * 10000) / 10000;
      assert.ok(Math.abs(sum - src.totalUsd) < 1e-4);
      assert.equal(src.modelCount, src.models.length);
      const calls = src.models.reduce((acc, m) => acc + m.calls, 0);
      assert.equal(src.totalCalls, calls);
    }
    const grand = Math.round(usage.sources.reduce((acc, s) => acc + s.totalUsd, 0) * 10000) / 10000;
    assert.ok(Math.abs(grand - usage.totalUsd) < 1e-4);
  });

  it('builds a timeline of UTC 5-minute buckets', () => {
    assert.equal(usage.timeline.available, true);
    assert.ok(usage.timeline.rows.length > 100);
    for (const row of usage.timeline.rows) {
      assert.match(row.bucket, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      assert.equal(Number(row.bucket.slice(14, 16)) % 5, 0);
      assert.equal(typeof row.model, 'string');
      assert.equal(typeof row.provider, 'string');
      assert.ok(row.calls >= 1);
      assert.ok(row.costUsd > 0);
    }
    const buckets = [...new Set(usage.timeline.rows.map((r) => r.bucket))].sort();
    assert.deepEqual(buckets, buckets.slice().sort());
  });

  it('buildUsageDemo accepts a fixed now for deterministic output', () => {
    const fixed = globalThis.buildUsageDemo(Date.parse('2026-08-07T12:00:00Z'));
    const again = globalThis.buildUsageDemo(Date.parse('2026-08-07T12:00:00Z'));
    assert.deepEqual(fixed, again);
    assert.ok(fixed.timeline.rows.length > 0);
    assert.ok(fixed.timeline.rows.every((r) => r.bucket <= '2026-08-07 12:00'));
  });

  it('contains nothing that looks like an API key', () => {
    const raw = JSON.stringify(usage);
    assert.ok(!/sk-[A-Za-z0-9]{8,}/.test(raw));
    assert.ok(!/api[_-]?key/i.test(raw));
  });
});
