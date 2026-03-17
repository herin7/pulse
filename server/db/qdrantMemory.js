import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

import {
  qdrantClient,
  QDRANT_COLLECTION,
  QDRANT_NAMESPACE,
} from './qdrantClient.js';

export async function upsertChunks(userId, chunks) {
  const points = chunks.map((chunk) => ({
    id: uuidv4(),
    vector: chunk.embedding,
    payload: {
      text: chunk.text,
      userId,
      chunkIndex: chunk.index,
      source: chunk.source,
      type: 'chunk',
    },
  }));

  await qdrantClient.upsert(QDRANT_COLLECTION, { wait: true, points });
}

export async function upsertChatMemory(userId, text, embedding) {
  if (!text || !embedding) {
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

  if (!normalizedFacts.length || !embedding) {
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
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export async function deleteUserData(userId) {
  await qdrantClient.delete(QDRANT_COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'userId', match: { value: userId } }] },
  });
}
