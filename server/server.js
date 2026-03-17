import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import pgSession from 'connect-pg-simple';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import cron from 'node-cron';

import { runDailyTracker } from './agents/competitorTracker.js';
import { runScheduledEmailQueue } from './agents/emailScheduler.js';
import pool, { closeDb, initDb } from './db/postgres.js';
import { connectMongo, disconnectMongo } from './db/mongo.js';
import { authRateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import agentSetupRouter from './routes/agentSetup.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import competitorsRouter from './routes/competitors.js';
import configRouter from './routes/config.js';
import gmailRouter from './routes/gmail.js';
import healthRouter from './routes/health.js';
import ingestRouter from './routes/ingest.js';
import loopsRouter from './routes/loops.js';
import remindersRouter from './routes/reminders.js';
import sessionRouter from './routes/session.js';
import storeRouter from './routes/store.js';
import { getLogContext, logger } from './utils/logger.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const sessionStore = pgSession(session);
let activeRequests = 0;
let httpServer;
let shuttingDown = false;

function mountRequestContext() {
  app.use((req, res, next) => {
    if (shuttingDown) {
      res.status(503).json({ error: 'Server is shutting down' });
      return;
    }

    req.requestId = randomUUID();
    req.requestStartedAt = Date.now();
    activeRequests += 1;
    res.setHeader('x-request-id', req.requestId);
    res.on('finish', () => {
      activeRequests = Math.max(activeRequests - 1, 0);
      logger.info('Request completed', {
        ...getLogContext(req, { durationMs: Date.now() - req.requestStartedAt }),
        method: req.method,
        route: req.originalUrl,
        statusCode: res.statusCode,
      });
    });
    next();
  });
}

function mountMiddleware() {
  app.use(cors({ origin: ['http://localhost:5173', 'https://pulse-client-olive.vercel.app'], credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(session({
    store: new sessionStore({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET || 'pulse-dev-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
  }));
}

function mountRoutes() {
  app.use(healthRouter);
  app.use(ingestRouter);
  app.use(storeRouter);
  app.use(chatRouter);
  app.use(configRouter);
  app.use('/api', sessionRouter);
  app.use('/api/auth', authRateLimit, authRouter);
  app.use('/api/agent-setup', agentSetupRouter);
  app.use('/api/competitors', competitorsRouter);
  app.use('/api/gmail', gmailRouter);
  app.use('/api/loops', loopsRouter);
  app.use('/api/reminders', remindersRouter);
  app.use(errorHandler);
}

function startSchedulers() {
  runScheduledEmailQueue().catch((error) => {
    logger.error('Initial scheduled email run failed', { error: error.message });
  });

  setInterval(() => {
    runScheduledEmailQueue().catch((error) => {
      logger.error('Scheduled email run failed', { error: error.message });
    });
  }, 30000);

  if (process.env.TRACKER_USER_ID) {
    cron.schedule('0 8 * * *', () => {
      runDailyTracker(process.env.TRACKER_USER_ID).catch((error) => {
        logger.error('Daily tracker run failed', { error: error.message });
      });
    });
  }
}

async function waitForInFlightRequests(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (activeRequests > 0 && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down...', { signal });

  const forceExit = setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await waitForInFlightRequests(5000);
    await Promise.allSettled([disconnectMongo(), closeDb()]);
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    logger.error('Shutdown failed', { error: error.message });
    process.exit(1);
  }
}

async function startServer() {
  await Promise.all([initDb(), connectMongo()]);
  httpServer = app.listen(port, () => {
    logger.info('Server started', { port });
  });
  startSchedulers();
}

mountRequestContext();
mountMiddleware();
mountRoutes();

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

startServer().catch((error) => {
  logger.error('Server failed to start', { error: error.message, stack: error.stack });
  process.exit(1);
});
