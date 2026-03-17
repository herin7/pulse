import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';

export async function connectMongo() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulse';
  await mongoose.connect(mongoUri);
  logger.info('MongoDB connected');
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}
