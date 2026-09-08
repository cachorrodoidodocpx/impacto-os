const crypto = require('crypto');
const { Pool } = require('pg');
const { hashPassword } = require('./passwords');

if (!process.env.DATABASE_URL) {
  console.warn(
    '[Impacto OS] Aviso: a variável DATABASE_URL não está definida. ' +
      'Configure-a com a URL de conexão do Postgres (veja o README).'
  );
}

// O Railway costuma exigir SSL só quando a URL indica isso explicitamente
// (conexão pública). Na rede interna do próprio projeto, geralmente não precisa.
const useSSL = !!(process.env.DATABASE_URL && /sslmode=require/i.test(process.env.DATABASE_URL));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL DEFAULT 'Impacto',
      pix_key TEXT NOT NULL DEFAULT '',
      pix_name TEXT NOT NULL DEFAULT '',
      support_phone TEXT NOT NULL DEFAULT '',
      welcome_message TEXT NOT NULL DEFAULT ''
    );
  `);
  await pool.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL DEFAULT '',
      order_title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ,
      history JSONB NOT NULL DEFAULT '[]'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS admins_username_lower_idx ON admins (LOWER(username));`);

  const { rows: adminCountRows } = await pool.query('SELECT COUNT(*)::int AS n FROM admins');
  if (adminCountRows[0].n === 0) {
    // Primeira vez que o sistema liga com essa tabela nova: cria o primeiro
    // usuário a partir do que já está configurado no Railway, pra ninguém
    // ficar sem acesso. Depois disso, ADMIN_USERNAME/ADMIN_PASSWORD não têm
    // mais efeito — os logins passam a ser gerenciados em /admin/usuarios.
    const seedUsername = process.env.ADMIN_USERNAME || 'admin';
    const seedPassword = process.env.ADMIN_PASSWORD || 'impacto123';
    await pool.query('INSERT INTO admins (id, username, password_hash) VALUES ($1, $2, $3)', [
      crypto.randomUUID(),
      seedUsername,
      hashPassword(seedPassword),
    ]);
    console.log(`[Impacto OS] Usuário admin inicial criado a partir das variáveis de ambiente: "${seedUsername}".`);
  }
}

function mapOrder(row) {
  const toIso = (v) => (v ? (v instanceof Date ? v.toISOString() : new Date(v).toISOString()) : null);
  return {
    id: row.id,
    clientName: row.client_name,
    clientPhone: row.client_phone || '',
    orderTitle: row.order_title,
    description: row.description || '',
    price: Number(row.price) || 0,
    deadline: row.deadline || '',
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    paidAt: toIso(row.paid_at),
    finishedAt: toIso(row.finished_at),
    canceledAt: toIso(row.canceled_at),
    history: Array.isArray(row.history) ? row.history : [],
  };
}

function mapSettings(row) {
  return {
    companyName: (row && row.company_name) || 'Impacto',
    pixKey: (row && row.pix_key) || '',
    pixName: (row && row.pix_name) || '',
    supportPhone: (row && row.support_phone) || '',
    welcomeMessage: (row && row.welcome_message) || '',
  };
}

// ---------- Settings ----------

async function getSettings() {
  const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
  return mapSettings(rows[0]);
}

async function saveSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await pool.query(
    `UPDATE settings
     SET company_name = $1, pix_key = $2, pix_name = $3, support_phone = $4, welcome_message = $5
     WHERE id = 1`,
    [merged.companyName, merged.pixKey, merged.pixName, merged.supportPhone, merged.welcomeMessage]
  );
  return merged;
}

// ---------- Orders ----------

