import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Onboarding from './Onboarding';
import IngestFlow from './IngestFlow';
import Chat from './Chat';
import HowItWorks from './pages/HowItWorks';
import HireMe from './pages/HireMe';
import BYOKPage from './pages/BYOKPage';

function NavBar() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="pulse-nav">
            {/* Logo */}
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
                <span className="font-semibold text-neutral-900 tracking-tight" style={{ fontFamily: "'Special Gothic', sans-serif", fontSize: '1.1rem' }}>Pulse</span>
            </Link>

            {/* Center nav */}
            <div className="flex-1 flex items-center justify-center gap-1">
                {[
                    { to: '/how-it-works', label: 'How It Works' },
                    { to: '/hire-me', label: 'Hire Me' },
                    { to: '/byok', label: 'BYOK' },
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

            {/* Right */}
            <div className="flex items-center gap-3 text-sm text-neutral-500">
                <a
                    href="https://github.com/herin7"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-neutral-900 transition-colors px-3 py-1.5 rounded-full hover:bg-neutral-100"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    GitHub
                </a>
                <a
                    href="mailto:herinsoni3737@gmail.com"
                    className="flex items-center gap-1.5 bg-neutral-900 text-white hover:bg-neutral-700 transition-colors px-3 py-1.5 rounded-full"
                >
                    Contact
                </a>
            </div>
        </nav>
    );
}

function HomeApp() {
    const [screen, setScreen] = useState('onboarding');
    const [formData, setFormData] = useState(null);
    const [characterCard, setCharacterCard] = useState(null);

    useEffect(() => {
        fetch('/api/session', { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                if (data.exists) {
                    localStorage.setItem('lc_user_id', data.userId);
                    setCharacterCard(data.characterCard);
                    setScreen('chat');
                }
            })
            .catch(() => { });
    }, []);

    return (
        <>
            {screen === 'onboarding' && (
                <Onboarding
                    onSubmit={(data) => {
                        setFormData(data);
                        setScreen('ingesting');
                    }}
                />
            )}
            {screen === 'ingesting' && (
                <IngestFlow
                    formData={formData}
                    onComplete={(card) => {
                        setCharacterCard(card);
                        setScreen('chat');
                    }}
                />
            )}
            {screen === 'chat' && <Chat characterCard={characterCard} />}
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <NavBar />
            <Routes>
                <Route path="/" element={<HomeApp />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/hire-me" element={<HireMe />} />
                <Route path="/byok" element={<BYOKPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
