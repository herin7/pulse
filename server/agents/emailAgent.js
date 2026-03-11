import { callLLM } from '../utils/llmCall.js';

const EMAIL_TRIGGER = /\b(send|draft|write|compose)\b[\s\S]*\b(mail|email|e-mail|gmail|mial)\b|\b(mail|email|e-mail|gmail|mial)\b[\s\S]*\b(send|draft|write|compose)\b/i;
const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function extractRecipientEmail(message) {
  const match = message.match(EMAIL_ADDRESS_PATTERN);
  return match ? match[0] : null;
}

function normalizeSpacing(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function extractDraftBrief(message, toEmail) {
  let brief = message || '';

  if (toEmail) {
    brief = brief.replace(toEmail, ' ');
  }

  brief = brief
    .replace(/\b(send|draft|write|compose)\b/gi, ' ')
    .replace(/\b(mail|email|e-mail|gmail|mial)\b/gi, ' ')
    .replace(/\b(can you|could you|would you|for me)\b/gi, ' ')
    .replace(/\bon behalf of me\b/gi, ' ')
    .replace(/\bplease\b|\bpls\b/gi, ' ')
    .replace(/\bto\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  brief = brief.replace(/^(a|an)\s+/i, '');
  brief = brief.replace(/^(saying|about|that says|says|telling them|tell them|ask them to)\s+/i, '');

  brief = normalizeSpacing(brief).replace(/^[^a-z0-9]+|[^a-z0-9.?!]+$/gi, '');

  if (brief.split(' ').filter(Boolean).length <= 2 && !/[.?!]/.test(brief)) {
    return '';
  }

  return brief;
}

function buildFallbackSubject(brief) {
  if (!brief) {
    return '';
  }

  const cleaned = brief
    .replace(/[.?!]+$/g, '')
    .replace(/^we\s+/i, '')
    .replace(/^i\s+/i, '');

  if (!cleaned) {
    return 'Quick follow-up';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildFallbackBody(brief, signature = 'Best,\nPulse') {
  if (!brief) {
    return '';
  }

  const statement = brief.endsWith('.') ? brief : `${brief}.`;
  return `Hi,\n\n${statement}\n\n${signature}`;
}

function parseDraftSections(text) {
  if (!text) {
    return null;
  }

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

  if (!subjectMatch && !bodyMatch) {
    return null;
  }

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
  };
}

function buildReply(missing) {
  if (missing.length === 0) {
    return 'I drafted the email. Review it before sending.';
  }

  if (missing.length === 1 && missing[0] === 'to') {
    return 'I drafted the email. Add the recipient address before sending.';
  }

  if (missing.length === 1 && missing[0] === 'body') {
    return 'I need a little more detail on what you want the email to say.';
  }

  return 'I drafted what I could. Fill in the missing details before sending.';
}

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
  const agentName = agentProfile?.identity?.agentName?.trim() || 'Pulse';

  let subject = buildFallbackSubject(brief);
  let body = buildFallbackBody(brief, signature);

  if (brief) {
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
            agentName,
            role: agentProfile?.identity?.role || 'AI Cofounder',
            responsibility: agentProfile?.identity?.responsibility || '',
            agentEmail: agentProfile?.emails?.agentEmail || '',
          }, null, 2)}\n\nDraft brief:\n${brief}`,
        }],
        maxTokens: 300,
      });

      const parsed = parseDraftSections(text);
      if (parsed?.subject) {
        subject = parsed.subject;
      }
      if (parsed?.body) {
        body = parsed.body;
      }
    } catch (error) {
      console.error('[EmailAgent] Falling back to heuristic draft:', error.message);
    }
  }

  return {
    shouldHandle: true,
    to,
    subject,
    body,
    missing,
    reply: buildReply(missing),
  };
}
