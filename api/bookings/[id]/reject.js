const { authenticate, requireOfficer } = require('../../../lib/auth');
const { query, transaction } = require('../../../lib/db');
const { fmtDate } = require('../../../lib/domain');
const { handle, ok, err } = require('../../../lib/helpers');
const { sendRejectionEmail } = require('../../../lib/mailer');

module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return err(res, 'Method not allowed.', 405);
  const user = await authenticate(req);
  requireOfficer(user);

  const { id } = req.query;

  await transaction(async (client) => {
    const br = await client.query(`SELECT * FROM bookings WHERE id=$1 AND status='pending'`, [id]);
    if (!br.rows.length) throw Object.assign(new Error('Booking not found or already decided.'), { status: 404 });
    const b = br.rows[0];

    await client.query(
      `UPDATE bookings SET status='rejected',decided_by=$1,decided_at=NOW() WHERE id=$2`,
      [user.id, id]
    );

    if (b.user_id) {
      const nd = { name: b.name, checkIn: b.check_in, checkOut: b.check_out };
      await client.query(
        `INSERT INTO notifications (user_id,booking_id,type,data) VALUES ($1,$2,'rejected',$3)`,
        [b.user_id, id, JSON.stringify(nd)]
      );
      const er = await client.query('SELECT email FROM users WHERE id=$1', [b.user_id]);
      if (er.rows.length)
        sendRejectionEmail(er.rows[0].email, { ...nd, checkIn: fmtDate(b.check_in), checkOut: fmtDate(b.check_out) });
    }

    await client.query(
      `INSERT INTO audit_log (actor_id,action,entity,entity_id) VALUES ($1,'REJECT','booking',$2)`,
      [user.id, id]
    );
  });

  ok(res, { message: 'Booking rejected. Applicant notified.' });
});
