import { getState, setState, updateContrato, addContrato, removeContrato } from '../state.js';
import { saveContrato } from '../supabase.js';
import { fD, fN, esc, toast, showLoader, hideLoader } from '../ui.js';
import { navigateTo } from '../navigation.js';

let editId = null;
export let detId = null; // usado en detail

export function renderContratosList(container, actionsEl) {
  actionsEl.innerHTML = `
    <div style="display:flex;gap:8px">
      <button class="btn btn-s btn-sm" id="importSapBtn">📤 Importar ME3N (SAP)</button>
      <button class="btn btn-p" id="newContractBtn">➕ Nuevo Contrato</button>
    </div>
  `;
  document.getElementById('newContractBtn').addEventListener('click', () => {
    editId = null;
    navigateTo('form');
  });
  
  const contratos = getState('contratos');
  // Aquí iría la lógica de filtros y renderizado de tabla (similar al original)
  container.innerHTML = '<div class="card">...</div>';
}

export function renderContratoForm(container, actionsEl) {
  actionsEl.innerHTML = `<button class="btn btn-s" id="cancelFormBtn">← Volver</button>`;
  document.getElementById('cancelFormBtn').addEventListener('click', () => navigateTo('list'));
  
  // Cargar datos si editId existe
  const contrato = editId ? getState('contratos').find(c => c.id === editId) : null;
  container.innerHTML = generarFormulario(contrato);
  setupFormEvents();
}

function setupFormEvents() {
  document.getElementById('saveContractBtn').addEventListener('click', async () => {
    // Validar y guardar
    const contrato = obtenerDatosFormulario();
    if (editId) {
      updateContrato(editId, contrato);
    } else {
      contrato.id = Date.now().toString(36) + Math.random().toString(36).substr(2,5);
      addContrato(contrato);
    }
    showLoader('Guardando...');
    await saveContrato(contrato);
    hideLoader();
    toast('Contrato guardado', 'ok');
    navigateTo('list');
  });
}

function generarFormulario(contrato) {
  // Retorna el HTML del formulario (similar al #vForm original)
  return `...`;
}

function obtenerDatosFormulario() {
  // Extrae los valores del formulario y retorna el objeto contrato
  return {};
}

export function renderContratoDetail(container, actionsEl) {
  const contrato = getState('contratos').find(c => c.id === detId);
  if (!contrato) return navigateTo('list');
  
  actionsEl.innerHTML = `
    <div style="display:flex;gap:8px">
      <button class="btn btn-s" id="backToListBtn">← Lista</button>
      <button class="btn btn-p btn-sm" id="editContractBtn">✏️ Editar</button>
    </div>
  `;
  document.getElementById('backToListBtn').addEventListener('click', () => navigateTo('list'));
  document.getElementById('editContractBtn').addEventListener('click', () => {
    editId = contrato.id;
    navigateTo('form');
  });
  
  container.innerHTML = generarHtmlDetalle(contrato);
}

function generarHtmlDetalle(contrato) {
  // Retorna el HTML completo del detalle (dossier, enmiendas, etc.)
  return `...`;
}