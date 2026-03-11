import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setAuth, setAuthModal, setCharacterCard, setScreen } from '../store/appSlice';

export default function AuthModal({ onClose }) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            localStorage.setItem('pulse_token', data.token);
            localStorage.setItem('lc_user_id', data.user.id);

            dispatch(setAuth({ user: data.user, token: data.token }));
            if (data.characterCard) {
                dispatch(setCharacterCard(data.characterCard));
                dispatch(setScreen('chat'));
            } else {
                dispatch(setScreen('onboarding'));
            }
            dispatch(setAuthModal(false));
            if (onClose) onClose();

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                <button
                    onClick={() => { dispatch(setAuthModal(false)); if (onClose) onClose(); }}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <h2 className="text-2xl font-serif font-semibold text-neutral-800 mb-6 tracking-tight">
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent text-sm transition-all"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent text-sm transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-neutral-500">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                        className="font-medium text-neutral-900 hover:underline focus:outline-none"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
}
