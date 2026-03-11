import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'pulse.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT,
    addedAt TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS competitor_intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    competitorId INTEGER NOT NULL,
    competitorName TEXT NOT NULL,
    summary TEXT NOT NULL,
    rawResults TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT DEFAULT 'low',
    fetchedAt TEXT DEFAULT (datetime('now'))
  )
`);

// Migration: add urgency column if missing
try {
  db.exec("ALTER TABLE competitor_intel ADD COLUMN urgency TEXT DEFAULT 'low'");
} catch (e) {
  // Column already exists
}

export function addCompetitor(userId, name, domain) {
  const stmt = db.prepare('INSERT INTO competitors (userId, name, domain) VALUES (?, ?, ?)');
  const result = stmt.run(userId, name, domain || null);
  return db.prepare('SELECT * FROM competitors WHERE id = ?').get(result.lastInsertRowid);
}

export function getCompetitors(userId) {
  return db.prepare('SELECT * FROM competitors WHERE userId = ?').all(userId);
}

export function insertIntel(userId, competitorId, competitorName, summary, rawResults, category, urgency = 'low') {
  const stmt = db.prepare(
    'INSERT INTO competitor_intel (userId, competitorId, competitorName, summary, rawResults, category, urgency) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, competitorId, competitorName, summary, rawResults, category, urgency);
  return db.prepare('SELECT * FROM competitor_intel WHERE id = ?').get(result.lastInsertRowid);
}

export function getRecentIntel(userId, days = 7) {
  return db
    .prepare(
      "SELECT * FROM competitor_intel WHERE userId = ? AND fetchedAt >= datetime('now', ? || ' days') ORDER BY CASE urgency WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, fetchedAt DESC"
    )
    .all(userId, -days);
}

export function getIntelByCompetitor(userId, competitorId) {
  return db
    .prepare('SELECT * FROM competitor_intel WHERE userId = ? AND competitorId = ? ORDER BY fetchedAt DESC')
    .all(userId, competitorId);
}
