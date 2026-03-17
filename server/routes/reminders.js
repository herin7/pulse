import { Router } from 'express';

import { getDueReminders } from '../db/reminders.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/due', requireAuth, asyncHandler(async (req, res) => {
  const reminders = await getDueReminders(req.user.id);
  res.json({ reminders, count: reminders.length });
}));

export default router;
