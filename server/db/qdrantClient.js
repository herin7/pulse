import { QdrantClient } from '@qdrant/js-client-rest';

export const QDRANT_COLLECTION = 'life_cofounder';
export const QDRANT_VECTOR_SIZE = 2048;
export const QDRANT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
