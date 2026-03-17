import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

import { logger } from '../utils/logger.js';
import {
  qdrantClient,
  QDRANT_COLLECTION,
  QDRANT_NAMESPACE,
  QDRANT_VECTOR_SIZE,
} from './qdrantClient.js';

function isValidVector(vector, expectedSize = QDRANT_VECTOR_SIZE) {
  return Array.isArray(vector)
    && vector.length === expectedSize
    && vector.every((value) => Number.isFinite(value));
}

export async function upsertChunks(userId, chunks) {
  const invalidChunk = chunks.find((chunk) => !isValidVector(chunk.embedding));
  if (invalidChunk) {
    const error = new Error('Invalid embedding vector for chunk upsert');
    error.code = 'INVALID_EMBEDDING_VECTOR';
    throw error;
  }

  const normalizedPoints = chunks.map((chunk) => {
    const chunkIndex = Number.isInteger(chunk.index)
      ? chunk.index
      : Number.isInteger(chunk.chunkIndex)
        ? chunk.chunkIndex
        : 0;
    const totalChunks = Number.isInteger(chunk.totalChunks) ? chunk.totalChunks : chunks.length;

    return {
      id: uuidv4(),
      vector: chunk.embedding,
      payload: {
      charEnd: chunk.charEnd,
      charStart: chunk.charStart,
      chunkIndex,
      metadata: {
        charEnd: chunk.charEnd,
        charStart: chunk.charStart,
        index: chunkIndex,
        source: chunk.source,
        totalChunks,
      },
      text: chunk.text,
      totalChunks,
      source: chunk.source,
      userId,
      type: 'chunk',
      },
    };
  });

  await qdrantClient.upsert(QDRANT_COLLECTION, { wait: true, points: normalizedPoints });
}

export async function upsertChatMemory(userId, text, embedding) {
  if (!text || !isValidVector(embedding)) {
    return;
  }

  await qdrantClient.upsert(QDRANT_COLLECTION, {
    wait: true,
    points: [{
      id: uuidv4(),
      vector: embedding,
      payload: {
        text,
        userId,
        chunkIndex: Date.now(),
        createdAt: new Date().toISOString(),
        memoryType: 'chat_message',
        source: 'chat_memory',
        type: 'chunk',
      },
    }],
  });
}

export async function upsertDurableMemory(userId, facts, embedding) {
  const normalizedFacts = (facts || []).map((fact) => fact.trim()).filter(Boolean);

  if (!normalizedFacts.length || !isValidVector(embedding)) {
    return;
  }

  const text = normalizedFacts.join(' ');
  const id = uuidv5(`${userId}:durable:${text.toLowerCase()}`, QDRANT_NAMESPACE);

  await qdrantClient.upsert(QDRANT_COLLECTION, {
    wait: true,
    points: [{
      id,
      vector: embedding,
      payload: {
        text,
        userId,
        chunkIndex: Date.now(),
        createdAt: new Date().toISOString(),
        memoryType: 'durable_fact',
        source: 'durable_memory',
        type: 'chunk',
      },
    }],
  });
}

export async function searchSimilar(userId, queryEmbedding, topK = 5) {
  if (!isValidVector(queryEmbedding)) {
    return [];
  }

  try {
    const results = await qdrantClient.search(QDRANT_COLLECTION, {
      vector: queryEmbedding,
      limit: Math.max(topK * 3, 8),
      filter: {
        must: [
          { key: 'userId', match: { value: userId } },
          { key: 'type', match: { value: 'chunk' } },
        ],
      },
      with_payload: true,
    });

    return rankSearchResults(results).slice(0, topK);
  } catch (error) {
    logger.warn('Qdrant similarity search failed', {
      code: error.code,
      error: error.message,
      userId,
    });
    return [];
  }
}

export async function searchWithFilter(userId, queryEmbedding, source, limit = 10) {
  if (!isValidVector(queryEmbedding)) {
    return [];
  }

  try {
    const results = await qdrantClient.search(QDRANT_COLLECTION, {
      vector: queryEmbedding,
      limit: Math.max(limit * 3, 8),
      filter: {
        must: [
          { key: 'userId', match: { value: userId } },
          { key: 'type', match: { value: 'chunk' } },
          { key: 'source', match: { value: source } },
        ],
      },
      with_payload: true,
    });

    return rankSearchResults(results).slice(0, limit);
  } catch (error) {
    logger.warn('Qdrant filtered search failed', {
      code: error.code,
      error: error.message,
      source,
      userId,
    });
    return [];
  }
}

function rankSearchResults(results) {
  return results
    .map((item) => {
      const memoryType = item.payload.memoryType;
      const source = item.payload.source;
      const scoreBoost = memoryType === 'durable_fact' || source === 'durable_memory'
        ? 0.12
        : memoryType === 'chat_message' || source === 'chat_memory'
          ? 0.06
          : 0;

      return {
        text: item.payload.text,
        score: item.score + scoreBoost,
        source,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function deleteUserData(userId) {
  await qdrantClient.delete(QDRANT_COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'userId', match: { value: userId } }] },
  });
}
