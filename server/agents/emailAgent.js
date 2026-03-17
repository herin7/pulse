import { generateEmailDraft } from './emailAgentDraft.js';
import { gmailMCP, isMcpEnabled } from './mcpClient.js';
import {
  buildDraftReply,
  buildFallbackBody,
  buildFallbackSubject,
  EMAIL_TRIGGER,
  extractDraftBrief,
  extractRecipientEmail,
} from './emailAgentHeuristics.js';
import { sendGmailMessage } from '../utils/gmail.js';
import { logger } from '../utils/logger.js';

export function looksLikeEmailRequest(message) {
  return EMAIL_TRIGGER.test(message || '');
}

export async function buildEmailDraft(message, characterCard = null, agentProfile = null) {
  if (!looksLikeEmailRequest(message)) {
    return { shouldHandle: false };
  }

  const to = extractRecipientEmail(message);
  const brief = extractDraftBrief(message, to);
  const missing = [];

  if (!to) {
    missing.push('to');
  }

  if (!brief) {
    missing.push('body');
  }

  const signature = agentProfile?.identity?.signature?.trim() || 'Best,\nPulse';
  const baseDraft = {
    subject: buildFallbackSubject(brief),
    body: buildFallbackBody(brief, signature),
  };

  const draft = await generateEmailDraft({
    brief,
    characterCard,
    agentProfile,
    signature,
    ...baseDraft,
  });

  return {
    shouldHandle: true,
    to,
    subject: draft.subject,
    body: draft.body,
    missing,
    reply: buildDraftReply(missing),
  };
}

async function callGmailTool(toolNames, params) {
  for (const toolName of toolNames) {
    const result = await gmailMCP(toolName, params);
    if (result) return result;
  }
  return null;
}

function getSenderEmail(agentProfile = null) {
  return process.env.GMAIL_SENDER_EMAIL || agentProfile?.gmailConnection?.connectedEmail || 'pulse@local';
}

export async function sendAgentEmail({ to, subject, body, agentProfile = null }) {
  const canUseMcp = isMcpEnabled() && Boolean(process.env.GMAIL_ACCESS_TOKEN);

  if (canUseMcp) {
    try {
      const payload = await callGmailTool(['gmail-send', 'send-message'], { body, subject, to });
      if (payload) {
        return {
          from: getSenderEmail(agentProfile),
          id: payload.id || payload.messageId || payload.result?.id || null,
          source: 'gmail_mcp',
          threadId: payload.threadId || payload.result?.threadId || null,
        };
      }
      logger.warn('Gmail MCP send returned empty payload; falling back to Gmail OAuth');
    } catch (error) {
      logger.warn('Gmail MCP send failed; falling back to Gmail OAuth', { error: error.message });
    }
  }

  const fallback = await sendGmailMessage({ to, subject, body, agentProfile });
  return {
    from: fallback.from || getSenderEmail(agentProfile),
    id: fallback.id || null,
    source: fallback.source || 'gmail_oauth',
    threadId: fallback.threadId || null,
  };
}

export async function searchAgentEmails(query, limit = 10) {
  if (!isMcpEnabled() || !process.env.GMAIL_ACCESS_TOKEN) {
    return [];
  }

  const payload = await callGmailTool(['gmail-search-messages', 'search-messages'], { limit, query });
  const items = payload?.messages || payload?.items || payload?.results || payload?.result?.messages || [];
  return Array.isArray(items) ? items : [];
}
