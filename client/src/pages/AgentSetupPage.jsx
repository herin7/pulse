import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

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

function SectionCard({ eyebrow, title, description, children, accent = 'sky' }) {
  const accentClasses = {
    sky: 'from-sky-100 via-white to-cyan-100',
    amber: 'from-amber-100 via-white to-orange-100',
    emerald: 'from-emerald-100 via-white to-teal-100',
    slate: 'from-slate-100 via-white to-zinc-100',
  };

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/88 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className={`border-b border-slate-100 bg-gradient-to-br px-6 py-5 ${accentClasses[accent] || accentClasses.sky}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-sky-400 focus:bg-white ${props.className || ''}`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-all focus:border-sky-400 focus:bg-white ${props.className || ''}`}
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${checked ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function MaskedStatus({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value ? `Configured (${value.length} chars)` : 'Not set'}</p>
    </div>
  );
}

export default function AgentSetupPage() {
  const user = useSelector((state) => state.app.user);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [debug, setDebug] = useState(null);
  const [upcomingAgents, setUpcomingAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const token = localStorage.getItem('pulse_token');

  const updateField = useCallback((section, field, value) => {
    setProfile((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }, []);

  const loadProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agent-setup', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load setup');

      setProfile(data.profile || DEFAULT_PROFILE);
      setDebug(data.debug || null);
      setUpcomingAgents(data.upcomingAgents || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch('/api/agent-setup', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save setup');

      setProfile(data.profile || profile);
      setDebug(data.debug || null);
      setStatus('Agent setup saved');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGmail = async () => {
    setGmailBusy(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch('/api/agent-setup/gmail/connect-url', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Gmail connection');

      const popup = window.open(data.authUrl, 'pulse-gmail-connect', 'width=540,height=760');
      if (!popup) {
        throw new Error('Popup was blocked. Allow popups and try again.');
      }

      await new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          window.clearInterval(closeCheck);
        };

        const handleMessage = (event) => {
          const payload = event.data || {};
          if (payload.type === 'pulse:gmail-connected') {
            settled = true;
            cleanup();
            setStatus(`Gmail connected: ${payload.email}`);
            resolve();
          }
          if (payload.type === 'pulse:gmail-error') {
            settled = true;
            cleanup();
            reject(new Error(payload.error || 'Gmail connection failed'));
          }
        };

        const closeCheck = window.setInterval(() => {
          if (popup.closed && !settled) {
            cleanup();
            reject(new Error('Gmail connection was closed before completion'));
          }
        }, 400);

        window.addEventListener('message', handleMessage);
      });

      await loadProfile();
    } catch (connectError) {
      setError(connectError.message);
    } finally {
      setGmailBusy(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setGmailBusy(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch('/api/agent-setup/gmail/disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect Gmail');

      setProfile(data.profile || DEFAULT_PROFILE);
      setDebug(data.debug || null);
      setStatus('Gmail disconnected');
    } catch (disconnectError) {
      setError(disconnectError.message);
    } finally {
      setGmailBusy(false);
    }
  };

  const handleReset = async (scope = 'all') => {
    setSaving(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch('/api/agent-setup/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset setup');

      setProfile(data.profile || DEFAULT_PROFILE);
      setDebug(data.debug || null);
      setStatus(scope === 'context' ? 'Agent context reset' : 'Full agent setup reset');
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setSaving(false);
    }
  };

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile.identity.agentName && profile.identity.role),
      Boolean(profile.context.startupName || profile.context.productName),
      Boolean(profile.emails.userEmail && profile.emails.agentEmail),
      Boolean(profile.byok.geminiKey || profile.byok.groqKey || profile.byok.anthropicKey),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  if (!user) {
    return (
      <div className="min-h-screen px-4 pt-28">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white/90 p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent Setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to configure your agent.</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/90 px-8 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Primary Agent Setup</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Shape how Pulse thinks, speaks, and acts.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Configure one primary agent now. The UI also previews a future agent fleet so founders can later run multiple specialized agents without relearning the product.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? 'Saving...' : 'Save setup'}
              </button>
              <button
                type="button"
                onClick={() => handleReset('context')}
                disabled={saving || loading}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Reset context
              </button>
              <button
                type="button"
                onClick={() => handleReset('all')}
                disabled={saving || loading}
                className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
              >
                Reset everything
              </button>
            </div>

            {(status || error) && (
              <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${error ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || status}
              </div>
            )}
          </div>

          <aside className="rounded-[2rem] border border-white/80 bg-slate-950 px-6 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Debug & Readiness</p>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-4xl font-semibold">{completion}%</p>
                <p className="mt-1 text-sm text-slate-300">Setup completion</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Gmail status</p>
                  <p className="mt-1 text-sm">
                    {debug?.gmailConnectedEmail
                      ? `Connected as ${debug.gmailConnectedEmail}`
                      : debug?.globalGmailFallback
                        ? 'Using server fallback sender'
                        : debug?.gmailOAuthReady
                          ? 'Ready to connect Gmail'
                          : 'Waiting for Gmail OAuth env setup'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Email identities</p>
                  <p className="mt-1 text-sm">{debug?.emailIdentityReady ? 'User and agent email saved' : 'Add both user and agent emails'}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Context</p>
                  <p className="mt-1 text-sm">{debug?.contextReady ? 'Agent context ready for chat' : 'Add startup context and operating instructions'}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Last updated</p>
                  <p className="mt-1 text-sm">{debug?.lastUpdatedAt ? new Date(debug.lastUpdatedAt).toLocaleString('en-IN') : 'Not saved yet'}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/90 px-8 py-10 text-sm text-slate-500 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            Loading agent setup...
          </div>
        ) : (
          <div className="grid gap-6">
            <SectionCard
              eyebrow="Section 01"
              title="Agent Identity"
              description="Define how the agent presents itself across chat, voice, and future outbound actions."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Agent Name">
                  <Input value={profile.identity.agentName} onChange={(e) => updateField('identity', 'agentName', e.target.value)} placeholder="Pulse" />
                </Field>
                <Field label="Agent Role">
                  <Input value={profile.identity.role} onChange={(e) => updateField('identity', 'role', e.target.value)} placeholder="AI Cofounder" />
                </Field>
                <Field label="Tone">
                  <Input value={profile.identity.tone} onChange={(e) => updateField('identity', 'tone', e.target.value)} placeholder="Direct, concise, execution-first" />
                </Field>
                <Field label="Voice Style">
                  <Input value={profile.identity.voiceStyle} onChange={(e) => updateField('identity', 'voiceStyle', e.target.value)} placeholder="Fast, grounded, operator energy" />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Signature">
                  <Textarea rows={4} value={profile.identity.signature} onChange={(e) => updateField('identity', 'signature', e.target.value)} />
                </Field>
                <Field label="Primary Responsibility">
                  <Textarea rows={4} value={profile.identity.responsibility} onChange={(e) => updateField('identity', 'responsibility', e.target.value)} placeholder="What this agent owns" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Section 02"
              title="Founder Context"
              description="This becomes working memory for chat and drafting. Use it to correct the agent, reset its assumptions, or give sharper operating context."
              accent="emerald"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Founder Name">
                  <Input value={profile.context.founderName} onChange={(e) => updateField('context', 'founderName', e.target.value)} placeholder="Herin Soni" />
                </Field>
                <Field label="Startup Name">
                  <Input value={profile.context.startupName} onChange={(e) => updateField('context', 'startupName', e.target.value)} placeholder="GitForMe" />
                </Field>
                <Field label="Product Name">
                  <Input value={profile.context.productName} onChange={(e) => updateField('context', 'productName', e.target.value)} placeholder="GitForMe" />
                </Field>
                <Field label="Website">
                  <Input value={profile.context.website} onChange={(e) => updateField('context', 'website', e.target.value)} placeholder="https://..." />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Goals">
                  <Textarea rows={5} value={profile.context.goals} onChange={(e) => updateField('context', 'goals', e.target.value)} placeholder="Top outcomes the agent should optimize for" />
                </Field>
                <Field label="Constraints">
                  <Textarea rows={5} value={profile.context.constraints} onChange={(e) => updateField('context', 'constraints', e.target.value)} placeholder="Budget, time, risk, or brand constraints" />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Operating Instructions">
                  <Textarea rows={6} value={profile.context.operatingInstructions} onChange={(e) => updateField('context', 'operatingInstructions', e.target.value)} placeholder="Tell the agent how to behave, what to prioritize, and what to avoid." />
                </Field>
                <Field label="Reset Notes">
                  <Textarea rows={6} value={profile.context.resetNotes} onChange={(e) => updateField('context', 'resetNotes', e.target.value)} placeholder="Any context that should be used when rebuilding the agent's assumptions." />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Section 03"
              title="Email Setup"
              description="Keep the founder and agent identities separate. This controls how outbound mail should be approved later."
              accent="amber"
            >
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Connected Sender</p>
                  <p className="mt-1 text-sm text-amber-950">
                    {debug?.gmailConnectedEmail || (debug?.globalGmailFallback ? 'Using server fallback Gmail sender' : 'No Gmail account connected yet')}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    The connected Gmail account is the real sender for drafted emails. Set your Google OAuth redirect to `/api/agent-setup/gmail/callback`.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={gmailBusy || !debug?.gmailOAuthReady}
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {gmailBusy ? 'Working...' : (debug?.gmailConnectedEmail ? 'Reconnect Gmail' : 'Connect Gmail')}
                </button>
                {debug?.gmailConnectedEmail && (
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    disabled={gmailBusy}
                    className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:text-amber-300"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Founder Email">
                  <Input type="email" value={profile.emails.userEmail} onChange={(e) => updateField('emails', 'userEmail', e.target.value)} placeholder="founder@example.com" />
                </Field>
                <Field label="Agent Email">
                  <Input type="email" value={profile.emails.agentEmail} onChange={(e) => updateField('emails', 'agentEmail', e.target.value)} placeholder="pulse.agent@example.com" />
                </Field>
                <Field label="Reply-To Email" hint="Optional fallback for outbound threads">
                  <Input type="email" value={profile.emails.replyToEmail} onChange={(e) => updateField('emails', 'replyToEmail', e.target.value)} placeholder="ops@example.com" />
                </Field>
                <Field label="Approval Mode">
                  <select
                    value={profile.emails.approvalMode}
                    onChange={(e) => updateField('emails', 'approvalMode', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-sky-400 focus:bg-white"
                  >
                    <option value="draft_only">Draft only</option>
                    <option value="approve_before_send">Approve before send</option>
                    <option value="auto_send_low_risk">Auto-send low risk</option>
                  </select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Section 04"
              title="BYOK"
              description="Store your personal model preferences here. This page keeps the keys available for later per-user routing and gives you a clean place to manage them now."
              accent="slate"
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="Active Model">
                  <select
                    value={profile.byok.activeModel}
                    onChange={(e) => updateField('byok', 'activeModel', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-sky-400 focus:bg-white"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="groq_llama">Groq Llama</option>
                    <option value="sarvam">Sarvam 105B</option>
                    <option value="claude">Claude</option>
                  </select>
                </Field>
                <MaskedStatus label="Gemini Key" value={profile.byok.geminiKey} />
                <MaskedStatus label="Groq Key" value={profile.byok.groqKey} />
                <MaskedStatus label="Sarvam Key" value={profile.byok.sarvamKey} />
                <MaskedStatus label="Anthropic Key" value={profile.byok.anthropicKey} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Gemini API Key">
                  <Input value={profile.byok.geminiKey} onChange={(e) => updateField('byok', 'geminiKey', e.target.value)} placeholder="Paste Gemini key" />
                </Field>
                <Field label="Groq API Key">
                  <Input value={profile.byok.groqKey} onChange={(e) => updateField('byok', 'groqKey', e.target.value)} placeholder="Paste Groq key" />
                </Field>
                <Field label="Sarvam API Key">
                  <Input value={profile.byok.sarvamKey} onChange={(e) => updateField('byok', 'sarvamKey', e.target.value)} placeholder="Paste Sarvam key" />
                </Field>
                <Field label="Anthropic API Key">
                  <Input value={profile.byok.anthropicKey} onChange={(e) => updateField('byok', 'anthropicKey', e.target.value)} placeholder="Paste Anthropic key" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Section 05"
              title="Automation Preferences"
              description="Set the guardrails for how much initiative the primary agent should take."
              accent="sky"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Toggle checked={profile.automation.canScheduleEmails} onChange={(value) => updateField('automation', 'canScheduleEmails', value)} label="Allow scheduling emails" />
                <Toggle checked={profile.automation.canFollowUpAutonomously} onChange={(value) => updateField('automation', 'canFollowUpAutonomously', value)} label="Allow autonomous follow-ups" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Quiet Hours">
                  <Input value={profile.automation.quietHours} onChange={(e) => updateField('automation', 'quietHours', e.target.value)} placeholder="23:00-07:00" />
                </Field>
                <Field label="Reminder Intensity">
                  <Input value={profile.automation.reminderIntensity} onChange={(e) => updateField('automation', 'reminderIntensity', e.target.value)} placeholder="firm" />
                </Field>
                <Field label="Escalation Behavior">
                  <Input value={profile.automation.escalationBehavior} onChange={(e) => updateField('automation', 'escalationBehavior', e.target.value)} placeholder="Nudge once, then escalate clearly." />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Section 06"
              title="Agent Fleet"
              description="Visible now so the product feels future-ready. Multiple agents are not live yet, but this is where founders will eventually spin up a full operator stack."
              accent="amber"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Active now</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{profile.identity.agentName || 'Pulse'}</h3>
                  <p className="mt-1 text-sm text-slate-600">{profile.identity.role || 'AI Cofounder'}</p>
                </div>
                {upcomingAgents.map((agent) => (
                  <div key={agent.name} className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Coming soon</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{agent.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">Dedicated memory, permissions, and email identity in a future release.</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
