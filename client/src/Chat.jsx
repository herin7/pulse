import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import useEmbeddings from './useEmbeddings';

const MOVED_KEYWORDS = ['shipped', 'completed', 'finished', 'launched', 'fixed', 'sent', 'closed', 'done', 'met', 'talked'];
const STALLED_KEYWORDS = ['forgot', 'still', 'blocked', 'stuck', 'delayed', 'waiting', "didn't", 'did not', "haven't", 'pending'];
const NEXT_KEYWORDS = ['need to', 'have to', 'will', 'going to', 'tomorrow', 'remind me to'];
const DEFAULT_CHARACTER_CARD = {
  name: 'Pulse',
  founderType: 'AI cofounder',
  building: 'Your startup operating system',
  stage: 'Active session',
  coreDrive: 'Keep momentum high and drift low.',
  northStar: 'Turn intention into execution.',
  techStack: [],
  founderStrengths: [],
  blindspots: [],
  biggestRisk: 'Losing context between sessions.',
  operatingStyle: 'Direct, concise, and execution-first.',
};

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickFirstMatchingSentence(sentences, keywords) {
  return sentences.find((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  }) || '';
}

function buildStandupSummary(text, reminder) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;

  return {
    transcript: text,
    moved: pickFirstMatchingSentence(sentences, MOVED_KEYWORDS) || sentences[0],
    stalled: pickFirstMatchingSentence(sentences, STALLED_KEYWORDS),
    nextAction: reminder?.task || pickFirstMatchingSentence(sentences, NEXT_KEYWORDS),
    reminder,
    createdAt: new Date().toISOString(),
  };
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function pickPulseVoice(voices) {
  if (!voices.length) return null;

  return voices.find((voice) => /male|david|mark|george|james|alex|daniel|google uk english male/i.test(`${voice.name} ${voice.voiceURI}`))
    || voices.find((voice) => /en-in|india/i.test(`${voice.lang} ${voice.name}`))
    || voices.find((voice) => /^en/i.test(voice.lang) && /male|david|mark|george|james|alex|daniel/i.test(voice.name))
    || voices.find((voice) => /^en/i.test(voice.lang))
    || voices[0]
    || null;
}

