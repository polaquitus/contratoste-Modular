// ════════════════════════════════════════════════════════════════════
// AUTH.JS - Autenticación y Control de Acceso
// ════════════════════════════════════════════════════════════════════

// ─── LOCK/UNLOCK UI ─────────────────────────────────────────────────
function authLock(){ 
  try{ 
    document.body.classList.add('auth-locked'); 
  }catch(_e){} 
}

function authUnlock(){
  try{ 
    document.body.classList.remove('auth-locked'); 
  }catch(_e){}
  try{ 
    document.getElementById('loginOverlay')?.remove(); 
  }catch(_e){}
  try{ 
    hideLoader(); 
  }catch(_e){}
}

// ─── LOGIN OVERLAY HTML ─────────────────────────────────────────────
function loginOverlayHtml(){
  return `<div id="loginOverlay" style="position:fixed;inset:0;background:linear-gradient(135deg,rgba(20,48,58,.97),rgba(36,86,108,.94));z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px">
    <div style="background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.35);width:430px;max-width:96vw;padding:24px 24px 18px;border:1px solid #dbe5ea">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><div style="font-size:26px">🔐</div><div><div style="font-size:21px;font-weight:800;color:#14303a">Ingreso al sistema</div><div style="font-size:12px;color:#64748b">Perfiles: OWNER / ING_CONTRATOS / RESP_TECNICO</div></div></div>
      <div style="display:grid;gap:12px">
        <div><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;margin-bottom:4px">Usuario</label><input id="lgUser" type="text" placeholder="usuario" onkeydown="_lgEnterKey(event)" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px"></div>
        <div><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;margin-bottom:4px">Contraseña</label><input id="lgPass" type="password" placeholder="••••••••" onkeydown="_lgEnterKey(event)" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px"></div>
        <div id="lgMsg" style="font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">Ingresá con tu usuario y contraseña.</div>
        <button class="btn btn-p" style="width:100%;justify-content:center" onclick="loginApp()">Ingresar</button>
      </div>
    </div>
  </div>`;
}

function ensureLoginOverlay(){ 
  authLock(); 
  if(!document.getElementById('loginOverlay')) 
    document.body.insertAdjacentHTML('beforeend', loginOverlayHtml()); 
}

function _lgEnterKey(e){ 
  if(e.key==='Enter') loginApp(); 
}

// ─── SHA256 HASH ────────────────────────────────────────────────────
async function sha256Hex(str){ 
  const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); 
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); 
}

// ─── ROLE BADGE ─────────────────────────────────────────────────────
function setRoleBadge(){
  let b=document.getElementById('role-badge');
  if(!b){
    b=document.createElement('span');
    b.id='role-badge';
    b.style.cssText='font-size:11px;font-weight:700;padding:4px 11px;border-radius:99px;display:inline-flex;align-items:center;gap:5px;cursor:default;margin-right:6px;background:#e0f2fe;color:#075985';
    const tba=document.querySelector('.tba');
    if(tba) tba.insertBefore(b, tba.firstChild);
  }
  const role = (window._APP_ROLE||'SIN ROL').toString().toUpperCase();
  b.className = 'auth-badge ' + role.toLowerCase().replace(/\s+/g,'_');
  b.textContent = '👤 ' + role.replaceAll('_',' ');
}

// ─── APPLY PERMISSIONS ──────────────────────────────────────────────
function applyRolePermissions(){
  const role = String(window._APP_ROLE||'').toUpperCase();
  if(role && role!=='OWNER') 
    document.querySelectorAll('[data-owner-only="1"]').forEach(el=>el.style.display='none');
  
  const sbBtn=document.getElementById('sbLogoutBtn');
  if(sbBtn) sbBtn.style.display = window._APP_USER ? 'inline-flex' : 'none';
}

// ─── LOGIN ──────────────────────────────────────────────────────────
async function loginApp(){
  const u=(document.getElementById('lgUser')?.value||'').trim();
  const p=(document.getElementById('lgPass')?.value||'').trim();
  const msg=document.getElementById('lgMsg');
  
  if(!u||!p){ 
    if(msg) msg.textContent='Ingresá usuario y contraseña'; 
    return; 
  }
  
  try{
    const rows = await sbFetch('app_users','GET',null,`?select=id,username,password_hash,role,active&username=eq.${encodeURIComponent(u)}&limit=1`);
    if(!rows || !rows.length) throw new Error('Usuario no encontrado');
    
    const row=rows[0];
    if(row.active===false || String(row.active)==='false') 
      throw new Error('Usuario inactivo');
    
    const hash = await sha256Hex(p);
    if(String(hash).toLowerCase() !== String(row.password_hash||'').toLowerCase()) 
      throw new Error('Contraseña inválida');
    
    window._APP_USER = {id:row.id || row.username, username:row.username};
    window._APP_ROLE = (row.role || 'SIN_ROL').trim();
    
    authUnlock();
    setRoleBadge();
    applyRolePermissions();
    
    if(typeof toast==='function') 
      toast('Sesión iniciada: '+row.username,'ok');
    
    if(typeof initApp==='function') 
      await initApp(true);
    
    if(typeof applyPermissions==='function') 
      applyPermissions();
      
    if(typeof UsersAdmin!=='undefined' && typeof UsersAdmin.goFirstAllowed==='function') 
      UsersAdmin.goFirstAllowed();
      
  }catch(err){
    window._APP_USER = null;
    window._APP_ROLE = null;
    authLock();
    ensureLoginOverlay();
    if(msg){ 
      msg.textContent = err.message || 'No se pudo iniciar sesión'; 
      msg.style.color = '#dc2626'; 
    }
  }
}

// ─── REQUIRE LOGIN ──────────────────────────────────────────────────
async function requireLogin(){
  if(window._APP_USER && window._APP_ROLE){ 
    setRoleBadge(); 
    applyRolePermissions(); 
    authUnlock(); 
    return true; 
  }
  ensureLoginOverlay();
  return false;
}

// ─── LOGOUT ─────────────────────────────────────────────────────────
function logoutApp(){
  window._APP_USER = null;
  window._APP_ROLE = null;
  authLock();
  setRoleBadge();
  applyRolePermissions();
  ensureLoginOverlay();
  
  const u=document.getElementById('lgUser'); 
  const p=document.getElementById('lgPass'); 
  const msg=document.getElementById('lgMsg');
  
  if(u) u.value='';
  if(p) p.value='';
  if(msg){ 
    msg.textContent='Sesión cerrada. Ingresá nuevamente.'; 
    msg.style.color='#64748b'; 
  }
  
  if(typeof toast==='function') 
    toast('Sesión cerrada','ok');
}

// ─── DOM READY INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){ 
  authLock(); 
  setRoleBadge(); 
  applyRolePermissions(); 
});

