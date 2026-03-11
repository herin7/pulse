import pool from './postgres.js';

export async function insertLoop(userId, loop, source) {
  const res = await pool.query(
    'INSERT INTO open_loops ("userId", loop, source) VALUES ($1, $2, $3) RETURNING *',
    [userId, loop, source]
  );
  return res.rows[0];
}

export async function getOpenLoops(userId) {
  const res = await pool.query(
    'SELECT * FROM open_loops WHERE "userId" = $1 AND status = $2 ORDER BY "createdAt" DESC',
    [userId, 'open']
  );
  return res.rows;
}

export async function findSimilarLoop(userId, loop) {
  const prefix = loop.split(' ').slice(0, 5).join(' ') + '%';
  const res = await pool.query(
    "SELECT * FROM open_loops WHERE \"userId\" = $1 AND status = 'open' AND LOWER(loop) LIKE LOWER($2) LIMIT 1",
    [userId, prefix]
  );
  return res.rows[0] || null;
}

export async function closeLoop(userId, loopId) {
  await pool.query(
    "UPDATE open_loops SET status = 'closed', \"closedAt\" = NOW() WHERE id = $1 AND \"userId\" = $2",
    [loopId, userId]
  );
}
