const crypto = require('crypto');

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    // Ainda gasta um tempo comparável para não vazar tamanho via timing.
    crypto.timingSafeEqual(Buffer.alloc(bufA.length), Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkCredentials(username, password) {
  const validUser = safeCompare(username, process.env.ADMIN_USERNAME || 'admin');
  const validPass = safeCompare(password, process.env.ADMIN_PASSWORD || 'impacto123');
  return validUser && validPass;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/login');
}

module.exports = { checkCredentials, requireAuth };
