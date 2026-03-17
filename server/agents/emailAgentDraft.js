import { callLLM } from '../utils/llmCall.js';
import { logger } from '../utils/logger.js';

import { parseDraftSections } from './emailAgentHeuristics.js';

export async function generateEmailDraft({
  brief,
  characterCard,
  agentProfile,
  subject,
  body,
  signature,
}) {
  if (!brief) {
    return { subject, body };
  }

  try {
    const { text } = await callLLM({
      system: `You draft polished plain-text emails for Pulse.
Return exactly in this format:
SUBJECT: <one line>
BODY:
<plain text email body>

Rules:
- No JSON, no markdown, no bullets.
- Keep the subject concise and specific.
- The body must be concise, professional, and immediately sendable.
- Use a greeting, short paragraphs, and this exact sign-off:
${signature}
- Keep the body under 140 words unless the user explicitly asked for a longer email.`,
      messages: [{
        role: 'user',
        content: `Founder profile:\n${JSON.stringify(characterCard || {}, null, 2)}\n\nAgent identity:\n${JSON.stringify({
          agentName: agentProfile?.identity?.agentName || 'Pulse',
          role: agentProfile?.identity?.role || 'AI Cofounder',
          responsibility: agentProfile?.identity?.responsibility || '',
          agentEmail: agentProfile?.emails?.agentEmail || '',
        }, null, 2)}\n\nDraft brief:\n${brief}`,
      }],
      maxTokens: 300,
    });

    const parsed = parseDraftSections(text);
    return {
      subject: parsed?.subject || subject,
      body: parsed?.body || body,
    };
  } catch (error) {
    logger.warn('Falling back to heuristic email draft', { error: error.message });
    return { subject, body };
  }
}
