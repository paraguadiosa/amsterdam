import deepseek from './deepseek.js';
import openrouter from './openrouter.js';
import huggingface from './huggingface.js';
import {
  anthropic,
  openai,
  moonshot,
  groq,
  together,
  mistral,
  google,
  fireworks,
} from './verify.js';

const providers = [
  deepseek,
  openrouter,
  anthropic,
  openai,
  moonshot,
  groq,
  together,
  mistral,
  google,
  huggingface,
  fireworks,
];

export default providers;
