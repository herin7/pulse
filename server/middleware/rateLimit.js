import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function passThrough(_req, _res, next) {
  next();
}

function buildHandler() {
  return (req, res) => {
    const retryAfterMs = req.rateLimit?.resetTime instanceof Date
      ? Math.max(req.rateLimit.resetTime.getTime() - Date.now(), 0)
      : 0;
    const retryAfter = Math.max(Math.ceil(retryAfterMs / 1000), 1);
    res.status(429).json({ error: 'Too many requests', retryAfter });
  };
}

function getUserKey(req) {
  return req.user?.id || req.user?._id?.toString() || ipKeyGenerator(req);
}

function createRateLimit(options) {
  return IS_PRODUCTION ? rateLimit(options) : passThrough;
}

export const authRateLimit = createRateLimit({
  limit: 10,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
  handler: buildHandler(),
});

export const chatRateLimit = createRateLimit({
  limit: 30,
  standardHeaders: true,
  windowMs: 60 * 1000,
  keyGenerator: getUserKey,
  handler: buildHandler(),
});

export const ingestRateLimit = createRateLimit({
  limit: 5,
  standardHeaders: true,
  windowMs: 60 * 60 * 1000,
  keyGenerator: getUserKey,
  handler: buildHandler(),
});
