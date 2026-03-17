import { DEFAULT_AGENT_PROFILE } from '../config/agentProfileDefaults.js';
import { AgentProfile } from '../db/models/AgentProfile.js';
import { isGmailConfigured, isGmailOAuthConfigured, isGlobalGmailConfigured } from '../utils/gmail.js';

const ALLOWED_MODELS = new Set(['gemini', 'groq_llama', 'sarvam', 'claude']);
const ALLOWED_APPROVAL_MODES = new Set(['draft_only', 'approve_before_send', 'auto_send_low_risk']);

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeFlag(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeAgentProfile(input = {}) {
  return {
    identity: {
      agentName: cleanString(input.identity?.agentName, DEFAULT_AGENT_PROFILE.identity.agentName),
      role: cleanString(input.identity?.role, DEFAULT_AGENT_PROFILE.identity.role),
      tone: cleanString(input.identity?.tone, DEFAULT_AGENT_PROFILE.identity.tone),
      voiceStyle: cleanString(input.identity?.voiceStyle, DEFAULT_AGENT_PROFILE.identity.voiceStyle),
      signature: cleanString(input.identity?.signature, DEFAULT_AGENT_PROFILE.identity.signature),
      responsibility: cleanString(input.identity?.responsibility, DEFAULT_AGENT_PROFILE.identity.responsibility),
    },
    emails: {
      userEmail: cleanString(input.emails?.userEmail),
      agentEmail: cleanString(input.emails?.agentEmail),
      replyToEmail: cleanString(input.emails?.replyToEmail),
      approvalMode: ALLOWED_APPROVAL_MODES.has(input.emails?.approvalMode)
        ? input.emails.approvalMode
        : DEFAULT_AGENT_PROFILE.emails.approvalMode,
    },
    gmailConnection: DEFAULT_AGENT_PROFILE.gmailConnection,
    byok: {
      activeModel: ALLOWED_MODELS.has(input.byok?.activeModel)
        ? input.byok.activeModel
        : DEFAULT_AGENT_PROFILE.byok.activeModel,
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
      canScheduleEmails: normalizeFlag(input.automation?.canScheduleEmails, DEFAULT_AGENT_PROFILE.automation.canScheduleEmails),
      canFollowUpAutonomously: normalizeFlag(input.automation?.canFollowUpAutonomously, DEFAULT_AGENT_PROFILE.automation.canFollowUpAutonomously),
      quietHours: cleanString(input.automation?.quietHours, DEFAULT_AGENT_PROFILE.automation.quietHours),
      reminderIntensity: cleanString(input.automation?.reminderIntensity, DEFAULT_AGENT_PROFILE.automation.reminderIntensity),
      escalationBehavior: cleanString(input.automation?.escalationBehavior, DEFAULT_AGENT_PROFILE.automation.escalationBehavior),
    },
  };
}

export function buildAgentProfileDebug(profile) {
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

export async function saveAgentProfile(userId, profile) {
  const existing = await AgentProfile.findOne({ userId }).lean();
  return AgentProfile.findOneAndUpdate(
    { userId },
    {
      userId,
      ...profile,
      gmailConnection: existing?.gmailConnection || DEFAULT_AGENT_PROFILE.gmailConnection,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function updateAgentProfile(userId, update) {
  return AgentProfile.findOneAndUpdate(
    { userId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function disconnectAgentGmail(userId) {
  return updateAgentProfile(userId, {
    $set: {
      gmailConnection: DEFAULT_AGENT_PROFILE.gmailConnection,
    },
  });
}

export async function resetAgentProfile(userId) {
  return saveAgentProfile(userId, DEFAULT_AGENT_PROFILE);
}

export async function resetAgentProfileContext(userId) {
  return updateAgentProfile(userId, {
    $set: {
      context: DEFAULT_AGENT_PROFILE.context,
    },
  });
}
