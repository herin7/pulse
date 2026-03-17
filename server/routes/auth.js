import { Router } from 'express';

import { User } from '../db/models/User.js';
import { getCharacterCard } from '../db/qdrant.js';
import { AppError } from '../utils/AppError.js';
import { clearAuthCookie, createAuthToken, getTokenFromRequest, setAuthCookie, verifyAuthToken } from '../utils/authTokens.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function validateCredentials(email, password) {
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400, 'INVALID_CREDENTIALS');
  }
}

function attachSessionProfile(req, userId, characterCard) {
  req.session.userId = userId;

  if (characterCard) {
    req.session.characterCard = characterCard;
    req.session.storeDone = true;
  }
}

function buildAuthResponse(user, token, characterCard) {
  return {
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
    },
    characterCard,
  };
}

router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  validateCredentials(email, password);

  if (await User.findOne({ email })) {
    throw new AppError('User already exists', 400, 'USER_EXISTS');
  }

  const user = await User.create({ email, password });
  const token = createAuthToken(user._id);
  const characterCard = await getCharacterCard(user._id.toString());

  setAuthCookie(res, token);
  attachSessionProfile(req, user._id.toString(), characterCard);
  res.status(201).json(buildAuthResponse(user, token, characterCard));
}));

router.post('/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  validateCredentials(email, password);

  const user = await User.findOne({ email });
  const isMatch = user ? await user.comparePassword(password) : false;

  if (!user || !isMatch) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const token = createAuthToken(user._id);
  const characterCard = await getCharacterCard(user._id.toString());

  setAuthCookie(res, token);
  attachSessionProfile(req, user._id.toString(), characterCard);
  res.json(buildAuthResponse(user, token, characterCard));
}));

router.get('/me', asyncHandler(async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    throw new AppError('Not authenticated', 401, 'AUTH_REQUIRED');
  }

  const decoded = verifyAuthToken(token);
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  const characterCard = await getCharacterCard(user._id.toString());
  attachSessionProfile(req, user._id.toString(), characterCard);
  res.json({
    success: true,
    user: { id: user._id, email: user.email },
    characterCard,
  });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  if (req.session?.destroy) {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
  }
  res.json({ success: true });
}));

export default router;
