/* ==========================================================================
   SARC-611 · Sistema Automatizado de Cobranzas y Ruteo
   Núcleo: estado, persistencia y parseo de Excel
   ========================================================================== */

const DIAS = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
const DIA_COLS = {lunes:'Lunes', martes:'Martes', miercoles:'Miercoles', jueves:'Jueves', viernes:'Viernes', sabado:'Sabado', domingo:'Domingo'};
const LS_DATA = 'sarc611_data_v1';
const LS_LOGS = 'sarc611_logs_v1';
const SS_SESSION = 'sarc611_session_v1';
const ADMIN_PASS = 'admin611';

let appData = {
  entries: [],       // filas de ruteo fusionadas con deuda
  vendedores: [],     // codigos de vendedor detectados
  importedAt: null,
  routesInfo: null,
  debtInfo: null,
};
let logs = []; // {id, ts, vendedorCode, codigo, razon, tipo, monto, foto, comentario}

let session = { role: 'none', vendedorCode: null, vendedorLabel: null };

// Datos crudos parseados en esta sesión (no se persisten en localStorage para no duplicar peso).
// Permiten fusionar aunque los dos archivos se importen en pasos separados dentro de la misma sesión.
let _lastRouteEntries = null;
let _lastDebtByClient = null;

/* ---------------------------- Persistencia ---------------------------- */

function saveData(){
  try{
    localStorage.setItem(LS_DATA, JSON.stringify(appData));
    return true;
  }catch(e){
    console.error(e);
    showToast('No se pudo guardar: almacenamiento lleno. Exportá y limpiá gestiones antiguas.', 'err');
    return false;
  }
}
function loadData(){
  try{
    const raw = localStorage.getItem(LS_DATA);
    if(raw) appData = JSON.parse(raw);
  }catch(e){ console.error('Error leyendo datos', e); }
}
function saveLogs(){
  try{
    localStorage.setItem(LS_LOGS, JSON.stringify(logs));
    return true;
  }catch(e){
    console.error(e);
    showToast('No se pudo guardar la gestión: almacenamiento lleno.', 'err');
    return false;
  }
}
function loadLogs(){
  try{
    const raw = localStorage.getItem(LS_LOGS);
    if(raw) logs = JSON.parse(raw);
  }catch(e){ console.error('Error leyendo logs', e); }
}
function saveSession(){ sessionStorage.setItem(SS_SESSION, JSON.stringify(session)); }
function loadSession(){
  try{
    const raw = sessionStorage.getItem(SS_SESSION);
    if(raw) session = JSON.parse(raw);
  }catch(e){}
}

function estimateStorageUsage(){
  let total = 0;
  try{
    for(const k in localStorage){
      if(!localStorage.hasOwnProperty(k)) continue;
      total += (localStorage[k].length + k.length) * 2; // UTF-16 aprox
    }
  }catch(e){}
  return total;
}

/* ---------------------------- Utilidades ---------------------------- */

function todayDiaName(){
  const idx = new Date().getDay(); // 0=domingo
  const map = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  return map[idx];
}
function fmtMoney(n){
  n = Number(n)||0;
  return '$' + n.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtDate(d){
  if(!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if(isNaN(dt)) return String(d);
  return dt.toLocaleDateString('es-AR');
}
function fmtDateTime(ts){
  const dt = new Date(ts);
  return dt.toLocaleDateString('es-AR') + ' ' + dt.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}
function uid(){ return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

let toastTimer = null;
function showToast(msg, type){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' '+type : '');
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.add('hidden'), 3200);
}

/* ---------------------------- Parseo de Excel ---------------------------- */

function readWorkbook(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {defval:null});
        resolve({rows, headers: rows.length ? Object.keys(rows[0]) : []});
      }catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normHeader(h){ return String(h).toLowerCase().replace(/[^a-z0-9]/g,''); }

function detectFileType(headers){
  const norm = headers.map(normHeader);
  const hasRouteSig = norm.includes('codigo') && norm.includes('vendedor') && norm.includes('lunes');
  // La columna del código de cliente cambió de nombre entre versiones del Excel
  // ("id cliente" -> "prov" en una carga posterior). Por eso la firma del archivo
  // de deudas se basa en columnas que se mantuvieron estables entre versiones
  // (SaldoTmp + ComprobanteOriginal), y el ID de cliente se busca aparte con
  // una lista de alias (ver findClienteIdKey).
  const hasDebtSig = norm.includes('saldotmp') && norm.includes('comprobanteoriginal') && norm.includes('razonsocial');
  if(hasRouteSig) return 'routes';
  if(hasDebtSig) return 'debts';
  return 'unknown';
}

