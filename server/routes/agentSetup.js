import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AgentProfile } from '../db/models/AgentProfile.js';
import {
  createGmailAuthUrl,
  exchangeGmailCode,
  isGmailConfigured,
  isGmailOAuthConfigured,
  isGlobalGmailConfigured,
  verifyGmailOAuthState,
} from '../utils/gmail.js';

const router = Router();

const DEFAULT_PROFILE = {
  identity: {
    agentName: 'Pulse',
    role: 'AI Cofounder',
    tone: 'Direct, concise, execution-first',
    voiceStyle: 'Fast, grounded, operator energy',
    signature: 'Best,\nPulse',
    responsibility: 'Keep the founder focused, accountable, and moving.',
  },
  emails: {
    userEmail: '',
    agentEmail: '',
    replyToEmail: '',
    approvalMode: 'approve_before_send',
  },
  gmailConnection: {
    connectedEmail: '',
    refreshToken: '',
    scope: '',
    connectedAt: null,
  },
  byok: {
    activeModel: 'gemini',
    geminiKey: '',
    groqKey: '',
    sarvamKey: '',
    anthropicKey: '',
  },
  context: {
    founderName: '',
    startupName: '',
    productName: '',
    website: '',
    goals: '',
    constraints: '',
    operatingInstructions: '',
    resetNotes: '',
  },
  automation: {
    canScheduleEmails: true,
    canFollowUpAutonomously: false,
    quietHours: '23:00-07:00',
    reminderIntensity: 'firm',
    escalationBehavior: 'Nudge once, then escalate clearly.',
  },
};

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeProfile(input = {}) {
  return {
    identity: {
      agentName: cleanString(input.identity?.agentName, DEFAULT_PROFILE.identity.agentName),
      role: cleanString(input.identity?.role, DEFAULT_PROFILE.identity.role),
      tone: cleanString(input.identity?.tone, DEFAULT_PROFILE.identity.tone),
      voiceStyle: cleanString(input.identity?.voiceStyle, DEFAULT_PROFILE.identity.voiceStyle),
      signature: cleanString(input.identity?.signature, DEFAULT_PROFILE.identity.signature),
      responsibility: cleanString(input.identity?.responsibility, DEFAULT_PROFILE.identity.responsibility),
    },
    emails: {
      userEmail: cleanString(input.emails?.userEmail),
      agentEmail: cleanString(input.emails?.agentEmail),
      replyToEmail: cleanString(input.emails?.replyToEmail),
      approvalMode: ['draft_only', 'approve_before_send', 'auto_send_low_risk'].includes(input.emails?.approvalMode)
        ? input.emails.approvalMode
        : DEFAULT_PROFILE.emails.approvalMode,
    },
    byok: {
      activeModel: ['gemini', 'groq_llama', 'sarvam', 'claude'].includes(input.byok?.activeModel)
        ? input.byok.activeModel
        : DEFAULT_PROFILE.byok.activeModel,
      geminiKey: cleanString(input.byok?.geminiKey),
      groqKey: cleanString(input.byok?.groqKey),
      sarvamKey: cleanString(input.byok?.sarvamKey),
      anthropicKey: cleanString(input.byok?.anthropicKey),
    },
    context: {
      founderName: cleanString(input.context?.founderName),
      startupName: cleanString(input.context?.startupName),
      productName: cleanString(input.context?.productName),
      website: cleanString(input.context?.website),
      goals: cleanString(input.context?.goals),
      constraints: cleanString(input.context?.constraints),
      operatingInstructions: cleanString(input.context?.operatingInstructions),
      resetNotes: cleanString(input.context?.resetNotes),
    },
    automation: {
      canScheduleEmails: typeof input.automation?.canScheduleEmails === 'boolean'
        ? input.automation.canScheduleEmails
        : DEFAULT_PROFILE.automation.canScheduleEmails,
      canFollowUpAutonomously: typeof input.automation?.canFollowUpAutonomously === 'boolean'
        ? input.automation.canFollowUpAutonomously
        : DEFAULT_PROFILE.automation.canFollowUpAutonomously,
      quietHours: cleanString(input.automation?.quietHours, DEFAULT_PROFILE.automation.quietHours),
      reminderIntensity: cleanString(input.automation?.reminderIntensity, DEFAULT_PROFILE.automation.reminderIntensity),
      escalationBehavior: cleanString(input.automation?.escalationBehavior, DEFAULT_PROFILE.automation.escalationBehavior),
    },
  };
}

