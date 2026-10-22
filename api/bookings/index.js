const { z } = require('zod');
const { authenticate } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { getRoomType, getRate, calcNights } = require('../../lib/domain');
const { handle, ok, err, validateBody } = require('../../lib/helpers');

const bookingSchema = z.object({
  name:        z.string().min(2).max(100).trim(),
  office:      z.string().min(2).max(150).trim(),
  grp:         z.enum(['A','BC']),
  visit_type:  z.enum(['duty','private','other','retired','guest']),
  check_in:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mobile:      z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit mobile number'),
  remarks:     z.string().max(500).optional().default(''),
  pay_mode:    z.enum(['upi','cash']),
  upi_ref:     z.string().max(50).optional().default(''),
  cash_remark: z.string().max(200).optional().default(''),
}).refine(d => new Date(d.check_out) > new Date(d.check_in), { message: 'Check-out must be after check-in' })
  .refine(d => { const t = new Date(); t.setHours(0,0,0,0); return new Date(d.check_in) >= t; }, { message: 'Check-in cannot be in the past' })
  .refine(d => !(d.pay_mode === 'upi' && !d.upi_ref?.trim()), { message: 'UPI Transaction Reference is required for UPI payments' });

module.exports = handle(async (req, res) => {
  const user = await authenticate(req);

  // GET — list bookings
  if (req.method === 'GET') {
    const isOfficer = user.role === 'officer';
    const r = await query(
      `SELECT b.*,r.label AS room_label FROM bookings b LEFT JOIN rooms r ON r.id=b.room_id
       ${isOfficer ? '' : 'WHERE b.user_id=$1'} ORDER BY b.submitted_at DESC`,
      isOfficer ? [] : [user.id]
    );
    return ok(res, { bookings: r.rows });
  }

  // POST — create booking
  if (req.method === 'POST') {
    const d = validateBody(bookingSchema, req.body);
    const room_type       = getRoomType(d.grp);
    const estimated_total = getRate(d.visit_type, room_type) * calcNights(d.check_in, d.check_out);

    const r = await query(
      `INSERT INTO bookings (user_id,name,office,grp,visit_type,room_type,check_in,check_out,mobile,remarks,pay_mode,upi_ref,cash_remark,estimated_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [user.id, d.name, d.office, d.grp, d.visit_type, room_type, d.check_in, d.check_out, d.mobile, d.remarks, d.pay_mode, d.upi_ref, d.cash_remark, estimated_total]
    );
    // Audit log (non-blocking)
    query('INSERT INTO audit_log (actor_id,action,entity,entity_id,detail) VALUES ($1,$2,$3,$4,$5)',
      [user.id, 'CREATE', 'booking', r.rows[0].id, JSON.stringify({ name: d.name, check_in: d.check_in, check_out: d.check_out })]).catch(() => {});

    return ok(res, { message: 'Application submitted successfully.', booking: r.rows[0] }, 201);
  }

  err(res, 'Method not allowed.', 405);
});
