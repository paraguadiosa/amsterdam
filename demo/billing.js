// Sample data for demo mode (?demo) — hand-written, not from real accounts.
// Same shape as the data/billing.js snapshot written by amster dump.
(function (global) {
  global.BILLING = {
    timestamp: '2025-01-12T18:30:00.000Z',
    demo: true,
    providers: {
      deepseek: { detected: true, balance: 8.42, currency: 'USD' },
      moonshot: { detected: true, balance: 57.10, currency: 'CNY' },
      huggingface: { detected: true, username: 'demo-captain', verified: true },
      openai: { detected: true, verified: true, models: 74 },
      google: { detected: true, verified: true, models: 41 },
      groq: { detected: true, verified: true, models: 22 },
      mistral: { detected: true, verified: true, models: 35 },
      together: { detected: true, error: 'timeout' },
      fireworks: { detected: false },
      xai: { detected: false },
      anthropic: { detected: false },
    },
    spend: {
      models: [
        { model: 'kimi-k2', provider: 'moonshot', sessions: 18, calls: 210, inputTokens: 2400000, outputTokens: 520000, estimatedCostUsd: 3.12, costStatus: 'estimated', lastSeen: '2025-01-12' },
        { model: 'deepseek-v4-flash', provider: 'deepseek', sessions: 42, calls: 380, inputTokens: 1900000, outputTokens: 410000, estimatedCostUsd: 1.83, costStatus: 'estimated', lastSeen: '2025-01-12' },
        { model: 'llama-3.3-70b', provider: 'groq', sessions: 9, calls: 96, inputTokens: 640000, outputTokens: 180000, estimatedCostUsd: 0.41, costStatus: 'estimated', lastSeen: '2025-01-10' },
        { model: 'Qwen3.5-9B-Q8_0.gguf', provider: 'local', sessions: 5, calls: 60, inputTokens: 300000, outputTokens: 90000, estimatedCostUsd: 0, costStatus: 'local', lastSeen: '2025-01-11' },
        { model: 'mystery-7b', provider: 'together', sessions: 2, calls: 12, inputTokens: 50000, outputTokens: 9000, estimatedCostUsd: null, costStatus: 'unknown', lastSeen: '2025-01-08' },
        { model: 'Gemma4-12B-QAT-Q4_K_M.gguf', provider: 'local', sessions: 0, calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null, costStatus: 'no usage', lastSeen: null },
      ],
      totalEstimatedUsd: 5.36,
      modelCount: 6,
    },
    piSpend: {
      models: [
        { model: 'deepseek-v4-flash', provider: 'deepseek', sessions: 21, calls: 240, totalTokens: 1400000, costUsd: 0.97, lastSeen: '2025-01-12' },
        { model: 'kimi-k2', provider: 'moonshot', sessions: 7, calls: 88, totalTokens: 980000, costUsd: 1.45, lastSeen: '2025-01-11' },
      ],
      sessionCount: 28,
      totalUsd: 2.42,
      modelCount: 2,
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
