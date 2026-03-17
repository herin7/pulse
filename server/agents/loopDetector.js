import { findSimilarLoop, insertLoop } from '../db/openLoops.js';
import { callLLM } from '../utils/llmCall.js';
import { logger } from '../utils/logger.js';

const COMMITMENT_SIGNALS = ['need to', 'should', 'will', 'going to', 'plan to', 'want to', 'have to', 'must', 'gonna', 'tomorrow', 'this week'];

function parseLoopArray(text) {
  const match = String(text || '').trim().match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

export async function detectOpenLoops(userId, userMessage) {
  try {
    if (userMessage.length < 20 || !COMMITMENT_SIGNALS.some((signal) => userMessage.toLowerCase().includes(signal))) {
      return [];
    }

    const { text } = await callLLM({
      system: 'You extract explicit commitments from founder messages. Return ONLY a JSON array of action strings starting with a verb. If no explicit commitment exists, return [].',
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 200,
    });
    const loops = parseLoopArray(text);

    for (const loop of loops) {
      if (typeof loop === 'string' && loop && !await findSimilarLoop(userId, loop)) {
        await insertLoop(userId, loop, userMessage);
      }
    }

    return loops;
  } catch (error) {
    logger.warn('Loop detection failed', { error: error.message });
    return [];
  }
}
