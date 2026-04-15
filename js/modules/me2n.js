import { getState, setState } from '../state.js';
import { saveMe2n } from '../supabase.js';
import { fN, esc, toast, showLoader, hideLoader } from '../ui.js';
import { navigateTo } from '../navigation.js';

// Constantes para plantas
const PLANT_MAP = {
  'AR50':'APE - AR50','ARJ0':'LESC - ARJ0','AR20':'TDF - AR20','AR30':'PQ - AR30',
  'AR40':'RIO CHICO - AR40','ARM0':'PLYII - ARM0','ARN0':'MLO-123 - ARN0',
  'ARO0':'CAN-111 - ARO0','ARP0':'CAN-113 - ARP0','AR10':'BSAS - AR10',
  'AR60':'ASR - AR60','ARK0':'RCZA - ARK0'
};
function plantLabel(p) { return PLANT_MAP[p] || p || '—'; }

export let poDetOA = null;

export function renderMe2nList(container, actionsEl) {
  actionsEl.innerHTML = `
    <button class="btn btn-p btn-sm" id="importMe2nBtn">📤 Actualizar Base ME2N</button>
    <button class="btn btn-d btn-sm" id="purgeMe2nBtn">🗑️ Vaciar ME2N</button>
    <input type="file" id="me2nXlsIn" accept=".xlsx,.xls" style="display:none">
  `;
  document.getElementById('importMe2nBtn').addEventListener('click', () => {
    document.getElementById('me2nXlsIn').click();
  });
  document.getElementById('me2nXlsIn').addEventListener('change', (e) => importMe2n(e.target.files[0]));
  document.getElementById('purgeMe2nBtn').addEventListener('click', purgeMe2n);

  const me2n = getState('me2n');
  const srch = document.getElementById('poSrch')?.value?.toLowerCase() || '';
  const fPlant = document.getElementById('poPlant')?.value || '';
  
  let rows = [];
  for (const [oa, d] of Object.entries(me2n)) {
    if (!oa || oa === 'SIN_CTTO') continue;
    const curr = d[1];
    for (const p of d[2]) {
      rows.push({ oa, poNum: p[0], plant: p[2] || '', nov: p[3], still: p[4], curr });
    }
  }
  if (srch) rows = rows.filter(r => r.oa.includes(srch) || r.poNum.toLowerCase().includes(srch));
  if (fPlant) rows = rows.filter(r => r.plant === fPlant);
  rows.sort((a, b) => b.nov - a.nov);
  
  const totalAll = Object.values(me2n).reduce((s, [, , pos]) => s + pos.length, 0);
  
  let html = `<div class="card">
    <div class="thdr"><h2>Purchase Orders — ME2N</h2><span class="tcnt" id="poLcnt">${rows.length}/${totalAll}</span></div>
    <div class="tfl">
      <input type="text" id="poSrch" placeholder="Buscar N° contrato o N° PO..." style="flex:1;max-width:320px">
      <select id="poPlant"><option value="">Todas las Plants</option></select>
    </div>
    <div id="poBody">`;
  
  if (!rows.length) {
    html += totalAll ? '<div class="empty"><div class="ei">🔍</div><p>Sin resultados.</p></div>' : '<div class="empty"><div class="ei">🛒</div><p>Sin datos ME2N. Subí un archivo Excel con la bajada de SAP.</p></div>';
  } else {
    html += '<div style="overflow-x:auto"><table><thead><tr><th>N° PO</th><th>N° Contrato</th><th>Net Order Value</th><th>Pend. Facturación</th><th>Mon.</th><th>Lugar</th></tr></thead><tbody>';
    for (const r of rows) {
      const hasPend = r.still > 0;
      const lugar = plantLabel(r.plant);
      html += `<tr><td class="mono" style="font-size:11.5px;font-weight:700;color:var(--p700)">${esc(r.poNum)}</td>
        <td class="mono" style="font-size:11.5px;font-weight:600;cursor:pointer;color:var(--p600);text-decoration:underline" data-oa="${esc(r.oa)}">${esc(r.oa)}</td>
        <td class="mono" style="font-size:12px;font-weight:600">${fN(r.nov)}</td>
        <td class="mono" style="font-size:12px">${hasPend ? '<span class="bdg noinv">'+fN(r.still)+'</span>' : '<span style="color:var(--g500)">—</span>'}</td>
        <td style="font-size:12px;font-weight:600">${esc(r.curr)}</td>
        <td style="font-size:11.5px;white-space:nowrap">${esc(lugar)}</td></tr>`;
    }
    html += '</tbody></table></div>';
  }
  html += '</div></div>';
  container.innerHTML = html;

  buildPlantFilter();
  document.getElementById('poSrch').addEventListener('input', () => renderMe2nList(container, actionsEl));
  document.getElementById('poPlant').addEventListener('change', () => renderMe2nList(container, actionsEl));
  container.querySelectorAll('[data-oa]').forEach(el => {
    el.addEventListener('click', () => {
      poDetOA = el.dataset.oa;
      navigateTo('me2ndet');
    });
  });
}

