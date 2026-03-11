import { useState, useEffect } from 'react';

function PanelHeader({ index, label, category }) {
    return (
        <div className="caret-panel-header">
            <span className="caret-label">[{String(index).padStart(2, '0')}] {label}</span>
            <span className="caret-label">/ {category}</span>
        </div>
    );
}

function SectionTitle({ children }) {
    return (
        <div className="caret-section-title-cell">
            <h2 className="caret-section-title">{children}</h2>
        </div>
    );
}

const providers = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        model: 'gemini-2.0-flash',
        placeholder: 'AIzaSy...',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        free: true,
        tag: 'FREE TIER',
    },
    {
        id: 'groq',
        name: 'Groq — Llama 3.3 70B',
        model: 'llama-3.3-70b-versatile',
        placeholder: 'gsk_...',
        docsUrl: 'https://console.groq.com/keys',
        free: true,
        tag: 'FREE TIER',
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        model: 'claude-sonnet-4-5',
        placeholder: 'sk-ant-...',
        docsUrl: 'https://console.anthropic.com/settings/keys',
        free: false,
        tag: 'PAID',
    },
];

function KeyRow({ provider, saved, onSave, onClear }) {
    const [value, setValue] = useState('');
    const [visible, setVisible] = useState(false);
    const [status, setStatus] = useState(null);

    const handleSave = () => {
        if (!value.trim()) return;
        setStatus('saving');
        setTimeout(() => {
            localStorage.setItem(`byok_${provider.id}`, btoa(value.trim()));
            setStatus('saved');
            onSave(provider.id);
            setTimeout(() => setStatus(null), 2000);
        }, 500);
    };

    const handleClear = () => {
        localStorage.removeItem(`byok_${provider.id}`);
        setValue('');
        onClear(provider.id);
    };

    return (
        <div className="caret-key-row">
            <div className="caret-key-meta">
                <div className="caret-card-label">{provider.name}</div>
                <div className="caret-key-model">{provider.model}</div>
                <span className={`caret-key-tag ${provider.free ? 'caret-key-tag-free' : 'caret-key-tag-paid'}`}>
                    {provider.tag}
                </span>
            </div>

            <div className="caret-key-input-area">
                {saved ? (
                    <div className="caret-key-saved-row">
                        <span className="caret-key-saved-mask">••••••••••••••••••••••••••••</span>
                        <span className="caret-key-active">✓ ACTIVE</span>
                        <button onClick={handleClear} className="caret-key-remove">Remove</button>
                    </div>
                ) : (
                    <div className="caret-key-entry-row">
                        <div className="caret-key-entry-wrap">
                            <input
                                type={visible ? 'text' : 'password'}
                                placeholder={provider.placeholder}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="caret-key-input"
                            />
                            <button onClick={() => setVisible(v => !v)} tabIndex={-1} className="caret-key-eye">
                                {visible ? '◻' : '◼'}
                            </button>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!value.trim() || status === 'saving'}
                            className="caret-key-save-btn"
                        >
                            {status === 'saving' ? '...' : status === 'saved' ? '✓ SAVED' : 'SAVE KEY'}
                        </button>
                    </div>
                )}
                <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="caret-key-docs">
                    Get API key ↗
                </a>
            </div>
        </div >
    );
}

