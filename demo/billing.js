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
      pi: { detected: true, kind: 'manual', credit: 42 },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
