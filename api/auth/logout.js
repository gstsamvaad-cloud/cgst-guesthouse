const { handle, ok, err, clearTokenCookie } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return err(res, 'Method not allowed.', 405);
  clearTokenCookie(res);
  ok(res, { message: 'Logged out.' });
});
