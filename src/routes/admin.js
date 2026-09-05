const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { STAGES, CANCELED, stageIndex, stageInfo, nextStageKey } = require('../stages');

router.use(requireAuth);

function publicLink(req, id) {
  return `${req.protocol}://${req.get('host')}/acompanhar/${id}`;
}

function whatsappLink(phone, message) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ---------- Dashboard ----------

router.get('/', (req, res) => {
  const { status, q } = req.query;
  const orders = db.listOrders({ status, search: q });
  const counts = db.countsByStatus();

  res.render('dashboard', {
    orders,
    counts,
    stages: STAGES,
    canceled: CANCELED,
    stageInfo,
    activeStatus: status || '',
    query: q || '',
  });
});

// ---------- Novo pedido ----------

router.get('/pedidos/novo', (req, res) => {
  res.render('order-form', { order: null, error: null });
});

router.post('/pedidos', (req, res) => {
  const { clientName, clientPhone, orderTitle, description, price, deadline } = req.body;
  if (!clientName || !orderTitle || !price) {
    return res.status(400).render('order-form', {
      order: req.body,
      error: 'Preencha ao menos o nome do cliente, o pedido e o valor.',
    });
  }
  const order = db.createOrder({ clientName, clientPhone, orderTitle, description, price, deadline });
  res.redirect(`/admin/pedidos/${order.id}?criado=1`);
});

// ---------- Detalhe / edição ----------

router.get('/pedidos/:id', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).render('404');

  const settings = db.getSettings();
  const isCanceled = order.status === CANCELED;
  const currentIndex = isCanceled ? -1 : stageIndex(order.status);
  const next = isCanceled ? null : nextStageKey(order.status);

  const message =
    `Oi ${order.clientName}! Aqui é da Impacto. Segue o link para acompanhar seu pedido "${order.orderTitle}": ${publicLink(req, order.id)}` +
    (order.status === 'aguardando_pagamento' && settings.pixKey
      ? `\n\nChave Pix: ${settings.pixKey}\nValor: R$ ${order.price.toFixed(2)}\nAssim que você fizer o Pix, é só me mandar o comprovante por aqui.`
      : '');

  res.render('order-detail', {
    order,
    stages: STAGES,
    canceled: CANCELED,
    currentIndex,
    nextStage: next ? stageInfo(next) : null,
    isCanceled,
    link: publicLink(req, order.id),
    whatsapp: whatsappLink(order.clientPhone, message),
    justCreated: req.query.criado === '1',
  });
});

router.post('/pedidos/:id', (req, res) => {
  const { clientName, clientPhone, orderTitle, description, price, deadline } = req.body;
  const updated = db.updateOrder(req.params.id, { clientName, clientPhone, orderTitle, description, price, deadline });
  if (!updated) return res.status(404).render('404');
  res.redirect(`/admin/pedidos/${updated.id}?salvo=1`);
});

router.post('/pedidos/:id/status', (req, res) => {
  const { status, action } = req.body;
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).render('404');

  let targetStatus = status;
  if (action === 'avancar') {
    targetStatus = nextStageKey(order.status);
  }
  if (targetStatus) {
    db.setStatus(order.id, targetStatus);
  }
  res.redirect(`/admin/pedidos/${order.id}`);
});

router.post('/pedidos/:id/excluir', (req, res) => {
  db.deleteOrder(req.params.id);
  res.redirect('/admin');
});

// ---------- Configurações ----------

router.get('/configuracoes', (req, res) => {
  res.render('settings', { settings: db.getSettings(), saved: req.query.salvo === '1' });
});

router.post('/configuracoes', (req, res) => {
  const { companyName, pixKey, pixName, supportPhone, welcomeMessage } = req.body;
  db.saveSettings({ companyName, pixKey, pixName, supportPhone, welcomeMessage });
  res.redirect('/admin/configuracoes?salvo=1');
});

module.exports = router;
