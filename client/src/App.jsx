import { lazy, Suspense, useEffect, memo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { sessionLoaded, setFormData, setCharacterCard, setScreen } from './store/appSlice';
import { Analytics } from '@vercel/analytics/react';
import Onboarding from './Onboarding';
import IngestFlow from './IngestFlow';
import Chat from './Chat';
import AuthModal from './components/AuthModal';

const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const HireMe = lazy(() => import('./pages/HireMe'));
const BYOKPage = lazy(() => import('./pages/BYOKPage'));
const AgentSetupPage = lazy(() => import('./pages/AgentSetupPage'));

function PageShell() {
    return (
        <div style={{ minHeight: '100vh', paddingTop: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase' }}>
                Loading...
            </div>
        </div>
    );
}

function Landing() {
    const dispatch = useDispatch();

    return (
        <div className="landing-hero">
            <h1 className="landing-title">The Co-founder <br /><em>you've always wanted.</em></h1>
            <p className="landing-subtitle">
                Pulse lives in your data-GitHub, LinkedIn, and your notes-to hold you accountable,
                identify your blindspots, and help you ship faster.
            </p>
            <button
                onClick={() => dispatch({ type: 'app/setAuthModal', payload: true })}
                className="landing-btn"
            >
                Get Started
            </button>

            <div className="landing-grid">
                <div className="landing-feature">
                    <h3>Radical Candor</h3>
                    <p>Unlike ChatGPT, Pulse doesn't care about your feelings. It tells you exactly where you're failing.</p>
                </div>
                <div className="landing-feature">
                    <h3>Deep Memory</h3>
                    <p>It remembers every GitHub commit and every goal you've set, forming a complete picture of your journey.</p>
                </div>
                <div className="landing-feature">
                    <h3>Real-time Intel</h3>
                    <p>While you build, Pulse tracks your competitors and surfaces mission-critical threats proactively.</p>
                </div>
            </div>
        </div>
    );
}

const NavBar = memo(function NavBar() {
    const location = useLocation();
    const dispatch = useDispatch();
    const user = useSelector((s) => s.app.user);
    const isActive = (path) => location.pathname === path;

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {}

        localStorage.removeItem('pulse_token');
        localStorage.removeItem('lc_user_id');
        dispatch({ type: 'app/resetSession' });
    };

    return (
        <nav className="pulse-nav">
            <Link to="/" className="flex items-center gap-2.5 cursor-pointer select-none group">
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-105 transition-transform">
                    <rect x="0" y="0" width="12" height="12" rx="2" fill="#1a1a1a" />
                    <rect x="16" y="0" width="12" height="12" rx="2" fill="#1a1a1a" />
                    <rect x="0" y="16" width="12" height="12" rx="2" fill="#1a1a1a" />
                    <rect x="16" y="16" width="5" height="5" rx="1" fill="#1a1a1a" />
                    <rect x="23" y="16" width="5" height="5" rx="1" fill="#1a1a1a" />
                    <rect x="16" y="23" width="5" height="5" rx="1" fill="#1a1a1a" />
                    <rect x="23" y="23" width="5" height="5" rx="1" fill="#1a1a1a" />
                </svg>
                <span className="font-serif text-base font-semibold text-neutral-800 tracking-tight">Pulse</span>
            </Link>

            <div className="flex-1 flex items-center justify-center gap-1">
                {[
                    { to: '/how-it-works', label: 'How It Works' },
                    { to: '/hire-me', label: 'Hire Me' },
                    { to: '/byok', label: 'BYOK' },
                    { to: '/agent-setup', label: 'Agent Setup' },
                ].map(({ to, label }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`px-4 py-1.5 rounded-full text-sm transition-all ${isActive(to)
                            ? 'bg-neutral-900 text-white font-medium'
                            : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                            }`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            <div className="flex items-center gap-3 text-sm text-neutral-500">
                <a href="https://github.com/herin7" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-neutral-900 transition-colors px-3 py-1.5 rounded-full hover:bg-neutral-100">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    GitHub
                </a>
                <a href="mailto:herinsoni3737@gmail.com" className="flex items-center gap-1.5 bg-neutral-900 text-white hover:bg-neutral-700 transition-colors px-3 py-1.5 rounded-full">
                    Contact
                </a>

                {user ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2">{user.email}</span>
                        <button
                            onClick={handleLogout}
                            className="text-xs border border-neutral-300 px-3 py-1.5 rounded-full hover:bg-neutral-100 transition-all font-medium"
                        >
                            Log Out
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => dispatch({ type: 'app/setAuthModal', payload: true })}
                        className="flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 transition-colors px-4 py-1.5 rounded-full font-medium"
                    >
                        Sign In
                    </button>
                )}
            </div>
        </nav>
    );
});

function HomeApp() {
    const dispatch = useDispatch();
    const screen = useSelector((s) => s.app.screen);
    const formData = useSelector((s) => s.app.formData);
    const characterCard = useSelector((s) => s.app.characterCard);
    const sessionChecked = useSelector((s) => s.app.sessionChecked);
    const user = useSelector((s) => s.app.user);

    useEffect(() => {
        if (sessionChecked) return;

        const token = localStorage.getItem('pulse_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        fetch('/api/auth/me', {
            headers,
            credentials: 'include',
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    dispatch({ type: 'app/setAuth', payload: { user: data.user, token } });
                }
                dispatch(sessionLoaded({
                    exists: !!data.success && !!data.characterCard,
                    characterCard: data.characterCard || null,
                }));
            })
            .catch(() => dispatch(sessionLoaded({ exists: false })));
    }, [dispatch, sessionChecked]);

    if (!sessionChecked) return <PageShell />;
    if (!user) return <Landing />;

    return (
        <>
            {screen === 'onboarding' && (
                <Onboarding onSubmit={(data) => {
                    dispatch(setFormData(data));
                    dispatch(setScreen('ingesting'));
                }} />
            )}
            {screen === 'ingesting' && (
                <IngestFlow
                    formData={formData}
                    onComplete={(card) => {
                        dispatch(setCharacterCard(card));
                        dispatch(setScreen('chat'));
                    }}
                />
            )}
            {screen === 'chat' && <Chat characterCard={characterCard} />}
        </>
    );
}

function App() {
    const authModalOpen = useSelector((s) => s.app.authModalOpen);

    return (
        <BrowserRouter>
            <NavBar />
            {authModalOpen && <AuthModal />}
            <Routes>
                <Route path="/" element={<HomeApp />} />
                <Route path="/how-it-works" element={<Suspense fallback={<PageShell />}><HowItWorks /></Suspense>} />
                <Route path="/hire-me" element={<Suspense fallback={<PageShell />}><HireMe /></Suspense>} />
                <Route path="/byok" element={<Suspense fallback={<PageShell />}><BYOKPage /></Suspense>} />
                <Route path="/agent-setup" element={<Suspense fallback={<PageShell />}><AgentSetupPage /></Suspense>} />
            </Routes>
            <Analytics />
        </BrowserRouter>
    );
}

export default App;
