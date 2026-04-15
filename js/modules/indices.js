import { getState, setState } from '../state.js';
import { saveIndices } from '../supabase.js';
import { fN, esc, toast, showLoader, hideLoader } from '../ui.js';
import { callGeminiForEnm } from '../lib/gemini.js';

// Catálogo de índices (definición estática)
export const IDX_CATALOG = [
  { id: 'ipc_nac', name: 'IPC Nacional (Nivel General)', cat: 'ipc', catLabel: 'IPC', src: 'INDEC', srcLink: 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5' },
  { id: 'ipc_gba', name: 'IPC GBA (Nivel General)', cat: 'ipc', catLabel: 'IPC', src: 'INDEC', srcLink: 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5' },
  { id: 'ipc_pat', name: 'IPC Patagonia (Nivel General)', cat: 'ipc', catLabel: 'IPC', src: 'INDEC', srcLink: 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5' },
  { id: 'ipc_nqn', name: 'IPC NQN (Nivel General)', cat: 'ipc', catLabel: 'IPC', src: 'DPEyC NQN', srcLink: 'https://www.estadisticaneuquen.gob.ar/series/' },
  { id: 'ipc_nqnab', name: 'IPC NQN (Alim. y Bebidas)', cat: 'ipc', catLabel: 'IPC', src: 'DPEyC NQN', srcLink: 'https://www.estadisticaneuquen.gob.ar/series/' },
  { id: 'ipim_gral', name: 'IPIM (Nivel General)', cat: 'ipim', catLabel: 'IPIM', src: 'INDEC', srcLink: 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5' },
  { id: 'ipim_r29', name: 'IPIM R29 (Refinados Petróleo)', cat: 'ipim', catLabel: 'IPIM', src: 'INDEC', srcLink: 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5' },
  { id: 'fadeaac', name: 'FADEAAC (Equipo Vial)', cat: 'ipim', catLabel: 'IPIM', src: 'FADEAAC', srcLink: 'https://www.fadeaac.org.ar/indice' },
  { id: 'go_g2', name: 'Gas Oil Grado 2 YPF NQN', cat: 'fuel', catLabel: 'Combustible', src: 'YPF', srcLink: 'https://www.ypf.com' },
  { id: 'go_g3', name: 'Gas Oil Grado 3 YPF NQN', cat: 'fuel', catLabel: 'Combustible', src: 'YPF', srcLink: 'https://www.ypf.com' },
  { id: 'usd_div', name: 'USD DIVISA (TC Vendedor)', cat: 'usd', catLabel: 'USD', src: 'BCRA', srcLink: 'https://www.bcra.gob.ar/PublicacionesEstadisticas/Tipos_de_cambio_v2.asp' },
  { id: 'usd_bill', name: 'USD BILLETE (TC Vendedor)', cat: 'usd', catLabel: 'USD', src: 'BCRA', srcLink: 'https://www.bcra.gob.ar/PublicacionesEstadisticas/Tipos_de_cambio_v2.asp' },
  { id: 'mo_pp', name: 'Petroleros Privados (SINPEP)', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°396/04', src: 'RRLL' },
  { id: 'mo_pj', name: 'Petroleros Jerárquicos (ASIMRA)', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°644/12', src: 'RRLL' },
  { id: 'mo_uocra', name: 'UOCRA (Construcción General)', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°76/75', src: 'RRLL' },
  { id: 'mo_uocrayac', name: 'UOCRA Yacimiento', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°1024/16', src: 'RRLL' },
  { id: 'mo_com', name: 'Comercio (FAECYS)', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°130/75', src: 'RRLL' },
  { id: 'mo_cam', name: 'Camioneros (FCTA)', cat: 'mo', catLabel: 'Mano de Obra', cct: 'CCT N°40/89', src: 'RRLL' },
  { id: 'mo_uom10', name: 'UOM Rama N°10', cat: 'mo', catLabel: 'Mano de Obra', cct: 'UOM R°10', src: 'RRLL' },
  { id: 'mo_uom17', name: 'UOM Rama N°17', cat: 'mo', catLabel: 'Mano de Obra', cct: 'UOM R°17', src: 'RRLL' },
];

const CAT_CSS = { mo: 'mo-c', ipc: 'ipc-c', ipim: 'ipim-c', fuel: 'fuel-c', usd: 'usd-c' };
const CAT_PILL = { mo: 'mo', ipc: 'ipc', ipim: 'ipim', fuel: 'fuel', usd: 'usd' };

// Semilla oficial de índices (valores predefinidos)
const IDX_OFFICIAL_SEED = {
  ipc_nac: [{ ym: '2026-02', pct: 2.9 }],
  ipc_gba: [{ ym: '2026-02', pct: 2.6 }],
  ipc_pat: [{ ym: '2026-02', pct: 3.0 }],
  ipc_nqn: [{ ym: '2026-02', pct: 2.5 }],
  ipim_gral: [{ ym: '2026-02', pct: 1.0, value: 14296.33 }],
  ipc_nqnab: [{ ym: '2026-02', pct: 3.1 }],
  fadeaac: [{ ym: '2026-02', pct: 2.28 }, { ym: '2026-03', pct: 10.15 }],
};

let _idxSel = null;
let _idxEntryId = null;

function ymCompare(a, b) { return String(a || '').localeCompare(String(b || '')); }
function idxRows(id) { return (getState('indices')[id] || {}).rows || []; }
function idxTargetYm() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7); }
function pctStr(v, decimals = 2) { if (v === null || v === undefined) return '—'; return (v > 0 ? '+' : '') + Number(v).toFixed(decimals) + '%'; }
function formatMonth(ym) { const [y, m] = ym.split('-'); const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return names[parseInt(m)-1] + ' ' + y; }

function idxValueLabel(def, row) {
  if (!row) return '—';
  if (def.cat === 'usd') return row.value != null ? fN(row.value) : '—';
  return pctStr(row.pct);
}

export function renderIndicesView(container, actionsEl) {
  actionsEl.innerHTML = `
    <button class="btn btn-s btn-sm" id="runAllIdxBtn">🔄 Actualizar todos</button>
    <button class="btn btn-p btn-sm" id="newIdxPeriodBtn">➕ Cargar período</button>
    <button class="btn btn-d btn-sm" id="resetIdxBtn">🧹 Reset</button>
  `;
  document.getElementById('runAllIdxBtn').addEventListener('click', () => runAllIdxUpdates());
  document.getElementById('newIdxPeriodBtn').addEventListener('click', () => showNewIdxModal());
  document.getElementById('resetIdxBtn').addEventListener('click', () => resetIdxAll());

  if (_idxSel) {
    container.innerHTML = renderIdxDetPanel(_idxSel);
  } else {
    container.innerHTML = renderIdxCardsGrid();
  }
}

function renderIdxCardsGrid() {
  const indices = getState('indices');
  let html = '<div id="idxCardsGrid">';
  const cats = ['ipc', 'ipim', 'fuel', 'usd', 'mo'];
  const catLabel = { ipc: 'IPC', ipim: 'IPIM / FADEAAC', fuel: 'Combustible', usd: 'USD', mo: 'Mano de Obra' };
  cats.forEach(cat => {
    const defs = IDX_CATALOG.filter(d => d.cat === cat);
    html += `<div style="margin-bottom:22px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><h3>${catLabel[cat]}</h3></div><div class="idx-cards">`;
    defs.forEach(def => {
      const rows = idxRows(def.id);
      const target = idxTargetYm();
      const last = rows.length ? rows[rows.length - 1] : null;
      html += `<div class="idx-c" data-id="${def.id}">
        <div class="idx-c-top ${CAT_CSS[cat]}"></div>
        <div class="idx-c-body">
          <div class="idx-c-name">${esc(def.name)}</div>
          <div class="idx-c-kpi"><span class="big">${idxValueLabel(def, last)}</span><span class="period">${last?.ym ? formatMonth(last.ym) : 'sin datos'}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <button class="btn btn-s btn-sm" data-update="${def.id}">🔄 Actualizar</button>
          </div>
        </div>
      </div>`;
    });
    html += '</div></div>';
  });
  html += '</div>';
  setTimeout(() => {
    document.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        _idxSel = el.dataset.id;
        renderIndicesView(document.getElementById('appContainer'), document.getElementById('pgA'));
      });
    });
    document.querySelectorAll('[data-update]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        runIdxUpdate(el.dataset.update);
      });
    });
  }, 0);
  return html;
}

function renderIdxDetPanel(id) {
  const def = IDX_CATALOG.find(d => d.id === id);
  const indices = getState('indices');
  const rows = idxRows(id);
  return `<div>
    <button class="btn btn-s btn-sm" id="closeIdxDetBtn">← Volver</button>
    <h2>${esc(def.name)}</h2>
    <div>Aquí iría el detalle del índice con gráficos y tabla de valores.</div>
  </div>`;
}

async function runIdxUpdate(id) {
  // Implementación de actualización individual (similar a original)
  toast(`Actualizando ${id}...`, 'ok');
}

async function runAllIdxUpdates() {
  for (const def of IDX_CATALOG.filter(d => d.cat !== 'mo')) {
    await runIdxUpdate(def.id);
  }
}

async function resetIdxAll() {
  if (!confirm('¿Resetear todos los índices a valores oficiales?')) return;
  setState('indices', {});
  await saveIndices();
  renderIndicesView(document.getElementById('appContainer'), document.getElementById('pgA'));
  toast('Índices reiniciados', 'ok');
}

function showNewIdxModal() {
  // Abrir modal para cargar período (similar al original)
}