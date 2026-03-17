import { Router } from 'express';

import multer from 'multer';

import { chatRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { buildChatResult } from '../services/chatService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { chatBodySchema } from '../validators/chatValidator.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/chat', requireAuth, chatRateLimit, upload.array('files'), validateBody(chatBodySchema), asyncHandler(async (req, res) => {
  const { history, message } = req.body;
  const files = req.files || [];

  if (!message && !files.length) {
    throw new AppError('message or files are required', 400, 'EMPTY_CHAT_REQUEST');
  }

  res.json(await buildChatResult({ files, history, message, req }));
}));

export default router;
