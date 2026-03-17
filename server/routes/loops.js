import { Router } from 'express';

import { getOpenLoops } from '../db/openLoops.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/overdue', requireAuth, asyncHandler(async (req, res) => {
  const loops = await getOpenLoops(req.user.id);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const overdue = loops.filter((loop) => loop.createdAt < cutoff);
  res.json({ overdue, count: overdue.length });
}));

export default router;
