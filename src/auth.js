const db = require('./db');
const { verifyPassword } = require('./passwords');

// Retorna o registro do admin (sem a senha) se as credenciais baterem, ou null.
async function checkCredentials(username, password) {
  if (!username || !password) return null;
  const admin = await db.getAdminByUsername(String(username).trim());
  if (!admin) return null;
  return verifyPassword(password, admin.passwordHash) ? { id: admin.id, username: admin.username } : null;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/login');
}

module.exports = { checkCredentials, requireAuth };
