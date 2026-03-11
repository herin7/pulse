import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = 'life_cofounder';
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 output dims
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace UUID for uuidv5

export async function ensureCollection() {
  const result = await client.getCollections();
  const exists = result.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
  }

  try {
    await client.createPayloadIndex(COLLECTION, {
      field_name: 'userId',
      field_schema: 'keyword',
      wait: true,
    });
  } catch (e) {
    // index already exists, ignore
  }

  try {
    await client.createPayloadIndex(COLLECTION, {
      field_name: 'type',
      field_schema: 'keyword',
      wait: true,
    });
  } catch (e) {
    // index already exists, ignore
  }
}

export async function upsertChunks(userId, chunks) {
  const points = chunks.map((c) => ({
    id: uuidv4(),
    vector: c.embedding,
    payload: {
      text: c.text,
      userId,
      chunkIndex: c.index,
      source: c.source,
      type: 'chunk',
    },
  }));
  await client.upsert(COLLECTION, { wait: true, points });
}

export async function upsertCharacterCard(userId, card) {
  const id = uuidv5(userId, NAMESPACE);
  await client.upsert(COLLECTION, {
    wait: true,
    points: [
      {
        id,
        vector: Array(VECTOR_SIZE).fill(0),
        payload: { ...card, userId, type: 'character_card' },
      },
    ],
  });
}

export async function searchSimilar(userId, queryEmbedding, topK = 5) {
  const results = await client.search(COLLECTION, {
    vector: queryEmbedding,
    limit: topK,
    filter: {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'type', match: { value: 'chunk' } },
      ],
    },
    with_payload: true,
  });
  return results.map((r) => ({
    text: r.payload.text,
    score: r.score,
    source: r.payload.source,
  }));
}

export async function getCharacterCard(userId) {
  const result = await client.scroll(COLLECTION, {
    filter: {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'type', match: { value: 'character_card' } },
      ],
    },
    limit: 1,
    with_payload: true,
  });
  return result.points[0]?.payload || null;
}

export async function deleteUserData(userId) {
  await client.delete(COLLECTION, {
    wait: true,
    filter: {
      must: [{ key: 'userId', match: { value: userId } }],
    },
  });
}
