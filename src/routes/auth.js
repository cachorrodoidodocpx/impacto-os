const express = require('express');
const router = express.Router();
const { checkCredentials } = require('../auth');
const { asyncHandler } = require('../asyncHandler');

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const admin = await checkCredentials(username, password);
    if (admin) {
      req.session.isAdmin = true;
      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;
      return res.redirect('/admin');
    }
    res.status(401).render('login', { error: 'Usuário ou senha inválidos.' });
  })
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
