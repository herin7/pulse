import jwt from 'jsonwebtoken';

import { AppError } from './AppError.js';

const AUTH_COOKIE_NAME = 'pulse_token';
const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || 'pulse-dev-jwt-secret';

export function createAuthToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}

export function getTokenFromRequest(req) {
  const bearerToken = req.headers.authorization?.split(' ')[1];
  if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
    return bearerToken;
  }

  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
  return match?.[1] || null;
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