export function renderMe2nDetail(container, actionsEl) {
  const me2n = getState('me2n');
  const d = me2n[poDetOA];
  if (!d) return navigateTo('me2n');
  
  actionsEl.innerHTML = `<button class="btn btn-s" id="backToMe2nBtn">← Volver a ME2N</button>`;
  document.getElementById('backToMe2nBtn').addEventListener('click', () => navigateTo('me2n'));

  const vendor = d[0], curr = d[1], pos = d[2];
  const totalNOV = pos.reduce((s, p) => s + p[3], 0);
  const totalStill = pos.reduce((s, p) => s + p[4], 0);
  const totalPO = pos.length;
  const totalItems = pos.reduce((s, p) => s + p[5], 0);

  const byMonth = {};
  pos.forEach(p => {
    const m = p[1] || 'Sin fecha';
    if (!byMonth[m]) byMonth[m] = { pos: [], total: 0, still: 0 };
    byMonth[m].pos.push(p);
    byMonth[m].total += p[3];
    byMonth[m].still += p[4];
  });
  const months = Object.keys(byMonth).sort().reverse();
  const plants = [...new Set(pos.map(p => p[2]).filter(Boolean))].sort();

  let monthsHTML = '';
  months.forEach((m, mi) => {
    const md = byMonth[m];
    const pct = totalNOV > 0 ? (md.total / totalNOV * 100) : 0;
    const label = m === 'Sin fecha' ? 'Sin fecha' : formatMonth(m);
    monthsHTML += `<div class="po-month" data-month-index="${mi}">
      <div class="pm-h">
        <span class="pm-t">${label}</span>
        <span class="pm-cnt">${md.pos.length} POs</span>
        <span class="pm-v">${curr} ${fN(md.total)}</span>
      </div>
      <div class="pm-bar"><div class="pbar"><div class="fill green" style="width:${pct}%"></div></div></div>
    </div>
    <div class="po-lines" id="poM_${mi}">
      <div style="padding:6px 10px;display:grid;grid-template-columns:140px 1fr 140px 130px;gap:8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--g500);border-bottom:1px solid var(--g200)">
        <span>N° PO</span><span>Lugar</span><span style="text-align:right">Net Order Value</span><span style="text-align:right">Pend. Facturación</span>
      </div>`;
    md.pos.sort((a, b) => b[3] - a[3]).forEach(p => {
      monthsHTML += `<div class="po-line" style="grid-template-columns:140px 1fr 140px 130px">
        <span class="po-num">${p[0]}</span>
        <span style="font-size:11px">${plantLabel(p[2])}</span>
        <span class="mono" style="text-align:right;font-size:11px">${fN(p[3])}</span>
        <span class="mono" style="text-align:right;font-size:11px">${p[4] > 0 ? fN(p[4]) : '—'}</span>
      </div>`;
    });
    monthsHTML += '</div>';
  });

  container.innerHTML = `<div class="card">
    <div class="det-h">
      <div><h2>${esc(poDetOA)}</h2><div class="ds">${esc(vendor)} · ${curr}</div></div>
      <div><span class="bdg blue" style="font-size:12px;padding:5px 14px">${plants.map(p => plantLabel(p)).join(', ')}</span></div>
    </div>
    <div class="po-summ">
      <div class="po-sc"><div class="po-sl">Net Order Value Total</div><div class="po-sv">${curr} ${fN(totalNOV)}</div></div>
      <div class="po-sc"><div class="po-sl">Pend. Facturación</div><div class="po-sv ${totalStill>0?'':'sm'}" style="${totalStill>0?'color:#92400e':''}">${totalStill>0?curr+' '+fN(totalStill):'—'}</div></div>
      <div class="po-sc"><div class="po-sl">Purchase Orders</div><div class="po-sv">${totalPO}</div></div>
      <div class="po-sc"><div class="po-sl">Líneas Totales</div><div class="po-sv">${totalItems}</div></div>
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid var(--g200)"><span style="font-size:13px;font-weight:600;color:var(--p800)">Consumo Mensual</span><span style="font-size:11px;color:var(--g500);margin-left:8px">(clic para expandir)</span></div>
    ${monthsHTML}
  </div>`;

  container.querySelectorAll('[data-month-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = el.dataset.monthIndex;
      document.getElementById(`poM_${idx}`)?.classList.toggle('open');
    });
  });
}