// Alias conocidos para la columna que identifica al cliente en el archivo de
// cuentas corrientes. Si en el futuro cambia de nombre de nuevo, agregar acá.
const CLIENTE_ID_ALIASES = ['idcliente', 'prov', 'codigocliente', 'codcliente', 'clientecodigo', 'idprov', 'codigoprov', 'proveedor'];

function findClienteIdKey(headers){
  return findKey(headers, CLIENTE_ID_ALIASES);
}

// Extrae de una fila el nombre de columna real dado un conjunto de alias normalizados
function findKey(headers, aliases){
  for(const h of headers){
    if(aliases.includes(normHeader(h))) return h;
  }
  return null;
}

function processRoutesRows(rows, headers){
  const kCodigo = findKey(headers, ['codigo']);
  const kRazon = findKey(headers, ['razonsocial']);
  const kDireccion = findKey(headers, ['direccion']);
  const kZona = findKey(headers, ['zona']);
  const kVendedor = findKey(headers, ['vendedor']);
  const dayKeys = {};
  for(const dk in DIA_COLS){
    dayKeys[dk] = findKey(headers, [dk]);
  }
  const out = [];
  for(const row of rows){
    const codigo = row[kCodigo];
    if(codigo === null || codigo === undefined || codigo === '') continue;
    const dias = [];
    for(const dk in DIA_COLS){
      const key = dayKeys[dk];
      if(key && row[key] && Number(row[key]) !== 0) dias.push(DIA_COLS[dk]);
    }
    out.push({
      codigo: String(codigo).trim(),
      razon: (row[kRazon]||'').toString().trim(),
      direccion: (row[kDireccion]||'').toString().trim(),
      zona: row[kZona] != null ? String(row[kZona]) : '',
      vendedor: row[kVendedor] != null ? String(row[kVendedor]).trim() : '',
      dias,
    });
  }
  return out;
}

function processDebtRows(rows, headers){
  const kId = findClienteIdKey(headers);
  if(!kId){
    throw new Error('No se encontró la columna del código de cliente en el archivo de cuentas corrientes (probé: '+CLIENTE_ID_ALIASES.join(', ')+'). Revisá el nombre de esa columna en el Excel.');
  }
  const kComp = findKey(headers, ['comprobanteoriginal']);
  const kSaldo = findKey(headers, ['saldotmp']);
  const kVenc = findKey(headers, ['fechavencoriginal']);
  const kTel = findKey(headers, ['telefono']);
  const kLoc = findKey(headers, ['localidad']);
  const kCond = findKey(headers, ['condpago']);
  const kFantasia = findKey(headers, ['fantasia']);

  const seen = new Set();
  const byClient = {};
  for(const row of rows){
    const codigo = row[kId];
    if(codigo === null || codigo === undefined || codigo === '') continue;
    const code = String(codigo).trim();
    const comp = kComp ? String(row[kComp]) : Math.random();
    const dedupeKey = code + '||' + comp;
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const saldo = kSaldo ? (Number(row[kSaldo])||0) : 0;
    if(!byClient[code]){
      byClient[code] = {
        saldo: 0, detalle: [],
        telefono: kTel ? (row[kTel]||'') : '',
        localidad: kLoc ? (row[kLoc]||'') : '',
        cond_pago: kCond ? (row[kCond]||'') : '',
        fantasia: kFantasia ? (row[kFantasia]||'') : '',
      };
    }
    byClient[code].saldo += saldo;
    if(saldo > 0.5){
      byClient[code].detalle.push({
        comprobante: comp,
        monto: Math.round(saldo*100)/100,
        vencimiento: kVenc ? row[kVenc] : null,
      });
    }
  }
  for(const code in byClient){
    byClient[code].saldo = Math.round(byClient[code].saldo*100)/100;
    byClient[code].detalle.sort((a,b)=> (new Date(a.vencimiento||0)) - (new Date(b.vencimiento||0)));
  }
  return byClient;
}

