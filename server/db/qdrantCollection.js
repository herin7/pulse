import { logger } from '../utils/logger.js';

import {
  qdrantClient,
  QDRANT_COLLECTION,
  QDRANT_VECTOR_SIZE,
} from './qdrantClient.js';

async function ensurePayloadIndex(fieldName) {
  try {
    await qdrantClient.createPayloadIndex(QDRANT_COLLECTION, {
      field_name: fieldName,
      field_schema: 'keyword',
      wait: true,
    });
  } catch {}
}

export async function ensureCollection() {
  const collections = await qdrantClient.getCollections();
  const exists = collections.collections.some((item) => item.name === QDRANT_COLLECTION);

  if (exists) {
    const info = await qdrantClient.getCollection(QDRANT_COLLECTION);
    const currentSize = info.config.params.vectors.size;

    if (currentSize !== QDRANT_VECTOR_SIZE) {
      logger.warn('Recreating Qdrant collection for vector size drift', {
        expectedSize: QDRANT_VECTOR_SIZE,
        existingSize: currentSize,
      });
      await qdrantClient.deleteCollection(QDRANT_COLLECTION);
      await qdrantClient.createCollection(QDRANT_COLLECTION, {
        vectors: { size: QDRANT_VECTOR_SIZE, distance: 'Cosine' },
      });
    }
  } else {
    await qdrantClient.createCollection(QDRANT_COLLECTION, {
      vectors: { size: QDRANT_VECTOR_SIZE, distance: 'Cosine' },
    });
  }

  await Promise.all([ensurePayloadIndex('userId'), ensurePayloadIndex('type')]);
}
