import { Router } from 'express';

import { deleteUserData } from '../db/qdrant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

router.get('/session', asyncHandler(async (req, res) => {
  if (req.session.storeDone && req.session.characterCard) {
    return res.json({
      exists: true,
      userId: req.session.userId,
      characterCard: req.session.characterCard,
    });
  }

  return res.json({ exists: false });
}));

router.delete('/session', asyncHandler(async (req, res) => {
  if (req.session.userId) {
    await deleteUserData(req.session.userId);
  }

  delete req.session.characterCard;
  delete req.session.storeDone;
  delete req.session.ingestDone;
  await saveSession(req);
  res.json({ success: true });
}));

export default router;