function mergeData(routeEntries, debtByClient){
  const merged = routeEntries.map(r=>{
    const d = debtByClient[r.codigo] || {saldo:0, detalle:[], telefono:'', localidad:'', cond_pago:'', fantasia:''};
    return {
      ...r,
      saldo: d.saldo || 0,
      detalle: d.detalle || [],
      telefono: d.telefono || '',
      localidad: d.localidad || '',
      cond_pago: d.cond_pago || '',
      fantasia: d.fantasia || '',
    };
  });
  // clientes con deuda que no tienen fila de ruta (sin día asignado) -> igual los incluimos, sin dias, para que el admin los vea
  const routeCodes = new Set(routeEntries.map(r=>r.codigo));
  for(const code in debtByClient){
    if(!routeCodes.has(code) && debtByClient[code].saldo > 0.5){
      const d = debtByClient[code];
      merged.push({
        codigo: code, razon: d.fantasia || ('Cliente '+code), direccion: '', zona: '', vendedor: '', dias: [],
        saldo: d.saldo, detalle: d.detalle, telefono: d.telefono, localidad: d.localidad, cond_pago: d.cond_pago, fantasia: d.fantasia,
      });
    }
  }
  return merged;
}

async function importFiles(fileList){
  const files = Array.from(fileList);
  let routeEntries = null, debtByClient = null;
  const results = {routes:null, debts:null, unknown:[]};
  for(const f of files){
    try{
      const {rows, headers} = await readWorkbook(f);
      const type = detectFileType(headers);
      if(type === 'routes'){
        routeEntries = processRoutesRows(rows, headers);
        results.routes = {name:f.name, rows: rows.length};
      }else if(type === 'debts'){
        debtByClient = processDebtRows(rows, headers);
        results.debts = {name:f.name, rows: rows.length, clientes: Object.keys(debtByClient).length};
      }else{
        results.unknown.push(f.name);
      }
    }catch(err){
      console.error('Error procesando', f.name, err);
      results.unknown.push(f.name + ' (error de lectura)');
    }
  }

  if(routeEntries){
    appData.routesInfo = results.routes;
    _lastRouteEntries = routeEntries;
  }
  if(debtByClient){
    appData.debtInfo = results.debts;
    _lastDebtByClient = debtByClient;
  }

  if(_lastRouteEntries && _lastDebtByClient){
    appData.entries = mergeData(_lastRouteEntries, _lastDebtByClient);
    appData.vendedores = [...new Set(appData.entries.map(e=>e.vendedor).filter(v=>v))].sort((a,b)=> Number(a)-Number(b) || a.localeCompare(b));
    appData.importedAt = Date.now();
    saveData();
  }

  results.merged = !!(_lastRouteEntries && _lastDebtByClient);
  return results;
}

/* ---------------------------- Fotos (compresión) ---------------------------- */

