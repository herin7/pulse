import { Router } from 'express';
import { getDueReminders } from '../db/reminders.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/due', requireAuth, async (req, res) => {
  try {
    const reminders = await getDueReminders(req.user.id);
    res.json({ reminders, count: reminders.length });
  } catch (error) {
    console.error('Failed to fetch due reminders:', error);
    res.status(500).json({ error: 'Failed to fetch due reminders' });
  }
});

export default router;
