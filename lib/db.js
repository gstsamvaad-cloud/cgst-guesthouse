const { neon } = require('@neondatabase/serverless');

// neon() returns a tagged-template SQL function — one connection per invocation,
// perfect for serverless. No persistent pool needed.
function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  return neon(process.env.DATABASE_URL);
}

// Helper: run a query with params using tagged template
// Usage: await query('SELECT * FROM users WHERE id=$1', [id])
async function query(text, params = []) {
  const sql = getDb();
  // neon supports standard parameterised queries via sql.query()
  return sql.query(text, params);
}

// Transaction helper
async function transaction(fn) {
  const sql = getDb();
  // neon supports transactions via sql.transaction()
  return sql.transaction(async (txSql) => fn({ query: (t, p) => txSql.query(t, p) }));
}

module.exports = { query, transaction };
