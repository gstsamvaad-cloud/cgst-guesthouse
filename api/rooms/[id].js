const { authenticate, requireOfficer } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { handle, ok, err } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  if (req.method !== 'DELETE') return err(res, 'Method not allowed.', 405);
  const user = await authenticate(req);
  requireOfficer(user);

  const { id } = req.query;
  await query('UPDATE rooms SET is_active=FALSE WHERE id=$1', [id]);
  query('INSERT INTO audit_log (actor_id,action,entity,entity_id) VALUES ($1,$2,$3,$4)',
    [user.id, 'DELETE', 'room', id]).catch(() => {});

  ok(res, { message: 'Room removed.' });
});
