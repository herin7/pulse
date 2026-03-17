import { detectOpenLoops } from '../agents/loopDetector.js';
import { extractDurableFacts } from '../agents/durableMemory.js';
import { buildEmailDraft, looksLikeEmailRequest } from '../agents/emailAgent.js';
import { isMcpEnabled } from '../agents/mcpClient.js';
import { parseReminderMessage } from '../agents/reminderParser.js';
import { getRecentIntel } from '../db/competitors.js';
import { getOpenLoops } from '../db/openLoops.js';
import { getCharacterCard, searchSimilar, searchWithFilter, upsertChatMemory, upsertDurableMemory } from '../db/qdrant.js';
import { insertReminder } from '../db/reminders.js';
import { getAgentProfileForUser } from '../services/agentProfileService.js';
import * as notion from '../services/notionService.js';
import { AppError } from '../utils/AppError.js';
import { buildAgentSetupBlock, buildContextBlock, buildIntelBlocks } from '../utils/contextBuilder.js';
import { isGmailConfigured } from '../utils/gmail.js';
import { callLLM } from '../utils/llmCall.js';
import { clipText, estimateTokens, shouldPersistChatMemory } from '../utils/messageUtils.js';
import { generateNvidiaEmbedding } from '../utils/nvidiaEmbedding.js';
import { buildFallbackReply, buildSystemPrompt, fetchTodayContext } from '../utils/promptBuilder.js';
import { rerankChunks } from '../utils/reranker.js';
import { getLogContext, logger } from '../utils/logger.js';

const MAX_CONTEXT_CHUNKS = 3;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 500;
const MAX_RETRIEVED_CHUNKS = 10;
const NOTION_QUERY_PATTERN = /\b(notion|page|pages|wrote|doc|docs|document|note|notes)\b/i;
const MAX_NOTION_CONTEXT_CHARS = 1800;

function trimContent(text, max = MAX_NOTION_CONTEXT_CHARS) {
  if (!text) return '';
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function buildLoopSyncReply(syncedServices) {
  if (!syncedServices.length) return '';
  if (syncedServices.includes('notion') && syncedServices.includes('calendar')) return 'Got it. Added to your loops, Notion, and calendar.';
  return `Got it. Added to your loops and ${syncedServices.join(', ')}.`;
}

function buildUserMessage(message, files) {
  const content = [];
  if (message) content.push({ text: message });
  files.forEach((file) => content.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } }));
  return content;
}

function detectSourceHint(message) {
  if (/github|repo|code/i.test(message || '')) return 'github';
  if (/linkedin/i.test(message || '')) return 'linkedin';
  if (/notion/i.test(message || '')) return 'notion';
  return null;
}

function looksLikeNotionRead(message) {
  return NOTION_QUERY_PATTERN.test(message || '') && /\b(fetch|show|see|what|list|mention|read|content|page|pages)\b/i.test(message || '');
}

function extractNotionPageTitle(message) {
  const quoted = String(message || '').match(/["“](.+?)["”]/);
  if (quoted?.[1]) return quoted[1].trim();
  return String(message || '').match(/create(?: a)? new page(?: named| name)?\s+(.+)$/i)?.[1]?.trim() || '';
}

function extractNotionPageUrl(message) {
  return String(message || '').match(/https?:\/\/www\.notion\.so\/[^\s)]+/i)?.[0] || null;
}

function normalizeNotionPageId(value) {
  const compact = String(value || '').replace(/-/g, '').match(/[0-9a-f]{32}/i)?.[0];
  return compact ? `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}` : null;
}

function extractNotionPageId(message) {
  const pageId = normalizeNotionPageId(message);
  return pageId || normalizeNotionPageId(extractNotionPageUrl(message));
}

