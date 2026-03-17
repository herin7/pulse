import { AgentProfile } from '../db/models/AgentProfile.js';
import { sendAgentEmail } from './emailAgent.js';
import { claimDueScheduledEmailActions, markEmailActionFailed, markEmailActionSent } from '../db/emailActions.js';
import { isGmailConfigured } from '../utils/gmail.js';
import { logger } from '../utils/logger.js';

let isRunning = false;

export async function runScheduledEmailQueue() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const dueEmails = await claimDueScheduledEmailActions();

    for (const email of dueEmails) {
      try {
        const agentProfile = await AgentProfile.findOne({ userId: email.userId }).lean();
        if (!isGmailConfigured(agentProfile)) {
          throw new Error('No Gmail connection available for this user');
        }

        const result = await sendAgentEmail({ to: email.toEmail, subject: email.subject, body: email.body, agentProfile });
        await markEmailActionSent({ id: email.id, providerMessageId: result.id, threadId: result.threadId });
      } catch (error) {
        logger.error('Scheduled email send failed', { emailActionId: email.id, error: error.message });
        await markEmailActionFailed(email.id);
      }
    }
  } finally {
    isRunning = false;
  }
}
