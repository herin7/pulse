import { Router } from 'express';
import { searchSimilar, getCharacterCard, upsertChatMemory, upsertDurableMemory } from '../db/qdrant.js';
import { callLLM } from '../utils/llmCall.js';
import { getOpenLoops } from '../db/openLoops.js';
import { getRecentIntel } from '../db/competitors.js';
import { detectOpenLoops } from '../agents/loopDetector.js';
import { extractDurableFacts } from '../agents/durableMemory.js';
import { buildEmailDraft, looksLikeEmailRequest } from '../agents/emailAgent.js';
import { parseReminderMessage } from '../agents/reminderParser.js';
import { insertReminder } from '../db/reminders.js';
import { requireAuth } from '../middleware/auth.js';
import { isGmailConfigured } from '../utils/gmail.js';
import { getAgentProfileForUser } from './agentSetup.js';

const router = Router();

const MAX_RETRIEVED_CHUNKS = 3;
const MAX_CONTEXT_CHARS_PER_CHUNK = 650;
const MAX_OPEN_LOOPS = 4;
const MAX_LOOP_CHARS = 120;
const MAX_INTEL_ITEMS = 2;
const MAX_INTEL_CHARS = 180;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 500;
const CHAT_MAX_TOKENS = 500;
const MIN_CHAT_MEMORY_CHARS = 12;
const CHAT_MEMORY_SKIP_PATTERNS = [/^hi$/i, /^hello$/i, /^hey$/i, /^thanks?$/i, /^ok(ay)?$/i, /^yup$/i];

function clipText(text, maxChars) {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}...`;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function estimateTokens(text) {
  return Math.ceil((text?.length || 0) / 4);
}

function shouldPersistChatMemory(message) {
  const normalized = String(message || '').trim();
  if (normalized.length < MIN_CHAT_MEMORY_CHARS) return false;
  return !CHAT_MEMORY_SKIP_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildCompactCharacterProfile(characterCard) {
  return {
    name: characterCard.name,
    founderType: characterCard.founderType,
    building: characterCard.building,
    stage: characterCard.stage,
    coreDrive: characterCard.coreDrive,
    northStar: characterCard.northStar,
    biggestRisk: characterCard.biggestRisk,
    operatingStyle: characterCard.operatingStyle,
    strengths: (characterCard.founderStrengths || []).slice(0, 3),
    blindspots: (characterCard.blindspots || []).slice(0, 3),
    techStack: (characterCard.techStack || []).slice(0, 6),
  };
}

function buildAgentSetupBlock(agentProfile) {
  if (!agentProfile) {
    return 'Agent setup: default Pulse profile.';
  }

  const lines = [
    `Identity: ${agentProfile.identity?.agentName || 'Pulse'} (${agentProfile.identity?.role || 'AI Cofounder'})`,
    `Tone: ${clipText(agentProfile.identity?.tone || 'Direct, concise, execution-first', 120)}`,
    `Responsibility: ${clipText(agentProfile.identity?.responsibility || 'Keep the founder focused, accountable, and moving.', 140)}`,
  ];

  if (agentProfile.context?.startupName || agentProfile.context?.productName || agentProfile.context?.founderName) {
    lines.push(
      `Startup: founder=${clipText(agentProfile.context?.founderName || 'unknown', 50)}, startup=${clipText(agentProfile.context?.startupName || 'unknown', 60)}, product=${clipText(agentProfile.context?.productName || 'unknown', 60)}`
    );
  }
  if (agentProfile.context?.goals) {
    lines.push(`Goals: ${clipText(agentProfile.context.goals, 180)}`);
  }
  if (agentProfile.context?.constraints) {
    lines.push(`Constraints: ${clipText(agentProfile.context.constraints, 160)}`);
  }
  if (agentProfile.context?.operatingInstructions) {
    lines.push(`Operating instructions: ${clipText(agentProfile.context.operatingInstructions, 180)}`);
  }
  if (agentProfile.emails?.agentEmail || agentProfile.emails?.userEmail) {
    lines.push(
      `Email identity: agent=${clipText(agentProfile.emails?.agentEmail || 'not set', 60)}, user=${clipText(agentProfile.emails?.userEmail || 'not set', 60)}, approval=${agentProfile.emails?.approvalMode || 'approve_before_send'}`
    );
  }
  if (agentProfile.automation) {
    lines.push(
      `Automation: schedule=${agentProfile.automation.canScheduleEmails ? 'yes' : 'no'}, autoFollowUp=${agentProfile.automation.canFollowUpAutonomously ? 'yes' : 'no'}, quietHours=${clipText(agentProfile.automation.quietHours || 'not set', 40)}, reminderIntensity=${clipText(agentProfile.automation.reminderIntensity || 'firm', 30)}`
    );
  }

  return `Agent setup:\n- ${lines.join('\n- ')}`;
}

function buildIntelBlocks(recentIntel) {
  const highUrgency = recentIntel.filter((item) => item.urgency === 'high');
  const restIntel = recentIntel.filter((item) => item.urgency !== 'high');

  const urgentBlock = highUrgency.length
    ? `URGENT COMPETITIVE DEVELOPMENT - mention only if relevant:\n${highUrgency
      .slice(0, 1)
      .map((item) => `${clipText(item.competitor_name, 40)}: ${clipText(item.summary, MAX_INTEL_CHARS)}`)
      .join('\n')}\n\n`
    : '';

  const intelBlock = restIntel.length
    ? `\n\nRecent competitive intelligence (surface only when relevant):\n${restIntel
      .slice(0, MAX_INTEL_ITEMS)
      .map((item) => `- [${item.category}] ${clipText(item.competitor_name, 40)}: ${clipText(item.summary, MAX_INTEL_CHARS)}`)
      .join('\n')}`
    : '';

  return { urgentBlock, intelBlock };
}

function describeSource(source, founderName) {
  if (source === 'durable_memory') return `${founderName}'s saved memory`;
  if (source === 'chat_memory') return `${founderName}'s prior chat`;
  return source;
}

