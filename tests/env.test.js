import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvFile, loadEnvFile } from '../src/env.js';

// ── parseEnvFile ─────────────────────────────────

describe('parseEnvFile', () => {
  it('parses simple key=value', () => {
    const vars = parseEnvFile('FOO=bar\nBAZ=123');
    assert.equal(vars.FOO, 'bar');
    assert.equal(vars.BAZ, '123');
  });

  it('skips comments and blank lines', () => {
    const vars = parseEnvFile('# comment\n\nKEY=val\n  # another');
    assert.deepEqual(vars, { KEY: 'val' });
  });

  it('strips double quotes', () => {
    const vars = parseEnvFile('KEY="hello world"');
    assert.equal(vars.KEY, 'hello world');
  });

  it('strips single quotes', () => {
    const vars = parseEnvFile("KEY='hello'");
    assert.equal(vars.KEY, 'hello');
  });

  it('handles values with equals signs', () => {
    const vars = parseEnvFile('URL=https://example.com?a=1&b=2');
    assert.equal(vars.URL, 'https://example.com?a=1&b=2');
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(parseEnvFile(''), {});
  });

  it('skips lines without equals', () => {
    const vars = parseEnvFile('not a var\nKEY=val');
    assert.deepEqual(vars, { KEY: 'val' });
  });
});

// ── loadEnvFile ──────────────────────────────────

describe('loadEnvFile', () => {
  const tmpDir = join(tmpdir(), 'amsterdam-test-' + Date.now());

  it('loads vars into target object', () => {
    mkdirSync(tmpDir, { recursive: true });
    const file = join(tmpDir, '.env');
    writeFileSync(file, 'TEST_A=hello\nTEST_B=world');
    const target = {};
    const keys = loadEnvFile(file, target);
    assert.equal(target.TEST_A, 'hello');
    assert.equal(target.TEST_B, 'world');
    assert.ok(keys.length > 0);
    rmSync(tmpDir, { recursive: true });
  });

  it('does not overwrite existing vars', () => {
    mkdirSync(tmpDir, { recursive: true });
    const file = join(tmpDir, '.env2');
    writeFileSync(file, 'EXISTING=new');
    const target = { EXISTING: 'original' };
    loadEnvFile(file, target);
    assert.equal(target.EXISTING, 'original');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array for missing file', () => {
    const keys = loadEnvFile('/nonexistent/.env', {});
    assert.deepEqual(keys, []);
  });
});
