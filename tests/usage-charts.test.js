import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketLabelToMs,
  colorAt,
  donutSvg,
  filterTimelineRange,
  hbarSvg,
  lineSeriesSvg,
  msToBucketLabel,
  pivotTimeline,
  rollupTimeline,
  slicesFromModels,
  stackedBarsSvg,
} from '../src/usage-charts.js';

const ROWS = [
  { bucket: '2026-08-07 00:00', model: 'deepseek-v4-flash', provider: 'deepseek', calls: 2, costUsd: 0.0004 },
  { bucket: '2026-08-07 00:05', model: 'deepseek-v4-flash', provider: 'deepseek', calls: 1, costUsd: 0.0001 },
  { bucket: '2026-08-07 01:00', model: 'gpt-5', provider: 'openai', calls: 1, costUsd: 0.0031 },
];

describe('pivotTimeline', () => {
  it('keeps one series per model and provider', () => {
    const { series, buckets } = pivotTimeline(ROWS);
    assert.deepEqual(buckets, ['2026-08-07 00:00', '2026-08-07 00:05', '2026-08-07 01:00']);
    assert.deepEqual(series, ['gpt-5 · openai', 'deepseek-v4-flash · deepseek']);
  });
});

describe('rollupTimeline', () => {
  it('leaves 5-minute rows unchanged', () => {
    assert.deepEqual(rollupTimeline(ROWS, '5min'), ROWS);
  });

  it('merges rows into hour buckets', () => {
    const hours = rollupTimeline(ROWS, 'hour');
    assert.deepEqual(hours, [
      { bucket: '2026-08-07 00:00', model: 'deepseek-v4-flash', provider: 'deepseek', calls: 3, costUsd: 0.0005 },
      { bucket: '2026-08-07 01:00', model: 'gpt-5', provider: 'openai', calls: 1, costUsd: 0.0031 },
    ]);
  });

  it('merges rows into day buckets', () => {
    const days = rollupTimeline(ROWS, 'day');
    assert.equal(days.length, 2);
    assert.equal(days[0].bucket, '2026-08-07');
    assert.equal(days[1].bucket, '2026-08-07');
    const total = days.reduce((sum, r) => sum + r.costUsd, 0);
    assert.equal(total, 0.0036);
  });
});

describe('filterTimelineRange', () => {
  it('keeps rows inside the inclusive bounds', () => {
    const kept = filterTimelineRange(ROWS, '2026-08-07 00:05', '2026-08-07 00:59');
    assert.deepEqual(kept.map((r) => r.bucket), ['2026-08-07 00:05']);
  });

  it('treats null bounds as open ends', () => {
    assert.equal(filterTimelineRange(ROWS, null, null).length, 3);
    assert.equal(filterTimelineRange(ROWS, '2026-08-07 00:05', null).length, 2);
    assert.equal(filterTimelineRange(ROWS, null, '2026-08-07 00:00').length, 1);
  });
});

describe('bucket label helpers', () => {
  it('round-trips epoch ms and UTC labels', () => {
    const label = msToBucketLabel(Date.parse('2026-08-07T00:07:30Z'));
    assert.equal(label, '2026-08-07 00:05');
    assert.equal(bucketLabelToMs(label), Date.parse('2026-08-07T00:05:00Z'));
  });
});

describe('stackedBarsSvg', () => {
  it('draws one rect per series in a bucket and labels the grain', () => {
    const drawn = stackedBarsSvg(ROWS, { width: 400 });
    assert.ok(drawn.svg.includes('<svg'));
    assert.ok(drawn.svg.includes('role="img"'));
    assert.ok(drawn.svg.includes('2026-08-07 01:00'));
    assert.ok(drawn.svg.includes('gpt-5 · openai'));
    assert.equal((drawn.svg.match(/<rect/g) || []).length, 3);
    assert.ok(drawn.legend.includes('deepseek-v4-flash'));
  });

  it('renders an empty state when there are no rows', () => {
    const drawn = stackedBarsSvg([]);
    assert.ok(drawn.svg.includes('No timeline data'));
    assert.deepEqual(drawn.buckets, []);
  });
});

describe('lineSeriesSvg', () => {
  it('draws one line per series plus an emphasized total line', () => {
    const drawn = lineSeriesSvg(ROWS, { width: 400 });
    assert.ok(drawn.svg.includes('<svg'));
    assert.ok(drawn.svg.includes('role="img"'));
    assert.ok(drawn.svg.includes('class="total-line"'));
    assert.ok(drawn.svg.includes('Total spend'));
    assert.ok(drawn.svg.includes('gpt-5 · openai'));
    assert.ok(drawn.legend.includes('Total'));
    assert.ok(drawn.legend.includes('deepseek-v4-flash'));
    // two series + one total = three polylines, with no stacked rects
    assert.equal((drawn.svg.match(/<polyline/g) || []).length, 3);
    assert.equal((drawn.svg.match(/<rect/g) || []).length, 0);
  });

  it('renders an empty state when there are no rows', () => {
    const drawn = lineSeriesSvg([]);
    assert.ok(drawn.svg.includes('No timeline data'));
    assert.deepEqual(drawn.buckets, []);
  });

  it('draws dots for a single bucket instead of a zero-length line', () => {
    const one = lineSeriesSvg([ROWS[0]]);
    assert.ok(one.svg.includes('<circle'));
    assert.ok(one.svg.includes('class="total-dot"'));
  });
});

describe('donutSvg and hbarSvg', () => {
  it('draw slices and bars from positive values', () => {
    const slices = [{ label: 'pi', value: 2 }, { label: 'hermes', value: 1 }];
    const donut = donutSvg(slices);
    assert.ok(donut.svg.includes('<path'));
    assert.ok(donut.legend.includes('pi'));
    const bars = hbarSvg(slices);
    assert.ok(bars.svg.includes('<rect'));
    assert.equal(bars.items.length, 2);
  });

  it('render empty states for zero spend', () => {
    assert.ok(donutSvg([]).svg.includes('No spend to chart'));
    assert.ok(hbarSvg([]).svg.includes('No spend to chart'));
  });
});

describe('slicesFromModels', () => {
  it('sums cost by the requested key and skips nulls', () => {
    const slices = slicesFromModels([
      { model: 'a', provider: 'p', costUsd: 1 },
      { model: 'a', provider: 'q', costUsd: 0.5 },
      { model: 'b', provider: 'p', costUsd: null },
    ], 'model');
    assert.deepEqual(slices, [{ label: 'a', value: 1.5 }]);
  });
});

describe('colorAt', () => {
  it('cycles the palette', () => {
    assert.equal(colorAt(0), colorAt(7));
    assert.notEqual(colorAt(0), colorAt(1));
  });
});
