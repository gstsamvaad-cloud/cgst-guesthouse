const { z } = require('zod');
const { authenticate, requireOfficer } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { handle, ok, err, validateBody } = require('../../lib/helpers');

const roomSchema = z.object({
  label: z.string().min(1).max(100).trim(),
  type:  z.enum(['suite','room']),
});

module.exports = handle(async (req, res) => {
  const user = await authenticate(req);

  // GET — list rooms
  if (req.method === 'GET') {
    const r = await query('SELECT id,label,type FROM rooms WHERE is_active=TRUE ORDER BY type,label');
    return ok(res, { rooms: r.rows });
  }

  // POST — add room (officer only)
  if (req.method === 'POST') {
    requireOfficer(user);
    const { label, type } = validateBody(roomSchema, req.body);
    const r = await query('INSERT INTO rooms (label,type) VALUES ($1,$2) RETURNING *', [label, type]);
    query('INSERT INTO audit_log (actor_id,action,entity,entity_id,detail) VALUES ($1,$2,$3,$4,$5)',
      [user.id, 'CREATE', 'room', r.rows[0].id, JSON.stringify({ label, type })]).catch(() => {});
    return ok(res, { room: r.rows[0] }, 201);
  }

  err(res, 'Method not allowed.', 405);
});
