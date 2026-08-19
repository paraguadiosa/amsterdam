// Render a self-contained HTML report of Pi usage spend in 5-minute
// buckets, one stacked series per model+provider. It reads the SQLite
// export (data/usage.db, built by `amster export-usage`) and writes a
// static file with an inline SVG chart — no server, no dependencies.
// Run it with `amster usage-report` or `node src/usage-report.js`.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { resolveUsageDbPath } from './usage-db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORT_PATH = resolve(__dirname, '..', 'data', 'usage-report.html');

// Resolve the report path from an env-like object.
// USAGE_REPORT overrides the default data/usage-report.html.
export function resolveUsageReportPath(env = process.env) {
  const raw = env.USAGE_REPORT || DEFAULT_REPORT_PATH;
  return raw.replace(/^~(?=\/|$)/, homedir());
}

const MAX_BUCKETS = 240; // last 240 non-empty buckets = 20 h of activity
const MAX_SERIES = 6; // top series keep a color; the rest merge into "other"
const OTHER = 'other';
const PALETTE = ['#4fc3f7', '#aed581', '#ffb74d', '#f06292', '#ba68c8', '#4db6ac', '#90a4ae'];
const SEP = '\u0000'; // pivot-map key separator; never appears in the data

// Read the non-empty 5-minute buckets from the export database.
// Keeps only the last MAX_BUCKETS distinct buckets so the chart stays
// readable. Returns plain rows: {bucket, model, provider, calls, costUsd}.
export function readBuckets(dbPath, maxBuckets = MAX_BUCKETS) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `SELECT bucket, model, provider, calls, cost_usd AS costUsd
         FROM spend_5min
         WHERE cost_usd > 0
         ORDER BY bucket`,
      )
      .all()
      .map((row) => ({ ...row }));
    const kept = new Set([...new Set(rows.map((r) => r.bucket))].slice(-maxBuckets));
    return rows.filter((r) => kept.has(r.bucket));
  } finally {
    db.close();
  }
}

// Pick the top model+provider series by total cost; the rest are "other".
function pickSeries(rows) {
  const totals = new Map();
  for (const row of rows) {
    const key = `${row.model} · ${row.provider}`;
    totals.set(key, (totals.get(key) || 0) + row.costUsd);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map(([key]) => key);
}

// Pivot rows into { buckets: [...], series: [...], cells: Map }.
// cells maps "bucket series" to its cost, with non-top series merged.
function pivot(rows, series) {
  const top = new Set(series);
  const buckets = [...new Set(rows.map((r) => r.bucket))].sort();
  const cells = new Map();
  for (const row of rows) {
    const key = `${row.model} · ${row.provider}`;
    const name = top.has(key) ? key : OTHER;
    const cell = row.bucket + SEP + name;
    cells.set(cell, (cells.get(cell) || 0) + row.costUsd);
  }
  const names = cellsHas(cells, OTHER) ? [...series, OTHER] : series;
  return { buckets, series: names, cells };
}

function cellsHas(cells, name) {
  for (const key of cells.keys()) {
    if (key.endsWith(SEP + name)) return true;
  }
  return false;
}

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Round a max value up to a readable axis ceiling (1/2/5 steps).
function niceCeil(value) {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * mag >= value) return step * mag;
  }
  return 10 * mag;
}

