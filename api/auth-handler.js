const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../lib/db');
const { signToken, authenticate } = require('../lib/auth');
const {
  handle, ok, err, setTokenCookie, clearTokenCookie, validateBody
} = require('../lib/helpers');
const { sendRegistrationEmail } = require('../lib/mailer');

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  role: z.enum(['applicant', 'officer']),
  password: z.string().min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[0-9]/, 'Must include a number'),
});

module.exports = handle(async (req, res) => {
  const route = req.query.route;

  if (route === 'login') {
    if (req.method !== 'POST')
      return err(res, 'Method not allowed.', 405);

    const { email, password } = validateBody(loginSchema, req.body);
    const r = await query(
      'SELECT id,name,email,mobile,role,password_hash FROM users WHERE email=$1 AND is_active=TRUE',
      [email]
    );
    const user = r.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return err(res, 'Invalid email or password.', 401);

    const token = signToken(user);
    setTokenCookie(res, token);

    return ok(res, {
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        mobile: user.mobile, role: user.role
      }
    });
  }

  if (route === 'logout') {
    if (req.method !== 'POST')
      return err(res, 'Method not allowed.', 405);

    clearTokenCookie(res);
    return ok(res, { message: 'Logged out.' });
  }

  if (route === 'me') {
    if (req.method !== 'GET')
      return err(res, 'Method not allowed.', 405);

    const user = await authenticate(req);
    return ok(res, { user });
  }

  if (route === 'register') {
    if (req.method !== 'POST')
      return err(res, 'Method not allowed.', 405);

    const { name, email, mobile, role, password } =
      validateBody(registerSchema, req.body);

    const existing = await query(
      'SELECT id FROM users WHERE email=$1', [email]
    );
    if (existing.rows.length)
      return err(res, 'An account with this email already exists.', 409);

    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      'INSERT INTO users (name,email,mobile,role,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role',
      [name, email, mobile, role, hash]
    );

    sendRegistrationEmail(email, { name, email, role });
    return ok(res, {
      message: 'Account created. You can now sign in.',
      user: r.rows[0]
    }, 201);
  }

  return err(res, 'Unknown authentication route.', 404);
});
