const { authenticate } = require('../../lib/auth');
const { handle, ok, err } = require('../../lib/helpers');

module.exports = handle(async (req, res) => {
  if (req.method !== 'GET') return err(res, 'Method not allowed.', 405);
  const user = await authenticate(req);
  ok(res, { user });
});