function buildPlantFilter() {
  const me2n = getState('me2n');
  const sel = document.getElementById('poPlant');
  if (!sel) return;
  const plants = new Set();
  for (const [, d] of Object.entries(me2n)) {
    d[2].forEach(p => { if (p[2]) plants.add(p[2]); });
  }
  const cur = sel.value;
  let h = '<option value="">Todas las Plants</option>';
  [...plants].sort().forEach(p => h += `<option value="${p}">${plantLabel(p)}</option>`);
  sel.innerHTML = h;
  sel.value = cur;
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return names[parseInt(m)-1] + ' ' + y;
}

async function importMe2n(file) {
  if (!file) return;
  toast('Procesando Excel...', 'ok');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      if (json.length < 2) { toast('Excel vacío', 'er'); return; }
      const poAgg = {};
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const oa = String(r[0] || '').trim();
        const po = String(r[1] || '').trim();
        if (!po) continue;
        const dt = r[4];
        let ym = '';
        if (dt instanceof Date) { ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); }
        else if (typeof dt === 'string' && dt.length >= 7) { ym = dt.substring(0, 7); }
        const vendor = String(r[5] || '').trim().substring(0, 40);
        const shortText = String(r[7] || '').trim().substring(0, 80);
        const plant = String(r[9] || '').trim();
        const curr = String(r[13] || '').trim();
        const still = parseFloat(r[14]) || 0;
        const nov = parseFloat(r[17]) || 0;
        if (!poAgg[po]) poAgg[po] = { oa: '', dt: '', pl: '', cu: '', n: 0, s: 0, ni: 0, v: '', st: '' };
        const pd = poAgg[po];
        if (oa) pd.oa = oa;
        if (ym && !pd.dt) pd.dt = ym;
        if (plant) pd.pl = plant;
        if (curr) pd.cu = curr;
        if (vendor) pd.v = vendor;
        if (shortText && !pd.st) pd.st = shortText;
        pd.n += nov;
        pd.s += still;
        pd.ni++;
      }
      const result = {};
      for (const [poNum, pd] of Object.entries(poAgg)) {
        const oa = pd.oa || 'SIN_CTTO';
        if (!result[oa]) result[oa] = ['', '', []];
        if (pd.v) result[oa][0] = pd.v;
        if (pd.cu) result[oa][1] = pd.cu;
        result[oa][2].push([poNum, pd.dt, pd.pl, Math.round(pd.n * 100) / 100, Math.round(pd.s * 100) / 100, pd.ni, pd.st || '']);
      }
      setState('me2n', result);
      await saveMe2n();
      const nC = Object.keys(result).length, nP = Object.keys(poAgg).length;
      toast(nP + ' POs en ' + nC + ' contratos cargados', 'ok');
      renderMe2nList(document.getElementById('appContainer'), document.getElementById('pgA'));
    } catch (err) {
      toast('Error leyendo Excel', 'er');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function purgeMe2n() {
  const me2n = getState('me2n');
  const n = Object.keys(me2n).length;
  if (!n) { toast('Base ME2N vacía', 'er'); return; }
  if (!confirm('⚠️ ¿Eliminar toda la data ME2N (' + n + ' contratos)?')) return;
  setState('me2n', {});
  await saveMe2n();
  renderMe2nList(document.getElementById('appContainer'), document.getElementById('pgA'));
  toast('ME2N vaciado', 'ok');
}

export function getConsumed(contractNum) {
  const me2n = getState('me2n');
  const d = me2n[contractNum];
  if (!d) return null;
  return d[2].reduce((s, p) => s + p[3], 0);
}