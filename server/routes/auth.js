import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../db/models/User.js';
import { getCharacterCard } from '../db/qdrant.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pulse-dev-jwt-secret';
const AUTH_COOKIE_NAME = 'pulse_token';
const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '30d'
    });
};

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization?.split(' ')[1];
    if (authHeader && authHeader !== 'null' && authHeader !== 'undefined') {
        return authHeader;
    }

    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
    return match?.[1] || null;
}

function setAuthCookie(res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: AUTH_COOKIE_MAX_AGE,
        path: '/',
    });
}

function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
}

router.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = await User.create({ email, password });
        const token = generateToken(user._id);
        const characterCard = await getCharacterCard(user._id.toString());
        setAuthCookie(res, token);

        req.session.userId = user._id.toString();
        if (characterCard) {
            req.session.characterCard = characterCard;
            req.session.storeDone = true;
        }

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email
            },
            characterCard
        });
    } catch (error) {
        console.error('[Auth] Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user._id);
        const characterCard = await getCharacterCard(user._id.toString());
        setAuthCookie(res, token);

        req.session.userId = user._id.toString();
        if (characterCard) {
            req.session.characterCard = characterCard;
            req.session.storeDone = true;
        }

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email
            },
            characterCard
        });
    } catch (error) {
        console.error('[Auth] Signin error:', error);
        res.status(500).json({ error: 'Server error during signin' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: 'Not authenticated' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) return res.status(401).json({ error: 'User not found' });
        const characterCard = await getCharacterCard(user._id.toString());

        req.session.userId = user._id.toString();
        if (characterCard) {
            req.session.characterCard = characterCard;
            req.session.storeDone = true;
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email
            },
            characterCard
        });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    req.session?.destroy?.(() => {
        res.json({ success: true });
    });
});

export default router;
