// Read-only per-model spend aggregation from Pi session logs.
// Pi (pi.dev CLI) writes one JSONL file per session under
// ~/.pi/agent/sessions; Amsterdam only reads it, never writes.
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_SESSIONS_DIR = join(homedir(), '.pi', 'agent', 'sessions');

// Resolve the Pi sessions dir from an env-like object.
// PI_SESSIONS_DIR overrides the default ~/.pi/agent/sessions.
export function resolvePiSessionsDir(env = process.env) {
  const raw = env.PI_SESSIONS_DIR || DEFAULT_SESSIONS_DIR;
  return raw.replace(/^~(?=\/|$)/, homedir());
}

// Pi encodes the cwd into the session directory name, e.g.
// /home/eve/Coding_Projects/amsterdam -> --home-eve-Coding_Projects-amsterdam--.
// The in-file session header is authoritative; this decode only fills the
// gap for files that have no header line.
function cwdFromDirName(dirName) {
  const stripped = dirName.replace(/^--/, '').replace(/--$/, '');
  return '/' + stripped.replace(/-/g, '/');
}

// The project is the basename of the session cwd. Home-directory sessions
// (cwd ending in /eve) count as 'home' so they do not spread one project
// per home machine user.
function projectFromCwd(cwd) {
  if (!cwd || typeof cwd !== 'string') return 'unknown';
  const base = basename(cwd);
  return base === 'eve' ? 'home' : base;
}

// Session id fallback: the filename is <timestamp>_<id>.jsonl.
function idFromFileName(fileName) {
  return fileName.replace(/\.jsonl$/, '').split('_').slice(1).join('_') || fileName;
}

function listJsonlFiles(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // unreadable subdir — skip it
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(full);
      }
    }
  }
  return files;
}

function numOr(value, fallback) {
  return typeof value === 'number' ? value : fallback;
}

// One record per counted assistant message. The message event carries
// provider/model/usage/timestamp; the project comes from the session cwd.
function callFromMessage(msg, event, file) {
  const model = typeof msg.model === 'string' && msg.model ? msg.model : 'unknown';
  const provider = typeof msg.provider === 'string' && msg.provider ? msg.provider : 'unknown';
  const usage = msg.usage;
  const cost = usage.cost && typeof usage.cost === 'object' ? usage.cost : {};
  return {
    timestamp: typeof event.timestamp === 'string' ? event.timestamp : null,
    sessionId: file.sessionId,
    project: projectFromCwd(file.cwd),
    model,
    provider,
    inputTokens: numOr(usage.input, 0),
    outputTokens: numOr(usage.output, 0),
    cacheReadTokens: numOr(usage.cacheRead, 0),
    reasoningTokens: numOr(usage.reasoning, 0),
    totalTokens: numOr(usage.totalTokens, 0),
    costUsd: numOr(cost.total, 0),
  };
}

// Parse one session file and yield one record per counted assistant
// message. Malformed lines are counted into stats and skipped.
function* callsFromFile(filePath, dirName, stats) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return; // unreadable file — skip it
  }
  const file = {
    sessionId: idFromFileName(basename(filePath)),
    cwd: cwdFromDirName(dirName),
  };
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      stats.malformedLines += 1;
      continue;
    }
    if (typeof obj !== 'object' || obj === null) continue;
    if (obj.type === 'session') {
      if (typeof obj.id === 'string' && obj.id) file.sessionId = obj.id;
      if (typeof obj.cwd === 'string' && obj.cwd) file.cwd = obj.cwd;
      continue;
    }
    if (obj.type !== 'message') continue;
    const msg = obj.message;
    if (typeof msg !== 'object' || msg === null) continue;
    if (msg.role !== 'assistant') continue;
    const usage = msg.usage;
    if (typeof usage !== 'object' || usage === null) continue;
    if (usage.input == null && usage.cost == null) continue;
    yield callFromMessage(msg, obj, file);
  }
}

// Walk every session file under dir and yield its call records.
function* iterCalls(dir, stats) {
  for (const filePath of listJsonlFiles(dir)) {
    yield* callsFromFile(filePath, basename(dirname(filePath)), stats);
  }
}

