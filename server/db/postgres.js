import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export default pool;

export async function query(text, params) {
    return await pool.query(text, params);
}

// ── INITIALIZE TABLES ────────────────────────────────────────────────────────
export async function initDb() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Competitors Table (using quotes for camelCase compatibility)
        await client.query(`
      CREATE TABLE IF NOT EXISTS competitors (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT,
        "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Competitor Intel Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS competitor_intel (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "competitorId" INTEGER NOT NULL,
        "competitorName" TEXT NOT NULL,
        summary TEXT NOT NULL,
        "rawResults" TEXT NOT NULL,
        category TEXT NOT NULL,
        urgency TEXT DEFAULT 'low',
        "fetchedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Open Loops Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS open_loops (
        id SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        loop TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "closedAt" TIMESTAMP
      )
    `);

        // Session Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

        await client.query('COMMIT');
        console.log('[DB] PostgreSQL Tables Initialized (with camelCase columns)');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[DB] Failed to initialize PostgreSQL Tables:', e);
        throw e;
    } finally {
        client.release();
    }
}
