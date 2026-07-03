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
  if(log.foto){
    const {mime, base64} = splitDataUrl(log.foto);
    payload.fotoBase64 = base64;
    payload.fotoMime = log.fotoMime || mime;
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
  window.addEventListener('online', ()=> syncPendingLogs(false));
}
