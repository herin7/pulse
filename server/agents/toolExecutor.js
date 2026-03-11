import { closeLoop } from '../db/openLoops.js';
import { addCompetitor, getRecentIntel } from '../db/competitors.js';
import { fetchCompetitorIntel } from './competitorTracker.js';

export function executeTool(name, args, userId) {
  switch (name) {
    case 'close_loop':
      closeLoop(userId, args.loopId);
      return { success: true, message: 'Got it, marking that as done.' };
    case 'add_competitor': {
      addCompetitor(userId, args.name, args.url || null);
      fetchCompetitorIntel(userId).catch(console.error);
      return { success: true, message: `Now tracking ${args.name}. I'll gather intel in the background.` };
    }
    case 'get_competitor_intel': {
      const intel = getRecentIntel(userId, 10);
      if (!intel.length) return { success: true, message: 'No competitor intel yet. Add competitors first.' };
      const formatted = intel
        .map((i) => `[${i.category}|${i.urgency}] ${i.competitor_name}: ${i.summary} (${new Date(i.fetchedAt).toLocaleDateString()})`)
        .join('\n');
      return { success: true, message: formatted };
    }
    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
