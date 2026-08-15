import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseEnvFile,
  loadEnvFile,
  parseHermesPool,
  loadHermesPool,
  loadDefaults,
} from '../src/env.js';

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

// ── parseHermesPool ──────────────────────────────

describe('parseHermesPool', () => {
  const pool = JSON.stringify({
    credential_pool: {
      anthropic: [{ source: 'manual', access_token: 'sk-ant-test' }],
      'kimi-coding': [{ source: 'manual', access_token: 'sk-kimi-test' }],
      deepseek: [{ source: 'env:DEEPSEEK_API_KEY' }],
      huggingface: [{ source: 'env:HF_TOKEN' }],
    },
  });

  it('maps manual credentials to env vars', () => {
    const vars = parseHermesPool(pool);
    assert.equal(vars.ANTHROPIC_API_KEY, 'sk-ant-test');
    assert.equal(vars.KIMI_API_KEY, 'sk-kimi-test');
  });

  it('skips env-sourced credentials', () => {
    const vars = parseHermesPool(pool);
    assert.ok(!('DEEPSEEK_API_KEY' in vars));
    assert.ok(!('HF_TOKEN' in vars));
  });

  it('maps kimi-coding to KIMI_API_KEY', () => {
    const vars = parseHermesPool(pool);
    assert.equal(vars.KIMI_API_KEY, 'sk-kimi-test');
  });

  it('propagates base_url and strips the /v1 suffix', () => {
    const content = JSON.stringify({
      credential_pool: {
        'kimi-coding': [
          { source: 'manual', access_token: 'sk-kimi-test', base_url: 'https://api.moonshot.ai/v1' },
        ],
      },
    });
    const vars = parseHermesPool(content);
    assert.equal(vars.KIMI_API_KEY, 'sk-kimi-test');
    assert.equal(vars.KIMI_BASE_URL, 'https://api.moonshot.ai');
  });

  it('propagates base_url for deepseek and groq', () => {
    const content = JSON.stringify({
      credential_pool: {
        deepseek: [
          { source: 'manual', access_token: 'sk-ds', base_url: 'https://api.deepseek.com/v1' },
        ],
        groq: [
          { source: 'manual', access_token: 'sk-gq', base_url: 'https://api.groq.com/openai/v1' },
        ],
      },
    });
    const vars = parseHermesPool(content);
    assert.equal(vars.DEEPSEEK_BASE_URL, 'https://api.deepseek.com');
    assert.equal(vars.GROQ_BASE_URL, 'https://api.groq.com/openai');
  });

  it('does not propagate base_url for env-sourced credentials', () => {
    const content = JSON.stringify({
      credential_pool: {
        'kimi-coding': [
          { source: 'env:KIMI_API_KEY', base_url: 'https://api.moonshot.cn/v1' },
        ],
      },
    });
    assert.deepEqual(parseHermesPool(content), {});
  });

  it('takes the first manual credential per provider', () => {
    const content = JSON.stringify({
      credential_pool: {
        anthropic: [
          { source: 'manual', access_token: 'sk-first' },
          { source: 'manual', access_token: 'sk-second' },
        ],
      },
    });
    const vars = parseHermesPool(content);
    assert.equal(vars.ANTHROPIC_API_KEY, 'sk-first');
  });

  it('returns empty object for invalid JSON', () => {
    assert.deepEqual(parseHermesPool('not json'), {});
  });

  it('returns empty object when pool is missing', () => {
    assert.deepEqual(parseHermesPool(JSON.stringify({})), {});
  });

  it('skips unknown providers', () => {
    const content = JSON.stringify({
      credential_pool: {
        spotify: [{ source: 'manual', access_token: 'sk-x' }],
      },
    });
    assert.deepEqual(parseHermesPool(content), {});
  });
});

// ── loadHermesPool ───────────────────────────────

describe('loadHermesPool', () => {
  const tmpDir = join(tmpdir(), 'amsterdam-pool-test-' + Date.now());

  it('loads manual credentials into target', () => {
    mkdirSync(tmpDir, { recursive: true });
    const file = join(tmpDir, 'auth.json');
    writeFileSync(file, JSON.stringify({
      credential_pool: {
        anthropic: [{ source: 'manual', access_token: 'sk-ant-test' }],
      },
    }));
    const target = {};
    const keys = loadHermesPool(file, target);
    assert.equal(target.ANTHROPIC_API_KEY, 'sk-ant-test');
    assert.ok(keys.includes('ANTHROPIC_API_KEY'));
    rmSync(tmpDir, { recursive: true });
  });

  it('does not overwrite existing vars', () => {
    mkdirSync(tmpDir, { recursive: true });
    const file = join(tmpDir, 'auth.json');
    writeFileSync(file, JSON.stringify({
      credential_pool: {
        anthropic: [{ source: 'manual', access_token: 'sk-new' }],
      },
    }));
    const target = { ANTHROPIC_API_KEY: 'sk-original' };
    loadHermesPool(file, target);
    assert.equal(target.ANTHROPIC_API_KEY, 'sk-original');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array for missing file', () => {
    assert.deepEqual(loadHermesPool('/nonexistent/auth.json', {}), []);
  });
});

// ── loadDefaults ─────────────────────────────────

describe('loadDefaults', () => {
  const tmpDir = join(tmpdir(), 'amsterdam-defaults-test-' + Date.now());

  it('loads env files and hermes pool together', () => {
    mkdirSync(join(tmpDir, '.hermes'), { recursive: true });
    writeFileSync(join(tmpDir, '.env'), 'PROJECT_KEY=abc');
    writeFileSync(join(tmpDir, '.hermes', '.env'), 'HOME_KEY=def');
    writeFileSync(join(tmpDir, '.hermes', 'auth.json'), JSON.stringify({
      credential_pool: {
        anthropic: [{ source: 'manual', access_token: 'sk-pool' }],
      },
    }));
    const target = {};
    const loaded = loadDefaults(target, { cwd: tmpDir, home: tmpDir });
    assert.equal(target.PROJECT_KEY, 'abc');
    assert.equal(target.HOME_KEY, 'def');
    assert.equal(target.ANTHROPIC_API_KEY, 'sk-pool');
    assert.equal(loaded.length, 3);
    rmSync(tmpDir, { recursive: true });
  });

  it('project env wins over pool', () => {
    mkdirSync(join(tmpDir, '.hermes'), { recursive: true });
    writeFileSync(join(tmpDir, '.env'), 'ANTHROPIC_API_KEY=sk-project');
    writeFileSync(join(tmpDir, '.hermes', 'auth.json'), JSON.stringify({
      credential_pool: {
        anthropic: [{ source: 'manual', access_token: 'sk-pool' }],
      },
    }));
    const target = {};
    loadDefaults(target, { cwd: tmpDir, home: tmpDir });
    assert.equal(target.ANTHROPIC_API_KEY, 'sk-project');
    rmSync(tmpDir, { recursive: true });
  });
});