function buildDebug(profile) {
  return {
    lastUpdatedAt: profile?.updatedAt || null,
    gmailConfigured: isGmailConfigured(profile),
    gmailOAuthReady: isGmailOAuthConfigured(),
    globalGmailFallback: isGlobalGmailConfigured(),
    gmailConnectedEmail: profile?.gmailConnection?.connectedEmail || '',
    byokConfigured: {
      gemini: Boolean(profile?.byok?.geminiKey),
      groq: Boolean(profile?.byok?.groqKey),
      sarvam: Boolean(profile?.byok?.sarvamKey),
      anthropic: Boolean(profile?.byok?.anthropicKey),
    },
    emailIdentityReady: Boolean(profile?.emails?.userEmail && profile?.emails?.agentEmail),
    contextReady: Boolean(profile?.context?.startupName || profile?.context?.operatingInstructions || profile?.context?.goals),
  };
}

export async function getAgentProfileForUser(userId) {
  return AgentProfile.findOne({ userId }).lean();
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const existing = await AgentProfile.findOne({ userId: req.user._id }).lean();
    const profile = existing || { ...DEFAULT_PROFILE };

    res.json({
      success: true,
      profile,
      debug: buildDebug(existing),
      upcomingAgents: [
        { name: 'Sales Agent', status: 'coming_soon' },
        { name: 'Research Agent', status: 'coming_soon' },
        { name: 'Ops Agent', status: 'coming_soon' },
      ],
      schema: {
        sections: ['Agent Identity', 'Founder Context', 'Email Setup', 'BYOK', 'Automation Preferences', 'Agent Fleet'],
      },
    });
  } catch (error) {
    console.error('[AgentSetup] Fetch failed:', error);
    res.status(500).json({ error: 'Failed to load agent setup' });
  }
});

router.get('/gmail/connect-url', requireAuth, async (req, res) => {
  try {
    if (!isGmailOAuthConfigured()) {
      return res.status(400).json({ error: 'Gmail OAuth is not configured on the server' });
    }

    const authUrl = createGmailAuthUrl({ userId: req.user._id.toString() });
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('[AgentSetup] Gmail connect URL failed:', error);
    res.status(500).json({ error: 'Failed to start Gmail connection' });
  }
});

router.get('/gmail/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.send(`<script>
      if (window.opener) {
        window.opener.postMessage({ type: 'pulse:gmail-error', error: ${JSON.stringify(String(error))} }, '*');
      }
      window.close();
    </script>`);
  }

  try {
    if (!code || !state) {
      throw new Error('Missing Google OAuth response data');
    }

    const decoded = verifyGmailOAuthState(String(state));
    const result = await exchangeGmailCode(String(code));

    const saved = await AgentProfile.findOneAndUpdate(
      { userId: decoded.userId },
      {
        userId: decoded.userId,
        $set: {
          'gmailConnection.connectedEmail': result.email,
          'gmailConnection.refreshToken': result.refreshToken,
          'gmailConnection.scope': result.scope,
          'gmailConnection.connectedAt': new Date(),
          'emails.agentEmail': result.email,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const payload = {
      type: 'pulse:gmail-connected',
      email: saved?.gmailConnection?.connectedEmail || result.email,
    };

    return res.send(`<script>
      if (window.opener) {
        window.opener.postMessage(${JSON.stringify(payload)}, '*');
      }
      window.close();
    </script>`);
  } catch (callbackError) {
    console.error('[AgentSetup] Gmail callback failed:', callbackError);
    return res.send(`<script>
      if (window.opener) {
        window.opener.postMessage({ type: 'pulse:gmail-error', error: ${JSON.stringify(callbackError.message)} }, '*');
      }
      window.close();
    </script>`);
  }
});

router.post('/gmail/disconnect', requireAuth, async (req, res) => {
  try {
    const saved = await AgentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          gmailConnection: DEFAULT_PROFILE.gmailConnection,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      profile: saved,
      debug: buildDebug(saved),
    });
  } catch (error) {
    console.error('[AgentSetup] Gmail disconnect failed:', error);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const profile = sanitizeProfile(req.body.profile);

    const saved = await AgentProfile.findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, ...profile },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      profile: saved,
      debug: buildDebug(saved),
    });
  } catch (error) {
    console.error('[AgentSetup] Save failed:', error);
    res.status(500).json({ error: 'Failed to save agent setup' });
  }
});

router.post('/reset', requireAuth, async (req, res) => {
  try {
    const resetScope = cleanString(req.body?.scope, 'all');

    if (resetScope === 'context') {
      const saved = await AgentProfile.findOneAndUpdate(
        { userId: req.user._id },
        { $set: { context: DEFAULT_PROFILE.context } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      return res.json({
        success: true,
        profile: saved,
        debug: buildDebug(saved),
      });
    }

    const saved = await AgentProfile.findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, ...DEFAULT_PROFILE },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      profile: saved,
      debug: buildDebug(saved),
    });
  } catch (error) {
    console.error('[AgentSetup] Reset failed:', error);
    res.status(500).json({ error: 'Failed to reset agent setup' });
  }
});

export default router;
