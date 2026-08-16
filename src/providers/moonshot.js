/** Moonshot / Kimi — has a real balance endpoint. */
export default {
  id: 'moonshot',
  name: 'Kimi / Moonshot',
  envKey: 'KIMI_API_KEY',
  baseUrlEnv: 'KIMI_BASE_URL',
  defaultBaseUrl: 'https://api.moonshot.cn',

  async fetchBalance({ apiKey, baseUrl }, fetchFn = globalThis.fetch) {
    const base = String(baseUrl || this.defaultBaseUrl).replace(/\/v1\/?$/, '');
    const res = await fetchFn(`${base}/v1/users/me/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const data = body.data ?? {};
    return {
      balance: parseFloat(data.available_balance ?? 0),
      currency: baseUrl.includes('.cn') ? 'CNY' : 'USD',
      cash: data.cash_balance ?? null,
      voucher: data.voucher_balance ?? null,
    };
  },
};
