import { normalizeMessageText, normalizeMessages } from './llmMessageUtils.js';

async function parseApiError(response, modelName) {
  const body = await response.text();
  throw new Error(`${modelName} API error: ${body}`);
}

export async function callAnthropicProvider(config, apiKey, system, messages, maxTokens, options = {}) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages,
      system,
    }),
  });

  if (!response.ok) {
    await parseApiError(response, config.name);
  }

  const data = await response.json();
  return normalizeMessageText(data.content?.[0]?.text || data.content);
}

export async function callSarvamProvider(config, apiKey, system, messages, maxTokens, options = {}) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });

  if (!response.ok) {
    await parseApiError(response, config.name);
  }

  const data = await response.json();
  return normalizeMessageText(data.choices?.[0]?.message?.content);
}

export async function callOpenAiCompatibleProvider(config, apiKey, system, messages, maxTokens, options = {}) {
  const body = {
    model: config.model,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...normalizeMessages(messages)],
    ...config.extraBody,
  };

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await parseApiError(response, config.name);
  }

  const data = await response.json();
  return normalizeMessageText(data.choices?.[0]?.message?.content);
}
