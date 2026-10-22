// ── CORS ──────────────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ── Responses ─────────────────────────────────────────────────────────────────
function ok(res, data, status = 200) {
  res.status(status).json(data);
}

function err(res, message, status = 400) {
  res.status(status).json({ error: message });
}

// ── Cookie helper ─────────────────────────────────────────────────────────────
function setTokenCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie',
    `token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}${isProd ? '; Secure' : ''}`
  );
}

function clearTokenCookie(res) {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

// ── Route handler wrapper — catches errors, handles OPTIONS ───────────────────
function handle(fn) {
  return async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    try {
      await fn(req, res);
    }
    catch (e) {
      // Log the exception for debugging. Never log passwords,
      // request bodies, tokens, or environment-variable values.
      console.error('[API ERROR]', {
        message: e?.message,
        stack: e?.stack,
        status: e?.status
      });

      const status = e.status || 500;
      const message =
        status === 500 && process.env.NODE_ENV === 'production'
          ? 'Internal server error.'
          : e.message;

      err(res, message, status);
    }
  };
}

// ── Zod-style body validation ─────────────────────────────────────────────────
function validateBody(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const details = r.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw Object.assign(new Error(`Validation failed: ${details}`), { status: 400 });
  }
  return r.data;
}

module.exports = { ok, err, handle, setTokenCookie, clearTokenCookie, validateBody };
