// Sample data for the Amsterdam Monitor demo (?demo). Same shape as
// GET /api/usage. Buckets are generated relative to now so the default
// 24-hour range always shows a populated timeline. No real accounts.
(function (global) {
  'use strict';

  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  // Floor an epoch ms value to a UTC 5-minute bucket label.
  function bucketLabel(ms) {
    const date = new Date(ms);
    date.setUTCSeconds(0, 0);
    date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 5) * 5);
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  // Deterministic hash in [0, 1) so the chart is stable across reloads.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }

  function buildUsage(nowMs) {
    const now = nowMs || Date.now();
    const bucketMs = 5 * 60 * 1000;
    const spanMs = 24 * 3600 * 1000;
    const start = Math.floor((now - spanMs) / bucketMs) * bucketMs;

    const series = [
      { model: 'deepseek-v4-flash', provider: 'deepseek', base: 0.0002, amp: 0.0006 },
      { model: 'kimi-k2', provider: 'moonshot', base: 0.0003, amp: 0.0011 },
      { model: 'gpt-5', provider: 'openai', base: 0.0004, amp: 0.0018 },
    ];

    const rows = [];
    for (let t = start; t <= now; t += bucketMs) {
      for (const s of series) {
        const r = hash(t + ':' + s.model);
        const cost = s.base + s.amp * r;
        if (cost < 0.00007) continue; // sparse buckets look real
        rows.push({
          bucket: bucketLabel(t),
          model: s.model,
          provider: s.provider,
          calls: 1 + Math.floor(r * 5),
          costUsd: round4(cost),
        });
      }
    }
    rows.sort((a, b) => a.bucket.localeCompare(b.bucket) || b.costUsd - a.costUsd);

    // Aggregate the timeline back into per-model Pi rows.
    const byModel = new Map();
    for (const row of rows) {
      const key = row.model + '\u0000' + row.provider;
      let acc = byModel.get(key);
      if (!acc) {
        acc = { model: row.model, provider: row.provider, calls: 0, costUsd: 0, lastSeen: null };
        byModel.set(key, acc);
      }
      acc.calls += row.calls;
      acc.costUsd += row.costUsd;
      acc.lastSeen = row.bucket;
    }
    const piModels = [...byModel.values()].map((m) => ({
      model: m.model,
      provider: m.provider,
      calls: m.calls,
      sessions: Math.max(1, Math.round(m.calls / 12)),
      tokens: m.calls * 2200,
      costUsd: round4(m.costUsd),
      costStatus: 'actual',
      lastSeen: (m.lastSeen ? m.lastSeen.replace(' ', 'T') + ':00Z' : null),
    })).sort((a, b) => b.costUsd - a.costUsd);

    const piTotalUsd = round4(piModels.reduce((sum, m) => sum + m.costUsd, 0));
    const piCalls = piModels.reduce((sum, m) => sum + m.calls, 0);
    const piTokens = piModels.reduce((sum, m) => sum + m.tokens, 0);
    const piSessions = piModels.reduce((sum, m) => sum + m.sessions, 0);

    const hermesModels = [
      { model: 'deepseek-v4-flash', provider: 'deepseek', calls: 380, sessions: 42, tokens: 2310000, costUsd: 1.83, costStatus: 'estimated', lastSeen: new Date(now - 3600e3).toISOString() },
      { model: 'llama-3.3-70b', provider: 'groq', calls: 96, sessions: 9, tokens: 820000, costUsd: 0.41, costStatus: 'estimated', lastSeen: new Date(now - 2 * 3600e3).toISOString() },
      { model: 'Qwen3.5-9B-Q8_0.gguf', provider: 'local', calls: 60, sessions: 5, tokens: 390000, costUsd: 0, costStatus: 'local', lastSeen: new Date(now - 3 * 3600e3).toISOString() },
    ];
    const hermesTotalUsd = round4(hermesModels.reduce((sum, m) => sum + m.costUsd, 0));
    const hermesCalls = hermesModels.reduce((sum, m) => sum + m.calls, 0);
    const hermesTokens = hermesModels.reduce((sum, m) => sum + m.tokens, 0);

    return {
      source: 'usage-sources',
      generatedAt: new Date(now).toISOString(),
      totalUsd: round4(piTotalUsd + hermesTotalUsd),
      sources: [
        {
          id: 'pi',
          label: 'Pi sessions',
          kind: 'actual',
          available: true,
          totalUsd: piTotalUsd,
          totalCalls: piCalls,
          totalTokens: piTokens,
          modelCount: piModels.length,
          sessionCount: piSessions,
          lastSeen: piModels.length ? piModels[0].lastSeen : null,
          models: piModels,
        },
        {
          id: 'hermes',
          label: 'Hermes',
          kind: 'estimated',
          available: true,
          totalUsd: hermesTotalUsd,
          totalCalls: hermesCalls,
          totalTokens: hermesTokens,
          modelCount: hermesModels.length,
          sessionCount: null,
          lastSeen: hermesModels[0].lastSeen,
          models: hermesModels,
        },
      ],
      timeline: { available: true, grain: '5min', timezone: 'UTC', rows },
    };
  }

  global.AMS_USAGE = buildUsage();
  global.buildUsageDemo = buildUsage; // exported for tests
})(typeof window !== 'undefined' ? window : globalThis);
