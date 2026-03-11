const REMINDER_REGEX = /remind me to\s+(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(today|tomorrow))?(?:\s*[.?!])?$/i;

function buildReminderDate(hours, minutes, dayOffset) {
  const now = new Date();
  const reminderDate = new Date(now);
  reminderDate.setSeconds(0, 0);
  reminderDate.setHours(hours, minutes, 0, 0);
  reminderDate.setDate(reminderDate.getDate() + dayOffset);

  if (dayOffset === 0 && reminderDate <= now) {
    reminderDate.setDate(reminderDate.getDate() + 1);
  }

  return reminderDate;
}

function normalizeHours(rawHours, meridiem) {
  let hours = Number(rawHours);

  if (Number.isNaN(hours) || hours < 0 || hours > 23) {
    return null;
  }

  if (!meridiem) {
    return hours;
  }

  const lowerMeridiem = meridiem.toLowerCase();
  if (hours < 1 || hours > 12) {
    return null;
  }

  if (lowerMeridiem === 'am') {
    return hours === 12 ? 0 : hours;
  }

  return hours === 12 ? 12 : hours + 12;
}

export function parseReminderMessage(message) {
  if (typeof message !== 'string') return null;

  const trimmed = message.trim();
  const match = trimmed.match(REMINDER_REGEX);
  if (!match) return null;

  const [, rawTask, rawHours, rawMinutes = '00', meridiem, dayWord] = match;
  const hours = normalizeHours(rawHours, meridiem);
  const minutes = Number(rawMinutes);

  if (hours === null || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  const dayOffset = dayWord?.toLowerCase() === 'tomorrow' ? 1 : 0;
  const remindAt = buildReminderDate(hours, minutes, dayOffset);
  const task = rawTask.trim().replace(/\s+/g, ' ');

  if (!task) return null;

  return { task, remindAt };
}
