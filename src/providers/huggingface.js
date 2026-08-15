/** Hugging Face — whoami endpoint returns account info. */
export default {
  id: 'huggingface',
  name: 'Hugging Face',
  envKey: 'HF_TOKEN',
  defaultBaseUrl: 'https://huggingface.co',

  async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
    const res = await fetchFn(`${baseUrl}/api/whoami-v2`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return {
      username: body.name ?? null,
      verified: true,
    };
  },
};
