import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_STORED_MESSAGES = 50;
const MAX_HISTORY_CONTENT_CHARS = 2000;
const FALLBACK_REPLY = 'Something went wrong. Try again.';

function buildStorageKey(userId) {
  return `pulse_chat_${userId || 'anonymous'}`;
}

function trimMessages(messages) {
  return messages.slice(-MAX_STORED_MESSAGES);
}

function trimContent(text, max = MAX_HISTORY_CONTENT_CHARS) {
  if (!text) return '';
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function createMessageId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseStoredMessages(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && !item.isThinking)
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function normalizeReplyText(result) {
  const text = typeof result?.reply === 'string' ? result.reply.trim() : '';
  return text || FALLBACK_REPLY;
}

export default function useChat({ userId }) {
  const storageKey = useMemo(() => buildStorageKey(userId), [userId]);
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') return [];
    return parseStoredMessages(window.sessionStorage.getItem(storageKey));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMessages(parseStoredMessages(window.sessionStorage.getItem(storageKey)));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const serializable = messages.filter((item) => !item.isThinking).slice(-MAX_STORED_MESSAGES);
    window.sessionStorage.setItem(storageKey, JSON.stringify(serializable));
  }, [messages, storageKey]);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => trimMessages([...prev, { id: createMessageId(), ...message }]));
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const sendMessage = useCallback(async ({ content, files = [] }, requestFn) => {
    if (isLoading) return null;

    const userContent = String(content || '').trim();
    const userMessage = {
      id: createMessageId(),
      role: 'user',
      content: userContent || (files.length ? `Sent ${files.length} file(s)` : ''),
      files: files.map((file) => ({ name: file.name, type: file.type })),
    };
    const placeholderId = createMessageId();
    const thinkingMessage = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      isThinking: true,
    };

    const historyForRequest = trimMessages([
      ...messagesRef.current.filter((item) => !item.isThinking),
      userMessage,
    ]).map((item) => ({
      content: trimContent(item.content, MAX_HISTORY_CONTENT_CHARS),
      role: item.role,
    }));

    setError(null);
    setIsLoading(true);
    setMessages((prev) => trimMessages([...prev, userMessage, thinkingMessage]));

    try {
      const result = await requestFn({ history: historyForRequest, userMessage });
      const assistantMessage = {
        id: placeholderId,
        role: 'assistant',
        content: normalizeReplyText(result),
        sources: Array.isArray(result?.sources) ? result.sources : [],
        syncedServices: Array.isArray(result?.syncedServices) ? result.syncedServices : [],
      };

      setMessages((prev) => trimMessages(prev.map((item) => (
        item.id === placeholderId ? assistantMessage : item
      ))));

      return { result, userMessage, assistantMessage };
    } catch (err) {
      setError(err);
      setMessages((prev) => trimMessages(prev.map((item) => (
        item.id === placeholderId
          ? { id: placeholderId, role: 'assistant', content: FALLBACK_REPLY }
          : item
      ))));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return { messages, sendMessage, clearHistory, isLoading, error, appendMessage };
}
