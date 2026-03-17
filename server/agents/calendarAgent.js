import { calendarMCP, isMcpEnabled } from './mcpClient.js';

const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeItems(payload) {
  const items = payload?.results || payload?.items || payload?.events || payload?.data || payload?.result?.items || [];
  return Array.isArray(items) ? items : [];
}

function findPerson(text) {
  const match = String(text || '').match(/\b(call|meet|talk to|talk with|follow up with|email)\s+([a-z][a-z\s.&-]{2,40})/i);
  return match?.[2]?.trim() || null;
}

function resolveDateLabel(label) {
  const now = new Date();
  const value = String(label || '').toLowerCase();
  if (value === 'today') return new Date(now);
  if (value === 'tomorrow') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const targetDay = DAY_INDEX[value];
  if (targetDay === undefined) return null;

  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (targetDay - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function normalizeTime(value) {
  const match = String(value || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hours += 12;
  const minutes = Number(match[2] || '0');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function extractScheduleDetails(text) {
  const match = String(text || '').match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b.*?\b(\d{1,2}(?::\d{2})?\s*(am|pm))\b/i);
  const person = findPerson(text);
  const date = resolveDateLabel(match?.[1]);
  const time = normalizeTime(match?.[2]);

  if (!date || !time || !person) return null;
  return {
    date: date.toISOString().slice(0, 10),
    durationMinutes: 30,
    person,
    time,
  };
}

async function callCalendarTool(toolNames, params) {
  for (const toolName of toolNames) {
    const result = await calendarMCP(toolName, params);
    if (result) return result;
  }
  return null;
}

export async function getTodayEvents() {
  if (!isMcpEnabled() || !process.env.GOOGLE_ACCESS_TOKEN) return [];
  const start = new Date();
  const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
  const payload = await callCalendarTool(['calendar-list-events', 'list-events'], {
    end: end.toISOString(),
    start: start.toISOString(),
  });
  return normalizeItems(payload);
}

export async function createCalendarEvent(title, date, time, durationMinutes = 30) {
  if (!isMcpEnabled() || !process.env.GOOGLE_ACCESS_TOKEN) return null;
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return callCalendarTool(['calendar-create-event', 'create-event'], {
    date,
    durationMinutes,
    end: end.toISOString(),
    start: start.toISOString(),
    time,
    title,
  });
}
