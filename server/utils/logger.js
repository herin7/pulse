import pino from 'pino';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const transport = IS_PRODUCTION
  ? undefined
  : pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
      },
    });

const baseLogger = pino(
  {
    level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  },
  transport
);

function pruneContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  );
}

function readUserId(req) {
  return req?.user?.id || req?.user?._id?.toString() || req?.session?.userId;
}

export function getLogContext(req, extra = {}) {
  const durationMs =
    extra.durationMs ??
    (typeof req?.requestStartedAt === 'number' ? Date.now() - req.requestStartedAt : undefined);

  return pruneContext({
    requestId: req?.requestId,
    userId: readUserId(req),
    durationMs,
    ...extra,
  });
}

function write(level, message, context) {
  baseLogger[level](pruneContext(context), message);
}

export const logger = {
  info(message, context = {}) {
    write('info', message, context);
  },
  warn(message, context = {}) {
    write('warn', message, context);
  },
  error(message, context = {}) {
    write('error', message, context);
  },
  debug(message, context = {}) {
    write('debug', message, context);
  },
};
