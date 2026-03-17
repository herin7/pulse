import { google } from 'googleapis';

import {
  isGlobalGmailConfigured,
  sanitizeEmailAddress,
} from './gmailConfig.js';
import { createOauthClientWithRefreshToken } from './gmailOAuth.js';

async function getAuthenticatedGmailAddress(auth) {
  const gmailApi = google.gmail({ version: 'v1', auth });
  const profile = await gmailApi.users.getProfile({ userId: 'me' });
  return sanitizeEmailAddress(profile.data.emailAddress || '');
}

function buildRawMessage({ from, replyTo, to, subject, body }) {
  const lines = [
    `From: Pulse <${from}>`,
    `To: ${to}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ];

  if (replyTo && replyTo !== from) {
    lines.splice(1, 0, `Reply-To: ${replyTo}`);
  }

  return Buffer.from(lines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function resolveSender(agentProfile) {
  if (isGlobalGmailConfigured()) {
    const auth = createOauthClientWithRefreshToken(process.env.GMAIL_REFRESH_TOKEN);
    const authenticatedEmail = await getAuthenticatedGmailAddress(auth);
    const configuredEmail = sanitizeEmailAddress(process.env.GMAIL_SENDER_EMAIL);
    const from = configuredEmail || authenticatedEmail;

    if (!from) {
      throw new Error('Global Gmail sender email is invalid');
    }

    return { auth, from, replyTo: from, source: 'global_env' };
  }

  const refreshToken = agentProfile?.gmailConnection?.refreshToken;
  const connectedEmail = agentProfile?.gmailConnection?.connectedEmail;

  if (!refreshToken || !connectedEmail) {
    throw new Error('Gmail is not configured for this user');
  }

  const auth = createOauthClientWithRefreshToken(refreshToken);
  const from = sanitizeEmailAddress(connectedEmail) || await getAuthenticatedGmailAddress(auth);
  const replyTo = sanitizeEmailAddress(agentProfile?.emails?.replyToEmail) || from;

  if (!from) {
    throw new Error('Connected Gmail sender email is invalid');
  }

  return { auth, from, replyTo, source: 'user_connection' };
}

export async function sendGmailMessage({ to, subject, body, agentProfile = null }) {
  const sender = await resolveSender(agentProfile);
  const gmailApi = google.gmail({ version: 'v1', auth: sender.auth });
  const response = await gmailApi.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: buildRawMessage({
        from: sender.from,
        replyTo: sender.replyTo,
        to,
        subject,
        body,
      }),
    },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId || null,
    from: sender.from,
    source: sender.source,
  };
}
