const { authenticate } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { handle, ok, err } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  const user = await authenticate(req);

  if (req.method === 'GET') {
    const r = await query(
      `SELECT id,booking_id,type,is_read,data,created_at FROM notifications
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [user.id]
    );
    return ok(res, { notifications: r.rows, unread: r.rows.filter(n => !n.is_read).length });
  }

  if (req.method === 'PATCH') {
    await query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE', [user.id]);
    return ok(res, { message: 'Marked as read.' });
  }

  err(res, 'Method not allowed.', 405);
});
