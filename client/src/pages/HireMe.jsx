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

const skills = [
    { cat: 'FRONTEND', items: ['React', 'Next.js', 'Tailwind CSS', 'Figma'] },
    { cat: 'BACKEND', items: ['Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'Redis'] },
    { cat: 'AI / ML', items: ['LLM Pipelines', 'RAG', 'AST Parsing', 'ML'] },
    { cat: 'CREATIVE', items: ['Adobe CC', 'Motion Graphics', 'Sound Design'] },
    { cat: 'COMPETITIVE', items: ['LeetCode 1881', 'Codeforces 1403', 'Graphs, DP, Trees'] },
];

const projects = [
    { name: 'Pulse', desc: 'AI cofounder that builds a living model of who you are.', tag: 'Current', link: '/' },
    { name: 'WhatDoc.xyz', desc: 'AI doc generator using AST parsing for instant, structured docs.', tag: 'Live', link: 'https://whatdoc.xyz' },
    { name: 'GitForMe', desc: 'AI codebase intelligence — understand any repo in seconds.', tag: 'Live', link: '#' },
    { name: 'MiniDB Engine', desc: 'Low-level DB built from scratch — B-trees, WAL, query planner.', tag: 'Open Source', link: 'https://github.com/herin7' },
];

const socials = [
    { label: 'Email', href: 'mailto:herinsoni3737@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/herin7' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/herinsoni/' },
    { label: 'X / Twitter', href: 'https://x.com/herinnsoni' },
    { label: 'Portfolio', href: 'https://herin.vercel.app' },
];

export default function HireMe() {
    return (
        <div className="caret-page">
            {/* ── SECTION 01: INTRO ── */}
            <section className="caret-section">
                <PanelHeader index={1} label="HERIN SONI" category="IDENTITY" />
                <div className="caret-hero-row">
                    <div className="caret-hero-left">
                        <div className="caret-avail-badge">
                            <span className="caret-avail-dot" /> Available for work
                        </div>
                        <h1 className="caret-hero-name">Herin Soni</h1>
                        <p className="caret-hero-role">Performance-Obsessed<br />Full-Stack Engineer</p>
                    </div>
                    <div className="caret-hero-right">
                        <p className="caret-hero-quote">"Built different. Documented better."</p>
                        <p className="caret-hero-bio">
                            I'm a software engineer from India who treats every product like my own. I ship fast,
                            think deep, and sweat every pixel and API response. From architecture to deployment,
                            I own the entire stack — and I won't rest until it's both fast and beautiful.
                        </p>
                        <div className="caret-hero-actions">
                            <a href="mailto:herinsoni3737@gmail.com" className="caret-btn-primary">Hire Me →</a>
                            <a href="https://herin.vercel.app" target="_blank" rel="noreferrer" className="caret-btn-outline">Portfolio</a>
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="caret-stats-row">
                    {[
                        ['1881', 'LeetCode Knight Rating'],
                        ['1403', 'Codeforces Specialist'],
                        ['4+', 'Live Products'],
                        ['∞', 'Ship Velocity'],
                    ].map(([val, label]) => (
                        <div key={label} className="caret-stat-cell">
                            <div className="caret-stat-val">{val}</div>
                            <div className="caret-label">{label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── SECTION 02: SKILLS ── */}
            <section className="caret-section">
                <PanelHeader index={2} label="SKILLS & STACK" category="TECHNICAL" />
                <SectionTitle>
                    Full ownership,<br />
                    <em>full-stack.</em>
                </SectionTitle>
                <div className="caret-skills-grid">
                    {skills.map((s) => (
                        <div key={s.cat} className="caret-card">
                            <div className="caret-card-label">{s.cat}</div>
                            <div className="caret-skill-tags">
                                {s.items.map((item) => (
                                    <span key={item} className="caret-skill-tag">{item}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── SECTION 03: PROJECTS ── */}
            <section className="caret-section">
                <PanelHeader index={3} label="PROJECTS" category="WORK" />
                <SectionTitle>
                    Shipped. Live.<br />
                    <em>In production.</em>
                </SectionTitle>
                <div className="caret-two-col">
                    {projects.map((p) => (
                        <a key={p.name} href={p.link} target={p.link.startsWith('http') ? '_blank' : '_self'} rel="noreferrer" className="caret-card caret-project-card">
                            <div className="caret-project-header">
                                <span className="caret-card-label">{p.name}</span>
                                <span className="caret-project-tag">{p.tag}</span>
                            </div>
                            <p className="caret-card-body">{p.desc}</p>
                            <span className="caret-project-arrow">View →</span>
                        </a>
                    ))}
                </div>
            </section>

            {/* ── SECTION 04: EXPERIENCE ── */}
            <section className="caret-section">
                <PanelHeader index={4} label="EXPERIENCE" category="WORK HISTORY" />
                <SectionTitle>
                    Where I've been,<br />
                    <em>what I've built.</em>
                </SectionTitle>

                <div className="caret-exp-row">
                    <div className="caret-exp-meta">
                        <div className="caret-card-label">Creative Lead</div>
                        <div className="caret-exp-org">GDGoC LDCE</div>
                        <div className="caret-label">Aug 2025 – Present</div>
                    </div>
                    <div className="caret-exp-desc">
                        Leading the creative wing of Google Developer Groups on Campus. Mentoring designers, managing event branding and visual identity across the student community.
                    </div>
                </div>

                <div className="caret-exp-row" style={{ borderBottom: 'none' }}>
                    <div className="caret-exp-meta">
                        <div className="caret-card-label">Founder</div>
                        <div className="caret-exp-org">Scalex</div>
                        <div className="caret-label">Jan 2024 – Sep 2024</div>
                    </div>
                    <div className="caret-exp-desc">
                        Founded a freelance video editing agency delivering post-production for content creators. Managed end-to-end client pipeline and creative output.
                    </div>
                </div>
            </section>

            {/* ── SECTION 05: PHILOSOPHY ── */}
            <section className="caret-section">
                <PanelHeader index={5} label="PHILOSOPHY" category="HOW I WORK" />
                <SectionTitle>
                    "Don't just keep up —<br />
                    <em>set the pace."</em>
                </SectionTitle>
                <div className="caret-three-col">
                    {[
                        ['⚡ Speed & Momentum', "Ship outcomes fast. Tight feedback loops. No analysis paralysis. The best strategy is the one that gets tested."],
                        ['🏗 Full Ownership', "Architecture to deployment. If it's broken, I fix it. If it's slow, I speed it up. No handoff excuses."],
                        ['🎯 Craft & Care', "Every pixel. Every API response. The details that make the difference between good products and great ones."],
                    ].map(([title, desc]) => (
                        <div key={title} className="caret-card caret-card-textured">
                            <div className="caret-card-label">{title}</div>
                            <p className="caret-card-body">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── SECTION 06: CONTACT ── */}
            <section className="caret-section">
                <PanelHeader index={6} label="LET'S BUILD" category="CONTACT" />
                <div className="caret-cta-row">
                    <p className="caret-cta-text">
                        Reach out on any channel —<br /><em>I respond fast.</em>
                    </p>
                    <div className="caret-social-grid">
                        {socials.map((s) => (
                            <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="caret-social-cell">
                                <span className="caret-social-label">{s.label}</span>
                                <span className="caret-lbl-arrow">↗</span>
                            </a>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
