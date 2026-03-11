import { useEffect, useRef } from 'react';

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

const steps = [
    {
        icon: '◎',
        title: 'Dump Your Context',
        body: 'Paste the output of your AI conversation — the raw profile your LLM assembled about you. No forms, no checkboxes. Just raw, honest signal.',
        detail: 'Works with ChatGPT, Claude, Gemini, or any LLM of your choice.',
    },
    {
        icon: '⌥',
        title: 'Connect Your Stack',
        body: 'Link your LinkedIn and GitHub. Pulse parses your repos, career arc, and commit patterns — building a founder profile that actually reflects how you work.',
        detail: 'GitHub username + LinkedIn paste. Takes 30 seconds.',
    },
    {
        icon: '✦',
        title: 'Synthesise Your Character Card',
        body: "Pulse runs your data through a structured AI pipeline extracting your core drive, blind spots, operating mode, and north star into a living Character Card.",
        detail: 'RAG-powered. Context-aware. Updates as you grow.',
    },
    {
        icon: '⬡',
        title: 'Chat With Your AI Cofounder',
        body: 'Ask anything — strategy, positioning, copy, accountability. Pulse responds knowing exactly who you are: your stage, stack, ambitions, and blind spots.',
        detail: 'Supports Gemini, Groq Llama, Claude. Switchable mid-session.',
    },
    {
        icon: '◈',
        title: 'Track Competitors & Loops',
        body: "Pulse watches your market automatically. Get competitor intel delivered. Accountability loops ensure you follow through on what you said you'd do.",
        detail: 'Urgency scoring. Overdue loop nudges. No manual tracking.',
    },
];

const features = [
    ['Personalized Context', 'Every response shaped by your unique founder profile, not a generic system prompt.'],
    ['RAG Memory', 'Retrieval-Augmented Generation pulls the most relevant chunks per query.'],
    ['Competitor Intel', 'Automated market monitoring with urgency scoring — know what matters.'],
    ['BYOK Ready', 'Plug in your own API key. Unlimited, private, unthrottled usage.'],
    ['Accountability Loops', "Tracks commitments you make and surfaces them when they're overdue."],
    ['Session Persistence', 'Your character card sticks across sessions — context that actually lasts.'],
];

export default function HowItWorks() {
    const cardRef = useRef([]);

    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('caret-card-visible')),
            { threshold: 0.1 }
        );
        cardRef.current.forEach((el) => el && obs.observe(el));
        return () => obs.disconnect();
    }, []);

    return (
        <div className="caret-page">
            {/* ── SECTION 01: OVERVIEW ── */}
            <section className="caret-section">
                <PanelHeader index={1} label="HOW IT WORKS" category="OVERVIEW" />
                <SectionTitle>
                    Pulse builds a living model<br />
                    of <em>who you are.</em>
                </SectionTitle>
                <div className="caret-two-col">
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">The problem</div>
                        <p className="caret-card-body">
                            Every chatbot you use today knows <em>nothing</em> about you. You re-explain your context on every session. It gives you generic advice. You close the tab frustrated.
                        </p>
                    </div>
                    <div className="caret-card caret-card-textured">
                        <div className="caret-card-label">The Pulse approach</div>
                        <p className="caret-card-body">
                            Pulse inverts this. It builds a Character Card — a living, structured profile of you — and uses it to colour <em>every single response</em> it gives. Context sticks. Advice lands.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── SECTION 02: STEPS ── */}
            <section className="caret-section">
                <PanelHeader index={2} label="THE FLOW" category="STEP BY STEP" />
                <SectionTitle>
                    Five steps from stranger<br />
                    to <em>strategic partner.</em>
                </SectionTitle>

                {steps.map((s, i) => (
                    <div
                        key={s.title}
                        ref={(el) => (cardRef.current[i] = el)}
                        className={`caret-step-row caret-card-anim ${i % 2 === 0 ? '' : 'caret-step-row-alt'}`}
                    >
                        <div className="caret-step-left">
                            <div className="caret-step-icon">{s.icon}</div>
                            <div className="caret-step-num">{String(i + 1).padStart(2, '0')}</div>
                        </div>
                        <div className="caret-step-main">
                            <div className="caret-card-label">{s.title}</div>
                            <p className="caret-card-body">{s.body}</p>
                        </div>
                        <div className="caret-step-right">
                            <p className="caret-step-detail">{s.detail}</p>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── SECTION 03: FEATURES ── */}
            <section className="caret-section">
                <PanelHeader index={3} label="UNDER THE HOOD" category="FEATURES" />
                <SectionTitle>
                    Everything working<br />
                    <em>behind the scenes.</em>
                </SectionTitle>
                <div className="caret-three-col">
                    {features.map(([title, desc]) => (
                        <div key={title} className="caret-card">
                            <div className="caret-card-dot" />
                            <div className="caret-card-label">{title}</div>
                            <p className="caret-card-body">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── SECTION 04: CTA ── */}
            <section className="caret-section">
                <PanelHeader index={4} label="GET STARTED" category="CTA" />
                <div className="caret-cta-row">
                    <p className="caret-cta-text">
                        Ready to build with an AI that <em>actually knows you?</em>
                    </p>
                    <div className="caret-cta-actions">
                        <a href="/" className="caret-btn-primary">Start for free →</a>
                        <a href="/byok" className="caret-btn-outline">Bring your own key</a>
                    </div>
                </div>
            </section>
        </div>
    );
}
