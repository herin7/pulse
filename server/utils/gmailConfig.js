export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const EMAIL_ADDRESS_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function getRequiredGmailEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing Gmail configuration: ${name}`);
  }
  return value;
}

export function sanitizeEmailAddress(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return EMAIL_ADDRESS_PATTERN.test(normalized) ? normalized : null;
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
    process.env.GMAIL_ACCESS_TOKEN ||
    (isGmailOAuthConfigured() && process.env.GMAIL_REFRESH_TOKEN)
  );
}

export function isGmailConfigured(agentProfile = null) {
  return Boolean(
    isGlobalGmailConfigured() ||
    (
      isGmailOAuthConfigured() &&
      agentProfile?.gmailConnection?.refreshToken &&
      agentProfile?.gmailConnection?.connectedEmail
    )
  );
}
