const bcrypt = require('bcryptjs');
const { z }  = require('zod');
const { query } = require('../../lib/db');
const { signToken } = require('../../lib/auth');
const { handle, ok, err, setTokenCookie, validateBody } = require('../../lib/helpers');

const schema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return err(res, 'Method not allowed.', 405);

  const { email, password } = validateBody(schema, req.body);

  const r = await query(
    'SELECT id,name,email,mobile,role,password_hash FROM users WHERE email=$1 AND is_active=TRUE',
    [email]
  );
  const user = r.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return err(res, 'Invalid email or password.', 401);

  const token = signToken(user);
  setTokenCookie(res, token);

  ok(res, {
    token,
    user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role },
  });
});