function buildContextBlock(chunks, founderName) {
  return chunks
    .map((chunk) => `[${describeSource(chunk.source, founderName)}]: ${clipText(chunk.text, MAX_CONTEXT_CHARS_PER_CHUNK)}`)
    .join('\n\n');
}

function memoryToFounderVoice(text, founderName) {
  const escapedName = escapeRegex(founderName);
  return String(text || '')
    .replace(new RegExp(`\\b${escapedName}\\s+has\\b`, 'gi'), 'You have')
    .replace(new RegExp(`\\b${escapedName}\\s+need(s)?\\s+to\\b`, 'gi'), 'You need to')
    .replace(new RegExp(`\\b${escapedName}\\s+has to\\b`, 'gi'), 'You have to')
    .replace(new RegExp(`\\b${escapedName}\\s+will\\b`, 'gi'), 'You will')
    .replace(new RegExp(`\\b${escapedName}\\s+is\\b`, 'gi'), 'You are')
    .replace(new RegExp(`\\b${escapedName}'s\\b`, 'gi'), 'Your');
}

function buildFallbackReply(message, chunks, founderName) {
  const memoryChunk = chunks.find((chunk) => chunk.source === 'durable_memory' || chunk.source === 'chat_memory') || chunks[0];
  if (!memoryChunk?.text) {
    return 'I lost the thread for a second. Send that once more.';
  }

  const founderVoiceMemory = memoryToFounderVoice(memoryChunk.text, founderName);
  const lowerMessage = String(message || '').toLowerCase();

  if (/\bwhat\b/.test(lowerMessage) || /\btomorrow\b/.test(lowerMessage) || /\btonight\b/.test(lowerMessage)) {
    return founderVoiceMemory;
  }

  return `From memory: ${founderVoiceMemory}`;
}

