import { Router } from 'express';
import { getOpenLoops } from '../db/openLoops.js';

const router = Router();

router.get('/overdue', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const loops = getOpenLoops(userId);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const overdue = loops.filter((l) => l.createdAt < cutoff);

  res.json({ overdue, count: overdue.length });
});

export default router;
