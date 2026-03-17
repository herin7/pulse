import { AppError } from '../utils/AppError.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      next(new AppError(issue?.message || 'Invalid request body', 400, 'INVALID_BODY'));
      return;
    }

    req.body = result.data;
    next();
  };
}
