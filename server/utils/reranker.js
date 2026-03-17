import { logger } from './logger.js';

const RERANKER_ENDPOINT = 'https://ai.api.nvidia.com/v1/retrieval/nvidia/nv-rerankqa-mistral-4b-v3/reranking';
const RERANKER_MODEL = 'nvidia/nv-rerankqa-mistral-4b-v3';

function isRerankerEnabled() {
  return String(process.env.RERANKER_ENABLED || '').toLowerCase() === 'true';
}

function extractRankings(payload) {
  if (Array.isArray(payload?.rankings)) return payload.rankings;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.rankings)) return payload.data.rankings;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getRankIndex(item, fallbackIndex) {
  if (Number.isInteger(item?.index)) return item.index;
  if (Number.isInteger(item?.passage_index)) return item.passage_index;
  if (Number.isInteger(item?.document_id)) return item.document_id;
  return fallbackIndex;
}

function getRankScore(item) {
  return Number(
    item?.score
    ?? item?.relevance_score
    ?? item?.rerank_score
    ?? item?.logit
    ?? 0
  );
}

export async function rerankChunks(query, chunks, topK = 3) {
  if (!query || !chunks?.length) {
    return [];
  }

  if (!isRerankerEnabled()) {
    return chunks.slice(0, topK);
  }

  try {
    const response = await fetch(RERANKER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RERANKER_MODEL,
        query,
        passages: chunks.map((chunk) => ({ text: chunk.text })),
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    const rankings = extractRankings(data);

    if (!rankings.length) {
      return chunks.slice(0, topK);
    }

    return rankings
      .map((item, fallbackIndex) => ({
        chunk: chunks[getRankIndex(item, fallbackIndex)],
        score: getRankScore(item),
      }))
      .filter((item) => Boolean(item.chunk))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK)
      .map((item) => item.chunk);
  } catch (error) {
    logger.warn('Reranker failed, using original retrieval order', {
      error: error.message,
    });
    return chunks.slice(0, topK);
  }
}
