// Pure SVG chart builders for Amsterdam Monitor. No DOM, no dependencies.
// The page and the tests both import these functions.

const PALETTE = ['#4fc3f7', '#aed581', '#ffb74d', '#f06292', '#ba68c8', '#4db6ac', '#90a4ae'];
const OTHER = 'other';
const SEP = '\u0000';

export function colorAt(index) {
  return PALETTE[index % PALETTE.length];
}

export function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function niceCeil(value) {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * mag >= value) return step * mag;
  }
  return 10 * mag;
}

function money(value) {
  return '$' + Number(value).toFixed(4);
}

// Group rows into named series. Top maxSeries keep their name; the rest
// merge into "other". Returns { series, cells, buckets } for stacked bars.
export function pivotTimeline(rows, maxSeries = 6) {
  const totals = new Map();
  for (const row of rows) {
    const name = `${row.model} · ${row.provider}`;
    totals.set(name, (totals.get(name) || 0) + row.costUsd);
  }
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSeries)
    .map(([name]) => name);
  const keep = new Set(top);
  const cells = new Map();
  let hasOther = false;
  for (const row of rows) {
    const name = keep.has(`${row.model} · ${row.provider}`)
      ? `${row.model} · ${row.provider}`
      : OTHER;
    if (name === OTHER) hasOther = true;
    const key = row.bucket + SEP + name;
    cells.set(key, (cells.get(key) || 0) + row.costUsd);
  }
  const series = hasOther ? [...top, OTHER] : top;
  const buckets = [...new Set(rows.map((r) => r.bucket))].sort();
  return { series, cells, buckets };
}

// Stacked bars: one bar per 5-minute bucket, one segment per series.
export function stackedBarsSvg(rows, { width, height = 220 } = {}) {
  const { series, cells, buckets } = pivotTimeline(rows);
  if (buckets.length === 0) return emptySvg('No timeline data');
  const LEFT = 56;
  const TOP = 12;
  const BOTTOM = 40;
  const slot = Math.max(6, Math.min(14, Math.floor((Math.max(width || 640, 320) - LEFT - 12) / buckets.length)));
  const svgW = LEFT + buckets.length * slot + 12;
  const plotH = height - TOP - BOTTOM;
  const base = TOP + plotH;
  const totals = buckets.map((b) =>
    series.reduce((sum, name) => sum + (cells.get(b + SEP + name) || 0), 0),
  );
  const yMax = niceCeil(Math.max(...totals, 0));
  const parts = [];
  for (let i = 0; i <= 4; i += 1) {
    const y = base - (plotH * i) / 4;
    const value = (yMax * i) / 4;
    parts.push(
      `<line x1="${LEFT}" y1="${y}" x2="${svgW - 8}" y2="${y}" class="grid"/>`,
      `<text x="${LEFT - 6}" y="${y + 3}" class="axis" text-anchor="end">${esc(money(value))}</text>`,
    );
  }
  const labelStep = Math.max(1, Math.ceil(buckets.length / 12));
  buckets.forEach((bucket, i) => {
    const x = LEFT + i * slot;
    let y = base;
    series.forEach((name, si) => {
      const cost = cells.get(bucket + SEP + name) || 0;
      if (cost <= 0) return;
      const h = Math.max((cost / yMax) * plotH, 1);
      y -= h;
      parts.push(
        `<rect x="${x}" y="${y.toFixed(1)}" width="${slot - 2}" height="${h.toFixed(1)}" fill="${colorAt(si)}">` +
          `<title>${esc(bucket)} — ${esc(name)}: ${esc(money(cost))}</title></rect>`,
      );
    });
    if (i % labelStep === 0) {
      parts.push(
        `<text x="${x + (slot - 2) / 2}" y="${base + 12}" class="axis" text-anchor="end" ` +
          `transform="rotate(-45 ${x + (slot - 2) / 2} ${base + 12})">${esc(bucket.slice(5))}</text>`,
      );
    }
  });
  const legend = series
    .map((name, i) => `<span class="chip"><i style="background:${colorAt(i)}"></i>${esc(name)}</span>`)
    .join('');
  return {
    legend,
    svg:
      `<svg viewBox="0 0 ${svgW} ${height}" role="img" ` +
      `aria-label="Spend per 5 minutes by model and provider">${parts.join('')}</svg>`,
    width: svgW,
    series,
    buckets,
  };
}

