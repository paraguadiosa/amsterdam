import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  openManualStore,
  openDefaultManualStore,
  getManualCredits,
  setManualCredit,
  closeManualStore,
} from '../src/manual-credits.js';

describe('manual credits store', () => {
  let dir;
  let store;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-manual-'));
    store = openManualStore(join(dir, 'manual-credits.db'));
  });

  after(() => {
    closeManualStore(store);
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts empty', () => {
    assert.deepEqual(getManualCredits(store), {});
  });

  it('sets and reads a credit', () => {
    setManualCredit(store, 'anthropic', 25.5);
    assert.deepEqual(getManualCredits(store), { anthropic: 25.5 });
  });

  it('updates an existing credit', () => {
    setManualCredit(store, 'anthropic', 30);
    assert.deepEqual(getManualCredits(store), { anthropic: 30 });
  });

  it('stores several providers at once', () => {
    setManualCredit(store, 'xai', 5);
    setManualCredit(store, 'groq', 7);
    const all = getManualCredits(store);
    assert.equal(all.anthropic, 30);
    assert.equal(all.xai, 5);
    assert.equal(all.groq, 7);
  });

  it('deletes a credit with null', () => {
    setManualCredit(store, 'anthropic', null);
    assert.deepEqual(getManualCredits(store), { xai: 5, groq: 7 });
    setManualCredit(store, 'xai', null);
    setManualCredit(store, 'groq', null);
    assert.deepEqual(getManualCredits(store), {});
  });

  it('rejects invalid amounts', () => {
    assert.throws(() => setManualCredit(store, 'xai', -1), TypeError);
    assert.throws(() => setManualCredit(store, 'xai', NaN), TypeError);
    assert.throws(() => setManualCredit(store, 'xai', Infinity), TypeError);
    assert.throws(() => setManualCredit(store, 'xai', '10'), TypeError);
    assert.throws(() => setManualCredit(store, 'xai', undefined), TypeError);
  });

  it('rejects invalid providers', () => {
    assert.throws(() => setManualCredit(store, '', 10), TypeError);
    assert.throws(() => setManualCredit(store, null, 10), TypeError);
    assert.throws(() => setManualCredit(store, 42, 10), TypeError);
  });
});

describe('manual credits store robustness', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'amsterdam-manual-robust-'));
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it('creates the db file and parent dirs on open', () => {
    const path = join(dir, 'nested', 'store.db');
    const s = openManualStore(path);
    assert.ok(s.db);
    assert.deepEqual(getManualCredits(s), {});
    closeManualStore(s);
    assert.ok(existsSync(path));
  });

  it('survives a corrupt db file with empty reads', () => {
    const path = join(dir, 'corrupt.db');
    writeFileSync(path, 'this is not a sqlite database');
    const s = openManualStore(path);
    assert.deepEqual(getManualCredits(s), {});
    setManualCredit(s, 'pi', 50); // must not throw
    assert.deepEqual(getManualCredits(s), {});
    closeManualStore(s);
  });

  it('survives a store whose db failed to open', () => {
    const s = openManualStore(dir); // an existing directory is not openable
    setManualCredit(s, 'pi', 50);
    assert.deepEqual(getManualCredits(s), {});
    closeManualStore(s);
  });

  it('treats a missing store object as empty', () => {
    assert.deepEqual(getManualCredits(null), {});
    setManualCredit(null, 'pi', 50); // no-op, no throw
    closeManualStore(null);
  });

  it('skips malformed rows defensively', () => {
    const path = join(dir, 'malformed.db');
    const s = openManualStore(path);
    s.db.exec(`
      INSERT INTO manual_credits (provider, amount, updated_at) VALUES ('pi', 50, 't1');
      INSERT INTO manual_credits (provider, amount, updated_at) VALUES ('bad', -3, 't2');
      INSERT INTO manual_credits (provider, amount, updated_at) VALUES ('nan', 'not-a-number', 't3');
    `);
    assert.deepEqual(getManualCredits(s), { pi: 50 });
    closeManualStore(s);
  });
});

describe('openDefaultManualStore', () => {
  it('resolves into the repo data dir', () => {
    const s = openDefaultManualStore();
    assert.ok(s.db);
    assert.ok(s.dbPath.endsWith(join('data', 'manual-credits.db')));
    closeManualStore(s);
  });
});
