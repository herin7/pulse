import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'pulse.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS open_loops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    loop TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    createdAt TEXT DEFAULT (datetime('now')),
    closedAt TEXT
  )
`);

export function insertLoop(userId, loop, source) {
  const stmt = db.prepare(
    'INSERT INTO open_loops (userId, loop, source) VALUES (?, ?, ?)'
  );
  const result = stmt.run(userId, loop, source);
  return db.prepare('SELECT * FROM open_loops WHERE id = ?').get(result.lastInsertRowid);
}

export function getOpenLoops(userId) {
  return db
    .prepare('SELECT * FROM open_loops WHERE userId = ? AND status = ? ORDER BY createdAt DESC')
    .all(userId, 'open');
}

export function findSimilarLoop(userId, loop) {
  const prefix = loop.split(' ').slice(0, 5).join(' ') + '%';
  return db
    .prepare("SELECT * FROM open_loops WHERE userId = ? AND status = 'open' AND lower(loop) LIKE lower(?) LIMIT 1")
    .get(userId, prefix);
}

export function closeLoop(userId, loopId) {
  db.prepare(
    "UPDATE open_loops SET status = 'closed', closedAt = datetime('now') WHERE id = ? AND userId = ?"
  ).run(loopId, userId);
}
