import pool from './postgres.js';

export async function addCompetitor(userId, name, domain) {
  const res = await pool.query(
    'INSERT INTO competitors ("userId", name, domain) VALUES ($1, $2, $3) RETURNING *',
    [userId, name, domain || null]
  );
  return res.rows[0];
}

export async function getCompetitors(userId) {
  const res = await pool.query('SELECT * FROM competitors WHERE "userId" = $1', [userId]);
  return res.rows;
}

export async function insertIntel(userId, competitorId, competitorName, summary, rawResults, category, urgency = 'low', sourceUrl = null) {
  const res = await pool.query(
    `INSERT INTO competitor_intel ("userId", "competitorId", "competitorName", summary, "rawResults", category, urgency, "sourceUrl") 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, competitorId, competitorName, summary, rawResults, category, urgency, sourceUrl]
  );
  return res.rows[0];
}

export async function getRecentSummaries(userId, competitorId, limit = 5) {
  const res = await pool.query(
    'SELECT summary FROM competitor_intel WHERE "userId" = $1 AND "competitorId" = $2 ORDER BY "fetchedAt" DESC LIMIT $3',
    [userId, competitorId, limit]
  );
  return res.rows.map(r => r.summary);
}

export async function getRecentIntel(userId, days = 7) {
  const res = await pool.query(
    `SELECT * FROM competitor_intel 
     WHERE "userId" = $1 AND "fetchedAt" >= NOW() - ($2 || ' days')::INTERVAL 
     ORDER BY CASE urgency WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, "fetchedAt" DESC`,
    [userId, days]
  );
  return res.rows;
}

export async function getIntelByCompetitor(userId, competitorId) {
  const res = await pool.query(
    'SELECT * FROM competitor_intel WHERE "userId" = $1 AND "competitorId" = $2 ORDER BY "fetchedAt" DESC',
    [userId, competitorId]
  );
  return res.rows;
}
