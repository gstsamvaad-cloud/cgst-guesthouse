const { z } = require('zod');
const { authenticate, requireOfficer } = require('../../../lib/auth');
const { query, transaction } = require('../../../lib/db');
const { getRate, calcNights, fmtDate } = require('../../../lib/domain');
const { handle, ok, err, validateBody } = require('../../../lib/helpers');
const { sendApprovalEmail } = require('../../../lib/mailer');

const schema = z.object({ room_id: z.string().uuid() });

module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return err(res, 'Method not allowed.', 405);
  const user = await authenticate(req);
  requireOfficer(user);

  const { id } = req.query;
  const { room_id } = validateBody(schema, req.body);

  await transaction(async (client) => {
    // Lock booking row
    const br = await client.query(`SELECT * FROM bookings WHERE id=$1 AND status='pending'`, [id]);
    if (!br.rows.length) throw Object.assign(new Error('Booking not found or already decided.'), { status: 404 });
    const b = br.rows[0];

    // Verify room
    const rr = await client.query('SELECT * FROM rooms WHERE id=$1 AND is_active=TRUE', [room_id]);
    if (!rr.rows.length) throw Object.assign(new Error('Room not found.'), { status: 400 });
    const room = rr.rows[0];
    if (room.type !== b.room_type)
      throw Object.assign(new Error(`Room type mismatch: booking needs a ${b.room_type}.`), { status: 400 });

    // Check overlap
    const ov = await client.query(
      `SELECT id FROM bookings WHERE room_id=$1 AND status='approved' AND check_in<$3::date AND check_out>$2::date AND id!=$4`,
      [room_id, b.check_in, b.check_out, id]
    );
    if (ov.rows.length) throw Object.assign(new Error('Room is no longer available for these dates.'), { status: 409 });

    // Approve
    await client.query(
      `UPDATE bookings SET status='approved',room_id=$1,decided_by=$2,decided_at=NOW() WHERE id=$3`,
      [room_id, user.id, id]
    );

    // Notification + email
    const n    = calcNights(b.check_in, b.check_out);
    const rate = getRate(b.visit_type, b.room_type);
    const nd   = { name: b.name, checkIn: b.check_in, checkOut: b.check_out, nights: n, roomLabel: room.label, rate, total: rate * n, payMode: b.pay_mode, upiRef: b.upi_ref };

    if (b.user_id) {
      await client.query(
        `INSERT INTO notifications (user_id,booking_id,type,data) VALUES ($1,$2,'approved',$3)`,
        [b.user_id, id, JSON.stringify(nd)]
      );
      const er = await client.query('SELECT email FROM users WHERE id=$1', [b.user_id]);
      if (er.rows.length)
        sendApprovalEmail(er.rows[0].email, { ...nd, checkIn: fmtDate(b.check_in), checkOut: fmtDate(b.check_out) });
    }

    await client.query(
      `INSERT INTO audit_log (actor_id,action,entity,entity_id,detail) VALUES ($1,'APPROVE','booking',$2,$3)`,
      [user.id, id, JSON.stringify({ room_id, room_label: room.label })]
    );
  });

  ok(res, { message: 'Booking approved. Applicant notified.' });
});
