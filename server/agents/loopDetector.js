import { callLLM } from '../utils/llmCall.js';
import { insertLoop, findSimilarLoop } from '../db/openLoops.js';

const COMMITMENT_SIGNALS = ['need to', 'should', 'will', 'going to', 'plan to', 'want to', 'have to', 'must', 'gonna', 'tomorrow', 'this week'];

function parseLoopArray(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  try {
    return JSON.parse(arrayMatch[0]);
  } catch {
    return [];
  }
}

export async function detectOpenLoops(userId, userMessage) {
  try {
    const lower = userMessage.toLowerCase();
    const hasSignal = COMMITMENT_SIGNALS.some((s) => lower.includes(s));
    if (userMessage.length < 20 || !hasSignal) return [];

    const { text } = await callLLM({
      system: 'You extract explicit commitments from founder messages — things they stated they WILL do, not things they are considering or might do. A commitment has an actor (I), an action verb (will, need to, going to, must), and a specific task. Vague intentions like "I should think about pricing" are NOT commitments. Specific actions like "I need to email the investor by Friday" ARE commitments. Return ONLY a JSON array of action strings starting with a verb. If no explicit commitment exists, return []. No explanation.',
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 200,
    });

    const loops = parseLoopArray(text);

    if (!Array.isArray(loops)) return [];

    for (const loop of loops) {
      if (typeof loop === 'string' && loop.length > 0) {
        const existing = findSimilarLoop(userId, loop);
        if (!existing) {
          insertLoop(userId, loop, userMessage);
        }
      }
    }

    return loops;
  } catch (e) {
    console.error('Loop detection failed:', e);
    return [];
  }
}