// Build the stacked-bar SVG. One bar per bucket, one segment per series.
function buildSvg({ buckets, series, cells }) {
  const SLOT = 9;
  const BAR = 7;
  const LEFT = 64;
  const TOP = 16;
  const HEIGHT = 280;
  const LABELS = 48;
  const width = LEFT + buckets.length * SLOT + 16;
  const height = TOP + HEIGHT + LABELS;
  const base = TOP + HEIGHT;
  const totals = buckets.map((b) =>
    series.reduce((sum, s) => sum + (cells.get(b + SEP + s) || 0), 0),
  );
  const yMax = niceCeil(Math.max(...totals, 0));
  const parts = [];

  for (let i = 0; i <= 4; i += 1) {
    const y = base - (HEIGHT * i) / 4;
    const value = (yMax * i) / 4;
    parts.push(
      `<line x1="${LEFT}" y1="${y}" x2="${width - 8}" y2="${y}" class="grid"/>`,
      `<text x="${LEFT - 6}" y="${y + 3}" class="axis" text-anchor="end">$${value.toFixed(value < 1 ? 3 : 2)}</text>`,
    );
  }

  const labelStep = Math.max(1, Math.ceil(buckets.length / 14));
  buckets.forEach((bucket, i) => {
    const x = LEFT + i * SLOT;
    let y = base;
    series.forEach((name, si) => {
      const cost = cells.get(bucket + SEP + name) || 0;
      if (cost <= 0) return;
      const h = Math.max((cost / yMax) * HEIGHT, 1);
      y -= h;
      parts.push(
        `<rect x="${x}" y="${y.toFixed(1)}" width="${BAR}" height="${h.toFixed(1)}" fill="${PALETTE[si]}">` +
          `<title>${esc(bucket)} — ${esc(name)}: $${cost.toFixed(4)}</title></rect>`,
      );
    });
    if (i % labelStep === 0) {
      parts.push(
        `<text x="${x + BAR / 2}" y="${base + 10}" class="axis" transform="rotate(-45 ${x + BAR / 2} ${base + 10})" text-anchor="end">${esc(bucket.slice(5))}</text>`,
      );
    }
  });

  return { svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Spend per 5 minutes by model and provider">${parts.join('')}</svg>`, width };
}

// Render the report. Options: dbPath, outPath, maxBuckets. Returns stats.
// Throws when the database is missing — run `amster export-usage` first.
export function renderUsageReport(options = {}) {
  const env = options.env || process.env;
  const dbPath = options.dbPath || resolveUsageDbPath(env);
  const outPath = options.outPath || resolveUsageReportPath(env);
  const rows = readBuckets(dbPath, options.maxBuckets);
  const totalUsd = rows.reduce((sum, r) => sum + r.costUsd, 0);
  const generatedAt = new Date().toISOString();

  let body;
  let series = [];
  let bucketCount = 0;
  if (rows.length === 0) {
    body = '<p class="empty">No spend recorded yet. Run some Pi sessions, then <code>amster export-usage</code>.</p>';
  } else {
    series = pickSeries(rows);
    const data = pivot(rows, series);
    series = data.series;
    bucketCount = data.buckets.length;
    const { svg, width } = buildSvg(data);
    const legend = data.series
      .map((name, i) => `<span class="chip"><i style="background:${PALETTE[i]}"></i>${esc(name)}</span>`)
      .join('');
    body = `<div class="legend">${legend}</div><div class="scroll"><div style="width:${width}px">${svg}</div></div>`;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pi usage — spend per 5 min</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='12'%20fill='%23101828'/%3E%3Cg%20stroke='%23c8102e'%20stroke-width='6'%20stroke-linecap='square'%3E%3Cline%20x1='22'%20y1='9'%20x2='42'%20y2='23'/%3E%3Cline%20x1='42'%20y1='9'%20x2='22'%20y2='23'/%3E%3Cline%20x1='22'%20y1='25'%20x2='42'%20y2='39'/%3E%3Cline%20x1='42'%20y1='25'%20x2='22'%20y2='39'/%3E%3Cline%20x1='22'%20y1='41'%20x2='42'%20y2='55'/%3E%3Cline%20x1='42'%20y1='41'%20x2='22'%20y2='55'/%3E%3C/g%3E%3C/svg%3E">
<style>
  body { background:#0d1117; color:#e6edf3; font-family:system-ui,sans-serif; margin:2rem; }
  h1 { font-size:1.25rem; }
  .meta { color:#8b949e; font-size:.85rem; margin-bottom:1rem; }
  .legend { display:flex; flex-wrap:wrap; gap:.75rem; margin-bottom:1rem; font-size:.85rem; }
  .chip i { display:inline-block; width:.75rem; height:.75rem; border-radius:2px; margin-right:.3rem; }
  .scroll { overflow-x:auto; border:1px solid #30363d; border-radius:8px; padding:1rem; }
  svg { display:block; }
  .grid { stroke:#30363d; stroke-width:1; }
  .axis { fill:#8b949e; font-size:10px; font-family:system-ui,sans-serif; }
  .empty { color:#8b949e; }
  code { background:#161b22; padding:.1rem .35rem; border-radius:4px; }
</style>
</head>
<body>
<h1>Pi usage — spend per 5 minutes by model and provider</h1>
<p class="meta">${bucketCount} buckets · total $${totalUsd.toFixed(4)} · generated ${esc(generatedAt)} · buckets in UTC · source: ${esc(dbPath)}</p>
${body}
</body>
</html>
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  return { outPath, dbPath, buckets: bucketCount, series, totalUsd, generatedAt };
}

const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const stats = renderUsageReport();
    console.log(`Wrote ${stats.outPath}`);
    console.log(`${stats.buckets} buckets, ${stats.series.length} series, total $${stats.totalUsd.toFixed(4)}`);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    console.error('Hint: run `amster export-usage` first to build data/usage.db');
    process.exit(1);
  }
}
