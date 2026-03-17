import { v5 as uuidv5 } from 'uuid';

import {
  qdrantClient,
  QDRANT_COLLECTION,
  QDRANT_NAMESPACE,
  QDRANT_VECTOR_SIZE,
} from './qdrantClient.js';

export async function upsertCharacterCard(userId, card) {
  await qdrantClient.upsert(QDRANT_COLLECTION, {
    wait: true,
    points: [{
      id: uuidv5(userId, QDRANT_NAMESPACE),
      vector: Array(QDRANT_VECTOR_SIZE).fill(0),
      payload: { ...card, userId, type: 'character_card' },
    }],
  });
}

export async function getCharacterCard(userId) {
  const result = await qdrantClient.scroll(QDRANT_COLLECTION, {
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
