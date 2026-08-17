import './catalog.js';
import { createVerifyProvider } from './verify.js';
import deepseek from './deepseek.js';
import huggingface from './huggingface.js';
import moonshot from './moonshot.js';

const CATALOG = globalThis.AMS_PROVIDERS;

// balance/account providers keep hand-written fetch logic in their own
// modules; the catalog only supplies their metadata and console card.
const CUSTOM_FETCHERS = {
  deepseek,
  moonshot,
  huggingface,
};

function buildProvider(meta) {
  if (meta.kind === 'link') return null;
  if (meta.kind === 'verify') return createVerifyProvider(meta);
  const custom = CUSTOM_FETCHERS[meta.id];
  if (!custom) {
    throw new Error(`Provider "${meta.id}" has kind "${meta.kind}" but no fetcher module`);
  }
  // Catalog metadata wins; the custom module only contributes fetchBalance.
  return { ...custom, ...meta, fetchBalance: custom.fetchBalance };
}

const providers = CATALOG.map(buildProvider).filter(Boolean);

export default providers;
