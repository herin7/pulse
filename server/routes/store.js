import { Router } from 'express';

import { batchEmbedTexts } from '../utils/nvidiaEmbedding.js';
import { callLLM } from '../utils/llmCall.js';
import { ensureCollection, upsertCharacterCard, upsertChunks } from '../db/qdrant.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clipText } from '../utils/messageUtils.js';
import { getLogContext, logger } from '../utils/logger.js';

const router = Router();
const PROFILE_SYSTEM_PROMPT =
  'You are a founder talent analyst who has evaluated 1000+ early-stage founders. You write profiles that are specific enough that if you swapped the name, a reader could NOT confuse this person with any other founder. Vague phrases like "passionate about technology" or "strong communicator" are forbidden. Every field must contain a concrete, verifiable observation. Output ONLY valid JSON with no commentary.';
const PROFILE_TIMEOUT_MS = 20000;
const KNOWN_TECH = ['JavaScript', 'TypeScript', 'Python', 'C++', 'C', 'React', 'Node.js', 'Node', 'Express', 'Next.js', 'PostgreSQL', 'MongoDB', 'Redis', 'Django', 'Flask', 'SQLite', 'MySQL'];

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

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new AppError('Profile generation timed out', 504, 'PROFILE_TIMEOUT')), timeoutMs);
    }),
  ]);
}

function readSourceText(chunks, source) {
  return chunks.filter((chunk) => chunk.source === source).map((chunk) => chunk.text).join('\n');
}

function extractName(text) {
  const match = String(text || '').match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  return match?.[1] || 'Founder';
}

function extractTechStack(text) {
  const normalized = String(text || '').toLowerCase();
  return KNOWN_TECH.filter((item) => normalized.includes(item.toLowerCase())).slice(0, 8);
}

function buildFallbackCharacterCard(chunks) {
  const selfReport = readSourceText(chunks, 'ai_self_report');
  const linkedin = readSourceText(chunks, 'linkedin');
  const github = readSourceText(chunks, 'github');
  const notion = readSourceText(chunks, 'notion');
  const combined = [selfReport, linkedin, github, notion].join('\n');
  const techStack = extractTechStack(combined);

  return {
    name: extractName(`${linkedin}\n${selfReport}`),
    founderType: techStack.length ? 'Technical founder' : 'Founder',
    building: clipText(selfReport || linkedin || notion || 'Working on a product with evolving scope.', 160),
    stage: github ? 'Active builder' : 'Early stage',
    coreDrive: clipText(selfReport || notion || 'Turning ideas into shipped execution.', 140),
    techStack,
    founderStrengths: ['Moves quickly from idea to action', 'Keeps momentum through direct execution', 'Uses tools and systems to stay productive'],
    blindspots: ['May carry too much context manually', 'Can outrun clarity when many threads are open', 'Needs stronger pruning on lower-leverage work'],
    biggestRisk: 'Losing focus across too many moving parts before compounding one clear growth loop.',
    northStar: clipText(notion || selfReport || 'Build something useful, memorable, and hard to ignore.', 140),
    operatingStyle: 'Direct, execution-first, and iterative.',
  };
}

function parseCharacterCard(text, chunks) {
  try {
    return JSON.parse(String(text || '').replace(/```json|```/g, '').trim());
  } catch {
    return buildFallbackCharacterCard(chunks);
  }
}

router.post('/api/store', requireAuth, asyncHandler(async (req, res) => {
  const incomingChunks = req.body.chunks;
  if (!Array.isArray(incomingChunks) || !incomingChunks.length) {
    throw new AppError('Valid chunks are required', 400, 'INVALID_CHUNKS');
  }

  logger.info('Starting profile build', {
    ...getLogContext(req),
    chunkCount: incomingChunks.length,
  });
  const embeddings = await batchEmbedTexts(incomingChunks.map((chunk) => chunk.text));
  const expectedVectorSize = embeddings[0]?.length;

  if (!expectedVectorSize) {
    throw new AppError('Embeddings could not be generated for the provided chunks', 502, 'EMBEDDING_FAILED');
  }

  await ensureCollection(expectedVectorSize);

  const chunks = incomingChunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }));
  await upsertChunks(req.user.id, chunks);
  logger.info('Stored onboarding chunks', {
    ...getLogContext(req),
    chunkCount: chunks.length,
    vectorSize: expectedVectorSize,
  });

  let characterCard;
  try {
    const { modelUsed, text } = await withTimeout(callLLM({
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
      maxTokens: 1200,
    }), PROFILE_TIMEOUT_MS);
    logger.info('Profile generation completed', {
      ...getLogContext(req),
      modelUsed,
    });
    characterCard = parseCharacterCard(text, chunks);
  } catch (error) {
    logger.warn('Profile generation fell back to heuristic card', {
      ...getLogContext(req),
      error: error.message,
    });
    characterCard = buildFallbackCharacterCard(chunks);
  }

  await upsertCharacterCard(req.user.id, characterCard);

  req.session.characterCard = characterCard;
  req.session.storeDone = true;
  res.json({ characterCard });
}));

export default router;
