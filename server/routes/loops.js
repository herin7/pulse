import { Router } from 'express';
import { getOpenLoops } from '../db/openLoops.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/overdue', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const loops = await getOpenLoops(userId);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const overdue = loops.filter((l) => l.createdAt < cutoff);

  res.json({ overdue, count: overdue.length });
});

export default router;
