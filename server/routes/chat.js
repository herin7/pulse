import { Router } from 'express';
import { searchSimilar, getCharacterCard } from '../db/qdrant.js';
import { callLLM } from '../utils/llmCall.js';
import { getOpenLoops } from '../db/openLoops.js';
import { getRecentIntel } from '../db/competitors.js';
import { detectOpenLoops } from '../agents/loopDetector.js';

const router = Router();

router.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, queryEmbedding, history = [] } = req.body;

    if (!userId || !message || !queryEmbedding) {
      return res.status(400).json({ error: 'userId, message, and queryEmbedding are required' });
    }

    const [relevantChunks, characterCard] = await Promise.all([
      searchSimilar(userId, queryEmbedding, 5),
      getCharacterCard(userId),
    ]);

    if (!characterCard) {
      return res.status(404).json({ error: 'Character card not found. Complete onboarding first.' });
    }

    const context = relevantChunks.map((c) => `[${c.source}]: ${c.text}`).join('\n\n');

    const openLoops = await getOpenLoops(userId);
    const recentIntel = getRecentIntel(userId, 5);

    // Urgency-aware intel injection
    const highUrgency = recentIntel.filter((i) => i.urgency === 'high');
    const restIntel = recentIntel.filter((i) => i.urgency !== 'high').slice(0, 3);

    let urgentBlock = '';
    if (highUrgency.length) {
      urgentBlock = `⚠ URGENT COMPETITIVE DEVELOPMENT — mention this proactively if remotely relevant to the conversation:
${highUrgency.map((i) => `${i.competitor_name}: ${i.summary}`).join('\n')}

`;
    }

    let intelBlock = '';
    if (restIntel.length) {
      intelBlock = `\n\nRecent competitive intelligence (surface only when relevant):
${restIntel.map((i) => `- [${i.category}] ${i.competitor_name}: ${i.summary}`).join('\n')}`;
    }

    const now = new Date();
    const timeContext = `Current date and time: ${now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const systemPrompt = `${timeContext}\n\n${urgentBlock}You are ${characterCard.name}'s cofounder. You have previously built and exited a B2B SaaS. You are direct to the point of being uncomfortable. You never validate a bad idea to protect someone's feelings. When you see a founder avoiding something hard, you name it explicitly. You ask one sharp question instead of giving five options. You think in leverage — what one move creates the most downstream value right now.

You know this founder deeply. You know what they're building, their actual skill level, their blind spots, and what they've been procrastinating on. You use this to give advice that is specific to them, not generic startup wisdom they could find on Twitter.

When they bring you a problem, your first instinct is to diagnose root cause before suggesting anything. When they bring you a win, acknowledge it in one sentence then move to what's next.

Their Founder Profile:
${JSON.stringify(characterCard, null, 2)}

Relevant context from their data:
${context}

Open loops (things they said they'd do):
${openLoops.map((l) => `- [#${l.id}] ${l.loop}`).join('\n') || 'None yet.'}${intelBlock}

RESPONSE RULES:
- Default mode: make your point, give your take, stop. No question.
- Only ask a question when you genuinely cannot give useful advice without knowing the answer. Maximum one question per response.
- Never ask a question just to seem engaged or to end a response naturally.
- Never check in. Never say 'let me know if you need anything'.
- A good question test: if you could give reasonable advice WITHOUT the answer, don't ask it.`;

    const cleanHistory = history.map(({ role, content }) => ({ role, content }));

    const { text: reply } = await callLLM({
      system: systemPrompt,
      messages: [...cleanHistory, { role: 'user', content: message }],
      maxTokens: 1000,
    });

    res.json({
      reply,
      sources: relevantChunks.map((c) => c.source),
    });

    detectOpenLoops(userId, message).catch(console.error);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

export default router;