export default function BYOKPage() {
    const [savedKeys, setSavedKeys] = useState({});

    useEffect(() => {
        const state = {};
        providers.forEach((p) => {
            if (localStorage.getItem(`byok_${p.id}`)) state[p.id] = true;
        });
        setSavedKeys(state);
    }, []);

    const handleSave = (id) => setSavedKeys((prev) => ({ ...prev, [id]: true }));
    const handleClear = (id) => setSavedKeys((prev) => ({ ...prev, [id]: false }));

    return (
        <div className="caret-page">
            {/* ── SECTION 01: INTRO ── */}
            <section className="caret-section">
                <PanelHeader index={1} label="BRING YOUR OWN KEY" category="PRIVACY" />
                <div className="caret-hero-row">
                    <div className="caret-hero-left">
                        <h1 className="caret-hero-name" style={{ fontSize: '2.8rem' }}>Your keys,<br />your rules.</h1>
                        <p className="caret-hero-role" style={{ marginTop: '12px' }}>Unlimited access.<br />Zero server exposure.</p>
                    </div>
                    <div className="caret-hero-right">
                        <p className="caret-hero-bio">
                            Plug in your own API keys to unlock unlimited, unthrottled access to any supported LLM.
                            Your keys are encoded locally in your browser and are <strong>never sent to our servers</strong>.
                            Full control, full privacy.
                        </p>
                        <div className="caret-trust-grid">
                            {[
                                ['🔒', 'Keys stored in your browser only'],
                                ['🚫', 'Never transmitted to Pulse servers'],
                                ['⚡', 'No Pulse rate limits — use your quota'],
                                ['🔑', 'Removable at any time'],
                            ].map(([icon, label]) => (
                                <div key={label} className="caret-trust-item">
                                    <span>{icon}</span>
                                    <span className="caret-label">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 02: KEYS ── */}
            <section className="caret-section">
                <PanelHeader index={2} label="API KEYS" category="CONFIGURATION" />
                <SectionTitle>
                    Connect your<br />
                    <em>preferred LLM.</em>
                </SectionTitle>
                <div className="caret-keys-list">
                    {providers.map((p) => (
                        <KeyRow
                            key={p.id}
                            provider={p}
                            saved={!!savedKeys[p.id]}
                            onSave={handleSave}
                            onClear={handleClear}
                        />
                    ))}
                </div>
            </section>

            {/* ── SECTION 03: HOW IT WORKS ── */}
            <section className="caret-section">
                <PanelHeader index={3} label="HOW BYOK WORKS" category="TECHNICAL" />
                <SectionTitle>
                    Simple, secure,<br />
                    <em>client-side only.</em>
                </SectionTitle>
                <div className="caret-two-col">
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">Storage</div>
                        <p className="caret-card-body">
                            Your API key is encoded with base64 and written to <code>localStorage</code> in your browser. It never leaves your device unless you use it to make a request directly.
                        </p>
                    </div>
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">Usage</div>
                        <p className="caret-card-body">
                            When you send a chat message, Pulse reads your stored key and includes it in the API request to the LLM provider — not to our servers. Your key, your connection, your quota.
                        </p>
                    </div>
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">Removal</div>
                        <p className="caret-card-body">
                            Click "Remove" at any time. The key is deleted from localStorage. We have no copy. If you clear browser storage, the key is also gone automatically.
                        </p>
                    </div>
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">Fallback</div>
                        <p className="caret-card-body">
                            No key? No problem. Pulse falls back to its own shared rate-limited quota for free-tier models. BYOK simply removes all limits and adds full privacy.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── SECTION 04: FAQ ── */}
            <section className="caret-section">
                <PanelHeader index={4} label="COMMON QUESTIONS" category="FAQ" />
                <SectionTitle>
                    Answers to things<br />
                    <em>you're probably wondering.</em>
                </SectionTitle>

                {[
                    ['Is my key safe?', 'Yes. It lives only in your browser. We have no backend infrastructure that touches it.'],
                    ['What if I share my device?', "Anyone with access to your browser's localStorage can see encoded keys. Use private/incognito mode on shared devices."],
                    ['Do I need a paid API key?', 'No. Gemini and Groq both have generous free tiers. Only Claude requires a paid Anthropic account.'],
                    ['Can I use multiple keys?', 'Yes. Save all three providers and switch between them mid-session from the model selector in the chat view.'],
                ].map(([q, a]) => (
                    <div key={q} className="caret-faq-row">
                        <div className="caret-faq-q">{q}</div>
                        <div className="caret-faq-a">{a}</div>
                    </div>
                ))}
            </section>
        </div>
    );
}
