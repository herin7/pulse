import { logger } from './logger.js';

const EMBEDDING_ENDPOINT = 'https://integrate.api.nvidia.com/v1/embeddings';
const EMBEDDING_MODEL = 'nvidia/nv-embedqa-e5-v5';
const MAX_RETRIES = 3;
const BATCH_SIZE = 32;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function buildRetryDelay(retryCount) {
  return RETRY_DELAYS_MS[retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

async function requestEmbeddings(input, inputType, retryCount = 0) {
  const response = await fetch(EMBEDDING_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      input_type: inputType,
      encoding_format: 'float',
    }),
  });

  if ((response.status === 429 || response.status >= 500) && retryCount < MAX_RETRIES) {
    const delay = buildRetryDelay(retryCount);
    logger.warn('Retrying NVIDIA embedding request', {
      delayMs: Math.round(delay),
      retryCount,
      statusCode: response.status,
    });
    await wait(delay);
    return requestEmbeddings(input, inputType, retryCount + 1);
  }

  if (!response.ok) {
    throw new Error(`NVIDIA Embedding API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.map((item) => item.embedding);
}

export async function generateNvidiaEmbedding(text) {
  const [embedding] = await requestEmbeddings([text], 'query');
  return embedding;
}

export async function batchEmbedTexts(texts) {
  const results = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE);
    const embeddings = await requestEmbeddings(batch, 'passage');
    results.push(...embeddings);

    if (index + BATCH_SIZE < texts.length) {
      await wait(500);
    }
  }

  return results;
}

export async function embedText(text) {
  return generateNvidiaEmbedding(text);
}
