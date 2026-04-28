// ════════════════════════════════════════════════════════════════════
// STORAGE.JS - localStorage y Supabase wrappers
// ════════════════════════════════════════════════════════════════════

// ─── SUPABASE FETCH WRAPPER ─────────────────────────────────────────
async function sbFetch(table, method='GET', body=null, filter='') {
  const url = `${SB_URL}/rest/v1/${table}${filter}`;
  const opts = {method, headers: SB_HDR};
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${method} ${table} ${r.status}`);
  return method === 'DELETE' ? null : r.json();
}

// ─── LOAD FUNCTIONS ─────────────────────────────────────────────────
async function sbLoadTable(table) {
  const rows = await sbFetch(table, 'GET', null, '?select=id,datos&order=id.asc&limit=2000');
  return rows.map(r => { 
    try { 
      const o = JSON.parse(r.datos); 
      o.__sbId = r.id; 
      return o; 
    } catch(e) { 
      return null; 
    } 
  }).filter(Boolean);
}

async function sbLoadSingle(table) {
  const rows = await sbFetch(table, 'GET', null, '?select=id,datos&limit=1');
  if (!rows.length) return null;
  try { 
    const o = JSON.parse(rows[0].datos); 
    o.__sbId = rows[0].id; 
    return o; 
  } catch(e) { 
    return null; 
  }
}

// ─── UPSERT FUNCTIONS ───────────────────────────────────────────────
async function sbUpsertItem(table, item) {
  if (!window.SB_OK) { return; }
  const payload = { datos: JSON.stringify(item) };
  console.log('[sbUpsertItem]', table, 'sbId:', item.__sbId, 'payload size:', payload.datos.length);
  if (item.__sbId) {
    const res = await sbFetch(table, 'PATCH', payload, `?id=eq.${item.__sbId}`);
    console.log('[sbUpsertItem] PATCH response:', res);
  } else {
    const res = await sbFetch(table, 'POST', payload);
    console.log('[sbUpsertItem] POST response:', res);
    if (res && res[0]) item.__sbId = res[0].id;
  }
}

async function sbUpsertSingle(table, obj) {
  if (!window.SB_OK) return;
  const payload = { datos: JSON.stringify(obj) };
  if (obj.__sbId) {
    await sbFetch(table, 'PATCH', payload, `?id=eq.${obj.__sbId}`);
  } else {
    const res = await sbFetch(table, 'POST', payload);
    if (res && res[0]) obj.__sbId = res[0].id;
  }
}

// ─── DELETE FUNCTIONS ───────────────────────────────────────────────
async function sbDeleteItem(table, sbId) {
  if (!window.SB_OK || !sbId) return;
  await sbFetch(table, 'DELETE', null, `?id=eq.${sbId}`);
}

// ─── SAVE WRAPPERS (main entities) ──────────────────────────────────
async function save() {
  if (!window.SB_OK) { 
    localStorage.setItem('cta_v7', JSON.stringify(window._DB)); 
    return; 
  }
  const target = window.editId ? 
    window._DB.find(x=>x.id===window.editId) : 
    (window.detId ? window._DB.find(x=>x.id===window.detId) : window._DB[window._DB.length-1]);
  if (target) {
    console.log('[SAVE] Guardando contrato:', target.num, 'tarifarios:', (target.tarifarios||[]).length, '__sbId:', target.__sbId);
    await sbUpsertItem('contratos', target);
    console.log('[SAVE] ✓ Guardado completo');
  }
}

async function saveMe2n() {
  if (!window.SB_OK) { 
    localStorage.setItem('me2n_v1', JSON.stringify(window.ME2N)); 
    return; 
  }
  await sbUpsertSingle('me2n', window.ME2N);
}

async function saveLicit() {
  if (!window.SB_OK) { 
    localStorage.setItem('licit_v1', JSON.stringify(window.LICIT_DB)); 
    return; 
  }
  const last = window.LICIT_DB[window.LICIT_DB.length-1];
  if (last) await sbUpsertItem('licitaciones', last);
}

async function saveProv() {
  localStorage.setItem('contr_v1', JSON.stringify(window.PROV_DB));
  localStorage.setItem('prov_v1', JSON.stringify(window.PROV_DB));
  if (!window.SB_OK) return;
  await sbReplaceContratistas();
}

async function sbReplaceContratistas() {
  try {
    const existingRows = await sbFetch('contratistas', 'GET', null, '?select=id');
    for (const row of existingRows) {
      await sbFetch('contratistas', 'DELETE', null, `?id=eq.${row.id}`);
    }
    for (const prov of window.PROV_DB) {
      await sbFetch('contratistas', 'POST', {datos: JSON.stringify(prov)});
    }
    console.log('[sbReplaceContratistas] ✓ Sincronizado');
  } catch(e) {
    console.error('[sbReplaceContratistas] Error:', e);
  }
}

async function saveIdx(){
  localStorage.setItem('idx_v2', JSON.stringify(window.IDX_STORE));
  if(!window.SB_OK) return;
  await sbUpsertSingle('indices', window.IDX_STORE);
}

// ─── LOAD FROM LOCALSTORAGE (fallback) ─────────────────────────────
function loadFromLocalStorage() {
  try{
    window._DB = JSON.parse(localStorage.getItem('cta_v7'))||[];
    if(!window._DB.length) window._DB = JSON.parse(localStorage.getItem('cta_v5'))||[];
  }catch(ex){
    window._DB = [];
  }
  
  try{
    window.ME2N = JSON.parse(localStorage.getItem('me2n_v1'))||{};
  }catch(ex){
    window.ME2N = {};
  }
  
  try{
    window.IDX_STORE = JSON.parse(localStorage.getItem('idx_v2'))||{};
  }catch(ex){
    window.IDX_STORE = {};
  }
  
  try{
    window.LICIT_DB = JSON.parse(localStorage.getItem('licit_v1'))||[];
  }catch(ex){
    window.LICIT_DB = [];
  }
  
  try{
    window.PROV_DB = JSON.parse(localStorage.getItem('contr_v1'))||
      JSON.parse(localStorage.getItem('prov_v1'))||[];
  }catch(ex){
    window.PROV_DB = [];
  }
}

// ─── LOAD PROVIDERS (Supabase with localStorage fallback) ──────────
async function loadProv() {
  try {
    window.PROV_DB = await sbLoadTable('contratistas');
    localStorage.setItem('contr_v1', JSON.stringify(window.PROV_DB));
    localStorage.setItem('prov_v1', JSON.stringify(window.PROV_DB));
  } catch(e) {
    console.warn('[loadProv] Supabase error, using localStorage', e);
    try {
      window.PROV_DB = JSON.parse(localStorage.getItem('contr_v1')) || 
        JSON.parse(localStorage.getItem('prov_v1')) || [];
    } catch(e2) {
      window.PROV_DB = [];
    }
  }
}

