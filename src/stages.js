// Sequência fixa de etapas de um pedido, do início ao fim.
// Mudar aqui reflete automaticamente no painel admin e na página do cliente.
const STAGES = [
  { key: 'aguardando_pagamento', label: 'Aguardando pagamento', short: 'Aguardando Pix' },
  { key: 'pago', label: 'Pagamento confirmado', short: 'Pago' },
  { key: 'corte', label: 'Corte do tecido', short: 'Corte' },
  { key: 'costura', label: 'Costura', short: 'Costura' },
  { key: 'silk', label: 'Silk / estampa', short: 'Silk' },
  { key: 'revisao', label: 'Revisão de qualidade', short: 'Revisão' },
  { key: 'embalagem', label: 'Embalagem', short: 'Embalagem' },
  { key: 'pronto', label: 'Pronto', short: 'Pronto' },
];

const CANCELED = 'cancelado';

function stageIndex(key) {
  return STAGES.findIndex((s) => s.key === key);
}

function stageInfo(key) {
  if (key === CANCELED) return { key: CANCELED, label: 'Cancelado', short: 'Cancelado' };
  return STAGES.find((s) => s.key === key) || STAGES[0];
}

function nextStageKey(key) {
  const i = stageIndex(key);
  if (i === -1 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1].key;
}

module.exports = { STAGES, CANCELED, stageIndex, stageInfo, nextStageKey };
