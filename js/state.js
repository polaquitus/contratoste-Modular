export const state = {
  contratos: [],
  me2n: {},
  indices: {},
  licitaciones: [],
  proveedores: [],
  usuario: null,
  rol: null,
  loading: false
};

const listeners = new Map();

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

export function setState(key, value) {
  const oldValue = state[key];
  state[key] = value;
  if (listeners.has(key)) {
    listeners.get(key).forEach(cb => cb(value, oldValue));
  }
}

export function getState(key) {
  return state[key];
}

export function updateContrato(id, changes) {
  const contratos = state.contratos;
  const index = contratos.findIndex(c => c.id === id);
  if (index !== -1) {
    contratos[index] = { ...contratos[index], ...changes };
    setState('contratos', [...contratos]);
  }
}

export function addContrato(contrato) {
  setState('contratos', [...state.contratos, contrato]);
}

export function removeContrato(id) {
  setState('contratos', state.contratos.filter(c => c.id !== id));
}