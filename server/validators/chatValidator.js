import { z } from 'zod';

function trimContent(text, max = 2000) {
  if (!text) return '';
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

const historyItemSchema = z.object({
  content: z.preprocess((value) => trimContent(value, 2000), z.string()).optional().default(''),
  role: z.enum(['user', 'assistant']),
});

function parseHistory(value) {
  if (typeof value !== 'string') return value ?? [];
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const chatBodySchema = z.object({
  history: z.preprocess(
    parseHistory,
    z.array(historyItemSchema).max(20, 'History can include at most 20 items').optional().default([]),
  ),
  message: z.preprocess((value) => trimContent(value, 2000), z.string()).optional().default(''),
});
