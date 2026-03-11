import mongoose from 'mongoose';

const AgentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  identity: {
    agentName: { type: String, default: 'Pulse' },
    role: { type: String, default: 'AI Cofounder' },
    tone: { type: String, default: 'Direct, concise, execution-first' },
    voiceStyle: { type: String, default: 'Fast, grounded, operator energy' },
    signature: { type: String, default: 'Best,\nPulse' },
    responsibility: { type: String, default: 'Keep the founder focused, accountable, and moving.' },
  },
  emails: {
    userEmail: { type: String, default: '' },
    agentEmail: { type: String, default: '' },
    replyToEmail: { type: String, default: '' },
    approvalMode: {
      type: String,
      enum: ['draft_only', 'approve_before_send', 'auto_send_low_risk'],
      default: 'approve_before_send',
    },
  },
  gmailConnection: {
    connectedEmail: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    scope: { type: String, default: '' },
    connectedAt: { type: Date, default: null },
  },
  byok: {
    activeModel: { type: String, default: 'gemini' },
    geminiKey: { type: String, default: '' },
    groqKey: { type: String, default: '' },
    sarvamKey: { type: String, default: '' },
    anthropicKey: { type: String, default: '' },
  },
  context: {
    founderName: { type: String, default: '' },
    startupName: { type: String, default: '' },
    productName: { type: String, default: '' },
    website: { type: String, default: '' },
    goals: { type: String, default: '' },
    constraints: { type: String, default: '' },
    operatingInstructions: { type: String, default: '' },
    resetNotes: { type: String, default: '' },
  },
  automation: {
    canScheduleEmails: { type: Boolean, default: true },
    canFollowUpAutonomously: { type: Boolean, default: false },
    quietHours: { type: String, default: '23:00-07:00' },
    reminderIntensity: { type: String, default: 'firm' },
    escalationBehavior: { type: String, default: 'Nudge once, then escalate clearly.' },
  },
}, {
  timestamps: true,
});

export const AgentProfile = mongoose.models.AgentProfile || mongoose.model('AgentProfile', AgentProfileSchema);
