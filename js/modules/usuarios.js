import { getState, setState } from '../state.js';
import { sbFetch } from '../supabase.js';
import { toast, showLoader, hideLoader } from '../ui.js';

const ROLE_DEFAULTS = {
  OWNER: { list: true, form: true, detail: true, me2n: true, idx: true, licit: true, prov: true, users: true },
  ADMIN: { list: true, form: true, detail: true, me2n: true, idx: true, licit: true, prov: true, users: true },
  ING_CONTRATOS: { list: true, form: true, detail: true, me2n: true, idx: false, licit: true, prov: true, users: false },
  RESP_TECNICO: { list: true, form: false, detail: true, me2n: true, idx: false, licit: false, prov: false, users: false },
  SIN_ROL: { list: true, form: false, detail: true, me2n: false, idx: false, licit: false, prov: false, users: false }
};

let userList = [];

export async function applyPermissions() {
  const role = getState('rol') || 'SIN_ROL';
  const matrix = JSON.parse(localStorage.getItem('role_permissions_v19')) || ROLE_DEFAULTS;
  const perms = matrix[role] || ROLE_DEFAULTS.SIN_ROL;
  document.querySelectorAll('.sb-nav .nv[data-mod]').forEach(el => {
    const mod = el.getAttribute('data-mod');
    el.style.display = perms[mod] ? '' : 'none';
  });
}

export function renderUsuariosView(container, actionsEl) {
  actionsEl.innerHTML = `
    <button class="btn btn-s btn-sm" id="reloadUsersBtn">Recargar</button>
    <button class="btn btn-p btn-sm" id="newUserBtn">Nuevo usuario</button>
  `;
  document.getElementById('reloadUsersBtn').addEventListener('click', loadUsers);
  document.getElementById('newUserBtn').addEventListener('click', () => openUserModal(null));
  container.innerHTML = '<div id="usersTableContainer">Cargando...</div>';
  loadUsers();
}

async function loadUsers() {
  showLoader('Cargando usuarios...');
  try {
    userList = await sbFetch('app_users', 'GET', null, '?select=id,username,role,active&order=username.asc');
    renderUserTable();
  } catch (e) {
    toast('Error cargando usuarios', 'er');
  } finally {
    hideLoader();
  }
}

function renderUserTable() {
  const container = document.getElementById('usersTableContainer');
  if (!userList.length) {
    container.innerHTML = '<div class="empty">No hay usuarios</div>';
    return;
  }
  let html = '<table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
  userList.forEach(u => {
    html += `<tr>
      <td>${esc(u.username)}</td>
      <td>${esc(u.role)}</td>
      <td>${u.active ? '✅ Activo' : '❌ Inactivo'}</td>
      <td>
        <button class="btn btn-s btn-sm" data-edit="${u.id}">Editar</button>
        <button class="btn btn-d btn-sm" data-delete="${u.id}">Eliminar</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openUserModal(btn.dataset.edit));
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteUser(btn.dataset.delete));
  });
}

function openUserModal(id) {
  // Modal de edición/creación
}

async function deleteUser(id) {
  if (!confirm('¿Eliminar usuario?')) return;
  showLoader('Eliminando...');
  try {
    await sbFetch('app_users', 'DELETE', null, `?id=eq.${id}`);
    await loadUsers();
    toast('Usuario eliminado', 'ok');
  } catch (e) {
    toast('Error al eliminar', 'er');
  } finally {
    hideLoader();
  }
}