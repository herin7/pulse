import { fetchCompetitorIntel } from './competitorTracker.js';
import { addCompetitor, getRecentIntel } from '../db/competitors.js';
import { closeLoop } from '../db/openLoops.js';
import { logger } from '../utils/logger.js';

export async function executeTool(name, args, userId) {
  switch (name) {
    case 'close_loop':
      await closeLoop(userId, args.loopId);
      return { success: true, message: 'Got it, marking that as done.' };
    case 'add_competitor':
      await addCompetitor(userId, args.name, args.url || null);
      fetchCompetitorIntel(userId, true).catch((error) => {
        logger.error('Background competitor fetch failed', { error: error.message, userId });
      });
      return { success: true, message: `Now tracking ${args.name}. I'll gather intel in the background.` };
    case 'get_competitor_intel': {
      const intel = await getRecentIntel(userId, 10);
      if (!intel.length) return { success: true, message: 'No competitor intel yet. Add competitors first.' };
      return {
        success: true,
        message: intel
          .map((item) => `[${item.category}|${item.urgency}] ${item.competitor_name}: ${item.summary} (${new Date(item.fetchedAt).toLocaleDateString()})`)
          .join('\n'),
      };
    }
    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
