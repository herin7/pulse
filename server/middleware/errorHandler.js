import { AppError } from '../utils/AppError.js';
import { getLogContext, logger } from '../utils/logger.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error('Request failed', {
    ...getLogContext(req, { code, statusCode }),
    stack: err.stack,
  });

  const body = {
    error: err.message || 'Internal server error',
    code,
  };

  if (!IS_PRODUCTION && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
