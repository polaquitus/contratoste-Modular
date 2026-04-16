/* ═══════════════════════════════════════════════════════════════════
   SUPABASE DATA LAYER - Reemplazar localStorage
   ═══════════════════════════════════════════════════════════════════
   
   INSTRUCCIONES:
   1. Incluir antes del cierre </head>:
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   
   2. Configurar credenciales Supabase
   3. Reemplazar todas las llamadas localStorage con DB_API
   4. Este código es compatible con código existente localStorage
   ═══════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN SUPABASE
// ═══════════════════════════════════════════════════════════════════
const SUPABASE_CONFIG = {
  url: 'TU_SUPABASE_URL', // https://xxxxx.supabase.co
  anonKey: 'TU_SUPABASE_ANON_KEY',
  enableOffline: true, // Modo offline con sync
  enableCache: true
};

const supabase = window.supabase 
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;

// ═══════════════════════════════════════════════════════════════════
// CAPA DE ABSTRACCIÓN - Compatible con código existente
// ═══════════════════════════════════════════════════════════════════
const DB_API = (function() {
  let offlineQueue = [];
  let cache = {};
  const USE_SUPABASE = !!supabase;
  
  // CONTRACTS
  async function getContracts() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('contracts') || '[]');
    
    if (cache.contracts) return cache.contracts;
    
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          polynomial_configs(*),
          amendments(*),
          aves(*),
          price_lists(*, price_list_items(*)),
          polynomial_conditions(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform to legacy format
      const contracts = data.map(transformContractFromDB);
      cache.contracts = contracts;
      return contracts;
    } catch (err) {
      console.error('getContracts error:', err);
      return JSON.parse(localStorage.getItem('contracts') || '[]');
    }
  }
  
  async function saveContract(contract) {
    if (!USE_SUPABASE) {
      const contracts = JSON.parse(localStorage.getItem('contracts') || '[]');
      const idx = contracts.findIndex(c => c.id === contract.id);
      if (idx !== -1) contracts[idx] = contract;
      else contracts.push(contract);
      localStorage.setItem('contracts', JSON.stringify(contracts));
      return contract;
    }
    
    try {
      const payload = transformContractToDB(contract);
      
      // Upsert contract
      const { data: savedContract, error: contractError } = await supabase
        .from('contracts')
        .upsert(payload.contract)
        .select()
        .single();
      
      if (contractError) throw contractError;
      
      // Save polynomial configs
      if (payload.polynomialConfigs.length) {
        await supabase.from('polynomial_configs').delete().eq('contract_id', savedContract.id);
        await supabase.from('polynomial_configs').insert(payload.polynomialConfigs);
      }
      
      // Save amendments
      if (payload.amendments.length) {
        await supabase.from('amendments').delete().eq('contract_id', savedContract.id);
        await supabase.from('amendments').insert(payload.amendments);
      }
      
      // Save aves
      if (payload.aves.length) {
        await supabase.from('aves').delete().eq('contract_id', savedContract.id);
        await supabase.from('aves').insert(payload.aves);
      }
      
      // Save price lists
      for (const pl of payload.priceLists) {
        const { data: savedPL } = await supabase
          .from('price_lists')
          .upsert(pl.priceList)
          .select()
          .single();
        
        if (pl.items.length) {
          await supabase.from('price_list_items').delete().eq('price_list_id', savedPL.id);
          const items = pl.items.map(item => ({ ...item, price_list_id: savedPL.id }));
          await supabase.from('price_list_items').insert(items);
        }
      }
      
      // Save polynomial conditions
      if (payload.polynomialConditions) {
        await supabase.from('polynomial_conditions').upsert(payload.polynomialConditions);
      }
      
      cache.contracts = null; // Invalidar cache
      return savedContract;
    } catch (err) {
      console.error('saveContract error:', err);
      if (SUPABASE_CONFIG.enableOffline) {
        offlineQueue.push({ type: 'saveContract', data: contract });
        localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
      }
      throw err;
    }
  }
  
  async function deleteContract(contractId) {
    if (!USE_SUPABASE) {
      const contracts = JSON.parse(localStorage.getItem('contracts') || '[]');
      const filtered = contracts.filter(c => c.id !== contractId);
      localStorage.setItem('contracts', JSON.stringify(filtered));
      return true;
    }
    
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);
      
      if (error) throw error;
      cache.contracts = null;
      return true;
    } catch (err) {
      console.error('deleteContract error:', err);
      throw err;
    }
  }
  
  // PURCHASE ORDERS (ME2N)
  async function getPurchaseOrders() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('me2n_data') || '{}');
    
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('period', { ascending: false });
      
      if (error) throw error;
      
      // Transform to legacy format
      const me2n = {};
      data.forEach(po => {
        if (!me2n[po.contract_num]) {
          me2n[po.contract_num] = [po.vendor, po.currency, []];
        }
        me2n[po.contract_num][2].push([
          po.po_num,
          po.period,
          po.plant,
          po.net_order_value,
          po.still_to_invoice,
          po.line_items
        ]);
      });
      
      return me2n;
    } catch (err) {
      console.error('getPurchaseOrders error:', err);
      return JSON.parse(localStorage.getItem('me2n_data') || '{}');
    }
  }
  
  async function savePurchaseOrders(me2nData) {
    if (!USE_SUPABASE) {
      localStorage.setItem('me2n_data', JSON.stringify(me2nData));
      return true;
    }
    
    try {
      const pos = [];
      for (const [contractNum, data] of Object.entries(me2nData)) {
        const [vendor, currency, posList] = data;
        posList.forEach(po => {
          pos.push({
            contract_num: contractNum,
            po_num: po[0],
            vendor,
            currency,
            period: po[1],
            plant: po[2],
            net_order_value: po[3],
            still_to_invoice: po[4],
            line_items: po[5]
          });
        });
      }
      
      // Bulk upsert
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(pos, { onConflict: 'po_num' });
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('savePurchaseOrders error:', err);
      throw err;
    }
  }
  
  // INDICATORS
  async function getIndicatorSnapshots() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('indicator_snapshots') || '[]');
    
    try {
      const { data, error } = await supabase
        .from('indicator_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getIndicatorSnapshots error:', err);
      return JSON.parse(localStorage.getItem('indicator_snapshots') || '[]');
    }
  }
  
  async function saveIndicatorSnapshot(snapshot) {
    if (!USE_SUPABASE) {
      const snapshots = JSON.parse(localStorage.getItem('indicator_snapshots') || '[]');
      snapshots.push(snapshot);
      localStorage.setItem('indicator_snapshots', JSON.stringify(snapshots));
      return snapshot;
    }
    
    try {
      const { data, error } = await supabase
        .from('indicator_snapshots')
        .upsert(snapshot, { onConflict: 'indicator_code,snapshot_date' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('saveIndicatorSnapshot error:', err);
      throw err;
    }
  }
  
  async function getIndicatorsConfig() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('indicators_config') || '[]');
    
    try {
      const { data, error } = await supabase
        .from('indicators_config')
        .select('*')
        .eq('active', true);
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getIndicatorsConfig error:', err);
      return JSON.parse(localStorage.getItem('indicators_config') || '[]');
    }
  }
  
  // TENDERS
  async function getTenders() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('licitaciones') || '[]');
    
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getTenders error:', err);
      return JSON.parse(localStorage.getItem('licitaciones') || '[]');
    }
  }
  
  async function saveTender(tender) {
    if (!USE_SUPABASE) {
      const tenders = JSON.parse(localStorage.getItem('licitaciones') || '[]');
      const idx = tenders.findIndex(t => t.id === tender.id);
      if (idx !== -1) tenders[idx] = tender;
      else tenders.push(tender);
      localStorage.setItem('licitaciones', JSON.stringify(tenders));
      return tender;
    }
    
    try {
      const { data, error } = await supabase
        .from('tenders')
        .upsert(tender)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('saveTender error:', err);
      throw err;
    }
  }
  
  // SUPPLIERS
  async function getSuppliers() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('proveedores') || '[]');
    
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('nombre');
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getSuppliers error:', err);
      return JSON.parse(localStorage.getItem('proveedores') || '[]');
    }
  }
  
  async function saveSupplier(supplier) {
    if (!USE_SUPABASE) {
      const suppliers = JSON.parse(localStorage.getItem('proveedores') || '[]');
      const idx = suppliers.findIndex(s => s.id === supplier.id);
      if (idx !== -1) suppliers[idx] = supplier;
      else suppliers.push(supplier);
      localStorage.setItem('proveedores', JSON.stringify(suppliers));
      return supplier;
    }
    
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .upsert(supplier)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('saveSupplier error:', err);
      throw err;
    }
  }
  
  // USERS
  async function getUsers() {
    if (!USE_SUPABASE) return JSON.parse(localStorage.getItem('app_users') || '[]');
    
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('username');
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getUsers error:', err);
      return JSON.parse(localStorage.getItem('app_users') || '[]');
    }
  }
  
  async function saveUser(user) {
    if (!USE_SUPABASE) {
      const users = JSON.parse(localStorage.getItem('app_users') || '[]');
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) users[idx] = user;
      else users.push(user);
      localStorage.setItem('app_users', JSON.stringify(users));
      return user;
    }
    
    try {
      const { data, error } = await supabase
        .from('app_users')
        .upsert(user)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('saveUser error:', err);
      throw err;
    }
  }
  
  // AUTH
  async function login(username, password) {
    if (!USE_SUPABASE) {
      const users = JSON.parse(localStorage.getItem('app_users') || '[]');
      const user = users.find(u => u.username === username);
      if (!user) throw new Error('Usuario no encontrado');
      
      const hash = await sha256Hex(password);
      if (hash !== user.password_hash) throw new Error('Contraseña incorrecta');
      
      localStorage.setItem('current_user', JSON.stringify({ id: user.id, username: user.username, role: user.role }));
      return user;
    }
    
    try {
      const hash = await sha256Hex(password);
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', hash)
        .eq('active', true)
        .single();
      
      if (error) throw new Error('Credenciales inválidas');
      
      await supabase.from('app_users').update({ last_login: new Date().toISOString() }).eq('id', data.id);
      
      localStorage.setItem('current_user', JSON.stringify({ id: data.id, username: data.username, role: data.role }));
      return data;
    } catch (err) {
      console.error('login error:', err);
      throw err;
    }
  }
  
  // SYNC OFFLINE QUEUE
  async function syncOfflineQueue() {
    if (!USE_SUPABASE || !offlineQueue.length) return;
    
    try {
      for (const item of offlineQueue) {
        if (item.type === 'saveContract') {
          await saveContract(item.data);
        }
      }
      offlineQueue = [];
      localStorage.removeItem('offline_queue');
    } catch (err) {
      console.error('syncOfflineQueue error:', err);
    }
  }
  
  // REALTIME SUBSCRIPTIONS
  function subscribeToContracts(callback) {
    if (!USE_SUPABASE) return;
    
    supabase
      .channel('contracts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, callback)
      .subscribe();
  }
  
  // TRANSFORMERS
  function transformContractFromDB(dbContract) {
    return {
      id: dbContract.id,
      num: dbContract.num,
      cont: dbContract.cont,
      det: dbContract.det,
      tipo: dbContract.tipo,
      tcontr: dbContract.tcontr,
      monto: dbContract.monto,
      mon: dbContract.mon,
      fechaIni: dbContract.fecha_ini,
      fechaFin: dbContract.fecha_fin,
      plazo: dbContract.plazo,
      resp: dbContract.resp,
      own: dbContract.own,
      rtec: dbContract.rtec,
      vend: dbContract.vend,
      cc: dbContract.cc,
      cof: dbContract.cof,
      cprov: dbContract.cprov,
      dd: dbContract.dd,
      pr: dbContract.pr,
      sq: dbContract.sq,
      fev: dbContract.fev,
      com: dbContract.com,
      oferentes: dbContract.oferentes,
      btar: dbContract.btar,
      _aveOwnerLimit: dbContract.ave_owner_limit,
      poly: (dbContract.polynomial_configs || []).map(p => ({
        idx: p.idx,
        inc: p.inc,
        base: p.base
      })),
      enmiendas: (dbContract.amendments || []).map(a => ({
        num: a.num,
        tipo: a.tipo,
        fecha: a.fecha,
        motivo: a.motivo,
        descripcion: a.descripcion,
        fechaFinNueva: a.fecha_fin_nueva,
        pctPoli: a.pct_poli,
        basePeriodo: a.base_periodo,
        nuevoPeriodo: a.nuevo_periodo,
        correccionDeEnm: a.correccion_de_enm,
        superseded: a.superseded,
        polyTerms: a.poly_terms
      })),
      aves: (dbContract.aves || []).map(a => ({
        id: a.id,
        tipo: a.tipo,
        subtipo: a.subtipo,
        enmRef: a.enm_ref,
        fecha: a.fecha,
        periodo: a.periodo,
        monto: a.monto,
        concepto: a.concepto,
        autoGenerated: a.auto_generated
      })),
      tarifarios: (dbContract.price_lists || []).map(pl => ({
        name: pl.name,
        period: pl.period,
        source: pl.source,
        sourceFileName: pl.source_file_name,
        editable: pl.editable,
        importedAt: pl.imported_at,
        cols: ['Item', 'Descripción', 'Unidad', 'Precio'],
        rows: (pl.price_list_items || []).map(item => [
          item.item_code,
          item.description,
          item.unit,
          item.unit_price
        ])
      }))
    };
  }
  
  function transformContractToDB(contract) {
    return {
      contract: {
        id: contract.id,
        num: contract.num,
        cont: contract.cont,
        det: contract.det,
        tipo: contract.tipo,
        tcontr: contract.tcontr,
        monto: contract.monto,
        mon: contract.mon,
        fecha_ini: contract.fechaIni,
        fecha_fin: contract.fechaFin,
        plazo: contract.plazo,
        resp: contract.resp,
        own: contract.own,
        rtec: contract.rtec,
        vend: contract.vend,
        cc: contract.cc,
        cof: contract.cof,
        cprov: contract.cprov,
        dd: contract.dd,
        pr: contract.pr,
        sq: contract.sq,
        fev: contract.fev,
        com: contract.com,
        oferentes: contract.oferentes,
        btar: contract.btar,
        ave_owner_limit: contract._aveOwnerLimit
      },
      polynomialConfigs: (contract.poly || []).map((p, idx) => ({
        contract_id: contract.id,
        idx: p.idx,
        inc: p.inc,
        base: p.base,
        sort_order: idx
      })),
      amendments: (contract.enmiendas || []).map(a => ({
        contract_id: contract.id,
        num: a.num,
        tipo: a.tipo,
        fecha: a.fecha,
        motivo: a.motivo,
        descripcion: a.descripcion,
        fecha_fin_nueva: a.fechaFinNueva,
        pct_poli: a.pctPoli,
        base_periodo: a.basePeriodo,
        nuevo_periodo: a.nuevoPeriodo,
        correccion_de_enm: a.correccionDeEnm,
        superseded: a.superseded,
        poly_terms: a.polyTerms
      })),
      aves: (contract.aves || []).map(a => ({
        contract_id: contract.id,
        tipo: a.tipo,
        subtipo: a.subtipo,
        enm_ref: a.enmRef,
        fecha: a.fecha,
        periodo: a.periodo,
        monto: a.monto,
        concepto: a.concepto,
        auto_generated: a.autoGenerated
      })),
      priceLists: (contract.tarifarios || []).map(pl => ({
        priceList: {
          contract_id: contract.id,
          name: pl.name,
          period: pl.period,
          source: pl.source,
          source_file_name: pl.sourceFileName,
          editable: pl.editable,
          imported_at: pl.importedAt
        },
        items: (pl.rows || []).map((row, idx) => ({
          item_code: row[0],
          description: row[1],
          unit: row[2],
          unit_price: row[3],
          sort_order: idx
        }))
      })),
      polynomialConditions: null
    };
  }
  
  return {
    getContracts,
    saveContract,
    deleteContract,
    getPurchaseOrders,
    savePurchaseOrders,
    getIndicatorSnapshots,
    saveIndicatorSnapshot,
    getIndicatorsConfig,
    getTenders,
    saveTender,
    getSuppliers,
    saveSupplier,
    getUsers,
    saveUser,
    login,
    syncOfflineQueue,
    subscribeToContracts
  };
})();

// ═══════════════════════════════════════════════════════════════════
// REEMPLAZAR EN CÓDIGO EXISTENTE
// ═══════════════════════════════════════════════════════════════════

/* ANTES:
var DB = JSON.parse(localStorage.getItem('contracts') || '[]');
function save() {
  localStorage.setItem('contracts', JSON.stringify(DB));
}

DESPUÉS:
var DB = [];
async function loadDB() {
  DB = await DB_API.getContracts();
  render();
}
async function save() {
  // DB ya está actualizado en memoria, solo guardar el que cambió
  await DB_API.saveContract(DB.find(c => c.id === detId));
}
*/

// Auto-sync on load
if (window.addEventListener) {
  window.addEventListener('DOMContentLoaded', async function() {
    await DB_API.syncOfflineQueue();
  });
}
