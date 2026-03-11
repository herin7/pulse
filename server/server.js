import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pool, { initDb } from './db/postgres.js';
import cron from 'node-cron';
import ingestRouter from './routes/ingest.js';
import storeRouter from './routes/store.js';
import chatRouter from './routes/chat.js';
import configRouter from './routes/config.js';
import sessionRouter from './routes/session.js';
import competitorsRouter from './routes/competitors.js';
import gmailRouter from './routes/gmail.js';
import loopsRouter from './routes/loops.js';
import remindersRouter from './routes/reminders.js';
import authRouter from './routes/auth.js';
import agentSetupRouter from './routes/agentSetup.js';
import { runDailyTracker } from './agents/competitorTracker.js';
import { runScheduledEmailQueue } from './agents/emailScheduler.js';
import { connectMongo } from './db/mongo.js';

const pgStore = pgSession(session);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  store: new pgStore({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'pulse-dev-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(ingestRouter);
app.use(storeRouter);
app.use(chatRouter);
app.use(configRouter);
app.use('/api', sessionRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/loops', loopsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/auth', authRouter);
app.use('/api/agent-setup', agentSetupRouter);

Promise.all([initDb(), connectMongo()]).then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    runScheduledEmailQueue().catch((error) => {
      console.error('[Scheduler] Initial email queue run failed:', error);
    });

    setInterval(() => {
      runScheduledEmailQueue().catch((error) => {
        console.error('[Scheduler] Email queue run failed:', error);
      });
    }, 30000);

    if (process.env.TRACKER_USER_ID) {
      cron.schedule('0 8 * * *', () => {
        console.log('[Cron] Running daily competitor tracker...');
        runDailyTracker(process.env.TRACKER_USER_ID);
      });
      console.log('[Cron] Daily competitor tracker scheduled at 08:00');
    }
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
