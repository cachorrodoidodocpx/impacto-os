try {
  require('dotenv').config();
} catch (e) {
  // dotenv é opcional em produção (Railway injeta as variáveis direto).
}

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'impacto.sid',
    secret: process.env.SESSION_SECRET || 'troque-este-segredo-impacto',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    },
  })
);

app.use((req, res, next) => {
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  res.locals.adminUsername = (req.session && req.session.adminUsername) || null;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('404');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Algo deu errado no servidor. Confira os logs do Railway.');
});

const db = require('./db');
const PORT = process.env.PORT || 3000;

async function start() {
  await db.ensureSchema();
  app.listen(PORT, () => {
    console.log(`Impacto OS rodando na porta ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Não consegui conectar ou preparar o banco de dados Postgres:', err.message);
  console.error('Confira se a variável DATABASE_URL está configurada corretamente.');
  process.exit(1);
});
