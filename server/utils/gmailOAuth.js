import jwt from 'jsonwebtoken';

import { google } from 'googleapis';

import {
  GMAIL_SCOPES,
  getRequiredGmailEnv,
  isGmailOAuthConfigured,
} from './gmailConfig.js';

const GMAIL_JWT_SECRET = process.env.JWT_SECRET || 'pulse-dev-jwt-secret';

function createBaseOauthClient() {
  return new google.auth.OAuth2(
    getRequiredGmailEnv('GMAIL_CLIENT_ID'),
    getRequiredGmailEnv('GMAIL_CLIENT_SECRET'),
    getRequiredGmailEnv('GMAIL_REDIRECT_URI')
  );
}

function signOauthState(payload) {
  return jwt.sign(payload, GMAIL_JWT_SECRET, { expiresIn: '10m' });
}

export function createOauthClientWithRefreshToken(refreshToken) {
  const oauthClient = createBaseOauthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });
  return oauthClient;
}

export function verifyGmailOauthState(state) {
  return jwt.verify(state, GMAIL_JWT_SECRET);
}

export function createGmailAuthUrl({ userId }) {
  if (!isGmailOAuthConfigured()) {
    throw new Error('Gmail OAuth is not configured');
  }

  const oauthClient = createBaseOauthClient();
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: signOauthState({ userId }),
  });
}

export async function exchangeGmailCode(code) {
  const oauthClient = createBaseOauthClient();
  const { tokens } = await oauthClient.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Reconnect and grant consent again.');
  }

  oauthClient.setCredentials(tokens);
  const oauthApi = google.oauth2({ version: 'v2', auth: oauthClient });
  const profile = await oauthApi.userinfo.get();

  return {
    email: profile.data.email || '',
    refreshToken: tokens.refresh_token,
    scope: tokens.scope || '',
  };
}
