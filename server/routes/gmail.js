import { Router } from 'express';

import { sendAgentEmail } from '../agents/emailAgent.js';
import { insertEmailAction } from '../db/emailActions.js';
import { requireAuth } from '../middleware/auth.js';
import { getAgentProfileForUser } from '../services/agentProfileService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isGmailConfigured } from '../utils/gmail.js';

const router = Router();

function parseScheduleTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadGmailProfile(userId) {
  const agentProfile = await getAgentProfileForUser(userId);

  if (!isGmailConfigured(agentProfile)) {
    throw new AppError('Gmail is not configured', 400, 'GMAIL_NOT_CONFIGURED');
  }

  return agentProfile;
}

router.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const agentProfile = await getAgentProfileForUser(req.user._id);
  res.json({
    configured: isGmailConfigured(agentProfile),
    sender: process.env.GMAIL_SENDER_EMAIL || agentProfile?.gmailConnection?.connectedEmail || null,
  });
}));

router.post('/send', requireAuth, asyncHandler(async (req, res) => {
  const { body, subject, to } = req.body;
  if (!to || !subject || !body) {
    throw new AppError('to, subject, and body are required', 400, 'INVALID_EMAIL_PAYLOAD');
  }

  const agentProfile = await loadGmailProfile(req.user._id);
  const result = await sendAgentEmail({ to, subject, body, agentProfile });
  const emailAction = await insertEmailAction({
    userId: req.user.id,
    toEmail: to,
    subject,
    body,
    status: 'sent',
    providerMessageId: result.id,
    threadId: result.threadId,
    source: 'api',
    sentAt: new Date().toISOString(),
  });

  res.json({ success: true, sender: result.from, messageId: result.id, threadId: result.threadId, emailAction });
}));

router.post('/schedule', requireAuth, asyncHandler(async (req, res) => {
  const { body, scheduledFor, subject, to } = req.body;
  if (!to || !subject || !body || !scheduledFor) {
    throw new AppError('to, subject, body, and scheduledFor are required', 400, 'INVALID_EMAIL_PAYLOAD');
  }

  await loadGmailProfile(req.user._id);
  const scheduledDate = parseScheduleTime(scheduledFor);

  if (!scheduledDate) {
    throw new AppError('scheduledFor must be a valid date', 400, 'INVALID_SCHEDULE_DATE');
  }

  if (scheduledDate.getTime() <= Date.now() + 30 * 1000) {
    throw new AppError('scheduledFor must be at least 30 seconds in the future', 400, 'SCHEDULE_TOO_SOON');
  }

  const emailAction = await insertEmailAction({
    userId: req.user.id,
    toEmail: to,
    subject,
    body,
    status: 'scheduled',
    source: 'api',
    scheduledFor: scheduledDate.toISOString(),
  });

  res.json({ success: true, emailAction });
}));

export default router;
