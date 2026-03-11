import { Router } from 'express';
import { ensureCollection, upsertChunks, upsertCharacterCard } from '../db/qdrant.js';
import { callLLM } from '../utils/llmCall.js';

const router = Router();

router.post('/api/store', async (req, res) => {
  try {
    const { chunks, userId } = req.body;

    if (!userId || !chunks) {
      return res.status(400).json({ error: 'userId and chunks are required' });
    }

    await ensureCollection();
    await upsertChunks(userId, chunks);

    // Take 5 chunks from each source for balanced synthesis
    const bySource = {};
    chunks.forEach((c) => {
      if (!bySource[c.source]) bySource[c.source] = [];
      bySource[c.source].push(c);
    });
    const balanced = Object.values(bySource)
      .flatMap((arr) => arr.sort((a, b) => a.chunkIndex - b.chunkIndex).slice(0, 5));
    const synthesisContext = balanced.map((c) => `[${c.source}]: ${c.text}`).join('\n\n');

    // Call LLM for character card generation
    const { text: rawText } = await callLLM({
      system: 'You are a founder talent analyst who has evaluated 1000+ early-stage founders. You write profiles that are specific enough that if you swapped the name, a reader could NOT confuse this person with any other founder. Vague phrases like "passionate about technology" or "strong communicator" are forbidden. Every field must contain a concrete, verifiable observation. Output ONLY valid JSON with no commentary.',
      messages: [
        {
          role: 'user',
          content: `Here is raw data about a founder — their self-report, LinkedIn, and GitHub activity. Extract a founder profile. Be a mirror, not a cheerleader. Identify what they are actually doing vs what they say they want to do. Note gaps between ambition and current output. Output this exact JSON:
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
- stage: e.g. "Pre-product", "0→1", "Early traction"
- founderStrengths: top 3, founder-specific behavior patterns (e.g. "Ships fast without overthinking")
- blindspots: brutal and specific to their founder journey, not generic advice
- biggestRisk: the single most likely reason this startup fails

Context:
${synthesisContext}`,
        },
      ],
      maxTokens: 1500,
    });

    const raw = rawText.replace(/```json|```/g, '').trim();
    const card = JSON.parse(raw);

    await upsertCharacterCard(userId, card);

    req.session.characterCard = card;
    req.session.storeDone = true;

    res.json({ characterCard: card });
  } catch (err) {
    console.error('Store error:', err);
    res.status(500).json({ error: 'Store failed' });
  }
});

export default router;
