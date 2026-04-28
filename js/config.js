// ════════════════════════════════════════════════════════════════════
// CONFIG.JS - Configuración Supabase y Variables Globales
// ════════════════════════════════════════════════════════════════════

// Supabase Config
const SB_URL = 'https://upxsqroxbvzwudcaklvn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweHNxcm94YnZ6d3VkY2FrbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTg4NjYsImV4cCI6MjA5MTIzNDg2Nn0.EgXWuLg3ip66PnuCvK01XFj3QDMZDu7PDG21BwkzkNo';
const SB_HDR = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Global State
window._APP_USER = null;
window._APP_ROLE = null;
window.SB_OK = false;

// Data Stores
window._DB = [];
window.ME2N = {};
window.IDX_STORE = {};
window.LICIT_DB = [];
window.PROV_DB = [];

// UI State
window.editId = null;
window.detId = null;
window._idxSel = null;
window.files = [];
window.poDetOA = null;

// Roles & Permissions
const ROLE_MODULES = {
  owner: ['list','form','me2n','idx','licit','prov','users'],
  ing_contratos: ['list','form','me2n','idx','licit','prov'],
  resp_tecnico: ['list','me2n','idx']
};

// Índices Catalog
window.IDX_CATALOG = [
  // ── IPC ─────────────────────────────────────────────────────────
  {id:'ipc_nac', name:'IPC Nacional (Nivel General)', cat:'ipc',catLabel:'IPC', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31'},
  {id:'ipc_nqn', name:'IPC NQN (Nivel General)', cat:'ipc',catLabel:'IPC', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31'},
  {id:'ipc_nqn_alim', name:'IPC NQN (Alim. y Bebidas)', cat:'ipc',catLabel:'IPC', src:'DPEYC NQN', srcLink:'https://www.estadisticaneuquen.gob.ar/indice-de-precios-al-consumidor/'},
  // ── IPIM ─────────────────────────────────────────────────────────
  {id:'ipim_gral', name:'IPIM (Nivel General)', cat:'ipim',catLabel:'IPIM', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5'},
  {id:'ipim_r29', name:'IPIM R29 (Refinados Petróleo)', cat:'ipim',catLabel:'IPIM', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5'},
  {id:'fadeaac', name:'FADEAAC (Equipo Vial)', cat:'ipim',catLabel:'IPIM', src:'FADEAAC',srcLink:'https://www.fadeaac.org.ar/indice'},
  // ── Combustible ─────────────────────────────────────────────────
  {id:'fuel_gasoil_nqn', name:'Gasoil Neuquén', cat:'fuel',catLabel:'Comb.', src:'SE', srcLink:'https://www.argentina.gob.ar/economia/energia/hidrocarburos/precios'},
  {id:'fuel_super_nqn', name:'Super Neuquén', cat:'fuel',catLabel:'Comb.', src:'SE', srcLink:'https://www.argentina.gob.ar/economia/energia/hidrocarburos/precios'},
  // ── USD ──────────────────────────────────────────────────────────
  {id:'usd_oficial', name:'USD Oficial (BNA)', cat:'usd',catLabel:'USD', src:'BNA', srcLink:'https://www.bna.com.ar/Personas'},
  {id:'usd_mep', name:'USD MEP', cat:'usd',catLabel:'USD', src:'Ámbito', srcLink:'https://www.ambito.com/contenidos/dolar-mep.html'},
  // ── Mano de Obra ─────────────────────────────────────────────────
  {id:'mo_uocra', name:'UOCRA', cat:'mo',catLabel:'MO', cct:'CCT 76/75', src:'RRLL', srcLink:''},
  {id:'mo_smata', name:'SMATA', cat:'mo',catLabel:'MO', cct:'CCT 27/88', src:'RRLL', srcLink:''}
];

// Official Seeds (hardcoded fallback data)
window.IDX_OFFICIAL_SEED = {
  ipc_nac: [
    {ym:'2026-02',pct:2.90,value:null,publishedAt:'2026-03-12',sourceUrl:'https://www.indec.gob.ar/uploads/informesdeprensa/ipc_03_26E496462825.pdf',source:'INDEC',note:'IPC Nacional Feb 2026'}
  ],
  ipc_nqn: [
    {ym:'2026-02',pct:3.10,value:null,publishedAt:'2026-03-14',sourceUrl:'',source:'INDEC',note:'IPC NQN Feb 2026'}
  ]
};

// CSS Category Classes
window.CAT_CSS = {
  ipc: 'ipc-c',
  ipim: 'ipim-c',
  fuel: 'fuel-c',
  usd: 'usd-c',
  mo: 'mo-c'
};

window.CAT_PILL = {
  ipc: 'ipc',
  ipim: 'ipim',
  fuel: 'fuel',
  usd: 'usd',
  mo: 'mo'
};
