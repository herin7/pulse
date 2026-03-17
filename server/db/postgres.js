import 'dotenv/config';

import pg from 'pg';

import { logger } from '../utils/logger.js';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  logger.warn('DATABASE_URL is missing');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS competitors (id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS competitor_intel (id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL, "competitorId" INTEGER NOT NULL, "competitorName" TEXT NOT NULL, summary TEXT NOT NULL, "rawResults" TEXT NOT NULL, category TEXT NOT NULL, urgency TEXT DEFAULT 'low', "sourceUrl" TEXT, "fetchedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `ALTER TABLE competitor_intel ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT`,
  `CREATE TABLE IF NOT EXISTS open_loops (id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL, loop TEXT NOT NULL, source TEXT NOT NULL, status TEXT DEFAULT 'open', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "closedAt" TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS reminders (id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL, task TEXT NOT NULL, source TEXT NOT NULL, "remindAt" TIMESTAMP NOT NULL, status TEXT DEFAULT 'pending', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "deliveredAt" TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS email_actions (id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL, "toEmail" TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, "providerMessageId" TEXT, "threadId" TEXT, source TEXT NOT NULL, "scheduledFor" TIMESTAMP, "sentAt" TIMESTAMP, "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP`,
  `ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP`,
  `ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
];

export default pool;

export async function query(text, params) {
  return pool.query(text, params);
}

async function ensureSessionTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" ("sid" varchar NOT NULL COLLATE "default", "sess" json NOT NULL, "expire" timestamp(6) NOT NULL) WITH (OIDS=FALSE);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

export async function initDb() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const statement of MIGRATIONS) {
      await client.query(statement);
    }
    await ensureSessionTable(client);
    await client.query('COMMIT');
    logger.info('PostgreSQL schema ready');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('PostgreSQL schema init failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}
