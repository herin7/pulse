import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];
const EMAIL_ADDRESS_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing Gmail configuration: ${name}`);
  }
  return value;
}

function createBaseOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv('GMAIL_CLIENT_ID'),
    getRequiredEnv('GMAIL_CLIENT_SECRET'),
    getRequiredEnv('GMAIL_REDIRECT_URI')
  );
}

export function isGmailOAuthConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REDIRECT_URI
  );
}

export function isGlobalGmailConfigured() {
  return Boolean(
    isGmailOAuthConfigured() &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

export function isGmailConfigured(agentProfile = null) {
  return Boolean(
    (agentProfile?.gmailConnection?.refreshToken && agentProfile?.gmailConnection?.connectedEmail && isGmailOAuthConfigured())
    || isGlobalGmailConfigured()
  );
}

function sanitizeEmailAddress(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return EMAIL_ADDRESS_PATTERN.test(trimmed) ? trimmed : null;
}

async function getAuthenticatedGmailAddress(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return sanitizeEmailAddress(profile.data.emailAddress || '');
}

function buildRawMessage({ from, replyTo, to, subject, body }) {
  const mimeLines = [
    `From: Pulse <${from}>`,
    `To: ${to}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ];

  if (replyTo && replyTo !== from) {
    mimeLines.splice(1, 0, `Reply-To: ${replyTo}`);
  }

  return Buffer.from(mimeLines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function resolveSender(agentProfile = null) {
  if (isGlobalGmailConfigured()) {
    const auth = createOAuthClientWithRefreshToken(process.env.GMAIL_REFRESH_TOKEN);
    const authenticatedEmail = await getAuthenticatedGmailAddress(auth);
    const envSender = sanitizeEmailAddress(process.env.GMAIL_SENDER_EMAIL);
    const from = envSender || authenticatedEmail;

    if (!from) {
      throw new Error('Global Gmail sender email is invalid');
    }

    return {
      auth,
      from,
      replyTo: from,
      source: 'global_env',
    };
  }

  if (agentProfile?.gmailConnection?.refreshToken && agentProfile?.gmailConnection?.connectedEmail && isGmailOAuthConfigured()) {
    const auth = createOAuthClientWithRefreshToken(agentProfile.gmailConnection.refreshToken);
    const connectedEmail = sanitizeEmailAddress(agentProfile.gmailConnection.connectedEmail) || await getAuthenticatedGmailAddress(auth);
    const replyTo = sanitizeEmailAddress(agentProfile.emails?.replyToEmail) || connectedEmail;

    if (!connectedEmail) {
      throw new Error('Connected Gmail sender email is invalid');
    }

    return {
      auth,
      from: connectedEmail,
      replyTo,
      source: 'user_connection',
    };
  }

  throw new Error('Gmail is not configured for this user');
}

function createOAuthClientWithRefreshToken(refreshToken) {
  const oauth2Client = createBaseOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function signState(payload) {
  const secret = process.env.JWT_SECRET || 'pulse-dev-jwt-secret';
  return jwt.sign(payload, secret, { expiresIn: '10m' });
}

export function verifyGmailOAuthState(state) {
  const secret = process.env.JWT_SECRET || 'pulse-dev-jwt-secret';
  return jwt.verify(state, secret);
}

export function createGmailAuthUrl({ userId }) {
  if (!isGmailOAuthConfigured()) {
    throw new Error('Gmail OAuth is not configured');
  }

  const oauth2Client = createBaseOAuthClient();
  const state = signState({ userId });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeGmailCode(code) {
  const oauth2Client = createBaseOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Reconnect and grant consent again.');
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profile = await oauth2.userinfo.get();

  return {
    refreshToken: tokens.refresh_token,
    scope: tokens.scope || '',
    email: profile.data.email || '',
  };
}

export async function sendGmailMessage({ to, subject, body, agentProfile = null }) {
  const sender = await resolveSender(agentProfile);
  const gmail = google.gmail({ version: 'v1', auth: sender.auth });
  const raw = buildRawMessage({
    from: sender.from,
    replyTo: sender.replyTo,
    to,
    subject,
    body,
  });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId || null,
    from: sender.from,
    source: sender.source,
  };
}
