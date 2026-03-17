import { Router } from 'express';

import { MODELS } from '../config/models.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/api/config/model', asyncHandler(async (req, res) => {
  const { modelKey } = req.body;

  if (!modelKey || !MODELS[modelKey]) {
    throw new AppError('Invalid modelKey', 400, 'INVALID_MODEL_KEY');
  }

  process.env.ACTIVE_MODEL = modelKey;
  res.json({ activeModel: modelKey, name: MODELS[modelKey].name });
}));

router.get('/api/config/model', asyncHandler(async (_req, res) => {
  const activeModel = process.env.ACTIVE_MODEL || 'gemini';
  const config = MODELS[activeModel];

  res.json({
    activeModel,
    name: config?.name || 'Unknown',
    models: Object.entries(MODELS).map(([key, value]) => ({
      key,
      name: value.name,
      free: value.free,
    })),
  });
}));

export default router;
