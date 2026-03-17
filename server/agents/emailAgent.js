import { generateEmailDraft } from './emailAgentDraft.js';
import {
  buildDraftReply,
  buildFallbackBody,
  buildFallbackSubject,
  EMAIL_TRIGGER,
  extractDraftBrief,
  extractRecipientEmail,
} from './emailAgentHeuristics.js';

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
