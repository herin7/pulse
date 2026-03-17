import { createCalendarEvent, extractScheduleDetails } from './calendarAgent.js';
import { isMcpEnabled } from './mcpClient.js';
import { findSimilarLoop, insertLoop } from '../db/openLoops.js';
import * as notion from '../services/notionService.js';
import { callLLM } from '../utils/llmCall.js';
import { logger } from '../utils/logger.js';

const COMMITMENT_SIGNALS = ['need to', 'should', 'will', 'going to', 'plan to', 'want to', 'have to', 'must', 'gonna', 'tomorrow', 'this week'];

function parseLoopArray(text) {
  const match = String(text || '').trim().match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

async function syncLoopsToNotion(createdLoops) {
  const results = await Promise.allSettled(createdLoops.map((loop) => notion.createPage({
    title: loop,
    content: `Detected from Pulse chat on ${new Date().toLocaleDateString()}`,
    tags: ['Pulse', 'Open Loop'],
  })));
  return results.some((result) => result.status === 'fulfilled' && result.value);
}

async function syncLoopsToCalendar(createdLoops) {
  const schedulable = createdLoops
    .map((loop) => ({ details: extractScheduleDetails(loop), loop }))
    .filter((item) => item.details);
  if (!schedulable.length) return false;

  const results = await Promise.allSettled(schedulable.map(({ details, loop }) => (
    createCalendarEvent(loop, details.date, details.time, details.durationMinutes)
  )));
  return results.some((result) => result.status === 'fulfilled' && result.value);
}

export async function detectOpenLoops(userId, userMessage, options = {}) {
  try {
    if (userMessage.length < 20 || !COMMITMENT_SIGNALS.some((signal) => userMessage.toLowerCase().includes(signal))) {
      return { loops: [], syncedServices: [] };
    }

    const { text } = await callLLM({
      system: 'You extract explicit commitments from founder messages. Return ONLY a JSON array of action strings starting with a verb. If no explicit commitment exists, return [].',
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 200,
    });
    const loops = parseLoopArray(text);
    const createdLoops = [];

    for (const loop of loops) {
      if (typeof loop !== 'string' || !loop || await findSimilarLoop(userId, loop)) {
        continue;
      }

      await insertLoop(userId, loop, userMessage);
      createdLoops.push(loop);
    }

    if (!createdLoops.length) {
      return { loops, syncedServices: [] };
    }

    if (options.syncTargets) {
      const [notionResult, calendarResult] = await Promise.allSettled([
        notion.isEnabled() ? syncLoopsToNotion(createdLoops) : Promise.resolve(false),
        isMcpEnabled() ? syncLoopsToCalendar(createdLoops) : Promise.resolve(false),
      ]);
      const syncedServices = [];

      if (notionResult.status === 'fulfilled' && notionResult.value) syncedServices.push('notion');
      if (calendarResult.status === 'fulfilled' && calendarResult.value) syncedServices.push('calendar');
      return { loops, syncedServices };
    }

    if (notion.isEnabled()) {
      void syncLoopsToNotion(createdLoops).catch((error) => {
        logger.warn('Background Notion loop sync failed', { error: error.message, userId });
      });
    }
    return { loops, syncedServices: [] };
  } catch (error) {
    logger.warn('Loop detection failed', { error: error.message, userId });
    return { loops: [], syncedServices: [] };
  }
}
