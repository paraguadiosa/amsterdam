/** OpenRouter — auth/key endpoint returns usage and limit. */
export default {
  id: 'openrouter',
  name: 'OpenRouter',
  envKey: 'OPENROUTER_API_KEY',
  defaultBaseUrl: 'https://openrouter.ai',

  async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
    const res = await fetchFn(`${baseUrl}/api/v1/auth/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const d = body.data ?? {};
    return {
      usage: d.usage ?? null,
      limit: d.limit ?? null,
      freeTier: d.is_free_tier ?? null,
    };
  },
};
