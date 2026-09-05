const express = require('express');
const router = express.Router();
const { checkCredentials } = require('../auth');

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.status(401).render('login', { error: 'Usuário ou senha inválidos.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