// Time-series lines: one thin line per series plus an emphasized total
// line (the sum across series). Same shape as stackedBarsSvg so the
// page can swap renderers behind one toggle.
export function lineSeriesSvg(rows, { width, height = 220 } = {}) {
  const { series, cells, buckets } = pivotTimeline(rows);
  if (buckets.length === 0) return emptySvg('No timeline data');
  const LEFT = 56;
  const TOP = 12;
  const BOTTOM = 40;
  const slot = Math.max(8, Math.min(16, Math.floor((Math.max(width || 640, 320) - LEFT - 12) / buckets.length)));
  const svgW = LEFT + buckets.length * slot + 12;
  const plotH = height - TOP - BOTTOM;
  const base = TOP + plotH;

  // matrix[seriesIndex][bucketIndex] = cost, so each line shares one axis.
  const matrix = series.map((name) =>
    buckets.map((bucket) => cells.get(bucket + SEP + name) || 0),
  );
  const totals = buckets.map((_, bi) => matrix.reduce((sum, col) => sum + col[bi], 0));
  const yMax = niceCeil(Math.max(...totals, 0));
  const xAt = (i) => LEFT + i * slot + slot / 2;
  const yAt = (value) => base - (value / yMax) * plotH;

  const parts = [];
  for (let i = 0; i <= 4; i += 1) {
    const y = base - (plotH * i) / 4;
    const value = (yMax * i) / 4;
    parts.push(
      `<line x1="${LEFT}" y1="${y}" x2="${svgW - 8}" y2="${y}" class="grid"/>`,
      `<text x="${LEFT - 6}" y="${y + 3}" class="axis" text-anchor="end">${esc(money(value))}</text>`,
    );
  }

  const pointAt = (i, value, fill, title) =>
    `<circle cx="${xAt(i)}" cy="${yAt(value).toFixed(1)}" r="2.5" fill="${fill}">` +
    `<title>${esc(title)}</title></circle>`;

  // Per-series lines, palette-colored and thin.
  matrix.forEach((col, si) => {
    if (col.length === 1) {
      parts.push(pointAt(0, col[0], colorAt(si), `${buckets[0]} — ${series[si]}: ${money(col[0])}`));
      return;
    }
    const pts = col.map((value, bi) => `${xAt(bi)},${yAt(value).toFixed(1)}`).join(' ');
    parts.push(
      `<polyline points="${pts}" fill="none" stroke="${colorAt(si)}" stroke-width="1.5" stroke-linejoin="round">` +
        `<title>${esc(series[si])}</title></polyline>`,
    );
  });

  // Total line, emphasized with the theme accent via CSS classes.
  if (totals.length === 1) {
    parts.push(
      `<circle cx="${xAt(0)}" cy="${yAt(totals[0]).toFixed(1)}" r="3" class="total-dot">` +
        `<title>${esc(buckets[0])} — Total: ${money(totals[0])}</title></circle>`,
    );
  } else {
    const pts = totals.map((value, bi) => `${xAt(bi)},${yAt(value).toFixed(1)}`).join(' ');
    parts.push(
      `<polyline points="${pts}" fill="none" class="total-line" stroke-linejoin="round" stroke-linecap="round">` +
        `<title>Total spend</title></polyline>`,
    );
  }

  const labelStep = Math.max(1, Math.ceil(buckets.length / 12));
  buckets.forEach((bucket, i) => {
    if (i % labelStep === 0) {
      parts.push(
        `<text x="${xAt(i)}" y="${base + 12}" class="axis" text-anchor="end" ` +
          `transform="rotate(-45 ${xAt(i)} ${base + 12})">${esc(bucket.slice(5))}</text>`,
      );
    }
  });

  const legend =
    '<span class="chip"><i style="background:var(--accent)"></i>Total</span>' +
    series
      .map((name, i) => `<span class="chip"><i style="background:${colorAt(i)}"></i>${esc(name)}</span>`)
      .join('');

  return {
    legend,
    svg:
      `<svg viewBox="0 0 ${svgW} ${height}" role="img" ` +
      `aria-label="Spend over time as lines, with total">${parts.join('')}</svg>`,
    width: svgW,
    series,
    buckets,
  };
}

