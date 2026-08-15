import deepseek from './deepseek.js';
import huggingface from './huggingface.js';
import moonshot from './moonshot.js';
import {
  anthropic,
  openai,
  groq,
  together,
  mistral,
  google,
  fireworks,
} from './verify.js';

const providers = [
  deepseek,
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