function compressImageFile(file, maxDim=900, quality=0.62){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e)=>{
      img.onload = ()=>{
        let {width, height} = img;
        if(width > height && width > maxDim){ height = Math.round(height * maxDim/width); width = maxDim; }
        else if(height > maxDim){ width = Math.round(width * maxDim/height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------------------- Lógica de negocio: entries + logs ---------------------------- */

// Una factura está vencida si su fecha de vencimiento es hoy o anterior a hoy.
// Se calcula siempre "en vivo" (no se guarda fija) para que no quede desactualizado
// entre una importación y la siguiente.
function startOfToday(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function isInvoiceVencida(det){
  if(!det.vencimiento) return false;
  const d = new Date(det.vencimiento);
  if(isNaN(d)) return false;
  d.setHours(0,0,0,0);
  return d.getTime() <= startOfToday().getTime();
}
function getDetalleVencido(entry){
  return (entry.detalle||[]).filter(isInvoiceVencida);
}
function getDetalleNoVencido(entry){
  return (entry.detalle||[]).filter(d=>!isInvoiceVencida(d));
}
function getSaldoVencido(entry){
  return Math.round(getDetalleVencido(entry).reduce((s,d)=>s+d.monto,0)*100)/100;
}
function getSaldoNoVencido(entry){
  return Math.round(getDetalleNoVencido(entry).reduce((s,d)=>s+d.monto,0)*100)/100;
}

function getEntryLogsToday(codigo, vendedor){
  const todayStr = new Date().toDateString();
  return logs.filter(l => l.codigo === codigo && l.vendedorCode === vendedor && new Date(l.ts).toDateString() === todayStr);
}

function getEntryStatus(entry){
  const todayLogs = getEntryLogsToday(entry.codigo, entry.vendedor);
  if(todayLogs.length === 0) return 'PENDIENTE';
  const last = todayLogs[todayLogs.length-1];
  return last.tipo; // 'COBRADO' | 'PARCIAL' | 'NOCOBRADO'
}

// Devuelve las entradas de ruta del vendedor/día con deuda (>$0), vencida o no.
// Se muestra toda la deuda del cliente para que el vendedor tenga el panorama
// completo, pero queda diferenciada: _detalleVencido/_saldoVencido (lo que ya
// venció, se puede cobrar y despachar) y _detalleNoVencido/_saldoNoVencido
// (lo que todavía no vence, solo informativo).
function getEntriesForVendedorDia(vendedorCode, diaName){
  return appData.entries
    .filter(e => String(e.vendedor) === String(vendedorCode) && e.dias.includes(diaName))
    .map(e => ({
      ...e,
      _detalleVencido: getDetalleVencido(e),
      _saldoVencido: getSaldoVencido(e),
      _detalleNoVencido: getDetalleNoVencido(e),
      _saldoNoVencido: getSaldoNoVencido(e),
    }))
    .filter(e => e.saldo > 0.5);
}

function addLog(entry, data, vendedorCode){
  const log = {
    id: uid(),
    ts: Date.now(),
    vendedorCode: String(vendedorCode),
    vendedorNombre: data.vendedorNombre || ('V'+vendedorCode),
    codigo: entry.codigo,
    razon: entry.razon,
    tipo: data.tipo, // COBRADO | PARCIAL | NOCOBRADO
    monto: Number(data.monto)||0,
    facturasSeleccionadas: data.facturasSeleccionadas || [], // [{comprobante, monto}]
    facturasDetalle: (data.facturasSeleccionadas||[]).map(f=>f.comprobante).join('; '),
    fechaTransferencia: data.fechaTransferencia || null,
    prioridad: data.prioridad || null, // 'Prioridad 1: Despacho en el Acto' | 'Prioridad 2: Gestión Regular'
    saldoVencidoAlMomento: getSaldoVencido(entry),
    foto: data.foto || null,
    fotoMime: data.fotoMime || null,
    fotoNombre: data.fotoNombre || null,
    comentario: data.comentario || '',
    synced: false,
    driveLink: null,
    syncError: null,
  };
  logs.push(log);
  saveLogs();
  return log;
}

/* ---------------------------- Nombres de vendedor ---------------------------- */
// El Excel de rutas solo trae el código numérico de vendedor (ej. 31), no el nombre.
// Se guarda un mapeo editable código -> nombre para que la hoja de cálculo quede prolija
// (columna "VENDEDOR" con nombre real, ej. "GONZALEZ MARCELA LUCIANA").

function getVendedorNombre(code){
  if(!appData.vendedorNombres) appData.vendedorNombres = {};
  return appData.vendedorNombres[code] || ('V'+code);
}
function setVendedorNombre(code, nombre){
  if(!appData.vendedorNombres) appData.vendedorNombres = {};
  appData.vendedorNombres[code] = nombre;
  saveData();
}

/* ---------------------------- Archivos genéricos (PDF/imagen sin comprimir) ---------------------------- */

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=> resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl){
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl||'');
  if(!m) return {mime:'application/octet-stream', base64:''};
  return {mime: m[1], base64: m[2]};
}

const MAX_ADJUNTO_MB = 8;

async function handleComprobanteFile(file){
  if(!file) return null;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name||'');
  if(isPdf){
    if(file.size > MAX_ADJUNTO_MB*1024*1024){
      throw new Error('El PDF pesa más de '+MAX_ADJUNTO_MB+'MB. Elegí un archivo más liviano.');
    }
    const dataUrl = await fileToDataURL(file);
    return {dataUrl, mime:'application/pdf', nombre: file.name || 'comprobante.pdf', isPdf:true};
  }else{
    const dataUrl = await compressImageFile(file);
    return {dataUrl, mime:'image/jpeg', nombre: 'comprobante.jpg', isPdf:false};
  }
}
