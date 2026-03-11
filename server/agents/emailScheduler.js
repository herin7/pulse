import {
  claimDueScheduledEmailActions,
  markEmailActionFailed,
  markEmailActionSent,
} from '../db/emailActions.js';
import { isGmailConfigured, sendGmailMessage } from '../utils/gmail.js';
import { AgentProfile } from '../db/models/AgentProfile.js';

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

        const result = await sendGmailMessage({
          to: email.toEmail,
          subject: email.subject,
          body: email.body,
          agentProfile,
        });

        await markEmailActionSent({
          id: email.id,
          providerMessageId: result.id,
          threadId: result.threadId,
        });
      } catch (error) {
        console.error(`[EmailScheduler] Failed to send scheduled email ${email.id}:`, error);
        await markEmailActionFailed(email.id);
      }
    }
  } finally {
    isRunning = false;
  }
}
