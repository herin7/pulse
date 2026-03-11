import jwt from 'jsonwebtoken';
import { User } from '../db/models/User.js';

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization?.split(' ')[1];
    if (authHeader && authHeader !== 'null' && authHeader !== 'undefined') {
        return authHeader;
    }

    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/pulse_token=([^;]+)/);
    return match?.[1] || null;
}

export const requireAuth = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pulse-dev-jwt-secret');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        if (!req.session) {
            req.session = {};
        }
        req.session.userId = user._id.toString();

        next();
    } catch (error) {
        console.error('[Auth] Token error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
