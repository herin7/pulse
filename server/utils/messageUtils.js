const MIN_CHAT_MEMORY_CHARS = 12;
const CHAT_MEMORY_SKIP_PATTERNS = [/^hi$/i, /^hello$/i, /^hey$/i, /^thanks?$/i, /^ok(ay)?$/i, /^yup$/i];

export function clipText(text, maxChars) {
  if (!text) {
    return '';
  }

  const normalized = String(text).replace(/\s+/g, ' ').trim();
  return normalized.length <= maxChars ? normalized : `${normalized.slice(0, maxChars - 1)}...`;
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function estimateTokens(text) {
  return Math.ceil((text?.length || 0) / 4);
}

export function shouldPersistChatMemory(message) {
  const normalized = String(message || '').trim();
  return normalized.length >= MIN_CHAT_MEMORY_CHARS
    && !CHAT_MEMORY_SKIP_PATTERNS.some((pattern) => pattern.test(normalized));
}