function extractTodoItems(message) {
  const match = String(message || '').match(/\badd\b([\s\S]+?)(?:\b(?:also\s+(?:fetch|list)|fetch|list out|$))/i);
  if (!match?.[1]) return [];
  return match[1]
    .split(/\s*&\s*|,|\band\b/i)
    .map((item) => item.replace(/\bin\b.*$/i, '').replace(/['".]/g, '').trim())
    .filter(Boolean);
}

function buildNotionSearchQuery(message) {
  const cleaned = String(message || '').replace(extractNotionPageUrl(message) || '', '').trim();
  return cleaned.length >= 8 ? cleaned : 'workspace';
}

function formatNotionPage(page) {
  const heading = page?.title || 'Notion page';
  const content = clipText([page?.properties, page?.content].filter(Boolean).join('\n').trim() || 'No readable content found.', 900);
  return { content, heading };
}

async function handleNotionAction(message) {
  if (!notion.isEnabled()) return null;

  const notionPageId = extractNotionPageId(message);
  if (notionPageId) {
    const page = await notion.getPageContent(notionPageId);
    if (!page) {
      return { reply: 'I could not access that Notion page even with the provided link.', sources: ['notion'], syncedServices: [] };
    }

    const items = extractTodoItems(message);
    if (items.length) {
      const appended = await notion.appendBlocks(notionPageId, items.map((item) => `- ${item}`).join('\n'));
      if (!appended) {
        return { reply: `I could read "${page.title || 'that page'}", but I could not append the requested items.`, sources: ['notion'], syncedServices: [] };
      }
    }

    const refreshedPage = await notion.getPageContent(notionPageId) || page;
    const { content, heading } = formatNotionPage(refreshedPage);
    const prefix = items.length ? `Updated "${heading}" and fetched the latest content.` : `Fetched content from "${heading}".`;
    return { reply: `${prefix}\n\n${content}`, sources: ['notion'], syncedServices: [] };
  }

  if (!/\b(create|new)\b/i.test(message || '') || !/\bpage\b/i.test(message || '')) {
    return null;
  }

  const title = extractNotionPageTitle(message);
  if (!title) {
    return { reply: 'I need the exact Notion page title before I can create it.', sources: ['notion'], syncedServices: [] };
  }

  const created = await notion.createPage({ content: '', title });
  return created?.id
    ? { reply: `Created a Notion page named "${title}".`, sources: ['notion'], syncedServices: [] }
    : { reply: `I could not create the Notion page "${title}".`, sources: ['notion'], syncedServices: [] };
}

async function getLiveWorkspaceChunks(message) {
  if (!NOTION_QUERY_PATTERN.test(message || '') || !notion.isEnabled()) return [];
  const pages = await notion.searchPages(buildNotionSearchQuery(message));
  const detailedPages = await Promise.all(pages.slice(0, 2).map(async (page) => notion.getPageContent(page.id) || page));
  return detailedPages
    .filter(Boolean)
    .map((page) => {
      const combined = [page.title, page.properties || page.text, page.content].filter(Boolean).join('\n');
      logger.debug('Notion context size', {
        length: combined.length,
        pageId: page.id,
        trimmed: combined.length > MAX_NOTION_CONTEXT_CHARS,
      });
      return { score: 1, source: 'notion', text: trimContent(combined, MAX_NOTION_CONTEXT_CHARS) };
    });
}

async function retrieveRelevantChunks(userId, queryEmbedding, message) {
  const sourceHint = detectSourceHint(message);
  const liveWorkspaceChunks = await getLiveWorkspaceChunks(message);
  const memoryChunks = sourceHint === 'notion'
    ? await searchSimilar(userId, queryEmbedding, MAX_RETRIEVED_CHUNKS)
    : sourceHint
      ? await searchWithFilter(userId, queryEmbedding, sourceHint, MAX_RETRIEVED_CHUNKS)
      : await searchSimilar(userId, queryEmbedding, MAX_RETRIEVED_CHUNKS);
  const combinedChunks = [...liveWorkspaceChunks, ...memoryChunks];
  const reranked = await rerankChunks(message, combinedChunks, MAX_CONTEXT_CHUNKS);
  return reranked.length ? reranked : combinedChunks.slice(0, MAX_CONTEXT_CHUNKS);
}

async function handleEmailDraft(message, characterCard, agentProfile) {
  const emailDraft = await buildEmailDraft(message, characterCard, agentProfile);
  if (!emailDraft.shouldHandle) return null;
  const reply = isGmailConfigured(agentProfile) ? emailDraft.reply : `${emailDraft.reply} Sending is disabled until Gmail is connected in Agent Setup or configured as a server fallback.`;
  return {
    emailDraft: {
      body: emailDraft.body || '',
      gmailConfigured: isGmailConfigured(agentProfile),
      missing: emailDraft.missing,
      subject: emailDraft.subject || '',
      to: emailDraft.to || '',
    },
    reminder: null,
    reply,
    sources: ['gmail'],
    syncedServices: [],
  };
}

async function createReminder(userId, message) {
  const parsedReminder = parseReminderMessage(message);
  return parsedReminder ? insertReminder(userId, parsedReminder.task, parsedReminder.remindAt.toISOString(), message) : null;
}

function queueMemoryPersistence({ founderName, message, queryEmbedding, req }) {
  if (!message) return;
  const durableFacts = extractDurableFacts(message, { subjectName: founderName });
  const tasks = durableFacts.length ? [upsertDurableMemory(req.user.id, durableFacts, queryEmbedding)] : shouldPersistChatMemory(message) ? [upsertChatMemory(req.user.id, message, queryEmbedding)] : [];
  Promise.allSettled(tasks).then((results) => {
    results.filter((result) => result.status === 'rejected').forEach((result) => logger.warn('Deferred chat task failed', { ...getLogContext(req), error: result.reason?.message || String(result.reason) }));
  });
}

export async function buildChatResult({ files, history, message, req }) {
  const notionActionResult = await handleNotionAction(message);
  if (notionActionResult) {
    return { reminder: null, ...notionActionResult, fallbackUsed: false, modelUsed: null };
  }

  const queryEmbedding = await generateNvidiaEmbedding(message || 'Analyzing documents');
  const [relevantChunks, characterCard, agentProfile, todayContext] = await Promise.all([
    retrieveRelevantChunks(req.user.id, queryEmbedding, message),
    getCharacterCard(req.user.id),
    getAgentProfileForUser(req.user._id),
    fetchTodayContext(),
  ]);
  if (!characterCard) throw new AppError('Character card not found. Complete onboarding first.', 404, 'CHARACTER_CARD_MISSING');
  if (message && looksLikeEmailRequest(message)) return handleEmailDraft(message, characterCard, agentProfile);
  if (looksLikeNotionRead(message) && !relevantChunks.some((chunk) => chunk.source === 'notion')) {
    return {
      reminder: null,
      reply: 'I could not find any accessible Notion pages for this workspace, so I should not pretend I read anything there.',
      sources: [],
      syncedServices: [],
      fallbackUsed: false,
      modelUsed: null,
    };
  }

  const [openLoops, recentIntel] = await Promise.all([getOpenLoops(req.user.id), getRecentIntel(req.user.id, 5)]);
  const founderName = characterCard.name || 'Founder';
  const systemPrompt = buildSystemPrompt({
    agentSetupBlock: buildAgentSetupBlock(agentProfile),
    characterCard,
    compactOpenLoops: openLoops.slice(0, 4),
    context: buildContextBlock(relevantChunks, founderName),
    todayContext,
    ...buildIntelBlocks(recentIntel || []),
  });
  const messages = [
    ...history.slice(-MAX_HISTORY_MESSAGES).map(({ content, role }) => ({ role, content: clipText(content, MAX_HISTORY_MESSAGE_CHARS) })),
    { role: 'user', content: buildUserMessage(message, files) },
  ];

  logger.debug('Prepared chat prompt', {
    ...getLogContext(req),
    chunks: relevantChunks.length,
    estimatedInputTokens: estimateTokens(systemPrompt) + estimateTokens(message || ''),
    files: files.length,
  });

  let reply;
  let llmResult = null;
  try {
    llmResult = await callLLM({ system: systemPrompt, messages, maxTokens: 4000 });
    reply = clipText(llmResult.text, 2400) || buildFallbackReply(message, relevantChunks, founderName);
  } catch (error) {
    logger.warn('Falling back after LLM failure', { ...getLogContext(req), error: error.message });
    reply = buildFallbackReply(message, relevantChunks, founderName);
  }

  const [reminder, loopResult] = await Promise.all([
    message ? createReminder(req.user.id, message) : null,
    message ? detectOpenLoops(req.user.id, message, { syncTargets: isMcpEnabled() || notion.isEnabled() }) : { loops: [], syncedServices: [] },
  ]);
  const syncedServices = loopResult?.syncedServices || [];
  if (loopResult?.loops?.length && syncedServices.length) reply = `${reply}\n\n${buildLoopSyncReply(syncedServices)}`.trim();
  queueMemoryPersistence({ founderName, message, queryEmbedding, req });
  return {
    reminder,
    reply,
    sources: relevantChunks.map((chunk) => chunk.source),
    syncedServices,
    fallbackUsed: Boolean(llmResult?.fallbackUsed),
    modelUsed: llmResult?.modelUsed || null,
  };
}
