import { getState, setState } from '../state.js';
import { saveLicitaciones } from '../supabase.js';
import { fD, fN, esc, toast, showLoader, hideLoader } from '../ui.js';

let _licitDet = null;

export function renderLicitacionesView(container, actionsEl) {
  actionsEl.innerHTML = `<button class="btn btn-p btn-sm" id="newLicitBtn">➕ Nueva Licitación</button>`;
  document.getElementById('newLicitBtn').addEventListener('click', () => openLicitModal(null));

  const licitaciones = getState('licitaciones');
  if (_licitDet) {
    container.innerHTML = renderLicitDet(_licitDet);
  } else {
    container.innerHTML = renderLicitList();
  }
}

function renderLicitList() {
  const licitaciones = getState('licitaciones');
  if (!licitaciones.length) {
    return `<div class="empty"><div class="ei">📋</div><p>Sin licitaciones registradas</p></div>`;
  }
  let html = '<div>';
  licitaciones.forEach(l => {
    html += `<div class="licit-card" data-id="${l.id}">
      <div class="licit-hdr">
        <span class="licit-num">${esc(l.docAriba || l.id)}</span>
        <div class="licit-title">${esc(l.titulo)}</div>
        <button class="btn btn-s btn-sm" data-edit="${l.id}">✏️</button>
        <button class="btn btn-d btn-sm" data-delete="${l.id}">🗑️</button>
      </div>
    </div>`;
  });
  html += '</div>';
  setTimeout(() => {
    document.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        _licitDet = el.dataset.id;
        renderLicitacionesView(document.getElementById('appContainer'), document.getElementById('pgA'));
      });
    });
    document.querySelectorAll('[data-edit]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openLicitModal(el.dataset.edit);
      });
    });
    document.querySelectorAll('[data-delete]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLicit(el.dataset.delete);
      });
    });
  }, 0);
  return html;
}

function renderLicitDet(id) {
  const licit = getState('licitaciones').find(l => l.id === id);
  if (!licit) return '';
  return `<div>
    <button class="btn btn-s btn-sm" id="closeLicitDetBtn">← Volver</button>
    <h2>${esc(licit.titulo)}</h2>
    <p>Doc Ariba: ${esc(licit.docAriba)}</p>
    <!-- Más detalles... -->
  </div>`;
}

function openLicitModal(id) {
  // Implementación del modal (similar al original, usando globalModalBack)
}

async function deleteLicit(id) {
  if (!confirm('¿Eliminar esta licitación?')) return;
  const licitaciones = getState('licitaciones').filter(l => l.id !== id);
  setState('licitaciones', licitaciones);
  await saveLicitaciones();
  renderLicitacionesView(document.getElementById('appContainer'), document.getElementById('pgA'));
  toast('Licitación eliminada', 'ok');
}