import { MODELS, DEFAULT_MODEL } from '../config/models.js';

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
    // FORMAT B — Anthropic
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
    text = data.content[0].text;
  } else {
    // FORMAT A — OpenAI-compatible (gemini, groq)
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
    text = data.choices[0].message.content;
  }

  return { text, modelUsed: config.name };
}
