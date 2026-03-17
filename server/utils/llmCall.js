import { DEFAULT_MODEL, MODELS } from '../config/models.js';
import { logger } from './logger.js';

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

function compareModels(leftKey, rightKey) {
  return (MODELS[leftKey]?.priority || Number.MAX_SAFE_INTEGER) - (MODELS[rightKey]?.priority || Number.MAX_SAFE_INTEGER);
}

function buildModelChain(preferredKey) {
  const configuredKeys = Object.keys(MODELS)
    .filter((key) => Boolean(process.env[MODELS[key].apiKeyEnv]))
    .sort(compareModels);

  if (!configuredKeys.length) {
    return [];
  }

  return [...new Set([preferredKey, ...configuredKeys].filter(Boolean))];
}

function createTimeoutError(config) {
  return new Error(`${config.name} timed out after ${config.timeoutMs || 15000}ms`);
}

async function callWithTimeout(config, apiKey, system, messages, maxTokens) {
  const handler = PROVIDER_HANDLERS[config.provider] || callOpenAiCompatibleProvider;
  const controller = new AbortController();
  const timeoutMs = config.timeoutMs || 15000;
  const timeoutId = setTimeout(() => controller.abort(createTimeoutError(config)), timeoutMs);

  try {
    return await handler(config, apiKey, system, messages, maxTokens, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createTimeoutError(config);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callLLM({ modelKey, system, messages, maxTokens = 2000 }) {
  const resolvedKey = modelKey || process.env.ACTIVE_MODEL || DEFAULT_MODEL;
  if (!MODELS[resolvedKey]) {
    throw new Error(`Unknown model key: ${resolvedKey}`);
  }

  const modelChain = buildModelChain(resolvedKey);
  if (!modelChain.length) {
    throw new Error('No configured LLM models found. Add at least one provider API key.');
  }

  let lastError;
  const attemptedModels = [];

  for (const candidateKey of modelChain) {
    const config = MODELS[candidateKey];
    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      continue;
    }

    attemptedModels.push(candidateKey);

    try {
      const text = await callWithTimeout(config, apiKey, system, messages, maxTokens);
      if (!text) {
        throw new Error(`${config.name} returned an empty response`);
      }

      if (candidateKey !== resolvedKey) {
        logger.warn('LLM request used fallback model', {
          attemptedModels,
          fallbackFrom: resolvedKey,
          modelKey: candidateKey,
        });
      }

      return {
        text: stripThinking(text),
        modelKey: candidateKey,
        modelUsed: config.name,
        attemptedModels,
        fallbackUsed: candidateKey !== resolvedKey,
      };
    } catch (error) {
      lastError = error;
      logger.warn('LLM model attempt failed', {
        attemptedModels: [...attemptedModels],
        error: error.message,
        modelKey: candidateKey,
      });
    }
  }

  throw new Error(`All configured models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}
