export const EMAIL_TRIGGER =
  /\b(send|draft|write|compose)\b[\s\S]*\b(mail|email|e-mail|gmail|mial)\b|\b(mail|email|e-mail|gmail|mial)\b[\s\S]*\b(send|draft|write|compose)\b/i;
const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeSpacing(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractRecipientEmail(message) {
  const match = message.match(EMAIL_ADDRESS_PATTERN);
  return match ? match[0] : null;
}

export function extractDraftBrief(message, toEmail) {
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

export function buildFallbackSubject(brief) {
  if (!brief) {
    return '';
  }

  const cleaned = brief.replace(/[.?!]+$/g, '').replace(/^we\s+/i, '').replace(/^i\s+/i, '');
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Quick follow-up';
}

export function buildFallbackBody(brief, signature) {
  if (!brief) {
    return '';
  }

  const statement = brief.endsWith('.') ? brief : `${brief}.`;
  return `Hi,\n\n${statement}\n\n${signature}`;
}

export function parseDraftSections(text) {
  const subjectMatch = text?.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text?.match(/BODY:\s*([\s\S]+)/i);

  if (!subjectMatch && !bodyMatch) {
    return null;
  }

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
  };
}

export function buildDraftReply(missing) {
  if (!missing.length) {
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
