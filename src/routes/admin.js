const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { STAGES, CANCELED, stageIndex, stageInfo, nextStageKey } = require('../stages');
const { asyncHandler } = require('../asyncHandler');

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

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, q } = req.query;
    const orders = await db.listOrders({ status, search: q });
    const counts = await db.countsByStatus();
    const summary = await db.getMonthlySummary();
    const monthLabel = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    res.render('dashboard', {
      orders,
      counts,
      summary,
      monthLabel,
      stages: STAGES,
      canceled: CANCELED,
      stageInfo,
      activeStatus: status || '',
      query: q || '',
    });
  })
);

// ---------- Exportar CSV ----------

function csvEscape(value) {
  const str = String(value === undefined || value === null ? '' : value);
  if (/[";\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatMoneyBR(n) {
  return Number(n || 0).toFixed(2).replace('.', ',');
}

function formatDateBR(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

router.get(
  '/exportar.csv',
  asyncHandler(async (req, res) => {
    const orders = await db.listOrders({});
    const header = [
      'Cliente',
      'Telefone',
      'Pedido',
      'Descricao',
      'Valor (R$)',
      'Status',
      'Prazo',
      'Criado em',
      'Pago em',
      'Pronto em',
      'Link do cliente',
    ];
    const rows = orders.map((o) => [
      o.clientName,
      o.clientPhone,
      o.orderTitle,
      o.description,
      formatMoneyBR(o.price),
      o.status === CANCELED ? 'Cancelado' : stageInfo(o.status).label,
      formatDateBR(o.deadline),
      formatDateBR(o.createdAt),
      formatDateBR(o.paidAt),
      formatDateBR(o.finishedAt),
      publicLink(req, o.id),
    ]);
    const csvBody = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pedidos-impacto-${stamp}.csv"`);
    // \uFEFF (BOM) no início ajuda o Excel a reconhecer acentos corretamente.
    res.send('\uFEFF' + csvBody);
  })
);

// ---------- Novo pedido ----------

router.get('/pedidos/novo', (req, res) => {
  res.render('order-form', { order: null, error: null });
});

router.post(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const { clientName, clientPhone, orderTitle, description, price, deadline } = req.body;
    if (!clientName || !orderTitle || !price) {
      return res.status(400).render('order-form', {
        order: req.body,
        error: 'Preencha ao menos o nome do cliente, o pedido e o valor.',
      });
    }
    const order = await db.createOrder({ clientName, clientPhone, orderTitle, description, price, deadline });
    res.redirect(`/admin/pedidos/${order.id}?criado=1`);
  })
);

// ---------- Detalhe / edição ----------

router.get(
  '/pedidos/:id',
  asyncHandler(async (req, res) => {
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).render('404');

    const settings = await db.getSettings();
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
  })
);

router.post(
  '/pedidos/:id',
  asyncHandler(async (req, res) => {
    const { clientName, clientPhone, orderTitle, description, price, deadline } = req.body;
    const updated = await db.updateOrder(req.params.id, {
      clientName,
      clientPhone,
      orderTitle,
      description,
      price,
      deadline,
    });
    if (!updated) return res.status(404).render('404');
    res.redirect(`/admin/pedidos/${updated.id}?salvo=1`);
  })
);

router.post(
  '/pedidos/:id/status',
  asyncHandler(async (req, res) => {
    const { status, action } = req.body;
    const order = await db.getOrder(req.params.id);
    if (!order) return res.status(404).render('404');

    let targetStatus = status;
    if (action === 'avancar') {
      targetStatus = nextStageKey(order.status);
    }
    if (targetStatus) {
      await db.setStatus(order.id, targetStatus);
    }
    res.redirect(`/admin/pedidos/${order.id}`);
  })
);

router.post(
  '/pedidos/:id/excluir',
  asyncHandler(async (req, res) => {
    await db.deleteOrder(req.params.id);
    res.redirect('/admin');
  })
);

// ---------- Configurações ----------

router.get(
  '/configuracoes',
  asyncHandler(async (req, res) => {
    const settings = await db.getSettings();
    res.render('settings', { settings, saved: req.query.salvo === '1' });
  })
);

router.post(
  '/configuracoes',
  asyncHandler(async (req, res) => {
    const { companyName, pixKey, pixName, supportPhone, welcomeMessage } = req.body;
    await db.saveSettings({ companyName, pixKey, pixName, supportPhone, welcomeMessage });
    res.redirect('/admin/configuracoes?salvo=1');
  })
);

// ---------- Usuários do painel ----------

router.get(
  '/usuarios',
  asyncHandler(async (req, res) => {
    const admins = await db.listAdmins();
    let error = null;
    if (req.query.erro === 'ultimo') error = 'Não é possível remover o único usuário do sistema.';
    if (req.query.erro === 'proprio') error = 'Você não pode remover o usuário com o qual está logado agora.';

    res.render('users', {
      admins,
      error,
      created: req.query.criado === '1',
      deleted: req.query.excluido === '1',
      currentAdminId: req.session.adminId || null,
    });
  })
);

router.post(
  '/usuarios',
  asyncHandler(async (req, res) => {
    const { username, password, passwordConfirm } = req.body;
    const admins = await db.listAdmins();
    const currentAdminId = req.session.adminId || null;

    const fail = (error) =>
      res.status(400).render('users', { admins, error, created: false, deleted: false, currentAdminId });

    if (!username || !username.trim() || !password) {
      return fail('Preencha o usuário e a senha.');
    }
    if (password.length < 6) {
      return fail('A senha precisa ter pelo menos 6 caracteres.');
    }
    if (password !== passwordConfirm) {
      return fail('As senhas digitadas não são iguais.');
    }

    try {
      await db.createAdmin({ username, password });
    } catch (err) {
      if (err.isDuplicateUsername) {
        return fail('Já existe um usuário com esse nome.');
      }
      throw err;
    }

    res.redirect('/admin/usuarios?criado=1');
  })
);

router.post(
  '/usuarios/:id/excluir',
  asyncHandler(async (req, res) => {
    const admins = await db.listAdmins();
    if (admins.length <= 1) {
      return res.redirect('/admin/usuarios?erro=ultimo');
    }
    if (req.params.id === req.session.adminId) {
      return res.redirect('/admin/usuarios?erro=proprio');
    }
    await db.deleteAdmin(req.params.id);
    res.redirect('/admin/usuarios?excluido=1');
  })
);

module.exports = router;
