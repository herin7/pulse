import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';

export async function connectMongo() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulse';
  await mongoose.connect(mongoUri);
  logger.info('MongoDB connected');
}
