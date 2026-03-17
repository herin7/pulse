import { detectOpenLoops } from '../agents/loopDetector.js';
import { extractDurableFacts } from '../agents/durableMemory.js';
import { buildEmailDraft, looksLikeEmailRequest } from '../agents/emailAgent.js';
import { parseReminderMessage } from '../agents/reminderParser.js';
import { getRecentIntel } from '../db/competitors.js';
import { getOpenLoops } from '../db/openLoops.js';
import {
  getCharacterCard,
  searchSimilar,
  searchWithFilter,
  upsertChatMemory,
  upsertDurableMemory,
} from '../db/qdrant.js';
import { insertReminder } from '../db/reminders.js';
import { getAgentProfileForUser } from '../services/agentProfileService.js';
import { AppError } from '../utils/AppError.js';
import { buildAgentSetupBlock, buildContextBlock, buildIntelBlocks } from '../utils/contextBuilder.js';
import { isGmailConfigured } from '../utils/gmail.js';
import { callLLM } from '../utils/llmCall.js';
import { clipText, estimateTokens, shouldPersistChatMemory } from '../utils/messageUtils.js';
import { generateNvidiaEmbedding } from '../utils/nvidiaEmbedding.js';
import { buildFallbackReply, buildSystemPrompt } from '../utils/promptBuilder.js';
import { rerankChunks } from '../utils/reranker.js';
import { getLogContext, logger } from '../utils/logger.js';

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 500;
const MAX_RETRIEVED_CHUNKS = 10;
const MAX_CONTEXT_CHUNKS = 3;

function detectSourceHint(message) {
  if (!message) return null;
  if (/github|repo|code/i.test(message)) return 'github';
  if (/linkedin/i.test(message)) return 'linkedin';
  return null;
}

async function retrieveRelevantChunks(userId, queryEmbedding, message) {
  const sourceHint = detectSourceHint(message);
  const chunks = sourceHint
    ? await searchWithFilter(userId, queryEmbedding, sourceHint, MAX_RETRIEVED_CHUNKS)
    : await searchSimilar(userId, queryEmbedding, MAX_RETRIEVED_CHUNKS);

  const reranked = await rerankChunks(message, chunks, MAX_CONTEXT_CHUNKS);
  return reranked.length ? reranked : chunks.slice(0, MAX_CONTEXT_CHUNKS);
}

export async function buildChatResult({ files, history, message, req }) {
  const queryEmbedding = await generateNvidiaEmbedding(message || 'Analyzing documents');
  const [relevantChunks, characterCard, agentProfile] = await Promise.all([
    retrieveRelevantChunks(req.user.id, queryEmbedding, message),
    getCharacterCard(req.user.id),
    getAgentProfileForUser(req.user._id),
  ]);

  if (!characterCard) throw new AppError('Character card not found. Complete onboarding first.', 404, 'CHARACTER_CARD_MISSING');
  if (message && looksLikeEmailRequest(message)) return handleEmailDraft(message, characterCard, agentProfile);

  const openLoops = await getOpenLoops(req.user.id);
  const recentIntel = await getRecentIntel(req.user.id, 5);
  const founderName = characterCard.name || 'Founder';
  const systemPrompt = buildSystemPrompt({
    agentSetupBlock: buildAgentSetupBlock(agentProfile),
    characterCard,
    compactOpenLoops: openLoops.slice(0, 4),
    context: buildContextBlock(relevantChunks, founderName),
    ...buildIntelBlocks(recentIntel || []),
  });
  const messages = [...history.slice(-MAX_HISTORY_MESSAGES).map(({ content, role }) => ({ role, content: clipText(content, MAX_HISTORY_MESSAGE_CHARS) })), { role: 'user', content: buildUserMessage(message, files) }];

  logger.debug('Prepared chat prompt', { ...getLogContext(req), estimatedInputTokens: estimateTokens(systemPrompt) + estimateTokens(message || ''), files: files.length, chunks: relevantChunks.length });

  let reply;
  try {
    const result = await callLLM({ system: systemPrompt, messages, maxTokens: 4000 });
    reply = clipText(result.text, 2400) || buildFallbackReply(message, relevantChunks, founderName);
  } catch (error) {
    logger.warn('Falling back after LLM failure', { ...getLogContext(req), error: error.message });
    reply = buildFallbackReply(message, relevantChunks, founderName);
  }

  const reminder = message ? await createReminder(req.user.id, message) : null;
  queueMemoryPersistence({ founderName, message, queryEmbedding, relevantChunks, req });
  return { reply, reminder, sources: relevantChunks.map((chunk) => chunk.source) };
}

function buildUserMessage(message, files) {
  const content = [];
  if (message) content.push({ text: message });
  files.forEach((file) => content.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } }));
  return content;
}

async function handleEmailDraft(message, characterCard, agentProfile) {
  const emailDraft = await buildEmailDraft(message, characterCard, agentProfile);
  if (!emailDraft.shouldHandle) return null;
  const reply = isGmailConfigured(agentProfile)
    ? emailDraft.reply
    : `${emailDraft.reply} Sending is disabled until Gmail is connected in Agent Setup or configured as a server fallback.`;
  return { reply, reminder: null, sources: ['gmail'], emailDraft: { to: emailDraft.to || '', subject: emailDraft.subject || '', body: emailDraft.body || '', missing: emailDraft.missing, gmailConfigured: isGmailConfigured(agentProfile) } };
}

async function createReminder(userId, message) {
  const parsedReminder = parseReminderMessage(message);
  return parsedReminder ? insertReminder(userId, parsedReminder.task, parsedReminder.remindAt.toISOString(), message) : null;
}

function queueMemoryPersistence({ founderName, message, queryEmbedding, req }) {
  if (!message) return;
  const durableFacts = extractDurableFacts(message, { subjectName: founderName });
  const tasks = durableFacts.length
    ? [upsertDurableMemory(req.user.id, durableFacts, queryEmbedding)]
    : shouldPersistChatMemory(message)
      ? [upsertChatMemory(req.user.id, message, queryEmbedding)]
      : [];
  tasks.push(detectOpenLoops(req.user.id, message));
  Promise.allSettled(tasks).then((results) => {
    results.filter((result) => result.status === 'rejected').forEach((result) => {
      logger.warn('Deferred chat task failed', { ...getLogContext(req), error: result.reason?.message || String(result.reason) });
    });
  });
}
