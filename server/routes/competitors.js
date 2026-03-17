import { Router } from 'express';

import { fetchCompetitorIntel } from '../agents/competitorTracker.js';
import { getCompetitors, getIntelByCompetitor } from '../db/competitors.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLogContext, logger } from '../utils/logger.js';

const router = Router();

router.post('/refresh', requireAuth, asyncHandler(async (req, res) => {
  fetchCompetitorIntel(req.user.id).catch((error) => {
    logger.error('Competitor refresh failed', {
      ...getLogContext(req),
      error: error.message,
    });
  });

  res.json({ success: true });
}));

router.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const competitors = await getCompetitors(req.user.id);
  const items = await Promise.all(competitors.map(async (competitor) => {
    const intel = await getIntelByCompetitor(req.user.id, competitor.id);
    const latest = intel[0] || null;

    return {
      name: competitor.name,
      lastFetched: latest?.fetchedAt || null,
      latestSummary: latest?.summary || null,
      urgency: latest?.urgency || null,
      category: latest?.category || null,
    };
  }));

  res.json({
    competitors: items,
    totalTracked: competitors.length,
    hasHighUrgency: items.some((item) => item.urgency === 'high'),
  });
}));

export default router;
