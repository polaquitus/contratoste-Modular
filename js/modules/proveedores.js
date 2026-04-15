import { getState, setState } from '../state.js';
import { saveProveedores } from '../supabase.js';
import { esc, toast } from '../ui.js';

let _provDet = null;
let _provSrch = '';

export function renderProveedoresView(container, actionsEl) {
  actionsEl.innerHTML = `
    <button class="btn btn-s btn-sm" id="importProvBtn">📥 Importar SAP</button>
    <button class="btn btn-p btn-sm" id="newProvBtn">➕ Nuevo Proveedor</button>
  `;
  document.getElementById('importProvBtn').addEventListener('click', importProvModal);
  document.getElementById('newProvBtn').addEventListener('click', () => openProvModal(null));

  if (_provDet) {
    container.innerHTML = renderProvDet(_provDet);
  } else {
    container.innerHTML = renderProvList();
  }
}

function renderProvList() {
  const proveedores = getState('proveedores');
  const srch = _provSrch.toLowerCase();
  const arr = proveedores.filter(p => !srch || (p.name || '').toLowerCase().includes(srch) || (p.vendorNum || '').includes(srch));
  let html = `<div>
    <input type="text" placeholder="Buscar..." value="${esc(_provSrch)}" id="provSrchInput" style="max-width:300px">
    <span>${arr.length} de ${proveedores.length}</span>
  </div>`;
  if (!arr.length) {
    html += '<div class="empty"><p>Sin resultados</p></div>';
  } else {
    html += '<div class="prov-grid">';
    arr.forEach(p => {
      html += `<div class="prov-card" data-id="${p.id}">
        <div class="prov-name">${esc(p.name)}</div>
        <div class="prov-num">${esc(p.vendorNum || '—')}</div>
      </div>`;
    });
    html += '</div>';
  }
  setTimeout(() => {
    document.getElementById('provSrchInput')?.addEventListener('input', (e) => {
      _provSrch = e.target.value;
      renderProveedoresView(document.getElementById('appContainer'), document.getElementById('pgA'));
    });
    document.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        _provDet = el.dataset.id;
        renderProveedoresView(document.getElementById('appContainer'), document.getElementById('pgA'));
      });
    });
  }, 0);
  return html;
}

function renderProvDet(id) {
  const prov = getState('proveedores').find(p => p.id === id);
  if (!prov) return '';
  return `<div>
    <button class="btn btn-s btn-sm" id="closeProvDetBtn">← Volver</button>
    <h2>${esc(prov.name)}</h2>
    <p>Vendor: ${esc(prov.vendorNum)}</p>
  </div>`;
}

function openProvModal(id) {
  // Modal de creación/edición
}

function importProvModal() {
  // Importación desde Excel de SAP
}

async function deleteProv(id) {
  if (!confirm('¿Eliminar proveedor?')) return;
  const proveedores = getState('proveedores').filter(p => p.id !== id);
  setState('proveedores', proveedores);
  await saveProveedores();
  renderProveedoresView(document.getElementById('appContainer'), document.getElementById('pgA'));
  toast('Proveedor eliminado', 'ok');
}