const { authenticate } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { calcNights } = require('../../lib/domain');
const { handle, ok, err } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  if (req.method !== 'GET') return err(res, 'Method not allowed.', 405);
  await authenticate(req);

  const { check_in, check_out, room_type } = req.query;
  if (!check_in || !check_out || !['suite','room'].includes(room_type))
    return err(res, 'check_in, check_out and room_type (suite|room) are required.', 400);

  const rooms = (await query(
    'SELECT id,label,type FROM rooms WHERE type=$1 AND is_active=TRUE ORDER BY label',
    [room_type]
  )).rows;

  const busyRes = await query(
    `SELECT DISTINCT room_id FROM bookings
     WHERE room_id=ANY($1::uuid[]) AND status='approved'
       AND check_in<$3::date AND check_out>$2::date`,
    [rooms.map(r => r.id), check_in, check_out]
  );
  const busyIds = new Set(busyRes.rows.map(r => r.room_id));
  const result  = rooms.map(r => ({ ...r, available: !busyIds.has(r.id) }));

  ok(res, {
    check_in, check_out, room_type,
    nights:      calcNights(check_in, check_out),
    rooms:       result,
    free_count:  result.filter(r => r.available).length,
    total_count: result.length,
  });
});