router.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, queryEmbedding, history = [] } = req.body;
    const userId = req.user.id;

    if (!message || !queryEmbedding) {
      return res.status(400).json({ error: 'message and queryEmbedding are required' });
    }

    const [relevantChunks, characterCard, agentProfile] = await Promise.all([
      searchSimilar(userId, queryEmbedding, MAX_RETRIEVED_CHUNKS),
      getCharacterCard(userId),
      getAgentProfileForUser(req.user._id),
    ]);

    if (!characterCard) {
      return res.status(404).json({ error: 'Character card not found. Complete onboarding first.' });
    }

    if (looksLikeEmailRequest(message)) {
      try {
        const emailDraft = await buildEmailDraft(message, characterCard, agentProfile);

        if (emailDraft.shouldHandle) {
          const draftReply = isGmailConfigured(agentProfile)
            ? emailDraft.reply
            : `${emailDraft.reply} Sending is disabled until Gmail is connected in Agent Setup or configured as a server fallback.`;

          return res.json({
            reply: draftReply,
            sources: ['gmail'],
            reminder: null,
            emailDraft: {
              to: emailDraft.to || '',
              subject: emailDraft.subject || '',
              body: emailDraft.body || '',
              missing: emailDraft.missing,
              gmailConfigured: isGmailConfigured(agentProfile),
            },
          });
        }
      } catch (error) {
        console.error('[Chat] Email drafting failed, falling back to safe response:', error);
        return res.json({
          reply: 'I hit a snag while drafting that email. Try again with the recipient and what you want to say in one line.',
          sources: ['gmail'],
          reminder: null,
        });
      }
    }

    const founderName = characterCard.name || 'the founder';
    const context = buildContextBlock(relevantChunks, founderName);
    const compactCharacterProfile = buildCompactCharacterProfile(characterCard);
    const agentSetupBlock = buildAgentSetupBlock(agentProfile);

    const openLoops = (await getOpenLoops(userId)) || [];
    const recentIntel = (await getRecentIntel(userId, 5)) || [];
    const { urgentBlock, intelBlock } = buildIntelBlocks(recentIntel);

    const now = new Date();
    const timeContext = `Current date and time: ${now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const compactOpenLoops = openLoops
      .slice(0, MAX_OPEN_LOOPS)
      .map((loop) => `- [#${loop.id}] ${clipText(loop.loop, MAX_LOOP_CHARS)}`)
      .join('\n') || 'None yet.';

    const systemPrompt = `${timeContext}\n\n${urgentBlock}You are ${characterCard.name}'s cofounder. You are direct, specific, and execution-first. Diagnose the root cause before offering advice. Call out avoidance when you see it. Ask at most one sharp question only when necessary.\n\nFounder profile:\n${JSON.stringify(compactCharacterProfile, null, 2)}\n\nRelevant context:\n${context || 'No additional context.'}\n\nOpen loops:\n${compactOpenLoops}${intelBlock}\n\n${agentSetupBlock}\n\nResponse rules:\n- Make your point and stop.\n- Keep responses compact and high-signal.\n- Speak to ${characterCard.name} as "you".\n- When retrieved memory is about ${characterCard.name}, never talk as if it happened to you.\n- If the user asks what they have to do, answer using ${characterCard.name}'s commitments and schedule.\n- Do not ask a question if you can still give useful advice.\n- Never end with a check-in.`;

    const cleanHistory = history
      .slice(-MAX_HISTORY_MESSAGES)
      .map(({ role, content }) => ({
        role,
        content: clipText(content, MAX_HISTORY_MESSAGE_CHARS),
      }));

    console.log('[Chat] Prompt budget', {
      model: process.env.ACTIVE_MODEL || 'gemini',
      chunks: relevantChunks.length,
      contextChars: context.length,
      systemChars: systemPrompt.length,
      historyChars: cleanHistory.reduce((sum, item) => sum + (item.content?.length || 0), 0),
      estimatedInputTokens: estimateTokens(systemPrompt)
        + cleanHistory.reduce((sum, item) => sum + estimateTokens(item.content), 0)
        + estimateTokens(message),
      requestedOutputTokens: CHAT_MAX_TOKENS,
    });

    let reply;
    try {
      const { text } = await callLLM({
        system: systemPrompt,
        messages: [...cleanHistory, { role: 'user', content: message }],
        maxTokens: CHAT_MAX_TOKENS,
      });
      reply = clipText(text, 2400) || buildFallbackReply(message, relevantChunks, founderName);
    } catch (llmError) {
      console.error('[Chat] LLM call failed, using fallback reply:', llmError);
      reply = buildFallbackReply(message, relevantChunks, founderName);
    }

    let reminder = null;
    const parsedReminder = parseReminderMessage(message);
    if (parsedReminder) {
      reminder = await insertReminder(
        userId,
        parsedReminder.task,
        parsedReminder.remindAt.toISOString(),
        message
      );
    }

    res.json({
      reply,
      sources: relevantChunks.map((chunk) => chunk.source),
      reminder,
    });

    const durableFacts = extractDurableFacts(message, { subjectName: founderName });
    if (durableFacts.length > 0) {
      console.log('[Chat] Durable facts extracted', { count: durableFacts.length, facts: durableFacts });
      upsertDurableMemory(userId, durableFacts, queryEmbedding).catch((error) => {
        console.error('[Chat] Failed to persist durable memory:', error);
      });
    } else if (shouldPersistChatMemory(message)) {
      upsertChatMemory(userId, message, queryEmbedding).catch((error) => {
        console.error('[Chat] Failed to persist chat memory:', error);
      });
    }

    detectOpenLoops(userId, message).catch(console.error);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

export default router;
