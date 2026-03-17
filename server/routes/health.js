import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import { Router } from 'express';

import pool from '../db/postgres.js';
import { qdrantClient } from '../db/qdrantClient.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const router = Router();
const SQLITE_PATH = fileURLToPath(new URL('../db/pulse.db', import.meta.url));

function summarizeStatus(services) {
  const values = Object.values(services);
  if (values.every((value) => value === 'ok')) return 'ok';
  if (values.every((value) => value === 'error')) return 'down';
  return 'degraded';
}

async function checkMongo() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return 'error';
  await mongoose.connection.db.admin().ping();
  return 'ok';
}

async function checkPostgres() {
  await pool.query('SELECT 1');
  return 'ok';
}

async function checkQdrant() {
  await qdrantClient.getCollections();
  return 'ok';
}

async function checkSqlite() {
  const db = new Database(SQLITE_PATH);
  try {
    db.prepare('SELECT 1').get();
    return 'ok';
  } finally {
    db.close();
  }
}

async function readStatus(check) {
  try {
    return await check();
  } catch {
    return 'error';
  }
}

router.get('/health', async (_req, res) => {
  const services = {
    qdrant: await readStatus(checkQdrant),
    sqlite: await readStatus(checkSqlite),
    postgres: await readStatus(checkPostgres),
    mongo: await readStatus(checkMongo),
  };

  res.status(200).json({
    status: summarizeStatus(services),
    services,
    uptime: process.uptime(),
    version,
    timestamp: new Date().toISOString(),
  });
});

export default router;
