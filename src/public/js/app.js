document.addEventListener('click', function (e) {
  const btn = e.target.closest('.js-copy');
  if (!btn) return;

  let text = btn.getAttribute('data-copy-text');
  if (!text) {
    const targetSelector = btn.getAttribute('data-copy-target');
    const targetEl = targetSelector ? document.querySelector(targetSelector) : null;
    text = targetEl ? targetEl.textContent : '';
  }
  text = (text || '').trim();
  if (!text) return;

  const originalLabel = btn.getAttribute('data-label-default') || btn.textContent;
  const copiedLabel = btn.getAttribute('data-label-copied') || 'Copiado!';

  const finish = () => {
    btn.textContent = copiedLabel;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.classList.remove('copied');
    }, 1800);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(finish).catch(() => fallbackCopy(text, finish));
  } else {
    fallbackCopy(text, finish);
  }
});

function fallbackCopy(text, done) {
  const tmp = document.createElement('textarea');
  tmp.value = text;
  tmp.style.position = 'fixed';
  tmp.style.opacity = '0';
  document.body.appendChild(tmp);
  tmp.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    /* ignora, nada a fazer sem clipboard API */
  }
  document.body.removeChild(tmp);
  done();
}

document.addEventListener('click', function (e) {
  const row = e.target.closest('tr.js-row-link');
  if (!row) return;
  if (e.target.closest('a, button, input')) return;
  window.location = row.getAttribute('data-href');
});

document.addEventListener('submit', function (e) {
  const form = e.target;
  const message = form.getAttribute('data-confirm');
  if (message && !window.confirm(message)) {
    e.preventDefault();
  }
});
