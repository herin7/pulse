import { useState, useRef, useEffect, useCallback } from 'react';
import useEmbeddings from './useEmbeddings';

function getUserId() {
  return localStorage.getItem('lc_user_id') || '';
}

function Sidebar({ characterCard, handleReset, competitorStatus, showPanel, setShowPanel, hasHighUrgency, refreshing, handleRefreshIntel, lastRefreshed }) {
  const today = new Date().toDateString();
  const updatedCount = competitorStatus?.filter((c) => c.lastFetched && new Date(c.lastFetched).toDateString() === today).length || 0;
  const totalCount = competitorStatus?.length || 0;

  return (
    <aside className="w-64 bg-gray-50 border-r border-neutral-200 p-5 overflow-y-auto flex-shrink-0">
      <h2 className="text-lg font-semibold text-neutral-800">{characterCard.name}</h2>
      <p className="text-neutral-500 text-sm mt-1">{characterCard.founderType}</p>
      <hr className="border-neutral-200 my-4" />

      <Section title="Building">{characterCard.building}</Section>
      <Section title="Stage">{characterCard.stage}</Section>
      <Section title="Core Drive">{characterCard.coreDrive}</Section>
      <Section title="North Star">{characterCard.northStar}</Section>

      <SectionLabel title="Tech Stack" />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {characterCard.techStack?.map((t) => (
          <span key={t} className="bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded text-xs">{t}</span>
        ))}
      </div>

      <SectionLabel title="Founder Strengths" />
      <ul className="mb-4 space-y-1">
        {characterCard.founderStrengths?.map((s) => (
          <li key={s} className="text-green-700 text-sm flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            {s}
          </li>
        ))}
      </ul>

      <SectionLabel title="Blind Spots" />
      <ul className="mb-4 space-y-1">
        {characterCard.blindspots?.map((b) => (
          <li key={b} className="text-amber-700 text-sm flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <Section title="Biggest Risk">{characterCard.biggestRisk}</Section>
      <Section title="Operating Style">{characterCard.operatingStyle}</Section>

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
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    c.urgency === 'high' ? 'bg-red-100 text-red-700' :
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
  const [toast, setToast] = useState(null);
  const [overdueLoops, setOverdueLoops] = useState([]);
  const [showLoopBanner, setShowLoopBanner] = useState(false);
  const { isReady, embed } = useEmbeddings();
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const hasHighUrgency = competitorStatus?.some((c) => c.urgency === 'high') || false;

  const handleReset = async () => {
    if (!window.confirm('This will clear your profile and restart onboarding. Are you sure?')) return;
    try {
      await fetch('/api/session', { method: 'DELETE', credentials: 'include' });
    } catch (e) {
      // continue with local reset even if server call fails
    }
    localStorage.removeItem('lc_user_id');
    window.location.reload();
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/competitors/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompetitorStatus(data.competitors);
        return data;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    fetchStatus();
    fetch('/api/loops/overdue', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 0) {
          setOverdueLoops(data.overdue);
          setShowLoopBanner(true);
        }
      })
      .catch(() => {});
  }, [fetchStatus]);

  const handleRefreshIntel = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    try {
      await fetch('/api/competitors/refresh', { method: 'POST', credentials: 'include' });
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
    fetch('/api/config/model', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setActiveModel(d.activeModel))
      .catch(() => {});
  }, []);

  const handleModelChange = async (e) => {
    const modelKey = e.target.value;
    setActiveModel(modelKey);
    try {
      await fetch('/api/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userId = getUserId();
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const queryEmbedding = await embed(text);

      const history = messages.slice(-10);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, userId, queryEmbedding, history }),
      });

      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, sources: data.sources },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, embed]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-16 pb-4">
      <div className="pulse-card-chat">
        {/* Hero strip at top of card */}
        <div className="pulse-card-hero-sm flex items-center px-8">
          <span className="font-serif text-xl text-white italic tracking-tight">Pulse.</span>
          {/* Corner dots */}
          <div className="pulse-corner-dot" style={{ top: 10, left: 10 }} />
          <div className="pulse-corner-dot" style={{ top: 10, right: 10 }} />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          <Sidebar
            characterCard={characterCard}
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
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="font-serif text-3xl text-neutral-200 italic tracking-tight">Start a conversation.</p>
                    <p className="text-neutral-400 text-sm mt-3 font-light">Your AI cofounder is ready.</p>
                  </div>
                </div>
              )}
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%]">
                      <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                        {msg.content}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <p className="text-neutral-400 text-xs mt-1.5 px-2">
                          Sources: {[...new Set(msg.sources)].join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="chat-thinking">
                      Thinking
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Overdue loops banner */}
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

            {/* Input bar */}
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
              {/* Bottom row: attachment icon + model pills */}
              <div className="flex items-center justify-between mt-2 px-2">
                <div className="text-neutral-400 text-sm cursor-default">📎</div>
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
    </div>
  );
}
