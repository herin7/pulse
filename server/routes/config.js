import { Router } from 'express';
import { MODELS } from '../config/models.js';

const router = Router();

router.post('/api/config/model', (req, res) => {
  const { modelKey } = req.body;

  if (!modelKey || !MODELS[modelKey]) {
    return res.status(400).json({ error: 'Invalid modelKey', available: Object.keys(MODELS) });
  }

  process.env.ACTIVE_MODEL = modelKey;
  res.json({ activeModel: modelKey, name: MODELS[modelKey].name });
});

router.get('/api/config/model', (_req, res) => {
  const active = process.env.ACTIVE_MODEL || 'gemini';
  const config = MODELS[active];
  res.json({
    activeModel: active,
    name: config?.name || 'Unknown',
    models: Object.entries(MODELS).map(([key, m]) => ({ key, name: m.name, free: m.free })),
  });
});

export default router;
