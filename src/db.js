const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, '..', 'data', 'db.json');

function nowIso() {
  return new Date().toISOString();
}

function ensureFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      settings: {
        companyName: 'Impacto',
        pixKey: '',
        pixName: '',
        supportPhone: '',
        welcomeMessage: '',
      },
      orders: {},
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readData() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.settings) parsed.settings = {};
    if (!parsed.orders) parsed.orders = {};
    return parsed;
  } catch (e) {
    throw new Error(
      `O arquivo de dados (${DATA_FILE}) está corrompido ou vazio. Detalhe: ${e.message}`
    );
  }
}

function writeData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- Settings ----------

function getSettings() {
  return readData().settings;
}

function saveSettings(patch) {
  const data = readData();
  data.settings = { ...data.settings, ...patch };
  writeData(data);
  return data.settings;
}

// ---------- Orders ----------

function listOrders({ status, search } = {}) {
  const data = readData();
  let orders = Object.values(data.orders);

  if (status) {
    orders = orders.filter((o) => o.status === status);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    orders = orders.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        (o.orderTitle || '').toLowerCase().includes(q)
    );
  }

  orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return orders;
}

function getOrder(id) {
  const data = readData();
  return data.orders[id] || null;
}

function createOrder(input) {
  const data = readData();
  const id = crypto.randomUUID();
  const ts = nowIso();
  const order = {
    id,
    clientName: input.clientName.trim(),
    clientPhone: (input.clientPhone || '').trim(),
    orderTitle: input.orderTitle.trim(),
    description: (input.description || '').trim(),
    price: Number(input.price) || 0,
    deadline: input.deadline || '',
    status: 'aguardando_pagamento',
    pixKeySnapshot: data.settings.pixKey || '',
    createdAt: ts,
    updatedAt: ts,
    paidAt: null,
    finishedAt: null,
    canceledAt: null,
    history: [{ status: 'aguardando_pagamento', at: ts }],
  };
  data.orders[id] = order;
  writeData(data);
  return order;
}

function updateOrder(id, input) {
  const data = readData();
  const order = data.orders[id];
  if (!order) return null;
  order.clientName = input.clientName.trim();
  order.clientPhone = (input.clientPhone || '').trim();
  order.orderTitle = input.orderTitle.trim();
  order.description = (input.description || '').trim();
  order.price = Number(input.price) || 0;
  order.deadline = input.deadline || '';
  order.updatedAt = nowIso();
  writeData(data);
  return order;
}

function setStatus(id, status) {
  const data = readData();
  const order = data.orders[id];
  if (!order) return null;
  const ts = nowIso();
  order.status = status;
  order.updatedAt = ts;
  order.history.push({ status, at: ts });
  if (status === 'pago' && !order.paidAt) order.paidAt = ts;
  if (status === 'pronto' && !order.finishedAt) order.finishedAt = ts;
  if (status === 'cancelado') order.canceledAt = ts;
  writeData(data);
  return order;
}

function deleteOrder(id) {
  const data = readData();
  if (!data.orders[id]) return false;
  delete data.orders[id];
  writeData(data);
  return true;
}

function countsByStatus() {
  const orders = Object.values(readData().orders);
  const counts = {};
  for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
  return counts;
}

module.exports = {
  DATA_FILE,
  getSettings,
  saveSettings,
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  setStatus,
  deleteOrder,
  countsByStatus,
};
