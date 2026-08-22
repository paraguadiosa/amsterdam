import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import providers from './providers/index.js';
import { openFloodgates } from './dam.js';
import { loadDefaults } from './env.js';
import { formatBillingJs } from './format.js';
import { openDefaultManualStore, getManualCredits, setManualCredit } from './manual-credits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_PORT = 3131;
const DEFAULT_HOST = '127.0.0.1';
const CACHE_TTL_MS = 60_000;
const MAX_BODY_BYTES = 1_000_000;
const FRESH_MIN_INTERVAL_MS = 5_000;
const PROVIDER_ID_RE = /^[a-z0-9-]+$/i;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

// Manual credits are allowed for any catalog provider id plus 'pi'.
const MANUAL_PROVIDER_IDS = new Set(
  (globalThis.AMS_PROVIDERS || providers).map((p) => p.id).concat('pi'),
);

// Lazy module-level singleton so the daemon keeps one open connection.
let defaultStore = null;
function getDefaultManualStore() {
  if (!defaultStore) defaultStore = openDefaultManualStore();
  return defaultStore;
}

export function createApp({ env = process.env, fetchFn = globalThis.fetch, loadEnv = true, manualStore, freshMinIntervalMs = FRESH_MIN_INTERVAL_MS } = {}) {
  if (loadEnv) loadDefaults(env);

  let cache = { data: null, at: 0 };
  let lastForceAt = 0;
  const store = manualStore || getDefaultManualStore();

  async function getBilling(force = false) {
    const now = Date.now();
    // ?fresh is throttled: a forced refresh re-reads every env file and
    // fires provider requests, so repeated spam must not hammer the
    // owner's provider accounts.
    if (force && now - lastForceAt < freshMinIntervalMs) force = false;
    if (!force && cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
    // Re-read .env files and the Hermes pool so keys added since boot
    // are picked up without a daemon restart.
    if (loadEnv) loadDefaults(env);
    const data = await openFloodgates(env, fetchFn, store);
    cache = { data, at: Date.now() };
    if (force) lastForceAt = Date.now();
    return data;
  }

  const server = http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');

    // The daemon serves billing data and accepts credit writes, so it
    // must only answer to its own host. Without this check, any website
    // can DNS-rebind to 127.0.0.1 and read or modify the data.
    if (!hostAllowed(req.headers.host, env)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (pathname === '/api/billing') {
      try {
        const data = await getBilling(searchParams.has('fresh'));
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (pathname === '/api/manual-credits') {
      if (req.method === 'GET') {
        sendJson(res, 200, getManualCredits(store));
        return;
      }
      if (req.method === 'POST') {
        try {
          // CSRF guard: a browser always sends Origin on cross-origin
          // POSTs, and only our own console page may write credits.
          if (!originAllowed(req.headers.origin, env)) {
            sendJson(res, 403, { error: 'cross-origin request denied' });
            return;
          }
          const body = await readJsonBody(req);
          const error = validateManualCredit(body);
          if (error) {
            sendJson(res, 400, { error });
            return;
          }
          setManualCredit(store, body.provider, body.amount);
          // A credit change alters the billing payload (pi remaining),
          // so drop the cached snapshot.
          cache = { data: null, at: 0 };
          sendJson(res, 200, getManualCredits(store));
        } catch (err) {
          sendJson(res, 400, {
            error: err instanceof SyntaxError ? 'invalid JSON body' : err.message,
          });
        }
        return;
      }
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    // The billing console is the landing page. The Amsterdam Monitor
    // was removed: Grafana is the monitoring surface (see the console
    // header link).
    if (pathname === '/') {
      await sendFile(res, resolve(ROOT, 'index.html'), 'text/html');
      return;
    }

    if (pathname === '/index.html' || pathname === '/console') {
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
      // Reject dot-dot segments, leading slashes (absolute paths turn
      // resolve() into an arbitrary-file read) and anything that escapes
      // the served directory once resolved.
      const safe = /^[\w./-]+\.js$/.test(rel) && !rel.includes('..') && !rel.startsWith('/');
      if (!safe) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const filePath = resolve(ROOT, staticMatch[1], rel);
      const servedRoot = resolve(ROOT, staticMatch[1]) + sep;
      if (!filePath.startsWith(servedRoot)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      await sendFile(res, filePath, 'application/javascript');
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

// Local hostnames the daemon answers to, plus an optional AMS_HOST
// override so an explicitly exposed instance still works.
function allowedHostnames(env) {
  const allowed = new Set(LOCAL_HOSTNAMES);
  const custom = String(env.AMS_HOST || '').toLowerCase().trim();
  if (custom) allowed.add(custom);
  return allowed;
}

// Parse the Host header down to the bare hostname: strip the port and
// IPv6 brackets. Returns false for anything malformed or foreign.
function hostAllowed(hostHeader, env) {
  if (!hostHeader || typeof hostHeader !== 'string') return false;
  let hostname = hostHeader.toLowerCase().trim();
  if (hostname.startsWith('[')) {
    const close = hostname.indexOf(']');
    if (close === -1) return false;
    hostname = hostname.slice(1, close);
  } else {
    hostname = hostname.split(':')[0];
  }
  return allowedHostnames(env).has(hostname);
}

// CSRF guard for state-changing requests. Browsers always send Origin
// on cross-origin POSTs; requests without one come from non-browser
// clients (curl, the CLI) and are trusted like same-origin ones.
function originAllowed(originHeader, env) {
  if (!originHeader || typeof originHeader !== 'string') return true;
  let origin;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') return false;
  return allowedHostnames(env).has(origin.hostname.toLowerCase());
}

// Small async JSON body collector; no dependencies.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        reject(new Error('empty request body'));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Returns an error message, or null when the body is acceptable.
function validateManualCredit(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'body must be a JSON object';
  }
  const { provider, amount } = body;
  if (typeof provider !== 'string' || !PROVIDER_ID_RE.test(provider)) {
    return 'provider must be a non-empty string matching /^[a-z0-9-]+$/i';
  }
  if (!MANUAL_PROVIDER_IDS.has(provider)) {
    return `unknown provider "${provider}"`;
  }
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    return 'amount must be a finite number >= 0 or null';
  }
  return null;
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

export function start(port = DEFAULT_PORT, host = process.env.AMS_HOST || DEFAULT_HOST) {
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
  app.listen(port, host, () => {
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