async function listOrders({ status, search } = {}) {
  const clauses = [];
  const params = [];

  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    clauses.push(`(LOWER(client_name) LIKE $${params.length} OR LOWER(order_title) LIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);
  return rows.map(mapOrder);
}

async function getOrder(id) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

async function createOrder(input) {
  const id = crypto.randomUUID();
  const now = new Date();
  const history = [{ status: 'aguardando_pagamento', at: now.toISOString() }];

  const { rows } = await pool.query(
    `INSERT INTO orders
      (id, client_name, client_phone, order_title, description, price, deadline, status, created_at, updated_at, history)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, 'aguardando_pagamento', $8, $8, $9)
     RETURNING *`,
    [
      id,
      input.clientName.trim(),
      (input.clientPhone || '').trim(),
      input.orderTitle.trim(),
      (input.description || '').trim(),
      Number(input.price) || 0,
      input.deadline || '',
      now,
      JSON.stringify(history),
    ]
  );
  return mapOrder(rows[0]);
}

async function updateOrder(id, input) {
  const { rows } = await pool.query(
    `UPDATE orders
     SET client_name = $1, client_phone = $2, order_title = $3, description = $4,
         price = $5, deadline = $6, updated_at = $7
     WHERE id = $8
     RETURNING *`,
    [
      input.clientName.trim(),
      (input.clientPhone || '').trim(),
      input.orderTitle.trim(),
      (input.description || '').trim(),
      Number(input.price) || 0,
      input.deadline || '',
      new Date(),
      id,
    ]
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

async function setStatus(id, status) {
  const order = await getOrder(id);
  if (!order) return null;

  const now = new Date();
  const history = [...order.history, { status, at: now.toISOString() }];

  const fields = ['status = $1', 'updated_at = $2', 'history = $3'];
  const params = [status, now, JSON.stringify(history)];

  if (status === 'pago' && !order.paidAt) {
    fields.push(`paid_at = $${params.length + 1}`);
    params.push(now);
  }
  if (status === 'pronto' && !order.finishedAt) {
    fields.push(`finished_at = $${params.length + 1}`);
    params.push(now);
  }
  if (status === 'cancelado') {
    fields.push(`canceled_at = $${params.length + 1}`);
    params.push(now);
  }

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

async function deleteOrder(id) {
  const res = await pool.query('DELETE FROM orders WHERE id = $1', [id]);
  return res.rowCount > 0;
}

async function countsByStatus() {
  const { rows } = await pool.query('SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status');
  const counts = {};
  rows.forEach((r) => {
    counts[r.status] = r.count;
  });
  return counts;
}

// Faturamento do mês (pedidos pagos, com base no fuso de São Paulo).
// Brasil não usa mais horário de verão desde 2019, então UTC-3 é fixo.
async function getMonthlySummary() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value); // 1-12

  const startUtc = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)); // 00:00 em SP
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endUtc = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 3, 0, 0));

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(price), 0)::float AS total, COUNT(*)::int AS count
     FROM orders
     WHERE paid_at IS NOT NULL AND paid_at >= $1 AND paid_at < $2 AND status <> 'cancelado'`,
    [startUtc, endUtc]
  );
  return { total: Math.round(Number(rows[0].total) * 100) / 100, count: rows[0].count };
}

// ---------- Usuários do painel ----------

function mapAdmin(row) {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function listAdmins() {
  const { rows } = await pool.query('SELECT id, username, created_at FROM admins ORDER BY created_at ASC');
  return rows.map(mapAdmin);
}

async function getAdminByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
  if (!rows[0]) return null;
  return { id: rows[0].id, username: rows[0].username, passwordHash: rows[0].password_hash };
}

async function createAdmin({ username, password }) {
  const id = crypto.randomUUID();
  try {
    const { rows } = await pool.query(
      'INSERT INTO admins (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, created_at',
      [id, username.trim(), hashPassword(password)]
    );
    return mapAdmin(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('Já existe um usuário com esse nome.');
      dup.isDuplicateUsername = true;
      throw dup;
    }
    throw err;
  }
}

async function deleteAdmin(id) {
  const res = await pool.query('DELETE FROM admins WHERE id = $1', [id]);
  return res.rowCount > 0;
}

module.exports = {
  ensureSchema,
  getSettings,
  saveSettings,
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  setStatus,
  deleteOrder,
  countsByStatus,
  getMonthlySummary,
  listAdmins,
  getAdminByUsername,
  createAdmin,
  deleteAdmin,
};
