const { Pool } = require('@neondatabase/serverless');

let pool;

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

async function query(text, params = []) {
  const db = getDb();
  return db.query(text, params);
}

async function transaction(fn) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await fn({
      query: (text, params = []) => client.query(text, params),
    });

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction };
