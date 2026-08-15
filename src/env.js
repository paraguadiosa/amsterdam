import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export function parseEnvFile(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    vars[key] = value;
  }
  return vars;
}

export function loadEnvFile(filePath, target = process.env) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = parseEnvFile(content);
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in target)) target[key] = value;
    }
    return Object.keys(vars);
  } catch {
    return [];
  }
}

export function loadDefaults(target = process.env) {
  const paths = [
    resolve(process.cwd(), '.env'),
    resolve(homedir(), '.hermes', '.env'),
  ];
  const loaded = [];
  for (const p of paths) {
    const keys = loadEnvFile(p, target);
    if (keys.length) loaded.push(p);
  }
  return loaded;
}
