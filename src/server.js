import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openFloodgates } from './dam.js';
import { loadDefaults } from './env.js';
import { formatBillingJs } from './format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_PORT = 3131;
const CACHE_TTL_MS = 60_000;

export function createApp({ env = process.env, fetchFn = globalThis.fetch, loadEnv = true } = {}) {
  if (loadEnv) loadDefaults(env);

  let cache = { data: null, at: 0 };

  async function getBilling(force = false) {
    const now = Date.now();
    if (!force && cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
    // Re-read .env files and the Hermes pool so keys added since boot
    // are picked up without a daemon restart.
    if (loadEnv) loadDefaults(env);
    const data = await openFloodgates(env, fetchFn);
    cache = { data, at: Date.now() };
    return data;
  }

  const server = http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');

    if (pathname === '/api/billing') {
      try {
        const data = await getBilling(searchParams.has('fresh'));
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      await sendFile(res, resolve(ROOT, 'index.html'), 'text/html');
      return;
    }

    if (pathname === '/data/billing.js') {
      const data = await getBilling();
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(formatBillingJs(data));
      return;
    }

    const staticMatch = pathname.match(/^\/(src|demo)\/(.+)$/);
    if (staticMatch) {
      const rel = staticMatch[2];
      const safe = /^[\w./-]+\.js$/.test(rel) && !rel.includes('..');
      if (!safe) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      await sendFile(res, resolve(ROOT, staticMatch[1], rel), 'application/javascript');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  return server;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function sendFile(res, filePath, type) {
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

export function start(port = DEFAULT_PORT) {
  const app = createApp();
  app.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      console.error('   Another Amsterdam instance may be running.');
      console.error(`   Stop it first, or run: PORT=${port + 1} amsterdam`);
      process.exit(1);
    }
    throw err;
  });
  app.listen(port, () => {
    console.log(`Amsterdam Console — http://localhost:${port}`);
    console.log(`   PID ${process.pid} — Ctrl+C to stop, auto-refresh every 2.5 min.`);
  });
  return app;
}

const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.argv[2]) || Number(process.env.PORT) || DEFAULT_PORT;
  start(port);
}
