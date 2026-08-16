/**
 * Factory for providers that only verify the API key.
 * These providers lack a billing endpoint, so we call the models
 * endpoint instead. Provider definitions come from catalog.js.
 */
export function createVerifyProvider(config) {
  const {
    id,
    name,
    envKey,
    baseUrlEnv,
    defaultBaseUrl,
    auth = 'bearer',
    modelsPath = '/v1/models',
    buildRequest,
  } = config;

  const request = buildRequest
    || (auth === 'query' ? queryModels(modelsPath) : bearerModels(modelsPath));

  return {
    id,
    name,
    envKey,
    baseUrlEnv,
    defaultBaseUrl,
    async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
      const { url, options } = request(apiKey, baseUrl);
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

function bearerModels(modelsPath) {
  return (apiKey, baseUrl) => ({
    url: `${trim(baseUrl)}${modelsPath}`,
    options: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
}

function queryModels(modelsPath) {
  return (apiKey, baseUrl) => ({
    url: `${trim(baseUrl)}${modelsPath}?key=${apiKey}`,
    options: {},
  });
}

function trim(url) {
  return String(url).replace(/\/+$/, '');
}