// Fold one call record into the per-model and per-project accumulators.
function foldCall(state, call) {
  const key = call.model + '\u0000' + call.provider;
  let m = state.models.get(key);
  if (!m) {
    m = {
      model: call.model,
      provider: call.provider,
      sessions: new Set(),
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      lastSeen: null,
      projects: new Map(),
    };
    state.models.set(key, m);
  }
  m.sessions.add(call.sessionId);
  m.calls += 1;
  m.inputTokens += call.inputTokens;
  m.outputTokens += call.outputTokens;
  m.cacheReadTokens += call.cacheReadTokens;
  m.reasoningTokens += call.reasoningTokens;
  m.totalTokens += call.totalTokens;
  m.costUsd += call.costUsd;
  if (call.timestamp && (!m.lastSeen || call.timestamp > m.lastSeen)) m.lastSeen = call.timestamp;

  let p = m.projects.get(call.project);
  if (!p) {
    p = { project: call.project, calls: 0, costUsd: 0 };
    m.projects.set(call.project, p);
  }
  p.calls += 1;
  p.costUsd += call.costUsd;

  let proj = state.projects.get(call.project);
  if (!proj) {
    proj = { project: call.project, sessions: new Set(), calls: 0, costUsd: 0 };
    state.projects.set(call.project, proj);
  }
  proj.sessions.add(call.sessionId);
  proj.calls += 1;
  proj.costUsd += call.costUsd;

  state.sessions.add(call.sessionId);
  state.totalTokens += call.totalTokens;
  state.totalUsd += call.costUsd;
}

function buildResult(dir, state) {
  const models = Array.from(state.models.values()).map((m) => ({
    model: m.model,
    provider: m.provider,
    sessions: m.sessions.size,
    calls: m.calls,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    cacheReadTokens: m.cacheReadTokens,
    reasoningTokens: m.reasoningTokens,
    totalTokens: m.totalTokens,
    costUsd: Math.round(m.costUsd * 10000) / 10000,
    lastSeen: m.lastSeen,
    projects: Array.from(m.projects.values())
      .map((p) => ({
        project: p.project,
        calls: p.calls,
        costUsd: Math.round(p.costUsd * 10000) / 10000,
      }))
      .sort((a, b) => b.costUsd - a.costUsd || a.project.localeCompare(b.project)),
  }));
  models.sort((a, b) => b.costUsd - a.costUsd || a.model.localeCompare(b.model));

  const projects = Array.from(state.projects.values())
    .map((p) => ({
      project: p.project,
      sessionCount: p.sessions.size,
      calls: p.calls,
      costUsd: Math.round(p.costUsd * 10000) / 10000,
    }))
    .sort((a, b) => b.costUsd - a.costUsd || a.project.localeCompare(b.project));

  return {
    source: 'pi-sessions',
    generatedAt: new Date().toISOString(),
    sessionsDir: dir,
    sessionCount: state.sessions.size,
    totalUsd: Math.round(state.totalUsd * 10000) / 10000,
    totalTokens: state.totalTokens,
    modelCount: models.length,
    malformedLines: state.malformedLines,
    models,
    projects,
  };
}

// Read spend from Pi session logs. Never throws: a missing or unreadable
// sessions dir returns null; an existing empty dir returns the shape with
// zero totals. Accepts either a plain path or an env-like object with
// PI_SESSIONS_DIR.
export function readPiSpend(arg) {
  const dir = resolveDir(arg);
  if (!sessionsDirExists(dir)) return null;
  const state = {
    models: new Map(),
    projects: new Map(),
    sessions: new Set(),
    malformedLines: 0,
    totalTokens: 0,
    totalUsd: 0,
  };
  for (const call of iterCalls(dir, state)) foldCall(state, call);
  return buildResult(dir, state);
}

// Read the raw per-call records from Pi session logs, one per counted
// assistant message, sorted by timestamp. Same contract as readPiSpend:
// a plain path or an env-like object, null when the dir is missing.
export function readPiCalls(arg) {
  const dir = resolveDir(arg);
  if (!sessionsDirExists(dir)) return null;
  const stats = { malformedLines: 0 };
  const calls = [];
  for (const call of iterCalls(dir, stats)) calls.push(call);
  calls.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  return { sessionsDir: dir, calls, malformedLines: stats.malformedLines };
}

function resolveDir(arg) {
  return typeof arg === 'string' ? arg : resolvePiSessionsDir(arg);
}

function sessionsDirExists(dir) {
  try {
    readdirSync(dir, { withFileTypes: true });
    return true;
  } catch {
    return false;
  }
}
