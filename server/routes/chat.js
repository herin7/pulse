import { Router } from 'express';

import multer from 'multer';

import { requireAuth } from '../middleware/auth.js';
import { buildChatResult } from '../services/chatService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/chat', requireAuth, upload.array('files'), asyncHandler(async (req, res) => {
  const message = req.body.message;
  const history = typeof req.body.history === 'string' ? JSON.parse(req.body.history) : (req.body.history || []);
  const files = req.files || [];

  if (!message && !files.length) {
    throw new AppError('message or files are required', 400, 'EMPTY_CHAT_REQUEST');
  }

  res.json(await buildChatResult({ files, history, message, req }));
}));

export default router;