function formatReminderTime(value) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDefaultScheduleValue() {
  const scheduled = new Date(Date.now() + 60 * 60 * 1000);
  scheduled.setMinutes(Math.ceil(scheduled.getMinutes() / 5) * 5, 0, 0);

  const year = scheduled.getFullYear();
  const month = `${scheduled.getMonth() + 1}`.padStart(2, '0');
  const day = `${scheduled.getDate()}`.padStart(2, '0');
  const hours = `${scheduled.getHours()}`.padStart(2, '0');
  const minutes = `${scheduled.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatScheduledTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isEmailDraftReady(draft) {
  return Boolean(draft?.to?.trim() && draft?.subject?.trim() && draft?.body?.trim());
}

function normalizeAssistantReply(reply) {
  const text = typeof reply === 'string' ? reply.trim() : '';
  return text || 'I lost the thread for a second. Send that once more.';
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (parts.map((part) => part[0]?.toUpperCase()).join('') || 'P').slice(0, 2);
}

function getModelMeta(activeModel) {
  return CLIENT_MODELS.find((model) => model.key === activeModel) || CLIENT_MODELS[0];
}

function renderInlineFormatting(text) {
  const segments = String(text || '').split(/(\*\*.*?\*\*)/g);

  return segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
      return <strong key={index}>{segment.slice(2, -2)}</strong>;
    }
    return <Fragment key={index}>{segment}</Fragment>;
  });
}

function renderMessageContent(text) {
  const lines = String(text || '').split('\n');

  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {renderInlineFormatting(line)}
    </Fragment>
  ));
}

function VoiceStandupCard({
  summary,
  isListening,
  speechSupported,
  voiceEnabled,
  onToggleVoice,
  selectedVoiceName,
  conversationMode,
  onToggleConversationMode,
  liveTranscript,
  conversationStatus,
}) {
  const listeningLabel = isListening
    ? 'Listening live. Stop talking for a moment and Pulse will send it.'
    : conversationMode
      ? conversationStatus || 'Conversation mode is armed and ready.'
      : speechSupported
        ? 'Tap the mic and give Pulse a quick spoken standup.'
        : 'Voice input is not available in this browser.';

  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 shadow-[0_18px_40px_rgba(16,185,129,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Voice Conversation</p>
          <p className="mt-1 text-sm text-emerald-950">{listeningLabel}</p>
          {selectedVoiceName && (
            <p className="mt-1 text-xs text-emerald-800">Pulse voice: {selectedVoiceName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleConversationMode}
            disabled={!speechSupported}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${conversationMode ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'bg-white text-neutral-700 hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400'}`}
          >
            {conversationMode ? 'Stop talk mode' : 'Start talk mode'}
          </button>
          <button
            onClick={onToggleVoice}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${voiceEnabled ? 'bg-neutral-900 text-white hover:bg-neutral-700' : 'bg-white text-neutral-700 hover:bg-neutral-100'}`}
          >
            {voiceEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Live transcript</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${conversationMode ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>
              {conversationMode ? (isListening ? 'Capturing' : 'Armed') : 'Idle'}
            </span>
          </div>
          <p className="mt-3 min-h-[72px] whitespace-pre-wrap text-sm leading-6 text-neutral-800">
            {liveTranscript || 'What you say here will be transcribed, sent through chat, and saved into memory.'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white/75 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">How it works</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
            <li>Talk naturally.</li>
            <li>Pulse auto-sends after a short pause.</li>
            <li>The transcript goes into the same memory pipeline as typed chat.</li>
          </ul>
        </div>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Moved</p>
            <p className="mt-2 text-sm text-neutral-900">{summary.moved || 'Nothing captured yet.'}</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Stalled</p>
            <p className="mt-2 text-sm text-neutral-900">{summary.stalled || 'No blocker heard.'}</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Next</p>
            <p className="mt-2 text-sm text-neutral-900">{summary.nextAction || 'No next action captured.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailDraftCard({
  draft,
  busy,
  scheduleOpen,
  onToggleSchedule,
  onChange,
  onSend,
  onSchedule,
  onDiscard,
}) {
  if (!draft) return null;

  const missing = new Set(draft.missing || []);
  const ready = isEmailDraftReady(draft);
  const buttonsDisabled = busy || !draft.gmailConfigured;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.12),transparent_28%)]" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/88 shadow-[0_32px_100px_rgba(15,23,42,0.30)] ring-1 ring-slate-200/80">
        <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(8,145,178,0.10),rgba(255,255,255,0.88),rgba(14,165,233,0.16))] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Pulse Mailroom</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Approve the draft before anything goes out.</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Pulse wrote the first pass. Tighten it if needed, then send now or schedule delivery.
              </p>
            </div>
            <button
              onClick={onDiscard}
              className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-white"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              Draft first
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {ready ? 'Ready to send' : 'Needs review'}
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${draft.gmailConfigured ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'}`}>
              {draft.gmailConfigured ? 'Gmail connected' : 'Gmail offline'}
            </span>
          </div>
        </div>

        <div className="grid max-h-[calc(92vh-122px)] gap-0 overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-slate-200/80 bg-white px-6 py-6 lg:border-b-0 lg:border-r">
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recipient</span>
                <input
                  type="email"
                  value={draft.to}
                  onChange={(event) => onChange('to', event.target.value)}
                  placeholder="recipient@example.com"
                  className={`mt-2 w-full rounded-2xl border bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:bg-white ${missing.has('to') ? 'border-amber-300 focus:border-amber-500' : 'border-slate-200 focus:border-sky-400'}`}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Subject line</span>
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(event) => onChange('subject', event.target.value)}
                  placeholder="Subject line"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Message</span>
                <textarea
                  rows={12}
                  value={draft.body}
                  onChange={(event) => onChange('body', event.target.value)}
                  placeholder="Pulse will draft the message here."
                  className={`mt-2 w-full rounded-[1.5rem] border bg-slate-50/80 px-4 py-4 text-sm leading-relaxed text-slate-900 outline-none transition-all focus:bg-white ${missing.has('body') ? 'border-amber-300 focus:border-amber-500' : 'border-slate-200 focus:border-sky-400'}`}
                />
              </label>
            </div>

            {!draft.gmailConfigured && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Gmail is not configured yet, so this draft can be edited but not sent until the Gmail env values are added.
              </p>
            )}

            {!ready && (
              <p className="mt-4 text-sm text-amber-800">
                Fill in the missing fields before sending or scheduling.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={onSend}
                disabled={buttonsDisabled || !ready}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? 'Working...' : 'Send now'}
              </button>
              <button
                onClick={onToggleSchedule}
                disabled={buttonsDisabled || !ready}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {scheduleOpen ? 'Hide schedule' : 'Schedule'}
              </button>
            </div>

            {scheduleOpen && (
              <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Send at</span>
                  <input
                    type="datetime-local"
                    value={draft.scheduledFor}
                    onChange={(event) => onChange('scheduledFor', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-sky-400"
                  />
                </label>
                {draft.scheduledFor && (
                  <p className="mt-3 text-xs text-slate-500">Pulse will send it on {formatScheduledTime(draft.scheduledFor)}.</p>
                )}
                <button
                  onClick={onSchedule}
                  disabled={buttonsDisabled || !ready || !draft.scheduledFor}
                  className="mt-4 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-200"
                >
                  {busy ? 'Working...' : 'Confirm schedule'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,249,255,0.9))] px-6 py-6">
            <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live preview</p>
                  <p className="mt-1 text-sm text-slate-600">This is how the email is shaping up.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-900">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">To</p>
                  <p className="mt-1 break-all">{draft.to || 'Add recipient email'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Subject</p>
                  <p className="mt-1">{draft.subject || 'Add subject'}</p>
                </div>
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Body</p>
                  <div className="mt-3 min-h-[280px] whitespace-pre-wrap rounded-[1.25rem] bg-white px-4 py-4 leading-relaxed shadow-inner">
                    {draft.body || 'Add the email content.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderPopup({ reminder, onDismiss }) {
  if (!reminder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/10 p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">Reminder</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">It is time to do this.</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-neutral-900">{reminder.task}</p>
          <p className="mt-2 text-xs text-neutral-500">Scheduled for {formatReminderTime(reminder.remindAt)}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            onClick={onDismiss}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatHeader({ profile, activeModel, isReady, voiceEnabled, isListening, hasReminderQueue }) {
  const modelMeta = getModelMeta(activeModel);

  return (
    <div className="chat-header-shell">
      <div className="chat-header-main">
        <div className="chat-avatar-chip">
          <span>{getInitials(profile.name)}</span>
        </div>
        <div className="min-w-0">
          <div className="chat-header-line">
            <h1 className="chat-header-title">{profile.name}</h1>
            <span className="chat-header-role">{profile.founderType}</span>
          </div>
          <p className="chat-header-subtitle">{profile.coreDrive || 'Keep momentum high and drift low.'}</p>
        </div>
      </div>
      <div className="chat-header-stats">
        <span className={`chat-status-pill ${isReady ? 'chat-status-pill-ready' : ''}`}>
          <span className="chat-status-dot" />
          {isReady ? 'Embeddings ready' : 'Loading model'}
        </span>
        <span className="chat-status-pill">
          {modelMeta.name}
        </span>
        <span className="chat-status-pill">
          {voiceEnabled ? (isListening ? 'Listening' : 'Voice on') : 'Voice off'}
        </span>
        {hasReminderQueue && (
          <span className="chat-status-pill chat-status-pill-alert">Reminder queued</span>
        )}
      </div>
    </div>
  );
}

function EmptyConversationState({ profile }) {
  return (
    <div className="chat-empty-state">
      <div className="chat-empty-mark">{getInitials(profile.name)}</div>
      <p className="chat-empty-eyebrow">Execution Console</p>
      <h2 className="chat-empty-title">Start with what moved, what is blocked, or what Pulse should handle next.</h2>
      <p className="chat-empty-copy">
        Pulse already knows your founder profile. Use chat naturally, speak a standup, or ask it to draft, remind, and push you forward.
      </p>
    </div>
  );
}

function MessageRow({ message, profile }) {
  const isUser = message.role === 'user';
  const sources = [...new Set(message.sources || [])];

  return (
    <div className={`chat-message-row ${isUser ? 'chat-message-row-user' : ''}`}>
      {!isUser && (
        <div className="chat-message-avatar chat-message-avatar-ai">
          <span>{getInitials(profile.name)}</span>
        </div>
      )}
      <div className={`chat-message-stack ${isUser ? 'chat-message-stack-user' : ''}`}>
        <div className="chat-message-meta">
          <span className="chat-message-author">{isUser ? 'You' : profile.name}</span>
          <span className="chat-message-badge">{isUser ? 'Founder' : 'Cofounder'}</span>
        </div>
        <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
          {renderMessageContent(message.content)}
          {message.files && message.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-white/20">
              {message.files.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded text-[10px] font-medium">
                  <span>📎</span>
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <span className="opacity-60 lowercase">({file.type?.split('/')[1] || 'file'})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {sources.length > 0 && (
          <div className="chat-source-row">
            {sources.map((source) => (
              <span key={`${message.role}-${source}`} className="chat-source-pill">
                {source}
              </span>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="chat-message-avatar chat-message-avatar-user">
          <span>Y</span>
        </div>
      )}
    </div>
  );
}

function ComposerStatusBar({ activeModel, speechSupported, isListening, voiceEnabled, isReady }) {
  const modelMeta = getModelMeta(activeModel);

  return (
    <div className="composer-status-row">
      <div className="composer-status-group">
        <span className="composer-status-label">Mode</span>
        <span className="composer-status-value">{modelMeta.name}</span>
      </div>
      <div className="composer-status-group">
        <span className="composer-status-label">Mic</span>
        <span className="composer-status-value">
          {!speechSupported ? 'Unavailable' : isListening ? 'Listening now' : 'Ready'}
        </span>
      </div>
      <div className="composer-status-group">
        <span className="composer-status-label">Voice</span>
        <span className="composer-status-value">{voiceEnabled ? 'Enabled' : 'Muted'}</span>
      </div>
      <div className="composer-status-group">
        <span className="composer-status-label">State</span>
        <span className="composer-status-value">{isReady ? 'Operational' : 'Booting'}</span>
      </div>
    </div>
  );
}



function Sidebar({ characterCard, handleReset, competitorStatus, showPanel, setShowPanel, hasHighUrgency, refreshing, handleRefreshIntel, lastRefreshed }) {
  const profile = characterCard || DEFAULT_CHARACTER_CARD;
  const today = new Date().toDateString();
  const updatedCount = competitorStatus?.filter((c) => c.lastFetched && new Date(c.lastFetched).toDateString() === today).length || 0;
  const totalCount = competitorStatus?.length || 0;

  return (
    <aside className="w-64 bg-gray-50 border-r border-neutral-200 p-5 overflow-y-auto flex-shrink-0">
      <h2 className="text-lg font-semibold text-neutral-800">{profile.name}</h2>
      <p className="text-neutral-500 text-sm mt-1">{profile.founderType}</p>
      <hr className="border-neutral-200 my-4" />

      <Section title="Building">{profile.building}</Section>
      <Section title="Stage">{profile.stage}</Section>
      <Section title="Core Drive">{profile.coreDrive}</Section>
      <Section title="North Star">{profile.northStar}</Section>

      <SectionLabel title="Tech Stack" />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.techStack?.map((t) => (
          <span key={t} className="bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded text-xs">{t}</span>
        ))}
      </div>

      <SectionLabel title="Founder Strengths" />
      <ul className="mb-4 space-y-1">
        {profile.founderStrengths?.map((s) => (
          <li key={s} className="text-green-700 text-sm flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            {s}
          </li>
        ))}
      </ul>

      <SectionLabel title="Blind Spots" />
      <ul className="mb-4 space-y-1">
        {profile.blindspots?.map((b) => (
          <li key={b} className="text-amber-700 text-sm flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <Section title="Biggest Risk">{profile.biggestRisk}</Section>
      <Section title="Operating Style">{profile.operatingStyle}</Section>

      {/* Competitor Intel Panel */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full flex items-center justify-between text-xs text-neutral-500 hover:text-neutral-800 py-2 mt-4 border-t border-neutral-200"
      >
        <span>🔍 Competitor Intel</span>
        <span className="flex items-center gap-1">
          {hasHighUrgency && <span className="w-2 h-2 rounded-full bg-red-500" />}
          {showPanel ? '▲' : '▼'}
        </span>
      </button>

      {showPanel && (
        <div className="mt-2">
          {competitorStatus && competitorStatus.length > 0 ? (
            competitorStatus.map((c) => (
              <div key={c.name} className="mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-700 text-xs font-medium">{c.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.urgency === 'high' ? 'bg-red-100 text-red-700' :
                      c.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-neutral-100 text-neutral-500'
                    }`}>{c.urgency || 'no data'}</span>
                </div>
                {c.latestSummary
                  ? <p className="text-neutral-500 text-xs mt-1 line-clamp-2">{c.latestSummary}</p>
                  : <p className="text-neutral-400 text-xs mt-1">No intel yet</p>
                }
                {c.lastFetched && (
                  <p className="text-neutral-400 text-xs mt-0.5">
                    {new Date(c.lastFetched).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-neutral-400 text-xs">No competitors tracked yet.</p>
          )}

          <button
            onClick={handleRefreshIntel}
            disabled={refreshing}
            className="w-full mt-2 text-xs text-neutral-500 hover:text-neutral-800 py-2 border border-neutral-200 hover:border-neutral-400 rounded-lg disabled:opacity-50 transition-colors"
          >
            {refreshing ? <span className="animate-pulse">Fetching...</span> : 'Refresh Intel'}
          </button>
          {refreshing && totalCount > 0 && (
            <p className="text-neutral-400 text-xs mt-1 text-center">Updated {updatedCount} / {totalCount} competitors</p>
          )}
          {lastRefreshed && !refreshing && (
            <p className="text-neutral-400 text-xs mt-1 text-center">Last refreshed {lastRefreshed.toLocaleTimeString()}</p>
          )}
        </div>
      )}

      <button
        onClick={handleReset}
        className="w-full mt-6 text-xs text-neutral-400 hover:text-red-500 transition-colors py-2 border border-neutral-200 hover:border-red-300 rounded-lg"
      >
        Update Profile
      </button>
    </aside>
  );
}

function SectionLabel({ title }) {
  return <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{title}</h3>;
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <SectionLabel title={title} />
      <p className="text-neutral-700 text-sm">{children}</p>
    </div>
  );
}

const CLIENT_MODELS = [
  { key: 'gemini', name: 'Gemini 2.0 Flash', free: true },
  { key: 'groq_llama', name: 'Llama 3.3 70B (Groq)', free: true },
  { key: 'sarvam', name: 'Sarvam 105B', free: false },
  { key: 'claude', name: 'Claude Sonnet (Anthropic)', free: false },
];

export default function Chat({ characterCard }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('gemini');
  const [refreshing, setRefreshing] = useState(false);
  const [competitorStatus, setCompetitorStatus] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [toast, setToast] = useState(null);
  const [overdueLoops, setOverdueLoops] = useState([]);
  const [showLoopBanner, setShowLoopBanner] = useState(false);
  const [reminderQueue, setReminderQueue] = useState([]);
  const [activeReminder, setActiveReminder] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [conversationMode, setConversationMode] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [conversationStatus, setConversationStatus] = useState('Talk mode is off.');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceStandup, setVoiceStandup] = useState(null);
  const [emailDraft, setEmailDraft] = useState(null);
  const [draftActionLoading, setDraftActionLoading] = useState(false);
  const [showScheduleComposer, setShowScheduleComposer] = useState(false);
  const { isReady, embed } = useEmbeddings();
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const shownReminderIdsRef = useRef(new Set());
  const scheduledReminderTimersRef = useRef(new Map());
  const recognitionRef = useRef(null);
  const inputModeRef = useRef('text');
  const voiceAutoSendTimeoutRef = useRef(null);
  const voiceTranscriptRef = useRef('');
  const voiceRestartTimeoutRef = useRef(null);
  const shouldResumeConversationRef = useRef(false);
  const isLoadingRef = useRef(false);
  const conversationModeRef = useRef(false);

  const profile = characterCard || DEFAULT_CHARACTER_CARD;
  const hasHighUrgency = competitorStatus?.some((c) => c.urgency === 'high') || false;
  const selectedVoice = pickPulseVoice(availableVoices);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  const clearVoiceAutoSendTimer = useCallback(() => {
    window.clearTimeout(voiceAutoSendTimeoutRef.current);
    voiceAutoSendTimeoutRef.current = null;
  }, []);

  const stopConversationListening = useCallback(() => {
    clearVoiceAutoSendTimer();
    window.clearTimeout(voiceRestartTimeoutRef.current);
    voiceRestartTimeoutRef.current = null;
    shouldResumeConversationRef.current = false;

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {}
    }
  }, [clearVoiceAutoSendTimer, isListening]);

  const startConversationListening = useCallback(() => {
    if (!speechSupported || !recognitionRef.current || isListening || isLoadingRef.current) return;

    clearVoiceAutoSendTimer();
    voiceTranscriptRef.current = '';
    setLiveTranscript('');
    setConversationStatus('Listening for your next update...');
    inputModeRef.current = 'voice';

    try {
      recognitionRef.current.start();
    } catch (error) {
      setToast('Mic is already active');
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
    }
  }, [clearVoiceAutoSendTimer, isListening, speechSupported]);

  const queueConversationResume = useCallback(() => {
    if (!conversationModeRef.current || !speechSupported) return;

    window.clearTimeout(voiceRestartTimeoutRef.current);
    voiceRestartTimeoutRef.current = window.setTimeout(() => {
      if (!conversationModeRef.current || isLoadingRef.current) return;
      startConversationListening();
    }, 450);
  }, [speechSupported, startConversationListening]);

  const submitVoiceTranscript = useCallback((transcript) => {
    const normalized = String(transcript || '').trim();
    if (!normalized || isLoadingRef.current) return;

    clearVoiceAutoSendTimer();
    voiceTranscriptRef.current = normalized;
    setLiveTranscript(normalized);
    setConversationStatus('Sending your voice update...');

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {}
    }

    inputModeRef.current = 'voice';
    setInput(normalized);
  }, [clearVoiceAutoSendTimer, isListening]);

  const handleReset = async () => {
    if (!window.confirm('This will clear your profile and restart onboarding. Are you sure?')) return;
    try {
      await fetch('/api/session', { method: 'DELETE', credentials: 'include' });
    } catch (e) {}
    localStorage.removeItem('pulse_token');
    window.location.reload();
  };

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('pulse_token');
      const res = await fetch('/api/competitors/status', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCompetitorStatus(data.competitors);
        return data;
      }
    } catch (e) {}
    return null;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('pulse_token');
    fetchStatus();
    fetch('/api/loops/overdue', {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include'
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 0) {
          setOverdueLoops(data.overdue);
          setShowLoopBanner(true);
        }
      })
      .catch(() => { });
  }, [fetchStatus]);

  const handleRefreshIntel = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    try {
      const token = localStorage.getItem('pulse_token');
      await fetch('/api/competitors/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
    } catch (e) {
      setRefreshing(false);
      return;
    }

    const today = new Date().toDateString();
    const startTime = Date.now();

    const poll = setInterval(async () => {
      const data = await fetchStatus();
      if (!data) return;

      const allUpdated = data.competitors.length > 0 && data.competitors.every(
        (c) => c.lastFetched && new Date(c.lastFetched).toDateString() === today
      );

      if (allUpdated || Date.now() - startTime > 60000) {
        clearInterval(poll);
        setRefreshing(false);
        setLastRefreshed(new Date());
        setToast('Intel updated');
        setTimeout(() => setToast(null), 3000);
      }
    }, 5000);
  }, [refreshing, fetchStatus]);

  useEffect(() => {
    const token = localStorage.getItem('pulse_token');
    fetch('/api/config/model', {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include'
    })
      .then((r) => r.json())
      .then((d) => setActiveModel(d.activeModel))
      .catch(() => { });
  }, []);

  const handleModelChange = async (e) => {
    const modelKey = e.target.value;
    setActiveModel(modelKey);
    try {
      const token = localStorage.getItem('pulse_token');
      await fetch('/api/config/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ modelKey }),
      });
    } catch (err) {
      console.error('Failed to switch model:', err);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const recognitionCtor = getSpeechRecognitionCtor();
    setSpeechSupported(Boolean(recognitionCtor));

    if (!recognitionCtor) return undefined;

    const recognition = new recognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setConversationStatus('Listening...');
    };
    recognition.onend = () => {
      setIsListening(false);
      if (conversationMode && !isLoading && shouldResumeConversationRef.current) {
        queueConversationResume();
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      setToast('Voice capture failed');
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
      setConversationStatus('Voice capture failed. Try again.');
    };
    recognition.onresult = (event) => {
      let committed = voiceTranscriptRef.current;
      let interim = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          committed = `${committed} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      voiceTranscriptRef.current = committed;
      const combinedTranscript = `${committed} ${interim}`.trim();
      if (!combinedTranscript) return;

      setLiveTranscript(combinedTranscript);
      setConversationStatus('Got it. Waiting for you to finish...');
      shouldResumeConversationRef.current = conversationMode;

      clearVoiceAutoSendTimer();
      voiceAutoSendTimeoutRef.current = window.setTimeout(() => {
        submitVoiceTranscript(combinedTranscript);
      }, 1200);
    };

    recognitionRef.current = recognition;

    return () => {
      clearVoiceAutoSendTimer();
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [clearVoiceAutoSendTimer, conversationMode, isLoading, queueConversationResume, submitVoiceTranscript]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;

    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDiscardEmailDraft = useCallback(() => {
    setEmailDraft(null);
    setShowScheduleComposer(false);
  }, []);

  const handleEmailDraftChange = useCallback((field, value) => {
    setEmailDraft((prev) => {
      if (!prev) return prev;

      const nextMissing = new Set(prev.missing || []);
      if (field === 'to' || field === 'body') {
        if (value.trim()) {
          nextMissing.delete(field);
        } else {
          nextMissing.add(field);
        }
      }

      return {
        ...prev,
        [field]: value,
        missing: [...nextMissing],
      };
    });
  }, []);

  const speakPulseReply = useCallback((text) => {
    if (!text) {
      return;
    }

    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      if (conversationMode) {
        shouldResumeConversationRef.current = true;
        queueConversationResume();
      }
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang || 'en-IN';
    utterance.rate = 1.14;
    utterance.pitch = 0.72;
    utterance.volume = 1;
    utterance.onend = () => {
      if (conversationMode) {
        shouldResumeConversationRef.current = true;
        queueConversationResume();
      }
    };
    utterance.onerror = () => {
      if (conversationMode) {
        shouldResumeConversationRef.current = true;
        queueConversationResume();
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [conversationMode, queueConversationResume, selectedVoice, voiceEnabled]);

  const queueReminders = useCallback((incomingReminders) => {
    if (!incomingReminders?.length) return;

    setReminderQueue((prev) => {
      const seen = new Set([
        ...prev.map((item) => item.id),
        activeReminder?.id,
        ...shownReminderIdsRef.current,
      ].filter(Boolean));
      const additions = incomingReminders.filter((item) => !seen.has(item.id));
      additions.forEach((item) => shownReminderIdsRef.current.add(item.id));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [activeReminder]);

  const scheduleReminder = useCallback((reminder) => {
    if (!reminder?.id || shownReminderIdsRef.current.has(reminder.id) || scheduledReminderTimersRef.current.has(reminder.id)) {
      return;
    }

    const delay = new Date(reminder.remindAt).getTime() - Date.now();
    if (delay <= 0) {
      queueReminders([reminder]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      scheduledReminderTimersRef.current.delete(reminder.id);
      queueReminders([reminder]);
    }, delay);

    scheduledReminderTimersRef.current.set(reminder.id, timeoutId);
  }, [queueReminders]);

  const checkDueReminders = useCallback(async () => {
    try {
      const token = localStorage.getItem('pulse_token');
      const res = await fetch('/api/reminders/due', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!data.reminders?.length) return;

      queueReminders(data.reminders);

      if ('Notification' in window && Notification.permission === 'granted') {
        data.reminders.forEach((reminder) => {
          new Notification('Pulse reminder', {
            body: reminder.task,
          });
        });
      }
    } catch (e) {}
  }, [queueReminders]);

  useEffect(() => {
    const poll = window.setInterval(checkDueReminders, 15000);
    const refreshOnFocus = () => checkDueReminders();

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    checkDueReminders();

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [checkDueReminders]);

  useEffect(() => {
    if (!activeReminder && reminderQueue.length > 0) {
      setActiveReminder(reminderQueue[0]);
      setReminderQueue((prev) => prev.slice(1));
    }
  }, [activeReminder, reminderQueue]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    if (emailDraft) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [emailDraft]);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimeoutRef.current);
      window.clearTimeout(voiceAutoSendTimeoutRef.current);
      window.clearTimeout(voiceRestartTimeoutRef.current);
      scheduledReminderTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      scheduledReminderTimersRef.current.clear();
    };
  }, []);

  const handleDismissReminder = useCallback(() => {
    setActiveReminder(null);
  }, []);

  const handleStartVoiceCapture = useCallback(() => {
    if (conversationMode) {
      stopConversationListening();
      setConversationMode(false);
      setLiveTranscript('');
      setConversationStatus('Talk mode stopped.');
      return;
    }

    setConversationMode(true);
    shouldResumeConversationRef.current = true;
    startConversationListening();
  }, [conversationMode, startConversationListening, stopConversationListening]);

  const handleToggleConversationMode = useCallback(() => {
    if (conversationMode) {
      stopConversationListening();
      setConversationMode(false);
      setLiveTranscript('');
      setConversationStatus('Talk mode stopped.');
      return;
    }

    setConversationMode(true);
    shouldResumeConversationRef.current = true;
    startConversationListening();
  }, [conversationMode, startConversationListening, stopConversationListening]);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        shouldResumeConversationRef.current = conversationMode;
      }
      return next;
    });
  }, [conversationMode]);

  const handleSendEmailDraft = useCallback(async () => {
    if (!emailDraft || draftActionLoading || !isEmailDraftReady(emailDraft)) return;

    setDraftActionLoading(true);
    try {
      const token = localStorage.getItem('pulse_token');
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          to: emailDraft.to.trim(),
          subject: emailDraft.subject.trim(),
          body: emailDraft.body.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Email sent to ${emailDraft.to.trim()} with subject "${emailDraft.subject.trim()}".`,
          sources: ['gmail'],
        },
      ]);
      showToast('Email sent');
      setEmailDraft(null);
      setShowScheduleComposer(false);
    } catch (error) {
      console.error('Email send failed:', error);
      showToast(error.message || 'Failed to send email');
    } finally {
      setDraftActionLoading(false);
    }
  }, [draftActionLoading, emailDraft, showToast]);

  const handleScheduleEmailDraft = useCallback(async () => {
    if (!emailDraft || draftActionLoading || !isEmailDraftReady(emailDraft) || !emailDraft.scheduledFor) return;

    setDraftActionLoading(true);
    try {
      const token = localStorage.getItem('pulse_token');
      const res = await fetch('/api/gmail/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          to: emailDraft.to.trim(),
          subject: emailDraft.subject.trim(),
          body: emailDraft.body.trim(),
          scheduledFor: emailDraft.scheduledFor,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule email');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Email scheduled for ${formatScheduledTime(emailDraft.scheduledFor)}.`,
          sources: ['gmail'],
        },
      ]);
      showToast('Email scheduled');
      setEmailDraft(null);
      setShowScheduleComposer(false);
    } catch (error) {
      console.error('Email schedule failed:', error);
      showToast(error.message || 'Failed to schedule email');
    } finally {
      setDraftActionLoading(false);
    }
  }, [draftActionLoading, emailDraft, showToast]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && selectedFiles.length === 0) return;
    if (isLoading) return;

    const token = localStorage.getItem('pulse_token');
    const inputMode = inputModeRef.current;
    inputModeRef.current = 'text';

    // Optimistically add user message
    const userMsg = { 
      role: 'user', 
      content: text || (selectedFiles.length > 0 ? `Sent ${selectedFiles.length} file(s)` : ''),
      files: selectedFiles.map(f => ({ name: f.name, type: f.type }))
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', text);
      
      // We will let the server handle embedding now since it is multimodal
      // queryEmbedding is no longer sent from client if server can do it with Gemini.
      
      filesToUpload.forEach((file) => {
        formData.append('files', file);
      });

      const history = messages.slice(-10);
      formData.append('history', JSON.stringify(history));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Content-Type is set automatically by fetch when using FormData
        },
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      if (data.emailDraft) {
        setEmailDraft({
          to: data.emailDraft.to || '',
          subject: data.emailDraft.subject || '',
          body: data.emailDraft.body || '',
          missing: Array.isArray(data.emailDraft.missing) ? data.emailDraft.missing : [],
          gmailConfigured: Boolean(data.emailDraft.gmailConfigured),
          scheduledFor: getDefaultScheduleValue(),
        });
        setShowScheduleComposer(false);
      }

      if (data.reminder) {
        scheduleReminder(data.reminder);
        showToast(`Reminder set for ${formatReminderTime(data.reminder.remindAt)}`);
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => { });
        }
      }

      if (inputMode === 'voice') {
        setVoiceStandup(buildStandupSummary(text, data.reminder));
        setConversationStatus('Saved to memory. Pulse is replying...');
      }

      const assistantReply = normalizeAssistantReply(data.reply);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantReply, sources: data.sources },
      ]);
      speakPulseReply(assistantReply);
    } catch (err) {
      console.error('Chat error:', err);
      if (inputMode === 'voice') {
        setConversationStatus('Voice update failed. Try speaking again.');
        shouldResumeConversationRef.current = conversationMode;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [embed, input, isLoading, messages, scheduleReminder, showToast, speakPulseReply]);

  useEffect(() => {
    if (inputModeRef.current === 'voice' && input.trim() && !isLoading) {
      handleSend();
    }
  }, [handleSend, input, isLoading]);

  useEffect(() => {
    if (!conversationMode || isLoading || isListening || !shouldResumeConversationRef.current) {
      return;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
      return;
    }

    queueConversationResume();
  }, [conversationMode, isListening, isLoading, queueConversationResume]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-16 pb-4">
      <div className="pulse-card-chat">
        <div className="pulse-card-hero-sm flex items-center px-8">
          <span className="font-serif text-xl text-white italic tracking-tight">Pulse.</span>
          <div className="pulse-corner-dot" style={{ top: 10, left: 10 }} />
          <div className="pulse-corner-dot" style={{ top: 10, right: 10 }} />
        </div>

        <div className="flex flex-1 min-h-0">
          <Sidebar
            characterCard={profile}
            handleReset={handleReset}
            competitorStatus={competitorStatus}
            showPanel={showPanel}
            setShowPanel={setShowPanel}
            hasHighUrgency={hasHighUrgency}
            refreshing={refreshing}
            handleRefreshIntel={handleRefreshIntel}
            lastRefreshed={lastRefreshed}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-6 pt-5 pb-3 bg-white border-b border-slate-200/80">
              <ChatHeader
                profile={profile}
                activeModel={activeModel}
                isReady={isReady}
                voiceEnabled={voiceEnabled}
                isListening={isListening}
                hasReminderQueue={Boolean(activeReminder || reminderQueue.length)}
              />
            </div>
            <div className="chat-message-pane">
              <VoiceStandupCard
                summary={voiceStandup}
                isListening={isListening}
                speechSupported={speechSupported}
                voiceEnabled={voiceEnabled}
                onToggleVoice={handleToggleVoice}
                selectedVoiceName={selectedVoice?.name}
                conversationMode={conversationMode}
                onToggleConversationMode={handleToggleConversationMode}
                liveTranscript={liveTranscript}
                conversationStatus={conversationStatus}
              />
              {messages.length === 0 && (
                <EmptyConversationState profile={profile} />
              )}
              <div className="chat-thread">
                {messages.map((msg, i) => (
                  <MessageRow key={i} message={msg} profile={profile} />
                ))}
                {isLoading && (
                  <div className="chat-message-row">
                    <div className="chat-message-avatar chat-message-avatar-ai">
                      <span>{getInitials(profile.name)}</span>
                    </div>
                    <div className="chat-message-stack">
                      <div className="chat-message-meta">
                        <span className="chat-message-author">{profile.name}</span>
                        <span className="chat-message-badge">Cofounder</span>
                      </div>
                      <div className="chat-thinking">
                        Thinking
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {showLoopBanner && overdueLoops.length > 0 && (
              <div className="mx-4 mb-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 text-base">⏳</span>
                  <div>
                    <p className="text-amber-800 text-xs font-medium">
                      {overdueLoops.length} thing{overdueLoops.length > 1 ? 's' : ''} you said you'd do
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">
                      {overdueLoops.slice(0, 2).map((l) => l.loop).join(' · ')}
                      {overdueLoops.length > 2 ? ` · +${overdueLoops.length - 2} more` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setInput('What have I been procrastinating on? Hold me accountable.');
                      setShowLoopBanner(false);
                    }}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Review now
                  </button>
                  <button
                    onClick={() => setShowLoopBanner(false)}
                    className="text-neutral-400 hover:text-neutral-600 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 pb-3 pt-2">
              <div className="pulse-input-bar">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isReady ? 'Send a prompt or run a command...' : 'Loading model...'}
                  disabled={!isReady}
                  className="flex-1 resize-none text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none bg-transparent disabled:opacity-50 leading-relaxed"
                />
                <button
                  onClick={handleStartVoiceCapture}
                  disabled={!speechSupported || isLoading}
                  className={`pulse-send-btn ${isListening ? 'bg-red-500 hover:bg-red-500' : ''}`}
                  title={speechSupported ? (conversationMode ? 'Stop talk mode' : 'Start talk mode') : 'Voice input not supported'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                </button>
                <button
                  onClick={handleSend}
                  disabled={isLoading || !isReady || !input.trim()}
                  className="pulse-send-btn"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 px-2">
                <div className="flex items-center gap-3">
                  <label className="text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer text-sm" title="Upload files (Image, Video, Audio, PDF)">
                    📎
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setSelectedFiles((prev) => [...prev, ...files]);
                      }}
                    />
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedFiles.map((file, i) => (
                        <span key={i} className="bg-slate-100 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 group">
                          {file.name}
                          <button 
                            onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-neutral-400 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="pulse-model-pill">
                    <span>✦</span>
                    <select
                      value={activeModel}
                      onChange={handleModelChange}
                    >
                      {CLIENT_MODELS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name}{m.free ? '' : ' (paid)'}
                        </option>
                      ))}
                    </select>
                    <span>▾</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-neutral-800 text-white text-sm px-4 py-2 rounded-lg transition-opacity z-50">
          {toast}
        </div>
      )}
      <EmailDraftCard
        draft={emailDraft}
        busy={draftActionLoading}
        scheduleOpen={showScheduleComposer}
        onToggleSchedule={() => {
          setShowScheduleComposer((prev) => !prev);
          setEmailDraft((prev) => prev ? {
            ...prev,
            scheduledFor: prev.scheduledFor || getDefaultScheduleValue(),
          } : prev);
        }}
        onChange={handleEmailDraftChange}
        onSend={handleSendEmailDraft}
        onSchedule={handleScheduleEmailDraft}
        onDiscard={handleDiscardEmailDraft}
      />
      <ReminderPopup reminder={activeReminder} onDismiss={handleDismissReminder} />
    </div>
  );
}
