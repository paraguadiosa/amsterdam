/** DeepSeek — has a real balance endpoint. */
export default {
  id: 'deepseek',
  name: 'DeepSeek',
  envKey: 'DEEPSEEK_API_KEY',
  baseUrlEnv: 'DEEPSEEK_BASE_URL',
  defaultBaseUrl: 'https://api.deepseek.com',

  async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
    const res = await fetchFn(`${baseUrl}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const info = body.balance_infos?.[0];
    return {
      balance: parseFloat(info?.total_balance ?? '0'),
      currency: info?.currency ?? 'CNY',
      available: body.is_available ?? null,
    };
  },
};
