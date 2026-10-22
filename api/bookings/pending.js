const { authenticate, requireOfficer } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { priorityOf } = require('../../lib/domain');
const { handle, ok, err } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  if (req.method !== 'GET') return err(res, 'Method not allowed.', 405);
  const user = await authenticate(req);
  requireOfficer(user);

  const r = await query(
    `SELECT b.*,u.email AS applicant_email FROM bookings b
     LEFT JOIN users u ON u.id=b.user_id
     WHERE b.status='pending' ORDER BY b.submitted_at ASC`
  );
  const sorted = r.rows.sort((a, b) =>
    priorityOf(a.visit_type) - priorityOf(b.visit_type) ||
    new Date(a.submitted_at) - new Date(b.submitted_at)
  );
  ok(res, { bookings: sorted });
});
