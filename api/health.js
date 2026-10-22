const { query } = require('../lib/db');
const { handle, ok } = require('../lib/helpers');

module.exports = handle(async (req, res) => {
  try {
    await query('SELECT 1');
    ok(res, { status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});
