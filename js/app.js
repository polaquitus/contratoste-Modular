// ════════════════════════════════════════════════════════════════════
// APP.JS - Inicialización y Orquestación
// ════════════════════════════════════════════════════════════════════

// ─── INIT APP ───────────────────────────────────────────────────────
async function initApp(__fromLogin) {
  showLoader('Conectando con Supabase...');
  
  // Event listeners para formulario
  ['f_ini','f_fin'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.onchange = calcPlazo;
  });
  
  // Require login (skip if coming from login button)
  if(!__fromLogin){
    const logged = await requireLogin();
    if(!logged){ 
      hideLoader(); 
      return; 
    }
  }

  // Load data from Supabase
  try {
    showLoader('Cargando contratos...');
    window._DB = await sbLoadTable('contratos');
    
    showLoader('Cargando ME2N...');
    const me2nObj = await sbLoadSingle('me2n');
    if (me2nObj) window.ME2N = me2nObj;
    
    showLoader('Cargando índices...');
    const idxObj = await sbLoadSingle('indices');
    if (idxObj) { 
      delete idxObj.__sbId; 
      window.IDX_STORE = idxObj; 
    }
    idxMergeOfficialSeeds();
    localStorage.setItem('idx_v2', JSON.stringify(window.IDX_STORE));
    
    showLoader('Cargando licitaciones...');
    window.LICIT_DB = await sbLoadTable('licitaciones');
    
    window.SB_OK = true;
    setSBStatus(true);
    
  } catch(e) {
    console.warn('Supabase core error:', e);
    
    // Fallback to localStorage
    loadFromLocalStorage();
    idxMergeOfficialSeeds();
    
    window.SB_OK = false;
    setSBStatus(false);
    toast('Sin conexión a Supabase — modo local activo','er');
  }

  // Load providers
  try { 
    showLoader('Cargando contratistas...'); 
    await loadProv(); 
  }
  catch(ex) { 
    console.warn('loadProv error', ex); 
    try{
      window.PROV_DB = JSON.parse(localStorage.getItem('contr_v1')) ||
        JSON.parse(localStorage.getItem('prov_v1')) || [];
    }catch(e3){
      window.PROV_DB = [];
    }
  }

  hideLoader();
  
  // Render initial view
  if(typeof buildPoly === 'function') buildPoly();
  if(typeof renderList === 'function') renderList();
  if(typeof updNav === 'function') updNav();
}

// ─── WINDOW ONLOAD ──────────────────────────────────────────────────
window.addEventListener('load', async function(){
  await initApp(false);
});

