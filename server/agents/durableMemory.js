const TIME_KEYWORDS = /\b(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)?|today|tonight|tomorrow|this evening|this afternoon|this morning|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const FIRST_PERSON_PATTERNS = /\b(?:i|i'm|i have|i've|i am|my|we|we're|we have)\b/i;

function normalizeSentence(sentence) {
  return String(sentence || '').replace(/\s+/g, ' ').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPossessive(name) {
  if (!name) return "User's";
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function toFactStyle(sentence, subjectName = 'User') {
  let fact = normalizeSentence(sentence);
  if (!fact) return '';

  const cleanName = normalizeSentence(subjectName) || 'User';
  const possessiveName = toPossessive(cleanName);
  const namePattern = cleanName !== 'User'
    ? new RegExp(`\\b${escapeRegex(cleanName)}\\b`, 'gi')
    : null;

  fact = fact
    .replace(/\bI am\b/gi, `${cleanName} is`)
    .replace(/\bI'm\b/gi, `${cleanName} is`)
    .replace(/\bI have\b/gi, `${cleanName} has`)
    .replace(/\bI've got\b/gi, `${cleanName} has`)
    .replace(/\bI need to\b/gi, `${cleanName} needs to`)
    .replace(/\bI have to\b/gi, `${cleanName} has to`)
    .replace(/\bI will\b/gi, `${cleanName} will`)
    .replace(/\bI am going to\b/gi, `${cleanName} is going to`)
    .replace(/\bI'm going to\b/gi, `${cleanName} is going to`)
    .replace(/\bMy\b/gi, possessiveName)
    .replace(/\bWe are\b/gi, `${cleanName} is`)
    .replace(/\bWe're\b/gi, `${cleanName} is`)
    .replace(/\bWe have\b/gi, `${cleanName} has`)
    .replace(/\bWe need to\b/gi, `${cleanName} needs to`)
    .replace(/\bWe will\b/gi, `${cleanName} will`)
    .replace(/\bWe\b/gi, cleanName);

  if (namePattern) {
    fact = fact.replace(namePattern, cleanName);
  }

  if (!/[.!?]$/.test(fact)) {
    fact = `${fact}.`;
  }

  return fact;
}

function splitCandidates(message) {
  return String(message || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normalizeSentence)
    .filter(Boolean);
}

export function extractDurableFacts(message, options = {}) {
  const subjectName = normalizeSentence(options.subjectName || 'User') || 'User';
  const candidates = splitCandidates(message);
  const facts = new Set();

  for (const sentence of candidates) {
    const lower = sentence.toLowerCase();
    if (sentence.length < 12 || sentence.length > 220) continue;

    if (/\bmy name is\b/i.test(sentence)) {
      facts.add(toFactStyle(sentence, subjectName));
      continue;
    }

    if (/\b(?:i am building|we are building|my startup is|my product is)\b/i.test(sentence)) {
      facts.add(toFactStyle(sentence, subjectName));
      continue;
    }

    const soundsLikeSchedule = FIRST_PERSON_PATTERNS.test(sentence)
      && TIME_KEYWORDS.test(sentence)
      && /\b(?:meet|meeting|call|demo|interview|appointment|office|flight|doctor|event|standup|send|ship|submit|go|leave|launch|talk)\b/i.test(sentence);

    const soundsLikeCommitment = /\b(?:i need to|i have to|i will|i'm going to|i am going to)\b/i.test(sentence)
      && TIME_KEYWORDS.test(sentence);

    if (soundsLikeSchedule || soundsLikeCommitment) {
      facts.add(toFactStyle(sentence, subjectName));
      continue;
    }

    if (/\bmy (?:goal|priority|focus|plan) is\b/i.test(lower) || /\bi want to\b/i.test(lower)) {
      facts.add(toFactStyle(sentence, subjectName));
    }
  }

  return [...facts];
}
