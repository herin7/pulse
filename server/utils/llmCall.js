import { MODELS, DEFAULT_MODEL } from '../config/models.js';

function normalizeMessageText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  if (typeof content?.text === 'string') {
    return content.text.trim();
  }

  return '';
}

export async function callLLM({ modelKey, system, messages, maxTokens = 1000 }) {
  const key = modelKey || process.env.ACTIVE_MODEL || DEFAULT_MODEL;
  const config = MODELS[key];

  if (!config) {
    throw new Error(`Unknown model key: ${key}`);
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`API key not set for ${config.name}. Add ${config.apiKeyEnv} to .env`);
  }

  let text;

  if (config.provider === 'anthropic') {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${config.name} API error: ${err}`);
    }

    const data = await response.json();
    text = normalizeMessageText(data.content?.[0]?.text || data.content);
  } else if (config.provider === 'sarvam') {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${config.name} API error: ${err}`);
    }

    const data = await response.json();
    text = normalizeMessageText(data.choices?.[0]?.message?.content);
  } else {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${config.name} API error: ${err}`);
    }

    const data = await response.json();
    text = normalizeMessageText(data.choices?.[0]?.message?.content);
  }

  if (!text) {
    throw new Error(`${config.name} returned an empty response`);
  }

  return { text, modelUsed: config.name };
}
