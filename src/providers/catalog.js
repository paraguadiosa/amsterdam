/* Amsterdam provider catalog — the single source of truth.
 *
 * Both the Node backend (src/providers/index.js) and the dashboard
 * (index.html) read this file. Adding a provider is ONE entry here:
 *
 *   1. add an object below
 *   2. run `node scripts/sync-providers` to refresh .env.example
 *   3. done — key detection, the console card, and the Hermes pool
 *      mapping are all derived from this list.
 *
 * Fields:
 *   id             unique id (also the key in billing.providers)
 *   name           display name
 *   envKey         env var that holds the API key (omit for link cards)
 *   baseUrlEnv     optional env var that overrides defaultBaseUrl
 *   defaultBaseUrl base URL used when baseUrlEnv is unset
 *   kind           balance | account | verify | link
 *   auth           verify only: 'bearer' (default) or 'query'
 *   modelsPath     verify only: default '/v1/models'
 *   buildRequest   verify only: optional (apiKey, baseUrl) => ({ url, options })
 *   hermesId       Hermes credential-pool provider id (omit if n/a)
 *   consoleUrl     billing/console URL for the card button
 *   note           card note line
 *   tag            card badge text: 'Billing' or 'No billing'
 *   search         lowercase search terms for the filter box
 *   envLabel       override for the card's "Env:" line (link cards only)
 *
 * kind:
 *   balance — provider has a real balance endpoint (custom fetcher in
 *             src/providers/<id>.js + CUSTOM_FETCHERS map in index.js)
 *   account — provider exposes account info only (same custom layout)
 *   verify  — key verification via /v1/models; fully generic
 *   link    — console link only, no API, no key, no detection
 */
(function (global) {
  'use strict';

  var CATALOG = [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      envKey: 'DEEPSEEK_API_KEY',
      baseUrlEnv: 'DEEPSEEK_BASE_URL',
      defaultBaseUrl: 'https://api.deepseek.com',
      kind: 'balance',
      hermesId: 'deepseek',
      consoleUrl: 'https://platform.deepseek.com/',
      note: 'Console: Billing / Usage after login.',
      tag: 'Billing',
      search: 'deepseek deep seek',
    },
    {
      id: 'moonshot',
      name: 'Kimi / Moonshot',
      envKey: 'KIMI_API_KEY',
      baseUrlEnv: 'KIMI_BASE_URL',
      defaultBaseUrl: 'https://api.moonshot.cn',
      kind: 'balance',
      hermesId: 'kimi-coding',
      consoleUrl: 'https://platform.moonshot.ai/console',
      note: 'Console: Billing / Usage after login.',
      tag: 'Billing',
      search: 'kimi moonshot',
    },
    {
      id: 'huggingface',
      name: 'Hugging Face',
      envKey: 'HF_TOKEN',
      defaultBaseUrl: 'https://huggingface.co',
      kind: 'account',
      hermesId: 'huggingface',
      consoleUrl: 'https://huggingface.co/settings/billing',
      note: 'Inference providers, free tier included.',
      tag: 'Billing',
      search: 'huggingface hf hugging face',
    },
    {
      id: 'local',
      name: 'Local llama.cpp / Qwen GGUF',
      kind: 'link',
      consoleUrl: 'http://127.0.0.1:8080/v1',
      note: 'Local server, OpenAI-compatible. No billing applies.',
      tag: 'No billing',
      search: 'local llama llama.cpp qwen gguf',
      envLabel: 'URL: http://127.0.0.1:8080/v1',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      envKey: 'OPENAI_API_KEY',
      defaultBaseUrl: 'https://api.openai.com',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'openai',
      consoleUrl: 'https://platform.openai.com/usage',
      note: 'Usage and billing.',
      tag: 'Billing',
      search: 'openai gpt chatgpt',
    },
    {
      id: 'google',
      name: 'Google AI Studio',
      envKey: 'GOOGLE_API_KEY',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      kind: 'verify',
      auth: 'query',
      modelsPath: '/v1beta/models',
      hermesId: 'google',
      consoleUrl: 'https://aistudio.google.com/',
      note: 'Try models and view usage.',
      tag: 'Billing',
      search: 'google ai studio gemini',
    },
    {
      id: 'google-cloud',
      name: 'Google Cloud Billing',
      kind: 'link',
      consoleUrl: 'https://console.cloud.google.com/billing',
      note: 'GCP billing dashboard.',
      tag: 'Billing',
      search: 'google cloud gcp',
    },
    {
      id: 'groq',
      name: 'Groq',
      envKey: 'GROQ_API_KEY',
      baseUrlEnv: 'GROQ_BASE_URL',
      defaultBaseUrl: 'https://api.groq.com/openai',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'groq',
      consoleUrl: 'https://console.groq.com/',
      note: 'Usage and limits.',
      tag: 'Billing',
      search: 'groq',
    },
    {
      id: 'together',
      name: 'Together',
      envKey: 'TOGETHER_API_KEY',
      defaultBaseUrl: 'https://api.together.xyz',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'together',
      consoleUrl: 'https://api.together.xyz/',
      note: 'API and usage.',
      tag: 'Billing',
      search: 'together',
    },
    {
      id: 'mistral',
      name: 'Mistral',
      envKey: 'MISTRAL_API_KEY',
      defaultBaseUrl: 'https://api.mistral.ai',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'mistral',
      consoleUrl: 'https://console.mistral.ai/',
      note: 'Console and usage.',
      tag: 'Billing',
      search: 'mistral le chat',
    },
    {
      id: 'fireworks',
      name: 'Fireworks',
      envKey: 'FIREWORKS_API_KEY',
      defaultBaseUrl: 'https://api.fireworks.ai',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'fireworks',
      consoleUrl: 'https://app.fireworks.ai/',
      note: 'Models and usage.',
      tag: 'Billing',
      search: 'fireworks',
    },
    {
      id: 'xai',
      name: 'xAI',
      envKey: 'XAI_API_KEY',
      baseUrlEnv: 'XAI_BASE_URL',
      defaultBaseUrl: 'https://api.x.ai',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'xai',
      consoleUrl: 'https://console.x.ai/',
      note: 'Usage and billing.',
      tag: 'Billing',
      search: 'xai x ai grok',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      baseUrlEnv: 'ANTHROPIC_BASE_URL',
      defaultBaseUrl: 'https://api.anthropic.com',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'anthropic',
      consoleUrl: 'https://console.anthropic.com/',
      note: 'Usage and billing.',
      tag: 'Billing',
      search: 'anthropic claude',
      buildRequest: function (apiKey, baseUrl) {
        return {
          url: String(baseUrl).replace(/\/+$/, '') + '/v1/models',
          options: {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          },
        };
      },
    },
    {
      id: 'zai',
      name: 'Z.AI / GLM',
      envKey: 'ZAI_API_KEY',
      baseUrlEnv: 'ZAI_BASE_URL',
      defaultBaseUrl: 'https://api.z.ai/api/paas/v4',
      kind: 'verify',
      auth: 'bearer',
      hermesId: 'zai',
      consoleUrl: 'https://z.ai/manage-apikey/billing',
      note: 'Usage and billing.',
      tag: 'Billing',
      search: 'z.ai z ai glm zhipu',
    },
  ];

  global.AMS_PROVIDERS = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
