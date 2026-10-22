const bcrypt = require('bcryptjs');
const { z }  = require('zod');
const { query } = require('../../lib/db');
const { handle, ok, err, validateBody } = require('../../lib/helpers');
const { sendRegistrationEmail } = require('../../lib/mailer');

const schema = z.object({
  name:     z.string().min(2).max(100).trim(),
  email:    z.string().email().toLowerCase().trim(),
  mobile:   z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  role:     z.enum(['applicant', 'officer']),
  password: z.string().min(8, 'Min 8 characters').regex(/[A-Z]/, 'Must include uppercase').regex(/[0-9]/, 'Must include a number'),
});

module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return err(res, 'Method not allowed.', 405);

  const { name, email, mobile, role, password } = validateBody(schema, req.body);

  const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length) return err(res, 'An account with this email already exists.', 409);

  const hash = await bcrypt.hash(password, 12);
  const r = await query(
    'INSERT INTO users (name,email,mobile,role,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role',
    [name, email, mobile, role, hash]
  );

  sendRegistrationEmail(email, { name, email, role }); // fire-and-forget
  ok(res, { message: 'Account created. You can now sign in.', user: r.rows[0] }, 201);
});
