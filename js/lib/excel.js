import { getState, setState } from '../state.js';
import { saveContrato, saveMe2n, saveProveedores } from '../supabase.js';
import { fN, esc, toast, showLoader, hideLoader } from '../ui.js';

/**
 * Convierte un valor de fecha de Excel a string YYYY-MM-DD
 */
export function parseExcelDate(v) {
  if (!v || v === '') return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const m = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.substring(0, 10) || '';
}

/**
 * Calcula la diferencia en meses entre dos fechas (inclusiva)
 */
export function monthDiffInclusive(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(a + 'T00:00:00'), d2 = new Date(b + 'T00:00:00');
  return Math.max((d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1, 0);
}

/**
 * Normaliza un valor de precio importado (maneja comas, puntos, etc.)
 */
export function normalizeImportedPriceValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return '';
  s = s.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
  if (!s) return '';
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : String(v).trim();
}

/**
 * Detecta un período (YYYY-MM) a partir de un texto
 */
export function detectPeriodFromText(txt) {
  const s = String(txt || '');
  let m = s.match(/\b(20\d{2})[-_/](0[1-9]|1[0-2])\b/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/\b(0[1-9]|1[0-2])[-_/](20\d{2})\b/);
  if (m) return `${m[2]}-${m[1]}`;
  const map = {
    ene: '01', enero: '01', feb: '02', febrero: '02', mar: '03', marzo: '03',
    abr: '04', abril: '04', may: '05', mayo: '05', jun: '06', junio: '06',
    jul: '07', julio: '07', ago: '08', agosto: '08', sep: '09', sept: '09', septiembre: '09',
    oct: '10', octubre: '10', nov: '11', noviembre: '11', dic: '12', diciembre: '12'
  };
  const low = s.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    const r1 = new RegExp(`\\b${k}\\s*(?:de\\s*)?(20\\d{2})\\b`, 'i');
    const r2 = new RegExp(`\\b(20\\d{2})\\s*(?:-|/)??\\s*${k}\\b`, 'i');
    let mm = low.match(r1);
    if (mm) return `${mm[1]}-${v}`;
    mm = low.match(r2);
    if (mm) return `${mm[1]}-${v}`;
  }
  return null;
}

// ========== IMPORTACIÓN ME2N ==========

