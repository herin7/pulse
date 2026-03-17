import { v5 as uuidv5 } from 'uuid';

import { logger } from '../utils/logger.js';
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
  const pointId = uuidv5(userId, QDRANT_NAMESPACE);

  try {
    const points = await qdrantClient.retrieve(QDRANT_COLLECTION, {
      ids: [pointId],
      with_payload: true,
      with_vector: false,
    });
    if (Array.isArray(points) && points[0]?.payload) {
      return points[0].payload;
    }
  } catch (error) {
    logger.warn('Qdrant character card retrieve failed, falling back to scroll', {
      error: error.message,
      userId,
    });
  }

  try {
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
  } catch (error) {
    logger.warn('Qdrant character card scroll failed', {
      error: error.message,
      userId,
    });
    return null;
  }
}
