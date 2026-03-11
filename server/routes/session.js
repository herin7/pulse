import { Router } from 'express';
import { deleteUserData } from '../db/qdrant.js';

const router = Router();

router.get('/session', (req, res) => {
  if (req.session.storeDone && req.session.characterCard) {
    return res.json({
      exists: true,
      userId: req.session.userId,
      characterCard: req.session.characterCard,
    });
  }
  res.json({ exists: false });
});

router.delete('/session', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (userId) {
      await deleteUserData(userId);
    }

    delete req.session.characterCard;
    delete req.session.storeDone;
    delete req.session.ingestDone;

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Session delete error:', err);
    res.status(500).json({ error: 'Failed to reset profile' });
  }
});

export default router;
