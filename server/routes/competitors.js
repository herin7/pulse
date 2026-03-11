import { Router } from 'express';
import { getCompetitors, getIntelByCompetitor } from '../db/competitors.js';
import { fetchCompetitorIntel } from '../agents/competitorTracker.js';

const router = Router();

router.post('/refresh', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  fetchCompetitorIntel(userId).catch(console.error);
  res.json({ success: true });
});

router.get('/status', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const competitors = getCompetitors(userId);

  const result = competitors.map((c) => {
    const intel = getIntelByCompetitor(userId, c.id);
    const latest = intel[0] || null;
    return {
      name: c.name,
      lastFetched: latest?.fetchedAt || null,
      latestSummary: latest?.summary || null,
      urgency: latest?.urgency || null,
      category: latest?.category || null,
    };
  });

  res.json({
    competitors: result,
    totalTracked: competitors.length,
    hasHighUrgency: result.some((c) => c.urgency === 'high'),
  });
});

export default router;
