// Server-side manual credit tracking in a tiny SQLite store.
// Manual balances for providers without a billing API (and the Pi
// budget) live in data/manual-credits.db so every browser on the
// machine shares the same numbers. localStorage in the dashboard is
// only a fallback when the server is unreachable.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

export function openDefaultManualStore() {
  return openManualStore(resolve(DATA_DIR, 'manual-credits.db'));
}

// Open (or create) the store at dbPath. Never throws: an unreadable or
// corrupt file yields a store whose ops all no-op, so the dashboard
// keeps working without manual credits.
export function openManualStore(dbPath) {
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    try {
      chmodSync(dbPath, 0o600);
    } catch {
      // Permission hardening is best-effort; the store still works.
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS manual_credits (
        provider TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    return { db, dbPath };
  } catch {
    return { db: null, dbPath };
  }
}

// Plain object {provider: amount}; empty when nothing is stored.
// Malformed rows are skipped defensively.
export function getManualCredits(store) {
  const out = {};
  if (!store || !store.db) return out;
  try {
    const rows = store.db.prepare('SELECT provider, amount FROM manual_credits').all();
    for (const row of rows) {
      if (
        row && typeof row.provider === 'string' && row.provider &&
        typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount >= 0
      ) {
        out[row.provider] = row.amount;
      }
    }
  } catch {
    // Corrupt table: report nothing rather than crashing.
  }
  return out;
}

// Upsert provider/amount. A null amount deletes the row; any other
// non-finite or negative amount throws a TypeError.
export function setManualCredit(store, provider, amount) {
  if (typeof provider !== 'string' || provider.length === 0) {
    throw new TypeError('provider must be a non-empty string');
  }
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    throw new TypeError('amount must be a finite number >= 0 or null');
  }
  if (!store || !store.db) return;
  try {
    if (amount === null) {
      store.db.prepare('DELETE FROM manual_credits WHERE provider = ?').run(provider);
      return;
    }
    store.db.prepare(`
      INSERT INTO manual_credits (provider, amount, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        amount = excluded.amount,
        updated_at = excluded.updated_at
    `).run(provider, amount, new Date().toISOString());
  } catch {
    // Unwritable store: keep going without persisting.
  }
}

export function closeManualStore(store) {
  if (store && store.db) {
    try {
      store.db.close();
    } catch {
      // Already closed or corrupt: nothing to release.
    }
  }
}
