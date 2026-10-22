const jwt = require('jsonwebtoken');
const { query } = require('./db');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// Extract token from Authorization header or cookie string
function extractToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // Parse cookie header manually (no cookie-parser in serverless)
  const cookies = req.headers['cookie'] || '';
  const match = cookies.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? match[1] : null;
}

async function authenticate(req) {
  const token = extractToken(req);
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch (e) {
    throw Object.assign(
      new Error(e.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session.'),
      { status: 401 }
    );
  }
  const r = await query('SELECT id,name,email,mobile,role FROM users WHERE id=$1 AND is_active=TRUE', [payload.sub]);
  if (!r.rows.length) throw Object.assign(new Error('Account not found or deactivated.'), { status: 401 });
  return r.rows[0];
}

function requireOfficer(user) {
  if (user.role !== 'officer') throw Object.assign(new Error('Officer access required.'), { status: 403 });
}

module.exports = { signToken, authenticate, requireOfficer, extractToken };
