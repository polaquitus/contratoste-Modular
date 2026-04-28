// ════════════════════════════════════════════════════════════════════
// CONFIG.JS - Configuración y Namespace Global
// ════════════════════════════════════════════════════════════════════

// NAMESPACE ÚNICO - Todo el estado de la app vive aquí
window.APP = {
  
  // ─── CONFIGURACIÓN ────────────────────────────────────────────────
  config: {
    VERSION: '0.222',
    SB_URL: 'https://upxsqroxbvzwudcaklvn.supabase.co',
    SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweHNxcm94YnZ6d3VkY2FrbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTg4NjYsImV4cCI6MjA5MTIzNDg2Nn0.EgXWuLg3ip66PnuCvK01XFj3QDMZDu7PDG21BwkzkNo',
    SB_HDR: null // Se construye en init()
  },
  
  // ─── DATOS ────────────────────────────────────────────────────────
  data: {
    contratos: [],      // Antes: DB / _DB
    me2n: {},           // Antes: ME2N
    indices: {},        // Antes: IDX_STORE
    licitaciones: [],   // Antes: LICIT_DB
    proveedores: [],    // Antes: PROV_DB
    usuarios: []        // Nuevo: para módulo usuarios
  },
  
  // ─── ESTADO UI ────────────────────────────────────────────────────
  state: {
    currentPage: 'list',
    editId: null,       // ID del contrato en edición
    detailId: null,     // ID del contrato en vista detalle
    selectedIndex: null, // Índice seleccionado en módulo
    files: [],          // Archivos adjuntos temporales
    poDetail: null,     // PO en vista detalle
    supabaseOK: false,  // Estado conexión Supabase
    user: null,         // Usuario logueado
    role: null          // Rol del usuario
  },
  
  // ─── CATÁLOGOS ────────────────────────────────────────────────────
  catalogs: {
    indices: [
      // IPC
      {id:'ipc_nac', name:'IPC Nacional (Nivel General)', cat:'ipc', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31'},
      {id:'ipc_nqn', name:'IPC NQN (Nivel General)', cat:'ipc', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31'},
      {id:'ipc_nqn_alim', name:'IPC NQN (Alim. y Bebidas)', cat:'ipc', src:'DPEYC NQN', srcLink:'https://www.estadisticaneuquen.gob.ar/indice-de-precios-al-consumidor/'},
      // IPIM
      {id:'ipim_gral', name:'IPIM (Nivel General)', cat:'ipim', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5'},
      {id:'ipim_r29', name:'IPIM R29 (Refinados Petróleo)', cat:'ipim', src:'INDEC', srcLink:'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5'},
      {id:'fadeaac', name:'FADEAAC (Equipo Vial)', cat:'ipim', src:'FADEAAC', srcLink:'https://www.fadeaac.org.ar/indice'},
      // Combustible
      {id:'fuel_gasoil_nqn', name:'Gasoil Neuquén', cat:'fuel', src:'SE', srcLink:'https://www.argentina.gob.ar/economia/energia/hidrocarburos/precios'},
      {id:'fuel_super_nqn', name:'Super Neuquén', cat:'fuel', src:'SE', srcLink:'https://www.argentina.gob.ar/economia/energia/hidrocarburos/precios'},
      // USD
      {id:'usd_oficial', name:'USD Oficial (BNA)', cat:'usd', src:'BNA', srcLink:'https://www.bna.com.ar/Personas'},
      {id:'usd_mep', name:'USD MEP', cat:'usd', src:'Ámbito', srcLink:'https://www.ambito.com/contenidos/dolar-mep.html'},
      // Mano de Obra
      {id:'mo_uocra', name:'UOCRA', cat:'mo', cct:'CCT 76/75', src:'RRLL', srcLink:''},
      {id:'mo_smata', name:'SMATA', cat:'mo', cct:'CCT 27/88', src:'RRLL', srcLink:''}
    ],
    
    officialSeeds: {
      ipc_nac: [{ym:'2026-02',pct:2.90,value:null,publishedAt:'2026-03-12',source:'INDEC',note:'IPC Nacional Feb 2026'}],
      ipc_nqn: [{ym:'2026-02',pct:3.10,value:null,publishedAt:'2026-03-14',source:'INDEC',note:'IPC NQN Feb 2026'}]
    },
    
    cssClasses: {
      ipc: 'ipc-c',
      ipim: 'ipim-c',
      fuel: 'fuel-c',
      usd: 'usd-c',
      mo: 'mo-c'
    },
    
    pillClasses: {
      ipc: 'ipc',
      ipim: 'ipim',
      fuel: 'fuel',
      usd: 'usd',
      mo: 'mo'
    }
  },
  
  // ─── PERMISOS POR ROL ─────────────────────────────────────────────
  permissions: {
    owner: ['list','form','me2n','idx','licit','prov','users'],
    ing_contratos: ['list','form','me2n','idx','licit','prov'],
    resp_tecnico: ['list','me2n','idx']
  },
  
  // ─── CACHE ────────────────────────────────────────────────────────
  cache: {
    rendered: {},       // Cache de HTML renderizado
    computed: {},       // Cálculos cacheados
    lastUpdate: null    // Timestamp última actualización
  },
  
  // ─── API PÚBLICA ──────────────────────────────────────────────────
  // Las funciones se agregarán en otros módulos
  api: {},
  
  // ─── UTILIDADES ───────────────────────────────────────────────────
  utils: {},
  
  // ─── VALIDADORES ──────────────────────────────────────────────────
  validators: {},
  
  // ─── INICIALIZACIÓN ───────────────────────────────────────────────
  init: function() {
    // Construir headers Supabase
    this.config.SB_HDR = {
      'apikey': this.config.SB_KEY,
      'Authorization': 'Bearer ' + this.config.SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    
    console.log('[APP] Namespace inicializado v' + this.config.VERSION);
  }
};

// Auto-inicializar
APP.init();

// ═══════════════════════════════════════════════════════════════════
// ALIAS Y COMPATIBILIDAD - Para bundle.js original
// ═══════════════════════════════════════════════════════════════════

// Alias cortos apuntando a APP
window.DATA = APP.data;
window.STATE = APP.state;
window.CONFIG = APP.config;

// Variables globales simples que bundle.js usa
window.DB = APP.data.contratos;
window.ME2N = APP.data.me2n;
window.IDX_STORE = APP.data.indices;
window.LICIT_DB = APP.data.licitaciones;
window.PROV_DB = APP.data.proveedores;
window.SB_OK = false;
window.editId = null;
window.detId = null;
window._idxSel = null;
window.files = [];
window.poDetOA = null;
