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

function readVectorSize(info) {
  const vectors = info?.config?.params?.vectors;
  return typeof vectors?.size === 'number' ? vectors.size : null;
}

async function createCollection(vectorSize) {
  await qdrantClient.createCollection(QDRANT_COLLECTION, {
    vectors: { size: vectorSize, distance: 'Cosine' },
  });
}

export async function ensureCollection(expectedVectorSize = QDRANT_VECTOR_SIZE) {
  const collections = await qdrantClient.getCollections();
  const exists = collections.collections.some((item) => item.name === QDRANT_COLLECTION);

  if (exists) {
    const info = await qdrantClient.getCollection(QDRANT_COLLECTION);
    const currentSize = readVectorSize(info);

    if (currentSize !== expectedVectorSize) {
      logger.warn('Recreating Qdrant collection for vector size drift', {
        expectedSize: expectedVectorSize,
        existingSize: currentSize,
      });
      await qdrantClient.deleteCollection(QDRANT_COLLECTION);
      await createCollection(expectedVectorSize);
    }
  } else {
    await createCollection(expectedVectorSize);
  }

  await Promise.all([ensurePayloadIndex('userId'), ensurePayloadIndex('type')]);
}
