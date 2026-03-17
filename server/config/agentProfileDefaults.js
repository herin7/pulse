export const DEFAULT_AGENT_PROFILE = {
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

export const UPCOMING_AGENT_PRESETS = [
  { name: 'Sales Agent', status: 'coming_soon' },
  { name: 'Research Agent', status: 'coming_soon' },
  { name: 'Ops Agent', status: 'coming_soon' },
];

export const AGENT_SETUP_SECTIONS = [
  'Agent Identity',
  'Founder Context',
  'Email Setup',
  'BYOK',
  'Automation Preferences',
  'Agent Fleet',
];
