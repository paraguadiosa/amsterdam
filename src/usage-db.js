// Export Pi session usage to a SQLite database for BI tools.
// The JSONL logs under ~/.pi/agent/sessions stay the source of truth;
// data/usage.db is a full-refresh replica with one row per counted
// assistant message, plus a daily aggregate view for quick dashboards.
// Run it with `amster export-usage` or `node src/usage-db.js`.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readPiCalls, resolvePiSessionsDir } from './pi-spend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(__dirname, '..', 'data', 'usage.db');

// Resolve the export database path from an env-like object.
// USAGE_DB overrides the default data/usage.db.
export function resolveUsageDbPath(env = process.env) {
  const raw = env.USAGE_DB || DEFAULT_DB_PATH;
  return raw.replace(/^~(?=\/|$)/, homedir());
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY,
    timestamp TEXT,
    session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_read_tokens INTEGER NOT NULL,
    reasoning_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'pi-sessions'
  );
  CREATE INDEX IF NOT EXISTS idx_calls_day ON calls (date(timestamp));
  CREATE INDEX IF NOT EXISTS idx_calls_model ON calls (model);
  CREATE INDEX IF NOT EXISTS idx_calls_project ON calls (project);
  CREATE VIEW IF NOT EXISTS daily_model_spend AS
    SELECT date(timestamp) AS day,
           model,
           provider,
           project,
           COUNT(*) AS calls,
           SUM(total_tokens) AS total_tokens,
           ROUND(SUM(cost_usd), 6) AS cost_usd
    FROM calls
    GROUP BY day, model, provider, project
    ORDER BY day DESC, cost_usd DESC;
  CREATE VIEW IF NOT EXISTS spend_5min AS
    SELECT strftime('%Y-%m-%d %H:', timestamp) ||
           printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5) AS bucket,
           model,
           provider,
           COUNT(*) AS calls,
           SUM(total_tokens) AS total_tokens,
           ROUND(SUM(cost_usd), 6) AS cost_usd
    FROM calls
    WHERE timestamp IS NOT NULL
    GROUP BY bucket, model, provider
    ORDER BY bucket, cost_usd DESC;
`;

const INSERT = `
  INSERT INTO calls (
    timestamp, session_id, project, model, provider,
    input_tokens, output_tokens, cache_read_tokens, reasoning_tokens,
    total_tokens, cost_usd
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// Full-refresh export: rebuild the calls table from the current logs in
// one transaction, so the file never holds a half-written snapshot.
// Re-running is safe and never duplicates rows. Options accept explicit
// sessionsDir/dbPath; otherwise env (PI_SESSIONS_DIR, USAGE_DB) decides.
export function exportUsageToSqlite(options = {}) {
  const env = options.env || process.env;
  const sessionsDir = options.sessionsDir || resolvePiSessionsDir(env);
  const dbPath = options.dbPath || resolveUsageDbPath(env);
  const found = readPiCalls(sessionsDir);
  const calls = found ? found.calls : [];

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(SCHEMA);
    const insert = db.prepare(INSERT);
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM calls');
      for (const call of calls) {
        insert.run(
          call.timestamp,
          call.sessionId,
          call.project,
          call.model,
          call.provider,
          call.inputTokens,
          call.outputTokens,
          call.cacheReadTokens,
          call.reasoningTokens,
          call.totalTokens,
          call.costUsd,
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } finally {
    db.close();
  }

  return {
    dbPath,
    sessionsDir,
    sessionsFound: found !== null,
    rows: calls.length,
    malformedLines: found ? found.malformedLines : 0,
  };
}

const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const stats = exportUsageToSqlite();
    if (!stats.sessionsFound) {
      console.error(`Warning: sessions dir not found: ${stats.sessionsDir}`);
    }
    console.log(`Exported ${stats.rows} calls to ${stats.dbPath}`);
    if (stats.malformedLines > 0) {
      console.log(`Skipped ${stats.malformedLines} malformed log lines`);
    }
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}
