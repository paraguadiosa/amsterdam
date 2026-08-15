/**
 * Factory for providers that only verify the API key.
 * These providers lack a billing endpoint, so we call /v1/models instead.
 */
export function createVerifyProvider(config) {
  const {
    id,
    name,
    envKey,
    baseUrlEnv,
    defaultBaseUrl,
    buildRequest = bearerModels,
  } = config;

  return {
    id,
    name,
    envKey,
    baseUrlEnv,
    defaultBaseUrl,
    async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
      const { url, options } = buildRequest(apiKey, baseUrl);
      const res = await fetchFn(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json().catch(() => ({}));
      const models = body.data ?? body.models ?? [];
      return {
        verified: true,
        models: Array.isArray(models) ? models.length : null,
      };
    },
  };
}

function bearerModels(apiKey, baseUrl) {
  return {
    url: `${baseUrl}/v1/models`,
    options: { headers: { Authorization: `Bearer ${apiKey}` } },
  };
}

export const anthropic = createVerifyProvider({
  id: 'anthropic',
  name: 'Anthropic',
  envKey: 'ANTHROPIC_API_KEY',
  defaultBaseUrl: 'https://api.anthropic.com',
  buildRequest: (key, base) => ({
    url: `${base}/v1/models`,
    options: {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    },
  }),
});

export const openai = createVerifyProvider({
  id: 'openai',
  name: 'OpenAI',
  envKey: 'OPENAI_API_KEY',
  defaultBaseUrl: 'https://api.openai.com',
});

export const groq = createVerifyProvider({
  id: 'groq',
  name: 'Groq',
  envKey: 'GROQ_API_KEY',
  baseUrlEnv: 'GROQ_BASE_URL',
  defaultBaseUrl: 'https://api.groq.com/openai',
});

export const together = createVerifyProvider({
  id: 'together',
  name: 'Together',
  envKey: 'TOGETHER_API_KEY',
  defaultBaseUrl: 'https://api.together.xyz',
});

export const mistral = createVerifyProvider({
  id: 'mistral',
  name: 'Mistral',
  envKey: 'MISTRAL_API_KEY',
  defaultBaseUrl: 'https://api.mistral.ai',
});

export const google = createVerifyProvider({
  id: 'google',
  name: 'Google AI Studio',
  envKey: 'GOOGLE_API_KEY',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  buildRequest: (key, base) => ({
    url: `${base}/v1beta/models?key=${key}`,
    options: {},
  }),
});

export const fireworks = createVerifyProvider({
  id: 'fireworks',
  name: 'Fireworks',
  envKey: 'FIREWORKS_API_KEY',
  defaultBaseUrl: 'https://api.fireworks.ai',
});
