export function showLoader(msg) {
  let el = document.getElementById('sb-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-loader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(20,48,58,.88);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
    el.innerHTML = '<div style="width:52px;height:52px;border:4px solid rgba(255,255,255,.15);border-top-color:#4c96ad;border-radius:50%;animation:sbl .8s linear infinite"></div><div id="sb-lmsg" style="color:#fff;font-size:14px;font-weight:500"></div><style>@keyframes sbl{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(el);
  }
  document.getElementById('sb-lmsg').textContent = msg;
  el.style.display = 'flex';
}

export function hideLoader() {
  const el = document.getElementById('sb-loader');
  if (el) el.style.display = 'none';
}

export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = (type === 'ok' ? '✓ ' : '✕ ') + msg;
  el.className = 'toast ' + type;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

export function fD(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fN(num) {
  if (num == null || num === '') return '—';
  if (typeof num === 'string') {
    num = parseFloat(num.replace(/\./g, '').replace(',', '.'));
  }
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}