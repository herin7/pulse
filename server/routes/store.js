import { Router } from 'express';

import { batchEmbedTexts } from '../utils/nvidiaEmbedding.js';
import { callLLM } from '../utils/llmCall.js';
import { ensureCollection, upsertCharacterCard, upsertChunks } from '../db/qdrant.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const PROFILE_SYSTEM_PROMPT =
  'You are a founder talent analyst who has evaluated 1000+ early-stage founders. You write profiles that are specific enough that if you swapped the name, a reader could NOT confuse this person with any other founder. Vague phrases like "passionate about technology" or "strong communicator" are forbidden. Every field must contain a concrete, verifiable observation. Output ONLY valid JSON with no commentary.';

function buildSynthesisContext(chunks) {
  const grouped = chunks.reduce((accumulator, chunk) => {
    accumulator[chunk.source] = accumulator[chunk.source] || [];
    accumulator[chunk.source].push(chunk);
    return accumulator;
  }, {});

  return Object.values(grouped)
    .flatMap((items) => items.sort((left, right) => {
      const leftIndex = Number.isInteger(left.index) ? left.index : left.chunkIndex || 0;
      const rightIndex = Number.isInteger(right.index) ? right.index : right.chunkIndex || 0;
      return leftIndex - rightIndex;
    }).slice(0, 5))
    .map((chunk) => `[${chunk.source}]: ${chunk.text}`)
    .join('\n\n');
}

router.post('/api/store', requireAuth, asyncHandler(async (req, res) => {
  const incomingChunks = req.body.chunks;
  if (!Array.isArray(incomingChunks) || !incomingChunks.length) {
    throw new AppError('Valid chunks are required', 400, 'INVALID_CHUNKS');
  }

  await ensureCollection();

  const embeddings = await batchEmbedTexts(incomingChunks.map((chunk) => chunk.text));
  const chunks = incomingChunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }));
  await upsertChunks(req.user.id, chunks);

  const { text } = await callLLM({
    system: PROFILE_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Here is raw data about a founder - their self-report, LinkedIn, and GitHub activity. Extract a founder profile. Be a mirror, not a cheerleader. Identify what they are actually doing vs what they say they want to do. Note gaps between ambition and current output. Output this exact JSON:
{
  "name": string,
  "founderType": string,
  "building": string,
  "stage": string,
  "coreDrive": string,
  "techStack": string[],
  "founderStrengths": string[],
  "blindspots": string[],
  "biggestRisk": string,
  "northStar": string,
  "operatingStyle": string
}

Guidelines:
- founderType: e.g. "Technical solo founder", "Second-time operator"
- stage: e.g. "Pre-product", "0->1", "Early traction"
- founderStrengths: top 3, founder-specific behavior patterns
- blindspots: brutal and specific to their founder journey
- biggestRisk: single most likely reason this startup fails

Context:
${buildSynthesisContext(chunks)}`,
    }],
    maxTokens: 4000,
  });

  const characterCard = JSON.parse(text.replace(/```json|```/g, '').trim());
  await upsertCharacterCard(req.user.id, characterCard);

  req.session.characterCard = characterCard;
  req.session.storeDone = true;
  res.json({ characterCard });
}));

export default router;
