/* ==========================================================================
   Sincronización con Google Sheets / Drive (vía Apps Script)
   ========================================================================== */

function isSyncConfigured(){
  return typeof SCRIPT_URL === 'string' && SCRIPT_URL.trim().length > 0;
}

async function syncLogToSheet(log){
  if(!isSyncConfigured()){
    log.syncError = 'Falta configurar SCRIPT_URL en config.js';
    saveLogs();
    return {ok:false, error: log.syncError};
  }
  const entry = appData.entries.find(e=> e.codigo===log.codigo && String(e.vendedor)===String(log.vendedorCode));
  const payload = {
    action: 'gestion',
    vendedorCode: log.vendedorCode,
    vendedorNombre: log.vendedorNombre,
    clienteCodigo: log.codigo,
    clienteNombre: log.razon,
    fechaTransferencia: log.fechaTransferencia,
    facturasDetalle: log.facturasDetalle,
    montoCobrado: log.monto,
    observaciones: log.comentario,
    prioridad: log.prioridad,
    fotoBase64: null,
    fotoMime: log.fotoMime,
    fotoNombre: log.fotoNombre,
  };
  if(log.hasFoto){
    let fotoDataUrl = photoCache[log.id];
    if(!fotoDataUrl){
      // No estaba en la caché de memoria (por ejemplo, se reinició la app justo
      // después de guardar): se busca directamente en IndexedDB como respaldo.
      try{ fotoDataUrl = await idbGet(STORE_PHOTOS, log.id); }catch(e){ console.error(e); }
    }
    if(fotoDataUrl){
      const {mime, base64} = splitDataUrl(fotoDataUrl);
      payload.fotoBase64 = base64;
      payload.fotoMime = log.fotoMime || mime;
    }
  }

  try{
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'}, // evita preflight CORS con Apps Script
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if(data.ok){
      log.synced = true;
      log.driveLink = data.driveLink || null;
      log.syncError = null;
    }else{
      log.synced = false;
      log.syncError = data.error || 'Error desconocido del servidor';
    }
    saveLogs();
    return data;
  }catch(err){
    log.synced = false;
    log.syncError = 'Sin conexión o error de red';
    saveLogs();
    return {ok:false, error: log.syncError};
  }
}

function getPendingSyncLogs(){
  // Solo se sincronizan las gestiones con cobro real (tienen sentido en la hoja de cálculo).
  return logs.filter(l => !l.synced && (l.tipo === 'COBRADO' || l.tipo === 'PARCIAL'));
}

let _syncing = false;
async function syncPendingLogs(showToasts){
  if(_syncing) return;
  const pending = getPendingSyncLogs();
  if(pending.length === 0) return {synced:0, failed:0, total:0};
  if(!isSyncConfigured()){
    if(showToasts) showToast('Falta configurar la conexión con Google (config.js)', 'err');
    return {synced:0, failed:pending.length, total:pending.length};
  }
  _syncing = true;
  if(showToasts) showToast('Sincronizando ' + pending.length + ' gestión(es)...', '');
  let synced = 0, failed = 0;
  for(const log of pending){
    const r = await syncLogToSheet(log);
    if(r.ok) synced++; else failed++;
  }
  _syncing = false;
  if(showToasts){
    if(failed === 0) showToast('Sincronización completa: ' + synced + ' gestión(es)', 'ok');
    else showToast('Sincronizadas ' + synced + ', con error ' + failed, failed>0 ? 'err' : 'ok');
  }
  render();
  return {synced, failed, total: pending.length};
}

// Reintenta automáticamente cuando vuelve la conexión o al abrir la app.
if(typeof window !== 'undefined'){
  window.addEventListener('online', ()=>{ syncPendingLogs(false); autoUpdateRouteData(false); });
}

/* ==========================================================================
   Sincronización de los DATOS DE RUTA (lo que importa el administrador)
   ==========================================================================
   Antes, cuando administración importaba los dos Excel en su PC, esos datos
   quedaban SOLO en el navegador de esa PC (localStorage), y nunca llegaban
   al celular del vendedor. Estas funciones resuelven eso: suben los datos
   procesados a Drive (vía el mismo Apps Script) y cada celular los descarga
   automáticamente cuando hay una versión más nueva.
   ========================================================================== */

// Llamar después de una importación exitosa en el panel de administración.
async function syncRouteDataToBackend(){
  if(!isSyncConfigured()) return {ok:false, error:'SCRIPT_URL sin configurar'};
  const payload = {
    action: 'saveRouteData',
    data: {
      entries: appData.entries,
      vendedores: appData.vendedores,
      vendedorNombres: appData.vendedorNombres || {},
      routesInfo: appData.routesInfo,
      debtInfo: appData.debtInfo,
      importedAt: appData.importedAt,
    },
  };
  try{
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  }catch(err){
    return {ok:false, error:'Sin conexión o error de red al subir la ruta'};
  }
}

// Chequeo liviano: solo compara fechas, no baja los ~2MB de datos si no hace falta.
async function checkRouteDataUpdate(){
  if(!isSyncConfigured()) return {hasUpdate:false};
  try{
    const res = await fetch(SCRIPT_URL + '?action=getRouteDataMeta');
    const data = await res.json();
    if(!data.ok || !data.importedAt) return {hasUpdate:false};
    const local = appData.importedAt || 0;
    return {hasUpdate: data.importedAt > local, remoteImportedAt: data.importedAt};
  }catch(err){
    return {hasUpdate:false, error:'Sin conexión'};
  }
}

// Baja los datos completos y los aplica localmente.
async function pullRouteDataFromBackend(){
  if(!isSyncConfigured()) return {ok:false, error:'SCRIPT_URL sin configurar'};
  try{
    const res = await fetch(SCRIPT_URL + '?action=getRouteData');
    const data = await res.json();
    if(!data.ok || !data.data) return {ok:false, error: data.error || 'No hay datos de ruta guardados todavía'};
    appData.entries = data.data.entries || [];
    appData.vendedores = data.data.vendedores || [];
    appData.vendedorNombres = data.data.vendedorNombres || {};
    appData.routesInfo = data.data.routesInfo || null;
    appData.debtInfo = data.data.debtInfo || null;
    appData.importedAt = data.data.importedAt || null;
    saveData();
    return {ok:true};
  }catch(err){
    return {ok:false, error:'Sin conexión o error de red al descargar la ruta'};
  }
}

// Se llama al abrir la app (y al reconectar): si hay una ruta más nueva en el
// servidor que la que tiene el dispositivo, la descarga sola sin molestar.
async function autoUpdateRouteData(showToasts){
  const check = await checkRouteDataUpdate();
  if(!check.hasUpdate) return;
  if(showToasts) showToast('Actualizando ruta...', '');
  const r = await pullRouteDataFromBackend();
  if(r.ok){
    if(showToasts) showToast('Ruta actualizada', 'ok');
    render();
  }else if(showToasts){
    showToast('No se pudo actualizar la ruta: ' + (r.error||''), 'err');
  }
}
