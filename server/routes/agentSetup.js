import { Router } from 'express';

import { AGENT_SETUP_SECTIONS, DEFAULT_AGENT_PROFILE, UPCOMING_AGENT_PRESETS } from '../config/agentProfileDefaults.js';
import { requireAuth } from '../middleware/auth.js';
import {
  buildAgentProfileDebug,
  disconnectAgentGmail,
  getAgentProfileForUser,
  resetAgentProfile,
  resetAgentProfileContext,
  sanitizeAgentProfile,
  saveAgentProfile,
  updateAgentProfile,
} from '../services/agentProfileService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createGmailAuthUrl, exchangeGmailCode, isGmailOAuthConfigured, verifyGmailOauthState } from '../utils/gmail.js';
import { buildOauthErrorPopup, buildOauthSuccessPopup } from '../utils/oauthPopup.js';

const router = Router();

function buildSetupPayload(profile) {
  return {
    success: true,
    profile: profile || { ...DEFAULT_AGENT_PROFILE },
    debug: buildAgentProfileDebug(profile),
    upcomingAgents: UPCOMING_AGENT_PRESETS,
    schema: { sections: AGENT_SETUP_SECTIONS },
  };
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const profile = await getAgentProfileForUser(req.user._id);
  res.json(buildSetupPayload(profile));
}));

router.get('/gmail/connect-url', requireAuth, asyncHandler(async (req, res) => {
  if (!isGmailOAuthConfigured()) {
    throw new AppError('Gmail OAuth is not configured on the server', 400, 'GMAIL_OAUTH_MISSING');
  }

  res.json({
    success: true,
    authUrl: createGmailAuthUrl({ userId: req.user._id.toString() }),
  });
}));

router.get('/gmail/callback', asyncHandler(async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(buildOauthErrorPopup(error));
  }

  if (!code || !state) {
    return res.send(buildOauthErrorPopup('Missing Google OAuth response data'));
  }

  try {
    const decoded = verifyGmailOauthState(String(state));
    const result = await exchangeGmailCode(String(code));
    const saved = await updateAgentProfile(decoded.userId, {
      $set: {
        'emails.agentEmail': result.email,
        'gmailConnection.connectedAt': new Date(),
        'gmailConnection.connectedEmail': result.email,
        'gmailConnection.refreshToken': result.refreshToken,
        'gmailConnection.scope': result.scope,
      },
      $setOnInsert: {
        userId: decoded.userId,
      },
    });

    res.send(buildOauthSuccessPopup({
      type: 'pulse:gmail-connected',
      email: saved?.gmailConnection?.connectedEmail || result.email,
    }));
  } catch (callbackError) {
    res.send(buildOauthErrorPopup(callbackError.message));
  }
}));

router.post('/gmail/disconnect', requireAuth, asyncHandler(async (req, res) => {
  const profile = await disconnectAgentGmail(req.user._id);
  res.json({ success: true, profile, debug: buildAgentProfileDebug(profile) });
}));

router.put('/', requireAuth, asyncHandler(async (req, res) => {
  const profile = await saveAgentProfile(req.user._id, sanitizeAgentProfile(req.body.profile));
  res.json({ success: true, profile, debug: buildAgentProfileDebug(profile) });
}));

router.post('/reset', requireAuth, asyncHandler(async (req, res) => {
  const scope = typeof req.body?.scope === 'string' ? req.body.scope.trim() : 'all';
  const profile = scope === 'context'
    ? await resetAgentProfileContext(req.user._id)
    : await resetAgentProfile(req.user._id);

  res.json({ success: true, profile, debug: buildAgentProfileDebug(profile) });
}));

export { getAgentProfileForUser } from '../services/agentProfileService.js';

export default router;
