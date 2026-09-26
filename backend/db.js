const { Pool } = require('pg');

let pool = null;
let useInMemory = false;
const inMemoryScans = new Map();
let currentId = 1;

function getPool() {
  if (!pool && !useInMemory) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/secretguard';
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.warn('PostgreSQL pool error, falling back to in-memory storage:', err.message);
      useInMemory = true;
    });
  }
  return pool;
}

async function initDb() {
  if (useInMemory) return;
  try {
    const client = getPool();
    await client.query(`
      CREATE TABLE IF NOT EXISTS repo_scans (
        id SERIAL PRIMARY KEY,
        repo_url TEXT NOT NULL,
        scanned_at TIMESTAMP DEFAULT NOW(),
        results JSONB NOT NULL
      );
    `);
    console.log('PostgreSQL repo_scans table verified/created successfully.');
  } catch (err) {
    console.warn('Could not connect to PostgreSQL. Using in-memory fallback store:', err.message);
    useInMemory = true;
  }
}

async function saveScan(repoUrl, results) {
  const scannedAt = new Date().toISOString();
  if (useInMemory) {
    const id = currentId++;
    const record = {
      id,
      repo_url: repoUrl,
      scanned_at: scannedAt,
      results
    };
    inMemoryScans.set(String(id), record);
    return record;
  }

  try {
    const client = getPool();
    const res = await client.query(
      `INSERT INTO repo_scans (repo_url, results) VALUES ($1, $2) RETURNING id, repo_url, scanned_at, results`,
      [repoUrl, JSON.stringify(results)]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('Failed to save scan to PostgreSQL, using in-memory fallback:', err.message);
    useInMemory = true;
    const id = currentId++;
    const record = {
      id,
      repo_url: repoUrl,
      scanned_at: scannedAt,
      results
    };
    inMemoryScans.set(String(id), record);
    return record;
  }
}

async function getScanById(id) {
  if (useInMemory) {
    return inMemoryScans.get(String(id)) || null;
  }

  try {
    const client = getPool();
    const res = await client.query(`SELECT id, repo_url, scanned_at, results FROM repo_scans WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    console.warn('Failed to fetch scan from PostgreSQL, falling back to in-memory store:', err.message);
    useInMemory = true;
    return inMemoryScans.get(String(id)) || null;
  }
}

module.exports = {
  initDb,
  saveScan,
  getScanById
};
