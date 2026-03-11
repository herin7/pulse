import { Router } from 'express';
import { getCompetitors, getIntelByCompetitor } from '../db/competitors.js';
import { fetchCompetitorIntel } from '../agents/competitorTracker.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/refresh', requireAuth, (req, res) => {
  const userId = req.user.id;

  fetchCompetitorIntel(userId).catch(console.error);
  res.json({ success: true });
});

router.get('/status', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const competitors = (await getCompetitors(userId)) || [];

  const result = await Promise.all(competitors.map(async (c) => {
    const intel = await getIntelByCompetitor(userId, c.id);
    const latest = intel[0] || null;
    return {
      name: c.name,
      lastFetched: latest?.fetchedAt || null,
      latestSummary: latest?.summary || null,
      urgency: latest?.urgency || null,
      category: latest?.category || null,
    };
  }));

  res.json({
    competitors: result,
    totalTracked: competitors.length,
    hasHighUrgency: result.some((c) => c.urgency === 'high'),
  });
});

export default router;
