import { User } from '../db/models/User.js';
import { AppError } from '../utils/AppError.js';
import { getTokenFromRequest, verifyAuthToken } from '../utils/authTokens.js';

export async function requireAuth(req, _res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    req.session.userId = user._id.toString();
    next();
  } catch (error) {
    next(error);
  }
}