// Donut of share of spend. slices = [{label, value}].
export function donutSvg(slices, { size = 180 } = {}) {
  const live = slices.filter((s) => s.value > 0);
  if (live.length === 0) return emptySvg('No spend to chart');
  const total = live.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const stroke = size * 0.16;
  let angle = -Math.PI / 2;
  const parts = [];
  live.forEach((slice, i) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    parts.push(
      `<path d="${d}" fill="none" stroke="${colorAt(i)}" stroke-width="${stroke}" ` +
        `stroke-linecap="butt">` +
        `<title>${esc(slice.label)}: ${esc(money(slice.value))} (${((slice.value / total) * 100).toFixed(1)}%)</title></path>`,
    );
  });
  parts.push(
    `<text x="${cx}" y="${cy - 4}" class="donut-total" text-anchor="middle">${esc(money(total))}</text>`,
    `<text x="${cx}" y="${cy + 14}" class="donut-label" text-anchor="middle">total</text>`,
  );
  const legend = live
    .map((s, i) =>
      `<span class="chip"><i style="background:${colorAt(i)}"></i>${esc(s.label)} · ${esc(money(s.value))}</span>`,
    )
    .join('');
  return {
    legend,
    svg:
      `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Share of spend">${parts.join('')}</svg>`,
    total,
  };
}

// Horizontal bars sorted by value desc. bars = [{label, value}].
export function hbarSvg(bars, { width = 420, row = 22, max = 8 } = {}) {
  const live = bars.filter((b) => b.value > 0).sort((a, b) => b.value - a.value).slice(0, max);
  if (live.length === 0) return emptySvg('No spend to chart');
  const LEFT = 8;
  const LABEL = 140;
  const RIGHT = 64;
  const height = live.length * row + 8;
  const maxVal = Math.max(...live.map((b) => b.value));
  const barW = width - LEFT - LABEL - RIGHT;
  const parts = live.map((bar, i) => {
    const y = 4 + i * row;
    const w = Math.max((bar.value / maxVal) * barW, 2);
    return (
      `<text x="${LEFT + LABEL - 6}" y="${y + 12}" class="axis" text-anchor="end">${esc(shorten(bar.label, 22))}</text>` +
      `<rect x="${LEFT + LABEL}" y="${y + 3}" width="${w.toFixed(1)}" height="${row - 8}" fill="${colorAt(i)}">` +
      `<title>${esc(bar.label)}: ${esc(money(bar.value))}</title></rect>` +
      `<text x="${LEFT + LABEL + w + 4}" y="${y + 12}" class="axis">${esc(money(bar.value))}</text>`
    );
  });
  return {
    svg:
      `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Spend ranking">${parts.join('')}</svg>`,
    items: live,
  };
}

function shorten(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

function emptySvg(message) {
  return {
    legend: '',
    svg: `<p class="empty">${esc(message)}</p>`,
    width: 0,
    series: [],
    buckets: [],
    items: [],
    total: 0,
  };
}

// Collapse 5-minute rows into hour or day buckets. grain is '5min',
// 'hour', or 'day'. Same model+provider cells in one coarser bucket merge.
export function rollupTimeline(rows, grain) {
  if (grain === '5min' || !grain) return rows;
  const map = new Map();
  for (const row of rows) {
    const bucket = grain === 'day' ? row.bucket.slice(0, 10) : row.bucket.slice(0, 13) + ':00';
    const key = bucket + SEP + row.model + SEP + row.provider;
    let next = map.get(key);
    if (!next) {
      next = { bucket, model: row.model, provider: row.provider, calls: 0, costUsd: 0 };
      map.set(key, next);
    }
    next.calls += row.calls;
    next.costUsd += row.costUsd;
  }
  return [...map.values()]
    .map((r) => ({ ...r, costUsd: Math.round(r.costUsd * 10000) / 10000 }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || b.costUsd - a.costUsd);
}

// Keep only rows whose bucket label falls inside [fromLabel, toLabel].
// Labels are UTC 'YYYY-MM-DD HH:MM'; null bounds are open ends.
export function filterTimelineRange(rows, fromLabel, toLabel) {
  return rows.filter((row) =>
    (!fromLabel || row.bucket >= fromLabel) && (!toLabel || row.bucket <= toLabel),
  );
}

// Format epoch ms as a UTC 5-minute bucket label.
export function msToBucketLabel(ms) {
  const date = new Date(ms);
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 5) * 5);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

// Parse a UTC bucket label back to epoch ms.
export function bucketLabelToMs(label) {
  return Date.parse(label.replace(' ', 'T') + ':00Z');
}

// Roll model rows into {label, value} slices. Null costs are skipped.
export function slicesFromModels(models, key) {
  const map = new Map();
  for (const m of models) {
    if (m.costUsd == null || m.costUsd <= 0) continue;
    const label = m[key] || 'unknown';
    map.set(label, (map.get(label) || 0) + m.costUsd);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 10000) / 10000 }))
    .sort((a, b) => b.value - a.value);
}