export async function importMe2n(file) {
  if (!file) return;
  toast('Procesando Excel ME2N...', 'ok');
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
        if (dt instanceof Date) {
          ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        } else if (typeof dt === 'string' && dt.length >= 7) {
          ym = dt.substring(0, 7);
        }
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
    } catch (err) {
      toast('Error leyendo Excel', 'er');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ========== IMPORTACIÓN CONTRATOS SAP (ME3N) ==========

export async function importSapContractsFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      if (json.length < 2) { toast('Archivo vacío', 'er'); return; }
      
      const headers = json[0].map(h => String(h).trim());
      const colMap = {
        doc: headers.findIndex(h => /Purchasing Document/i.test(h)),
        text: headers.findIndex(h => /Short Text/i.test(h)),
        vendor: headers.findIndex(h => /Name of Vendor/i.test(h)),
        curr: headers.findIndex(h => /Currency/i.test(h)),
        ini: headers.findIndex(h => /Validity.*Start/i.test(h)),
        fin: headers.findIndex(h => /Validity Period End/i.test(h)),
        tv: headers.findIndex(h => /Target Val/i.test(h)),
        grp: headers.findIndex(h => /Purchasing Group/i.test(h)),
      };
      
      const byDoc = {};
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const doc = String(r[colMap.doc] || '').trim();
        if (!doc || doc === '0') continue;
        if (!byDoc[doc]) {
          const vRaw = String(r[colMap.vendor] || '').trim();
          const vMatch = vRaw.match(/^(\d+)\s+(.*)/);
          byDoc[doc] = {
            num: doc,
            cont: vMatch ? vMatch[2].trim() : vRaw,
            vendorNum: vMatch ? vMatch[1] : '',
            det: String(r[colMap.text] || '').trim(),
            mon: String(r[colMap.curr] || '').trim(),
            fechaIni: parseExcelDate(r[colMap.ini]),
            fechaFin: parseExcelDate(r[colMap.fin]),
            monto: parseFloat(String(r[colMap.tv] || '0').replace(/[^\d.-]/g, '')) || 0,
            grp: String(r[colMap.grp] || '').trim(),
          };
        }
      }
      
      const sapContracts = Object.values(byDoc);
      const contratosActuales = getState('contratos');
      let added = 0, skipped = 0;
      
      sapContracts.forEach(sc => {
        const exists = contratosActuales.find(c => c.num === sc.num);
        if (exists) { skipped++; return; }
        const nuevo = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + '_' + added,
          num: sc.num,
          cont: sc.cont,
          vendorNum: sc.vendorNum,
          det: sc.det,
          tipo: 'SERVICIO',
          mon: sc.mon,
          monto: sc.monto,
          fechaIni: sc.fechaIni,
          fechaFin: sc.fechaFin,
          plazo: sc.fechaIni && sc.fechaFin ? monthDiffInclusive(sc.fechaIni, sc.fechaFin) : 0,
          resp: '', rtec: '', own: '', cprov: '', vend: sc.vendorNum, fax: '',
          btar: '', tcontr: '', ariba: '', cc: null, cof: null, oferentes: '', fev: '',
          dd: true, pr: true, sq: true, dg: false, tc: 1,
          poly: [], hasPoly: false, trigA: false, trigB: false, trigC: false, trigBpct: null, trigCmes: null,
          tarifarios: [], enmiendas: [], aves: [], adj: [], com: '',
          grp: sc.grp,
          sapImport: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        contratosActuales.push(nuevo);
        added++;
      });
      
      setState('contratos', contratosActuales);
      await Promise.all(contratosActuales.filter(c => c.sapImport && !c.__sbId).map(c => saveContrato(c)));
      toast(`${added} contratos importados, ${skipped} ya existían`, 'ok');
    } catch (err) {
      toast('Error procesando el archivo', 'er');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ========== IMPORTACIÓN PROVEEDORES SAP ==========

export async function importSapProvFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const proveedoresActuales = getState('proveedores');
      let added = 0, skipped = 0;
      
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const nameRaw = String(r[0] || '').trim();
        const vnum = String(r[1] || '').trim();
        if (!nameRaw || nameRaw === 'nan') continue;
        const cleanName = nameRaw.replace(/^\d+\s+/, '').trim();
        if (vnum && proveedoresActuales.find(p => String(p.vendorNum || '').trim() === vnum)) {
          skipped++;
          continue;
        }
        proveedoresActuales.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4) + '_' + added,
          name: cleanName,
          vendorNum: vnum,
          rubro: '',
          website: '',
          obs: '',
          contacts: [],
          brochure: null,
          createdAt: new Date().toISOString()
        });
        added++;
      }
      
      setState('proveedores', proveedoresActuales);
      await saveProveedores();
      toast(`${added} proveedores importados, ${skipped} ya existían`, 'ok');
    } catch (err) {
      toast('Error procesando el archivo', 'er');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ========== PARSEO DE LISTAS DE PRECIOS DESDE EXCEL ==========

export function standardizeExcelPriceList(sheetName, json, contrato, fileName) {
  if (!Array.isArray(json) || json.length < 1) return null;
  const headers = (json[0] || []).map(v => String(v || '').trim());
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const h = headers.map(norm);
  const idxBySyn = (syns) => h.findIndex(x => syns.some(s => x.includes(s)));
  
  let itemIdx = idxBySyn(['item', 'codigo', 'cod', 'n item', 'n° item', 'numero item', 'posicion']);
  let descIdx = idxBySyn(['descripcion', 'detalle', 'concepto', 'texto breve', 'short text', 'servicio']);
  let unitIdx = idxBySyn(['unidad', 'uom', 'um', 'unit']);
  let priceIdx = idxBySyn(['precio', 'valor unitario', 'precio unitario', 'tarifa', 'rate', 'importe', 'valor']);
  
  if (descIdx < 0) descIdx = 1 >= headers.length ? 0 : 1;
  if (itemIdx < 0) itemIdx = 0;
  if (unitIdx < 0) unitIdx = Math.min(2, headers.length - 1);
  if (priceIdx < 0) priceIdx = Math.min(3, headers.length - 1);
  
  const rows = json.slice(1).filter(r => Array.isArray(r) && r.some(v => String(v || '').trim() !== '')).map(r => [
    String(r[itemIdx] ?? '').trim(),
    String(r[descIdx] ?? '').trim(),
    String(r[unitIdx] ?? '').trim(),
    normalizeImportedPriceValue(r[priceIdx] ?? '')
  ]).filter(r => r.some(v => String(v ?? '').trim() !== ''));
  
  if (!rows.length) return null;
  const blobText = [sheetName, ...json.slice(0, 8).flat()].join(' ');
  return {
    name: String(sheetName || 'Lista Excel').trim(),
    cols: ['Item', 'Descripción', 'Unidad', 'Precio'],
    rows,
    period: detectPeriodFromText(blobText) || (contrato?.btar || contrato?.fechaIni?.substring(0, 7) || null),
    source: 'EXCEL',
    sourceFileName: fileName,
    importedAt: new Date().toISOString(),
    editable: true
  };
}

export async function parsePriceListExcelFile(file, contrato) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const out = [];
  wb.SheetNames.forEach(sn => {
    const ws = wb.Sheets[sn];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const table = standardizeExcelPriceList(sn, json, contrato, file.name);
    if (table) out.push(table);
  });
  return out;
}