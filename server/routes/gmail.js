import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { insertEmailAction } from '../db/emailActions.js';
import { isGmailConfigured, sendGmailMessage } from '../utils/gmail.js';
import { getAgentProfileForUser } from './agentSetup.js';

const router = Router();

function normalizeScheduleTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

router.get('/status', requireAuth, async (req, res) => {
  const agentProfile = await getAgentProfileForUser(req.user._id);
  res.json({
    configured: isGmailConfigured(agentProfile),
    sender: process.env.GMAIL_SENDER_EMAIL || agentProfile?.gmailConnection?.connectedEmail || null,
  });
});

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const agentProfile = await getAgentProfileForUser(req.user._id);

    if (!isGmailConfigured(agentProfile)) {
      return res.status(400).json({ error: 'Gmail is not configured' });
    }

    const result = await sendGmailMessage({ to, subject, body, agentProfile });
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

    res.json({
      success: true,
      sender: result.from,
      messageId: result.id,
      threadId: result.threadId,
      emailAction,
    });
  } catch (error) {
    console.error('Gmail send failed:', error);
    res.status(500).json({ error: 'Failed to send Gmail message' });
  }
});

router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { to, subject, body, scheduledFor } = req.body;

    if (!to || !subject || !body || !scheduledFor) {
      return res.status(400).json({ error: 'to, subject, body, and scheduledFor are required' });
    }

    const agentProfile = await getAgentProfileForUser(req.user._id);

    if (!isGmailConfigured(agentProfile)) {
      return res.status(400).json({ error: 'Gmail is not configured' });
    }

    const scheduledDate = normalizeScheduleTime(scheduledFor);
    if (!scheduledDate) {
      return res.status(400).json({ error: 'scheduledFor must be a valid date' });
    }

    if (scheduledDate.getTime() <= Date.now() + 30 * 1000) {
      return res.status(400).json({ error: 'scheduledFor must be at least 30 seconds in the future' });
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

    res.json({
      success: true,
      emailAction,
    });
  } catch (error) {
    console.error('Gmail schedule failed:', error);
    res.status(500).json({ error: 'Failed to schedule Gmail message' });
  }
});

export default router;
