import { DEFAULT_MODEL, MODELS } from '../config/models.js';

import {
  callAnthropicProvider,
  callOpenAiCompatibleProvider,
  callSarvamProvider,
} from './llmProviders.js';
import { stripThinking } from './llmMessageUtils.js';

const PROVIDER_HANDLERS = {
  anthropic: callAnthropicProvider,
  sarvam: callSarvamProvider,
};

export async function callLLM({ modelKey, system, messages, maxTokens = 2000 }) {
  const resolvedKey = modelKey || process.env.ACTIVE_MODEL || DEFAULT_MODEL;
  const config = MODELS[resolvedKey];

  if (!config) {
    throw new Error(`Unknown model key: ${resolvedKey}`);
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`API key not set for ${config.name}. Add ${config.apiKeyEnv} to .env`);
  }

  const handler = PROVIDER_HANDLERS[config.provider] || callOpenAiCompatibleProvider;
  const text = await handler(config, apiKey, system, messages, maxTokens);

  if (!text) {
    throw new Error(`${config.name} returned an empty response`);
  }

  return {
    text: stripThinking(text),
    modelUsed: config.name,
  };
}
