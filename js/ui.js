// ════════════════════════════════════════════════════════════════════
// UI.JS - Helpers de UI y Navegación
// ════════════════════════════════════════════════════════════════════

// ─── FORMAT HELPERS ─────────────────────────────────────────────────
function fN(n){
  if(n==null||n==='')return'—';
  return Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function esc(s){
  const d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML;
}

function pctStr(v,decimals=2){
  if(v===null||v===undefined)return'—';
  return(v>0?'+':'')+Number(v).toFixed(decimals)+'%';
}

function formatMonth(ym){
  const[y,m]=ym.split('-');
  const names=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return names[parseInt(m)-1]+' '+y;
}

function ymCompare(a,b){
  return String(a||'').localeCompare(String(b||''));
}

function pctColor(v){
  if(v===null||v===undefined)return'zero';
  return v>=0?'pos':'neg';
}

// ─── LOADER ─────────────────────────────────────────────────────────
function showLoader(msg) {
  let el = document.getElementById('sb-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-loader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(20,48,58,.88);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
    el.innerHTML = '<div style="width:52px;height:52px;border:4px solid rgba(255,255,255,.15);border-top-color:#4c96ad;border-radius:50%;animation:sbl .8s linear infinite"></div><div id="sb-lmsg" style="color:#fff;font-size:14px;font-weight:500"></div><style>@keyframes sbl{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(el);
  }
  document.getElementById('sb-lmsg').textContent = msg;
  el.style.display = 'flex';
}

function hideLoader() {
  const el=document.getElementById('sb-loader');
  if(el) el.style.display='none';
}

// ─── TOAST NOTIFICATIONS ────────────────────────────────────────────
function toast(m,t){
  const e=document.getElementById('toast');
  e.textContent=(t==='ok'?'✓ ':'✕ ')+m;
  e.className='toast '+t;
  setTimeout(()=>e.classList.add('show'),10);
  setTimeout(()=>e.classList.remove('show'),3200);
}

// ─── NAVIGATION ─────────────────────────────────────────────────────
function _navAct(pg){
  document.querySelectorAll('.nv').forEach(n=>n.classList.remove('act'));
  const el=document.getElementById('n_'+pg);
  if(el)el.classList.add('act');
}

function go(v){
  ['vList','vForm','vDet','vMe2n','vMe2nDet','vIdx','vLicit','vProv'].forEach(id=>document.getElementById(id).classList.remove('on'));
  const t=document.getElementById('pgT'),a=document.getElementById('pgA');
  
  if(v==='list'){
    document.getElementById('vList').classList.add('on');
    _navAct('list');
    t.innerHTML='📋 Contratos';
    a.innerHTML=`<div style="display:flex;gap:8px"><button class="btn btn-s btn-sm" onclick="importMe3nModal()">📤 Importar ME3N (SAP)</button><button class="btn btn-p" onclick="go('form')">➕ Nuevo Contrato</button></div>`;
    window.editId=null;
    resetForm();
  }
  else if(v==='form'){
    document.getElementById('vForm').classList.add('on');
    _navAct('form');
    t.innerHTML=(window.editId?'✏️ Editar':'➕ Nuevo')+' Contrato';
    a.innerHTML=`<button class="btn btn-s" onclick="go('list')">← Volver</button>`;
    populateProvSelect();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  else if(v==='detail'){
    document.getElementById('vDet').classList.add('on');
    _navAct('list');
    t.innerHTML='📄 Detalle';
    a.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-s" onclick="go('list')">← Lista</button><button class="btn btn-p btn-sm" onclick="openDossier()">📘 Dossier</button><button class="btn btn-s btn-sm" onclick="openPriceListImportPicker()">🤖 Importar Listas IA</button></div>`;
    renderDet();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  else if(v==='me2n'){
    document.getElementById('vMe2n').classList.add('on');
    _navAct('me2n');
    t.innerHTML='🛒 Purchase Orders (ME2N)';
    a.innerHTML='';
    renderMe2n();
    buildPlantFilter();
  }
  else if(v==='idx'){
    document.getElementById('vIdx').classList.add('on');
    _navAct('idx');
    t.innerHTML='📊 Master de Índices';
    a.innerHTML=`<div style="display:flex;gap:8px"><button class="btn btn-s btn-sm" onclick="runAllIdxUpdates()">🔄 Actualizar todos</button><button class="btn btn-p btn-sm" onclick="showNewIdxModal()">➕ Cargar período</button><button class="btn btn-d btn-sm" onclick="resetIdxAll()">🧹 Reset</button></div>`;
    renderIdxView();
  }
  else if(v==='licit'){
    document.getElementById('vLicit').classList.add('on');
    _navAct('licit');
    t.innerHTML='🏗️ Licitaciones';
    a.innerHTML=`<button class="btn btn-p" onclick="openLicitModal()">➕ Nueva Licitación</button>`;
    renderLicitView();
  }
  else if(v==='prov'){
    document.getElementById('vProv').classList.add('on');
    _navAct('prov');
    t.innerHTML='👥 Proveedores';
    a.innerHTML=`<button class="btn btn-p" onclick="openProvModal()">➕ Nuevo Proveedor</button>`;
    renderProvView();
  }
  else if(v==='users'){
    document.getElementById('vUsers').classList.add('on');
    _navAct('users');
    t.innerHTML='👤 Usuarios';
    a.innerHTML=`<button class="btn btn-p" onclick="openUserModal()">➕ Nuevo Usuario</button>`;
    renderUsersView();
  }
}

// ─── ROLE BADGE ─────────────────────────────────────────────────────
function setRoleBadge(){
  const el=document.getElementById('userRoleBadge');
  if(!el)return;
  if(!window._APP_ROLE){
    el.innerHTML='';
    return;
  }
  const labels={owner:'Owner',ing_contratos:'Ing. Contratos',resp_tecnico:'Resp. Técnico'};
  el.innerHTML=`<span class="auth-badge ${window._APP_ROLE}">${labels[window._APP_ROLE]||window._APP_ROLE}</span>`;
}

// ─── SUPABASE STATUS ────────────────────────────────────────────────
function setSBStatus(ok){
  const el=document.getElementById('sbStatusBadge');
  if(!el)return;
  el.innerHTML=ok?
    '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--g600)"><span style="width:6px;height:6px;border-radius:50%;background:var(--g600)"></span>Supabase OK</span>':
    '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--r500)"><span style="width:6px;height:6px;border-radius:50%;background:var(--r500)"></span>Offline</span>';
}
