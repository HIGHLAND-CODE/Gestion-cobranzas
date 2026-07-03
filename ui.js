/* ==========================================================================
   SARC-611 · Interfaz
   ========================================================================== */

let ui = {
  screen: 'login',            // login | sellerLogin | adminLogin | seller | admin
  sellerTab: 'ruta',          // ruta | historial
  sellerFilter: 'all',        // all | PENDIENTE | COBRADO
  adminTab: 'resumen',        // resumen | importar | ruteo | gestiones | clientes | vendedores
  ruteoVendedor: null,
  ruteoDia: null,
  gestFecha: 'hoy',           // hoy | 7dias | todo
  gestVendedor: 'todos',
  clientesSearch: '',
  clientesVendedor: 'todos',
  activeEntry: null,          // entrada abierta en el modal de gestión
  actingVendedor: null,       // cuando admin gestiona en nombre de un vendedor
  pendingPhoto: null,         // {dataUrl, mime, nombre, isPdf} temporal en el modal
  lightboxPhoto: null,
  detailEntry: null,
  // estado del formulario de gestión abierto:
  gestSeleccion: {},          // {comprobante: true/false}
  gestPrioridad: null,        // 'Prioridad 1: Despacho en el Acto' | 'Prioridad 2: Gestión Regular'
};

const root = () => document.getElementById('root');

function render(){
  const r = root();
  switch(ui.screen){
    case 'login': r.innerHTML = tplLogin(); break;
    case 'sellerLogin': r.innerHTML = tplSellerLogin(); break;
    case 'adminLogin': r.innerHTML = tplAdminLogin(); break;
    case 'seller': r.innerHTML = tplSellerShell(); break;
    case 'admin': r.innerHTML = tplAdminShell(); break;
  }
  wireEvents();
  renderModals();
}

/* ---------------------------- Topbar helper ---------------------------- */

function topbar({title, subtitle, showBack, showLogout, showSync}){
  return `
  <div class="topbar">
    <div class="brand">
      ${showBack ? `<button class="icon-btn" id="btnBack">←</button>` : `<div class="brand-mark">611</div>`}
      <div class="brand-text"><b>${title}</b><span>${subtitle}</span></div>
    </div>
    <div class="topbar-actions">
      ${showSync ? tplSyncStatusPill() : ''}
      ${showLogout ? `<button class="icon-btn" id="btnLogout">Salir</button>` : ''}
    </div>
  </div>`;
}

/* ---------------------------- LOGIN ---------------------------- */

function tplLogin(){
  return `
  <div class="app-shell">
    ${topbar({title:'Cobranzas 611', subtitle:'Sistema de ruteo y gestión'})}
    <div class="login-wrap">
      <div class="login-hero">
        <div class="mark">611</div>
        <h1>Bienvenido</h1>
        <p>Elegí cómo querés ingresar al sistema</p>
      </div>
      <div class="role-grid">
        <div class="role-card" id="cardVendedor">
          <span class="ricon">🧾</span>
          <b>Vendedor</b>
          <span>Ver mi ruta del día</span>
        </div>
        <div class="role-card" id="cardAdmin">
          <span class="ricon">🛠️</span>
          <b>Administrador</b>
          <span>Importar y supervisar</span>
        </div>
      </div>
    </div>
  </div>`;
}

function tplSellerLogin(){
  return `
  <div class="app-shell">
    ${topbar({title:'Ingreso Vendedor', subtitle:'Cobranzas 611', showBack:true})}
    <div class="login-wrap">
      <div class="login-form">
        <h2>Ingresá tu código</h2>
        <p class="sub">Ejemplo: 31 (o V31). El sistema arma tu ruta del día automáticamente.</p>
        <div class="field">
          <label>Código de vendedor</label>
          <input type="text" id="inpVendCode" inputmode="numeric" placeholder="Ej: 31" autofocus>
        </div>
        <button class="btn btn-primary btn-block" id="btnSellerEnter">Ingresar</button>
        <div class="err-msg" id="sellerErr"></div>
      </div>
    </div>
  </div>`;
}

function tplAdminLogin(){
  return `
  <div class="app-shell">
    ${topbar({title:'Ingreso Administrador', subtitle:'Cobranzas 611', showBack:true})}
    <div class="login-wrap">
      <div class="login-form">
        <h2>Clave de acceso</h2>
        <p class="sub">Panel de importación y supervisión</p>
        <div class="field">
          <label>Contraseña</label>
          <input type="password" id="inpAdminPass" placeholder="••••••••" autofocus>
        </div>
        <button class="btn btn-primary btn-block" id="btnAdminEnter">Ingresar</button>
        <div class="err-msg" id="adminErr"></div>
      </div>
    </div>
  </div>`;
}

/* ---------------------------- VENDEDOR ---------------------------- */

function tplSellerShell(){
  const dia = todayDiaName();
  const list = getEntriesForVendedorDia(session.vendedorCode, dia).sort((a,b)=> b._saldoVencido - a._saldoVencido);
  const withStatus = list.map(e=>({...e, _status: getEntryStatus(e)}));
  const filtered = ui.sellerFilter === 'all' ? withStatus : withStatus.filter(e=> e._status === ui.sellerFilter);

  const totalDeuda = list.reduce((s,e)=>s+e._saldoVencido,0);
  const cobradosHoy = withStatus.filter(e=>e._status==='COBRADO').length;

  const body = ui.sellerTab === 'ruta' ? tplSellerRuta(dia, filtered, list.length, totalDeuda, cobradosHoy) : tplSellerHistorial();

  return `
  <div class="app-shell">
    ${topbar({title: 'V'+session.vendedorCode, subtitle: dia + ' · ' + new Date().toLocaleDateString('es-AR'), showLogout:true, showSync:true})}
    ${body}
    <div class="bottom-nav">
      <button class="nav-item ${ui.sellerTab==='ruta'?'active':''}" data-stab="ruta"><span class="nicon">🗺️</span><span>Mi ruta</span></button>
      <button class="nav-item ${ui.sellerTab==='historial'?'active':''}" data-stab="historial"><span class="nicon">📋</span><span>Historial hoy</span></button>
    </div>
  </div>`;
}

function tplSellerRuta(dia, filtered, totalClientes, totalDeuda, cobradosHoy){
  if(!appData.entries || appData.entries.length === 0){
    return `<div class="empty-state">
      <span class="eicon">📭</span>
      <b>Todavía no hay datos cargados</b>
      <p>Pedile al administrador que importe las planillas de ruta y cuentas corrientes, o probá actualizar si ya las cargó.</p>
      <button class="btn btn-accent btn-sm" id="btnRefreshRoute" style="margin-top:12px">⟳ Buscar ruta actualizada</button>
    </div>`;
  }
  return `
  <div class="kpi-row">
    <div class="kpi"><div class="k-label">Clientes hoy</div><div class="k-value">${totalClientes}</div></div>
    <div class="kpi accent"><div class="k-label">Deuda vencida</div><div class="k-value">${fmtMoney(totalDeuda)}</div></div>
    <div class="kpi ok"><div class="k-label">Cobrados</div><div class="k-value">${cobradosHoy}/${totalClientes}</div></div>
  </div>
  <div style="padding:0 18px 10px;display:flex;justify-content:flex-end">
    <button class="btn btn-ghost btn-sm" id="btnRefreshRoute">⟳ Actualizar ruta</button>
  </div>
  <div class="tabbar">
    <button class="tab ${ui.sellerFilter==='all'?'active':''}" data-sf="all">Todos</button>
    <button class="tab ${ui.sellerFilter==='PENDIENTE'?'active':''}" data-sf="PENDIENTE">Pendientes</button>
    <button class="tab ${ui.sellerFilter==='COBRADO'?'active':''}" data-sf="COBRADO">Cobrados</button>
    <button class="tab ${ui.sellerFilter==='PARCIAL'?'active':''}" data-sf="PARCIAL">Parciales</button>
  </div>
  ${filtered.length === 0 ? `
    <div class="empty-state">
      <span class="eicon">✅</span>
      <b>No hay clientes en este filtro</b>
      <p>${totalClientes===0 ? 'No tenés clientes con deuda VENCIDA asignados para hoy ('+dia+').' : 'Probá con otro filtro.'}</p>
    </div>` : `<div class="list">${filtered.map(e=>tplClientRow(e)).join('')}</div>`
  }`;
}

function tplClientRow(e){
  const statusLabel = {PENDIENTE:'Pendiente', COBRADO:'Cobrado', PARCIAL:'Parcial', NOCOBRADO:'No cobrado'}[e._status] || 'Pendiente';
  const detalleVencido = e._detalleVencido || getDetalleVencido(e);
  const saldoVencido = e._saldoVencido != null ? e._saldoVencido : getSaldoVencido(e);
  return `
  <div class="client-row" data-code="${e.codigo}" data-vend="${e.vendedor}">
    <div class="cr-top">
      <div>
        <div class="cr-name">${escapeHtml(e.razon)}</div>
        <div class="cr-addr">${escapeHtml(e.direccion || 'Sin dirección registrada')}</div>
        <div class="cr-code">#${e.codigo}${e.zona ? ' · Zona '+e.zona : ''} · ${detalleVencido.length} factura${detalleVencido.length===1?'':'s'} vencida${detalleVencido.length===1?'':'s'}</div>
      </div>
      <div class="cr-amount">${fmtMoney(saldoVencido)}</div>
    </div>
    <div class="cr-bottom">
      <span class="status-chip status-${e._status}">${statusLabel}</span>
      <div class="cr-actions">
        ${detalleVencido.length ? `<button class="btn btn-ghost btn-sm" data-detail="${e.codigo}">Detalle</button>` : ''}
        <button class="btn btn-accent btn-sm" data-gestionar="${e.codigo}">Gestionar</button>
      </div>
    </div>
  </div>`;
}

function tplSellerHistorial(){
  const todayStr = new Date().toDateString();
  const mine = logs.filter(l=> l.vendedorCode === String(session.vendedorCode) && new Date(l.ts).toDateString()===todayStr)
                    .sort((a,b)=>b.monto-a.monto);
  const totalCobrado = mine.filter(l=>l.tipo!=='NOCOBRADO').reduce((s,l)=>s+l.monto,0);
  if(mine.length===0){
    return `<div class="empty-state">
      <span class="eicon">🕒</span>
      <b>Todavía no registraste gestiones hoy</b>
      <p>Las cobranzas que registres van a aparecer acá.</p>
    </div>`;
  }
  return `
  <div class="kpi-row">
    <div class="kpi ok"><div class="k-label">Total cobrado hoy</div><div class="k-value">${fmtMoney(totalCobrado)}</div></div>
    <div class="kpi"><div class="k-label">Gestiones</div><div class="k-value">${mine.length}</div></div>
  </div>
  <div class="section-title">Registro de hoy</div>
  ${mine.map(l=>tplLogCard(l)).join('')}
  <div style="height:70px"></div>`;
}

function tplLogCard(l){
  const statusLabel = {COBRADO:'Cobrado', PARCIAL:'Parcial', NOCOBRADO:'No cobrado'}[l.tipo] || l.tipo;
  const isPdf = l.fotoMime === 'application/pdf';
  const needsSync = (l.tipo === 'COBRADO' || l.tipo === 'PARCIAL');
  let syncBadge = '';
  if(needsSync){
    if(l.synced) syncBadge = `<span class="pill" style="border-color:var(--ok);color:var(--ok);background:var(--ok-bg)">✓ En planilla</span>`;
    else if(l.syncError) syncBadge = `<span class="pill" style="border-color:var(--bad);color:var(--bad);background:var(--bad-bg)">⚠ Sin sincronizar</span>`;
    else syncBadge = `<span class="pill" style="border-color:var(--warn);color:var(--warn);background:var(--warn-bg)">⏳ Pendiente</span>`;
  }
  return `
  <div class="log-card" data-log="${l.id}">
    ${l.foto
      ? (isPdf ? `<div class="log-thumb" data-photo="${l.id}" style="display:flex;align-items:center;justify-content:center;font-size:20px">📄</div>`
               : `<img class="log-thumb" src="${l.foto}" data-photo="${l.id}">`)
      : `<div class="log-thumb empty">🧾</div>`}
    <div class="log-info">
      <div class="ltop">
        <b>${escapeHtml(l.razon)}</b>
        <span class="lamount">${fmtMoney(l.monto)}</span>
      </div>
      <div class="lmeta">#${l.codigo} · ${fmtDateTime(l.ts)}${l.fechaTransferencia ? ' · transf. '+fmtDate(l.fechaTransferencia) : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">
        <span class="status-chip status-${l.tipo}">${statusLabel}</span>
        ${l.prioridad ? `<span class="status-chip" style="background:${l.prioridad.indexOf('Prioridad 1')===0?'var(--bad-bg)':'#e5edfb'};color:${l.prioridad.indexOf('Prioridad 1')===0?'var(--bad)':'#2554a3'}">${l.prioridad.replace('Prioridad 1: ','P1: ').replace('Prioridad 2: ','P2: ')}</span>` : ''}
        ${syncBadge}
      </div>
      ${l.facturasDetalle ? `<div class="lmeta" style="margin-top:4px">Facturas: ${escapeHtml(l.facturasDetalle)}</div>` : ''}
      ${l.comentario ? `<div class="lmeta" style="margin-top:4px">"${escapeHtml(l.comentario)}"</div>` : ''}
      ${(needsSync && !l.synced) ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px" data-resync="${l.id}">Reintentar sincronización</button>` : ''}
    </div>
  </div>`;
}

function escapeHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------------------- ADMIN ---------------------------- */

function tplAdminShell(){
  const tabs = [
    ['resumen','Resumen'],
    ['importar','Importar'],
    ['ruteo','Ruteo'],
    ['gestiones','Gestiones'],
    ['clientes','Clientes'],
    ['vendedores','Vendedores'],
  ];
  let body = '';
  if(ui.adminTab==='resumen') body = tplAdminResumen();
  else if(ui.adminTab==='importar') body = tplAdminImportar();
  else if(ui.adminTab==='ruteo') body = tplAdminRuteo();
  else if(ui.adminTab==='gestiones') body = tplAdminGestiones();
  else if(ui.adminTab==='clientes') body = tplAdminClientes();
  else if(ui.adminTab==='vendedores') body = tplAdminVendedores();

  return `
  <div class="app-shell wide">
    ${topbar({title:'Panel Administrador', subtitle:'Cobranzas 611', showLogout:true, showSync:true})}
    <div class="admin-tabs">
      ${tabs.map(([k,l])=>`<button class="admin-tab ${ui.adminTab===k?'active':''}" data-atab="${k}">${l}</button>`).join('')}
    </div>
    ${body}
  </div>`;
}

function tplAdminResumen(){
  const hasData = appData.entries && appData.entries.length>0;
  const totalUsage = estimateStorageUsage();
  const usagePct = Math.min(100, Math.round(totalUsage / (5*1024*1024) * 100));
  if(!hasData){
    return `<div class="empty-state">
      <span class="eicon">📊</span>
      <b>Todavía no importaste las planillas</b>
      <p>Andá a la pestaña "Importar" para cargar los dos archivos de Excel.</p>
    </div>`;
  }
  const conDeuda = appData.entries.filter(e=>e.saldo>0.5);
  const totalDeuda = conDeuda.reduce((s,e)=>s+e.saldo,0);
  const totalVencido = conDeuda.reduce((s,e)=>s+getSaldoVencido(e),0);
  const todayStr = new Date().toDateString();
  const logsHoy = logs.filter(l=> new Date(l.ts).toDateString()===todayStr);
  const cobradoHoy = logsHoy.filter(l=>l.tipo!=='NOCOBRADO').reduce((s,l)=>s+l.monto,0);
  const dia = todayDiaName();
  const clientesHoy = appData.entries.filter(e=>e.dias.includes(dia) && getSaldoVencido(e)>0.5).length;

  return `
  <div class="view-header">
    <h1>Resumen general</h1>
    <div class="meta">Última importación: ${appData.importedAt ? fmtDateTime(appData.importedAt) : '—'}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi accent"><div class="k-label">Deuda vencida activa</div><div class="k-value">${fmtMoney(totalVencido)}</div></div>
    <div class="kpi"><div class="k-label">Deuda total (con no vencida)</div><div class="k-value">${fmtMoney(totalDeuda)}</div></div>
    <div class="kpi"><div class="k-label">Vendedores activos</div><div class="k-value">${appData.vendedores.length}</div></div>
    <div class="kpi ok"><div class="k-label">Cobrado hoy</div><div class="k-value">${fmtMoney(cobradoHoy)}</div></div>
    <div class="kpi"><div class="k-label">Ruta de hoy (${dia})</div><div class="k-value">${clientesHoy}</div></div>
    <div class="kpi"><div class="k-label">Gestiones hoy</div><div class="k-value">${logsHoy.length}</div></div>
  </div>
  <div class="section-title">Uso de almacenamiento local</div>
  <div class="storage-bar-wrap">
    <div class="meta">${(totalUsage/1024/1024).toFixed(2)} MB usados aprox. (fotos incluidas)</div>
    <div class="storage-bar"><div class="storage-bar-fill" style="width:${usagePct}%"></div></div>
  </div>
  ${!isSyncConfigured() ? `<div class="section-title" style="color:var(--warn)">⚠ Conexión con Google Sheets sin configurar (ver config.js)</div>` : ''}
  <div class="section-title">Vendedores</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Vendedor</th><th>Clientes c/ deuda vencida hoy</th><th>Deuda vencida ruta hoy</th><th>Gestiones hoy</th></tr></thead>
    <tbody>
      ${appData.vendedores.map(v=>{
        const rutaHoy = appData.entries.filter(e=>String(e.vendedor)===String(v) && e.dias.includes(dia) && getSaldoVencido(e)>0.5);
        const g = logsHoy.filter(l=>l.vendedorCode===String(v)).length;
        return {v, count:rutaHoy.length, total:rutaHoy.reduce((s,e)=>s+getSaldoVencido(e),0), g};
      }).sort((a,b)=>b.total-a.total).map(({v,count,total,g})=>
        `<tr><td><b>${escapeHtml(getVendedorNombre(v))}</b></td><td>${count}</td><td>${fmtMoney(total)}</td><td>${g}</td></tr>`
      ).join('')}
    </tbody>
  </table></div>
  <div style="height:20px"></div>`;
}

function tplAdminImportar(){
  const r = appData.routesInfo, d = appData.debtInfo;
  return `
  <div class="view-header">
    <h1>Importar planillas</h1>
    <div class="meta">Arrastrá o seleccioná los dos archivos .xlsx — el sistema los detecta automáticamente</div>
  </div>
  <div class="import-card" id="dropZone">
    <span class="iicon">📥</span>
    <h3>Soltá los archivos acá</h3>
    <p>"dia de visita clientes 611.xlsx" y "cuentas corrientes 611.xlsx" (podés soltar los dos juntos, en cualquier orden)</p>
    <button class="btn btn-accent" id="btnPickFiles">Elegir archivos</button>
    <input type="file" id="fileInput" accept=".xlsx,.xls" multiple class="hidden">
  </div>
  <div class="file-status-list">
    <div class="file-status ${r?'ok':'pending'}">
      <div class="fdot"></div>
      <b>Ruta / días de visita</b>
      <div class="fdetail">${r ? r.rows+' filas · '+r.name : 'Sin importar'}</div>
    </div>
    <div class="file-status ${d?'ok':'pending'}">
      <div class="fdot"></div>
      <b>Cuentas corrientes</b>
      <div class="fdetail">${d ? d.rows+' mov. · '+d.clientes+' clientes · '+d.name : 'Sin importar'}</div>
    </div>
  </div>
  ${(r && d) ? `<div style="padding:16px 18px"><button class="btn btn-ghost btn-block" id="btnClearData">Borrar datos importados</button></div>` : ''}
  ${isSyncConfigured() ? `<div style="padding:0 18px 16px"><button class="btn btn-ghost btn-block" id="btnRefreshRoute">⟳ Descargar la última ruta guardada en Google (si administrás desde otra PC)</button></div>` : ''}
  <div style="height:30px"></div>`;
}

function tplAdminRuteo(){
  if(!appData.vendedores || appData.vendedores.length===0){
    return `<div class="empty-state"><span class="eicon">🗺️</span><b>Sin datos</b><p>Importá las planillas primero.</p></div>`;
  }
  const vend = ui.ruteoVendedor || appData.vendedores[0];
  const dia = ui.ruteoDia || todayDiaName();
  const list = getEntriesForVendedorDia(vend, dia).map(e=>({...e, _status: getEntryStatus(e)})).sort((a,b)=> b._saldoVencido - a._saldoVencido);
  const totalDeuda = list.reduce((s,e)=>s+e._saldoVencido,0);
  return `
  <div class="filter-bar">
    <select id="selRuteoVend">
      ${appData.vendedores.map(v=>`<option value="${v}" ${String(v)===String(vend)?'selected':''}>V${v}</option>`).join('')}
    </select>
    <select id="selRuteoDia">
      ${DIAS.map(d=>`<option value="${d}" ${d===dia?'selected':''}>${d}${d===todayDiaName()?' (hoy)':''}</option>`).join('')}
    </select>
    <span class="pill" style="color:var(--ink-soft);border-color:var(--line);background:var(--card)">${list.length} clientes · ${fmtMoney(totalDeuda)}</span>
  </div>
  ${list.length===0 ? `<div class="empty-state"><span class="eicon">🗓️</span><b>Sin clientes con deuda vencida ese día</b><p>V${vend} no tiene clientes con facturas vencidas para ${dia}.</p></div>`
    : `<div class="list">${list.map(e=>tplClientRow(e)).join('')}</div>`}
  <div style="height:20px"></div>`;
}

function tplAdminGestiones(){
  let filtered = [...logs];
  if(ui.gestFecha==='hoy'){
    const t = new Date().toDateString();
    filtered = filtered.filter(l=> new Date(l.ts).toDateString()===t);
  }else if(ui.gestFecha==='7dias'){
    const cutoff = Date.now() - 7*24*3600*1000;
    filtered = filtered.filter(l=> l.ts >= cutoff);
  }
  if(ui.gestVendedor !== 'todos') filtered = filtered.filter(l=> l.vendedorCode === String(ui.gestVendedor));
  filtered.sort((a,b)=>b.monto-a.monto);
  const total = filtered.filter(l=>l.tipo!=='NOCOBRADO').reduce((s,l)=>s+l.monto,0);

  return `
  <div class="filter-bar">
    <select id="selGestFecha">
      <option value="hoy" ${ui.gestFecha==='hoy'?'selected':''}>Hoy</option>
      <option value="7dias" ${ui.gestFecha==='7dias'?'selected':''}>Últimos 7 días</option>
      <option value="todo" ${ui.gestFecha==='todo'?'selected':''}>Todo el historial</option>
    </select>
    <select id="selGestVend">
      <option value="todos">Todos los vendedores</option>
      ${appData.vendedores.map(v=>`<option value="${v}" ${ui.gestVendedor===v?'selected':''}>V${v}</option>`).join('')}
    </select>
    <button class="btn btn-accent btn-sm" id="btnExportLogs">⬇ Exportar Excel</button>
  </div>
  <div class="kpi-row">
    <div class="kpi ok"><div class="k-label">Total cobrado</div><div class="k-value">${fmtMoney(total)}</div></div>
    <div class="kpi"><div class="k-label">Gestiones</div><div class="k-value">${filtered.length}</div></div>
  </div>
  ${filtered.length===0 ? `<div class="empty-state"><span class="eicon">🗂️</span><b>No hay gestiones en este rango</b><p>Probá cambiando el filtro de fecha o vendedor.</p></div>`
    : filtered.map(l=>tplLogCard(l)).join('')}
  ${logs.length>0 ? `<div style="padding:6px 18px 20px"><button class="btn btn-ghost btn-block" id="btnClearLogs">Borrar historial completo de gestiones</button></div>` : `<div style="height:20px"></div>`}`;
}

function tplAdminClientes(){
  if(!appData.entries || appData.entries.length===0){
    return `<div class="empty-state"><span class="eicon">👥</span><b>Sin datos</b><p>Importá las planillas primero.</p></div>`;
  }
  let list = appData.entries.filter(e=>e.saldo>0.5).map(e=>({...e, _saldoVencido: getSaldoVencido(e)}));
  if(ui.clientesVendedor !== 'todos') list = list.filter(e=> String(e.vendedor)===String(ui.clientesVendedor));
  if(ui.clientesSearch){
    const q = ui.clientesSearch.toLowerCase();
    list = list.filter(e=> e.razon.toLowerCase().includes(q) || String(e.codigo).includes(q));
  }
  list = [...list].sort((a,b)=> b._saldoVencido - a._saldoVencido || b.saldo - a.saldo);
  const totalDeuda = list.reduce((s,e)=>s+e.saldo,0);
  const totalVencido = list.reduce((s,e)=>s+e._saldoVencido,0);

  return `
  <div class="filter-bar">
    <input type="text" id="inpClientesSearch" placeholder="Buscar cliente o código..." value="${escapeHtml(ui.clientesSearch)}" style="flex:1;min-width:160px">
    <select id="selClientesVend">
      <option value="todos">Todos los vendedores</option>
      ${appData.vendedores.map(v=>`<option value="${v}" ${ui.clientesVendedor===v?'selected':''}>V${v}</option>`).join('')}
    </select>
    <button class="btn btn-accent btn-sm" id="btnExportConsolidado">⬇ Exportar Excel</button>
  </div>
  <div class="section-title">${list.length} clientes con deuda · vencido ${fmtMoney(totalVencido)} de ${fmtMoney(totalDeuda)} total</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Días</th><th>Localidad</th><th>Deuda vencida</th><th>Deuda total</th></tr></thead>
    <tbody>
      ${list.slice(0,400).map(e=>`
        <tr>
          <td>${e.codigo}</td>
          <td>${escapeHtml(e.razon)}</td>
          <td>${e.vendedor ? 'V'+e.vendedor : '—'}</td>
          <td>${e.dias.join(', ') || '—'}</td>
          <td>${escapeHtml(e.localidad||'—')}</td>
          <td><b style="color:${e._saldoVencido>0.5?'var(--bad)':'inherit'}">${fmtMoney(e._saldoVencido)}</b></td>
          <td>${fmtMoney(e.saldo)}</td>
        </tr>`).join('')}
    </tbody>
  </table></div>
  ${list.length>400 ? `<div class="meta" style="padding:0 18px 16px">Mostrando 400 de ${list.length}. Usá el buscador o exportá a Excel para ver todos.</div>` : ''}
  <div style="height:20px"></div>`;
}

function tplAdminVendedores(){
  if(!appData.vendedores || appData.vendedores.length===0){
    return `<div class="empty-state"><span class="eicon">🧑‍💼</span><b>Sin datos</b><p>Importá las planillas primero para ver la lista de vendedores.</p></div>`;
  }
  return `
  <div class="view-header">
    <h1>Nombres de vendedor</h1>
    <div class="meta">El Excel de rutas solo trae el código (ej. V31). Completá el nombre real para que quede prolijo en la planilla de Google Sheets.</div>
  </div>
  <div class="table-wrap"><table>
    <thead><tr><th>Código</th><th>Nombre</th></tr></thead>
    <tbody>
      ${appData.vendedores.map(v=>`
        <tr>
          <td><b>V${v}</b></td>
          <td><input type="text" class="inpVendNombre" data-vendcode="${v}" value="${escapeHtml(getVendedorNombre(v))}" placeholder="Nombre y apellido" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12.5px"></td>
        </tr>`).join('')}
    </tbody>
  </table></div>
  <div style="height:20px"></div>`;
}

function tplSyncStatusPill(){
  if(!isSyncConfigured()){
    return `<span class="pill" style="border-color:var(--warn);color:var(--warn)">⚠ Google sin configurar</span>`;
  }
  const pending = getPendingSyncLogs().length;
  if(pending===0) return `<span class="pill" style="border-color:var(--ok);color:var(--ok)">✓ Sincronizado</span>`;
  return `<button class="icon-btn" id="btnSyncNow">⟳ ${pending} pendiente${pending===1?'':'s'}</button>`;
}

/* ---------------------------- MODALES ---------------------------- */

function renderModals(){
  const host = document.getElementById('modalHost');
  let html = '';
  if(ui.activeEntry) html += tplGestionModal(ui.activeEntry);
  if(ui.detailEntry) html += tplDetailModal(ui.detailEntry);
  if(ui.lightboxPhoto) html += tplLightbox(ui.lightboxPhoto);
  host.innerHTML = html;
  wireModalEvents();
}

function tplGestionModal(entry){
  const detalleVencido = entry._detalleVencido || getDetalleVencido(entry);
  const saldoVencido = entry._saldoVencido != null ? entry._saldoVencido : getSaldoVencido(entry);
  const seleccion = ui.gestSeleccion;
  const seleccionadas = detalleVencido.filter(d=>seleccion[d.comprobante]);
  const sumaSeleccion = Math.round(seleccionadas.reduce((s,d)=>s+d.monto,0)*100)/100;
  const hoy = new Date().toISOString().slice(0,10);
  const photo = ui.pendingPhoto;

  return `
  <div class="modal-overlay" id="ovGestion">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h3>${escapeHtml(entry.razon)}</h3>
          <div class="sub">#${entry.codigo} · Deuda vencida ${fmtMoney(saldoVencido)}</div>
        </div>
        <button class="modal-close" id="closeGestion">✕</button>
      </div>

      <div class="field">
        <label>Facturas vencidas — marcá las que cobrás</label>
        <div class="debt-detail" style="max-height:180px">
          ${detalleVencido.map(d=>`
            <label class="di" style="cursor:pointer;align-items:center;gap:8px">
              <span style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" class="chkFactura" data-comp="${escapeHtml(d.comprobante)}" ${seleccion[d.comprobante]?'checked':''}>
                ${escapeHtml(d.comprobante)}${d.vencimiento?' · vto '+fmtDate(d.vencimiento):''}
              </span>
              <span>${fmtMoney(d.monto)}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="field">
        <label>Facturas seleccionadas</label>
        <input type="text" value="${escapeHtml(seleccionadas.map(d=>d.comprobante).join('; ') || 'Ninguna')}" readonly style="background:var(--paper);color:var(--ink-soft)">
      </div>

      <div class="field" id="fieldMonto">
        <label>Monto cobrado</label>
        <input type="number" id="inpMonto" inputmode="decimal" value="${sumaSeleccion || ''}" step="0.01" min="0">
      </div>

      <div class="field">
        <label>Fecha de transferencia / pago</label>
        <input type="date" id="inpFechaTransf" value="${ui._fechaTransf || hoy}" max="${hoy}">
      </div>

      <div class="field">
        <label>Prioridad de gestión</label>
        <div class="seg" id="segPrioridad">
          <button data-pr="Prioridad 1: Despacho en el Acto" class="${ui.gestPrioridad==='Prioridad 1: Despacho en el Acto'?'active':''}" style="${ui.gestPrioridad==='Prioridad 1: Despacho en el Acto'?'color:var(--bad)':''}">🚀 Despacho en el Acto</button>
          <button data-pr="Prioridad 2: Gestión Regular" class="${ui.gestPrioridad==='Prioridad 2: Gestión Regular'?'active':''}" style="${ui.gestPrioridad==='Prioridad 2: Gestión Regular'?'color:#2554a3':''}">📋 Gestión Regular</button>
        </div>
      </div>

      <div class="field" id="fieldComentario">
        <label>Observaciones (opcional)</label>
        <input type="text" id="inpComentario" placeholder="Ej: paga el jueves, dejó cheque, etc." value="${escapeHtml(ui._comentario||'')}">
      </div>

      <div class="photo-zone" id="photoZone">
        ${photo
          ? `${photo.isPdf
              ? `<div style="padding:14px;font-size:13px;color:var(--ink-soft)">📄 ${escapeHtml(photo.nombre)}</div>`
              : `<img src="${photo.dataUrl}">`}
             <div class="photo-actions"><button class="btn btn-ghost btn-sm" id="btnRemovePhoto">Quitar comprobante</button></div>`
          : `<span class="ph-label">Adjuntá el comprobante de pago (foto o PDF)</span>
             <div class="photo-actions">
               <button class="btn btn-accent btn-sm" id="btnTakePhoto">📷 Tomar foto</button>
               <button class="btn btn-ghost btn-sm" id="btnPickPhoto">🖼️ Galería</button>
               <button class="btn btn-ghost btn-sm" id="btnPickPdf">📄 PDF</button>
             </div>`
        }
        <input type="file" id="inpCamera" accept="image/*" capture="environment" class="hidden">
        <input type="file" id="inpGallery" accept="image/*" class="hidden">
        <input type="file" id="inpPdf" accept="application/pdf" class="hidden">
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btnCancelGestion">Cancelar</button>
        <button class="btn btn-primary" id="btnGuardarGestion">Guardar cobro</button>
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" id="btnVisitaSinCobro">Registrar visita sin cobro</button>
    </div>
  </div>`;
}

function tplDetailModal(entry){
  const detalleVencido = entry._detalleVencido || getDetalleVencido(entry);
  return `
  <div class="modal-overlay centered" id="ovDetail">
    <div class="modal">
      <div class="modal-head">
        <div><h3>Facturas vencidas</h3><div class="sub">${escapeHtml(entry.razon)} · #${entry.codigo}</div></div>
        <button class="modal-close" id="closeDetail">✕</button>
      </div>
      <div class="debt-detail" style="max-height:320px">
        ${detalleVencido.map(d=>`<div class="di"><span>${escapeHtml(d.comprobante)}${d.vencimiento?' · vto '+fmtDate(d.vencimiento):''}</span><span>${fmtMoney(d.monto)}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-primary btn-block" id="closeDetail2">Cerrar</button></div>
    </div>
  </div>`;
}

function tplLightbox(src){
  const isPdfSrc = typeof src === 'string' && src.startsWith('data:application/pdf');
  return `
  <div class="modal-overlay centered" id="ovLightbox">
    <div class="modal" style="padding:12px;text-align:center">
      ${isPdfSrc
        ? `<a class="btn btn-primary" href="${src}" download="comprobante.pdf">Descargar PDF</a>`
        : `<img src="${src}" style="max-width:100%;border-radius:10px;max-height:75vh">`}
      <div class="modal-actions"><button class="btn btn-primary btn-block" id="closeLightbox">Cerrar</button></div>
    </div>
  </div>`;
}

function wireModalEvents(){
  const ovGestion = document.getElementById('ovGestion');
  if(ovGestion){
    document.getElementById('closeGestion').onclick = closeGestionModal;
    document.getElementById('btnCancelGestion').onclick = closeGestionModal;
    ovGestion.addEventListener('click', (e)=>{ if(e.target===ovGestion) closeGestionModal(); });

    document.querySelectorAll('.chkFactura').forEach(chk=>{
      chk.onchange = ()=>{
        ui.gestSeleccion[chk.dataset.comp] = chk.checked;
        renderModals();
      };
    });

    document.querySelectorAll('#segPrioridad button').forEach(btn=>{
      btn.onclick = ()=>{ ui.gestPrioridad = btn.dataset.pr; renderModals(); };
    });

    const inpMonto = document.getElementById('inpMonto');
    if(inpMonto) inpMonto.oninput = ()=>{ ui._montoManual = inpMonto.value; };
    const inpFecha = document.getElementById('inpFechaTransf');
    if(inpFecha) inpFecha.oninput = ()=>{ ui._fechaTransf = inpFecha.value; };
    const inpComentario = document.getElementById('inpComentario');
    if(inpComentario) inpComentario.oninput = ()=>{ ui._comentario = inpComentario.value; };

    const btnTake = document.getElementById('btnTakePhoto');
    const btnPick = document.getElementById('btnPickPhoto');
    const btnPickPdf = document.getElementById('btnPickPdf');
    const inpCamera = document.getElementById('inpCamera');
    const inpGallery = document.getElementById('inpGallery');
    const inpPdf = document.getElementById('inpPdf');
    if(btnTake) btnTake.onclick = ()=> inpCamera.click();
    if(btnPick) btnPick.onclick = ()=> inpGallery.click();
    if(btnPickPdf) btnPickPdf.onclick = ()=> inpPdf.click();
    const onFileChosen = async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      showToast('Procesando comprobante...', '');
      try{
        const {dataUrl, mime, nombre, isPdf} = await handleComprobanteFile(file);
        ui.pendingPhoto = {dataUrl, mime, nombre, isPdf};
        renderModals();
      }catch(err){
        console.error(err);
        showToast(err.message || 'No se pudo procesar el archivo', 'err');
      }
    };
    inpCamera.onchange = onFileChosen;
    inpGallery.onchange = onFileChosen;
    inpPdf.onchange = onFileChosen;
    const btnRemove = document.getElementById('btnRemovePhoto');
    if(btnRemove) btnRemove.onclick = ()=>{ ui.pendingPhoto = null; renderModals(); };

    document.getElementById('btnGuardarGestion').onclick = handleGuardarGestion;
    document.getElementById('btnVisitaSinCobro').onclick = handleVisitaSinCobro;
  }

  const ovDetail = document.getElementById('ovDetail');
  if(ovDetail){
    const close = ()=>{ ui.detailEntry = null; renderModals(); };
    document.getElementById('closeDetail').onclick = close;
    document.getElementById('closeDetail2').onclick = close;
    ovDetail.addEventListener('click', (e)=>{ if(e.target===ovDetail) close(); });
  }

  const ovLightbox = document.getElementById('ovLightbox');
  if(ovLightbox){
    const close = ()=>{ ui.lightboxPhoto = null; renderModals(); };
    document.getElementById('closeLightbox').onclick = close;
    ovLightbox.addEventListener('click', (e)=>{ if(e.target===ovLightbox) close(); });
  }
}

function closeGestionModal(){
  ui.activeEntry = null;
  ui.pendingPhoto = null;
  ui.actingVendedor = null;
  ui.gestSeleccion = {};
  ui.gestPrioridad = null;
  ui._montoManual = null;
  ui._fechaTransf = null;
  ui._comentario = null;
  renderModals();
}

function computeTipoGestion(entry, seleccionadas, monto){
  const detalleVencido = entry._detalleVencido || getDetalleVencido(entry);
  const sumaSeleccion = seleccionadas.reduce((s,d)=>s+d.monto,0);
  const cubreTodo = seleccionadas.length === detalleVencido.length && Math.abs(monto - sumaSeleccion) < 1;
  return cubreTodo ? 'COBRADO' : 'PARCIAL';
}

async function handleGuardarGestion(){
  const entry = ui.activeEntry;
  const detalleVencido = entry._detalleVencido || getDetalleVencido(entry);
  const seleccionadas = detalleVencido.filter(d=>ui.gestSeleccion[d.comprobante]);
  const inpMonto = document.getElementById('inpMonto');
  const monto = Number(inpMonto.value || 0);
  const fechaTransferencia = document.getElementById('inpFechaTransf').value;
  const comentario = document.getElementById('inpComentario').value.trim();
  const vendActing = ui.actingVendedor || session.vendedorCode;
  const vendedorNombre = getVendedorNombre(vendActing);

  if(seleccionadas.length === 0){ showToast('Marcá al menos una factura vencida', 'err'); return; }
  if(isNaN(monto) || monto <= 0){ showToast('Ingresá un monto válido', 'err'); return; }
  if(!fechaTransferencia){ showToast('Indicá la fecha de transferencia', 'err'); return; }
  if(!ui.gestPrioridad){ showToast('Elegí la prioridad de gestión', 'err'); return; }
  if(!ui.pendingPhoto){ showToast('Adjuntá el comprobante (foto o PDF)', 'err'); return; }

  const tipo = computeTipoGestion(entry, seleccionadas, monto);

  const log = addLog(entry, {
    tipo, monto,
    facturasSeleccionadas: seleccionadas,
    fechaTransferencia,
    prioridad: ui.gestPrioridad,
    comentario,
    foto: ui.pendingPhoto.dataUrl,
    fotoMime: ui.pendingPhoto.mime,
    fotoNombre: ui.pendingPhoto.nombre,
    vendedorNombre,
  }, vendActing);

  closeGestionModal();
  showToast('Cobro guardado. Sincronizando con la planilla...', 'ok');
  render();
  syncLogToSheet(log).then(r=>{
    if(r.ok) showToast('Cobro sincronizado con Google Sheets', 'ok');
    else showToast('Se guardó localmente. Se reintentará la sincronización (' + (r.error||'') + ')', 'err');
    render();
  });
}

function handleVisitaSinCobro(){
  const entry = ui.activeEntry;
  const vendActing = ui.actingVendedor || session.vendedorCode;
  const comentario = document.getElementById('inpComentario').value.trim();
  addLog(entry, {
    tipo: 'NOCOBRADO', monto: 0, facturasSeleccionadas: [], fechaTransferencia: null,
    prioridad: null, comentario, foto: null, vendedorNombre: getVendedorNombre(vendActing),
  }, vendActing);
  closeGestionModal();
  showToast('Visita registrada', 'ok');
  render();
}

/* ---------------------------- EVENTOS GENERALES ---------------------------- */

function wireEvents(){
  // LOGIN
  const cardVend = document.getElementById('cardVendedor');
  const cardAdmin = document.getElementById('cardAdmin');
  if(cardVend) cardVend.onclick = ()=>{ ui.screen='sellerLogin'; render(); };
  if(cardAdmin) cardAdmin.onclick = ()=>{ ui.screen='adminLogin'; render(); };

  const btnBack = document.getElementById('btnBack');
  if(btnBack) btnBack.onclick = ()=>{ ui.screen='login'; render(); };

  const btnLogout = document.getElementById('btnLogout');
  if(btnLogout) btnLogout.onclick = ()=>{
    session = {role:'none', vendedorCode:null, vendedorLabel:null};
    saveSession();
    ui.screen = 'login';
    render();
  };

  const btnSellerEnter = document.getElementById('btnSellerEnter');
  if(btnSellerEnter){
    const doEnter = async ()=>{
      let code = document.getElementById('inpVendCode').value.trim().toUpperCase();
      code = code.replace(/^V/,'');
      if(!code){ showSellerErr('Ingresá tu código de vendedor'); return; }

      // Si el celular todavía no tiene datos (primera vez) intentamos traerlos ahora.
      if(appData.entries.length===0 && isSyncConfigured() && navigator.onLine){
        btnSellerEnter.disabled = true;
        btnSellerEnter.textContent = 'Buscando tu ruta...';
        await pullRouteDataFromBackend();
        btnSellerEnter.disabled = false;
        btnSellerEnter.textContent = 'Ingresar';
      }

      if(appData.vendedores.length && !appData.vendedores.includes(code)){
        showSellerErr('No encontramos ese código de vendedor en los datos importados');
        return;
      }
      session = {role:'seller', vendedorCode: code, vendedorLabel: 'V'+code};
      saveSession();
      ui.screen = 'seller'; ui.sellerTab='ruta'; ui.sellerFilter='all';
      render();
      autoUpdateRouteData(false);
    };
    btnSellerEnter.onclick = doEnter;
    const inp = document.getElementById('inpVendCode');
    inp.onkeydown = (e)=>{ if(e.key==='Enter') doEnter(); };
  }

  const btnAdminEnter = document.getElementById('btnAdminEnter');
  if(btnAdminEnter){
    const doEnter = ()=>{
      const pass = document.getElementById('inpAdminPass').value;
      if(pass !== ADMIN_PASS){ showAdminErr('Contraseña incorrecta'); return; }
      session = {role:'admin', vendedorCode:null, vendedorLabel:null};
      saveSession();
      ui.screen = 'admin'; ui.adminTab = appData.entries.length ? 'resumen' : 'importar';
      render();
    };
    btnAdminEnter.onclick = doEnter;
    const inp = document.getElementById('inpAdminPass');
    inp.onkeydown = (e)=>{ if(e.key==='Enter') doEnter(); };
  }

  // SELLER NAV
  document.querySelectorAll('[data-stab]').forEach(b=>{
    b.onclick = ()=>{ ui.sellerTab = b.dataset.stab; render(); };
  });
  document.querySelectorAll('[data-sf]').forEach(b=>{
    b.onclick = ()=>{ ui.sellerFilter = b.dataset.sf; render(); };
  });

  // CLIENT ROWS (gestionar / detalle) — funciona tanto en vista vendedor como admin-ruteo
  document.querySelectorAll('[data-gestionar]').forEach(b=>{
    b.onclick = ()=>{
      const codigo = b.dataset.gestionar;
      const row = b.closest('.client-row');
      const vend = row.dataset.vend;
      const entry = appData.entries.find(e=> e.codigo===codigo && String(e.vendedor)===String(vend));
      if(!entry) return;
      const detalleVencido = getDetalleVencido(entry);
      ui.activeEntry = {...entry, _detalleVencido: detalleVencido, _saldoVencido: getSaldoVencido(entry)};
      ui.actingVendedor = session.role==='admin' ? vend : null;
      ui.pendingPhoto = null;
      ui.gestPrioridad = null;
      ui._montoManual = null;
      ui._fechaTransf = null;
      ui._comentario = null;
      // Por defecto se marcan todas las facturas vencidas (caso más común: pago total)
      ui.gestSeleccion = {};
      detalleVencido.forEach(d=>{ ui.gestSeleccion[d.comprobante] = true; });
      renderModals();
    };
  });
  document.querySelectorAll('[data-detail]').forEach(b=>{
    b.onclick = ()=>{
      const codigo = b.dataset.detail;
      const row = b.closest('.client-row');
      const vend = row.dataset.vend;
      const entry = appData.entries.find(e=> e.codigo===codigo && String(e.vendedor)===String(vend));
      if(!entry) return;
      ui.detailEntry = {...entry, _detalleVencido: getDetalleVencido(entry)};
      renderModals();
    };
  });
  document.querySelectorAll('[data-photo]').forEach(el=>{
    el.onclick = ()=>{
      const log = logs.find(l=>l.id===el.dataset.photo);
      if(log && log.foto){ ui.lightboxPhoto = log.foto; renderModals(); }
    };
  });
  document.querySelectorAll('[data-resync]').forEach(b=>{
    b.onclick = async ()=>{
      const log = logs.find(l=>l.id===b.dataset.resync);
      if(!log) return;
      showToast('Reintentando sincronización...', '');
      const r = await syncLogToSheet(log);
      showToast(r.ok ? 'Sincronizado correctamente' : 'Sigue sin sincronizar: '+(r.error||''), r.ok?'ok':'err');
      render();
    };
  });

  // ADMIN TABS
  document.querySelectorAll('[data-atab]').forEach(b=>{
    b.onclick = ()=>{ ui.adminTab = b.dataset.atab; render(); };
  });

  // ADMIN IMPORTAR
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnPickFiles = document.getElementById('btnPickFiles');
  if(btnPickFiles) btnPickFiles.onclick = ()=> fileInput.click();
  if(fileInput) fileInput.onchange = (e)=> handleImport(e.target.files);
  if(dropZone){
    ['dragover','dragenter'].forEach(ev=> dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(ev=> dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', (e)=>{
      if(e.dataTransfer.files && e.dataTransfer.files.length) handleImport(e.dataTransfer.files);
    });
  }
  const btnClearData = document.getElementById('btnClearData');
  if(btnClearData) btnClearData.onclick = ()=>{
    if(confirm('¿Borrar todos los datos importados (rutas y deudas)? Las gestiones registradas NO se van a borrar.')){
      appData = {entries:[], vendedores:[], importedAt:null, routesInfo:null, debtInfo:null};
      saveData();
      render();
    }
  };

  // ADMIN RUTEO
  const selRuteoVend = document.getElementById('selRuteoVend');
  if(selRuteoVend) selRuteoVend.onchange = (e)=>{ ui.ruteoVendedor = e.target.value; render(); };
  const selRuteoDia = document.getElementById('selRuteoDia');
  if(selRuteoDia) selRuteoDia.onchange = (e)=>{ ui.ruteoDia = e.target.value; render(); };

  // ADMIN GESTIONES
  const selGestFecha = document.getElementById('selGestFecha');
  if(selGestFecha) selGestFecha.onchange = (e)=>{ ui.gestFecha = e.target.value; render(); };
  const selGestVend = document.getElementById('selGestVend');
  if(selGestVend) selGestVend.onchange = (e)=>{ ui.gestVendedor = e.target.value; render(); };
  const btnExportLogs = document.getElementById('btnExportLogs');
  if(btnExportLogs) btnExportLogs.onclick = ()=>{
    let filtered = [...logs];
    if(ui.gestFecha==='hoy'){ const t=new Date().toDateString(); filtered=filtered.filter(l=>new Date(l.ts).toDateString()===t); }
    else if(ui.gestFecha==='7dias'){ const cutoff=Date.now()-7*24*3600*1000; filtered=filtered.filter(l=>l.ts>=cutoff); }
    if(ui.gestVendedor!=='todos') filtered = filtered.filter(l=>l.vendedorCode===String(ui.gestVendedor));
    if(filtered.length===0){ showToast('No hay gestiones para exportar', 'err'); return; }
    exportLogsToExcel(filtered);
    showToast('Excel exportado', 'ok');
  };
  const btnClearLogs = document.getElementById('btnClearLogs');
  if(btnClearLogs) btnClearLogs.onclick = ()=>{
    if(confirm('¿Borrar TODO el historial de gestiones (cobros, fotos y comentarios)? Te recomendamos exportar a Excel antes. Esta acción no se puede deshacer.')){
      logs = [];
      saveLogs();
      showToast('Historial de gestiones borrado', 'ok');
      render();
    }
  };

  // ADMIN CLIENTES
  const inpSearch = document.getElementById('inpClientesSearch');
  if(inpSearch){
    inpSearch.oninput = (e)=>{ ui.clientesSearch = e.target.value; render(); setTimeout(()=>{ const el=document.getElementById('inpClientesSearch'); if(el){ el.focus(); el.selectionStart=el.selectionEnd=el.value.length; } },0); };
  }
  const selClientesVend = document.getElementById('selClientesVend');
  if(selClientesVend) selClientesVend.onchange = (e)=>{ ui.clientesVendedor = e.target.value; render(); };
  const btnExportConsolidado = document.getElementById('btnExportConsolidado');
  if(btnExportConsolidado) btnExportConsolidado.onclick = ()=>{
    let list = appData.entries.filter(e=>e.saldo>0.5);
    if(ui.clientesVendedor!=='todos') list = list.filter(e=>String(e.vendedor)===String(ui.clientesVendedor));
    if(ui.clientesSearch){ const q=ui.clientesSearch.toLowerCase(); list=list.filter(e=>e.razon.toLowerCase().includes(q)||String(e.codigo).includes(q)); }
    exportConsolidatedToExcel(list);
    showToast('Excel exportado', 'ok');
  };

  // SYNC
  const btnSyncNow = document.getElementById('btnSyncNow');
  if(btnSyncNow) btnSyncNow.onclick = ()=> syncPendingLogs(true);
  const btnRefreshRoute = document.getElementById('btnRefreshRoute');
  if(btnRefreshRoute) btnRefreshRoute.onclick = async ()=>{
    if(!isSyncConfigured()){ showToast('Falta configurar la conexión con Google (config.js)', 'err'); return; }
    showToast('Buscando la ruta más reciente...', '');
    const r = await pullRouteDataFromBackend();
    if(r.ok) showToast('Ruta actualizada', 'ok'); else showToast('No se pudo actualizar: '+(r.error||''), 'err');
    render();
  };

  // ADMIN VENDEDORES (nombres)
  document.querySelectorAll('.inpVendNombre').forEach(inp=>{
    inp.onchange = ()=>{
      setVendedorNombre(inp.dataset.vendcode, inp.value.trim());
      showToast('Nombre actualizado', 'ok');
    };
  });
}

function showSellerErr(msg){
  const el = document.getElementById('sellerErr');
  el.textContent = msg; el.style.display='block';
}
function showAdminErr(msg){
  const el = document.getElementById('adminErr');
  el.textContent = msg; el.style.display='block';
}

async function handleImport(fileList){
  showToast('Importando planillas...', '');
  try{
    const results = await importFiles(fileList);
    if(!results.routes && !results.debts){
      showToast('No se reconoció ningún archivo válido. Verificá que sean los Excel correctos.', 'err');
    }else if(!results.merged){
      const falta = results.routes ? 'cuentas corrientes' : 'día de visita';
      showToast('Archivo cargado. Falta importar el de ' + falta + ' para armar las rutas.', '');
    }else{
      ui.adminTab = 'resumen';
      render();
      if(isSyncConfigured()){
        showToast('Importación completa. Subiendo ruta para que la vean los vendedores...', '');
        const r = await syncRouteDataToBackend();
        if(r.ok) showToast('¡Listo! Los vendedores ya pueden ver la ruta actualizada en su celular.', 'ok');
        else showToast('Se importó, pero no se pudo subir la ruta a Google: ' + (r.error||'') + '. Probá de nuevo desde Resumen.', 'err');
      }else{
        showToast('Importación completa. Ojo: falta configurar config.js para que la ruta llegue a los celulares.', 'err');
      }
      render();
      return;
    }
    render();
  }catch(err){
    console.error(err);
    showToast('Error al importar: ' + err.message, 'err');
  }
}

/* ---------------------------- INIT ---------------------------- */

function initApp(){
  loadData();
  loadLogs();
  loadSession();
  if(session.role === 'seller'){ ui.screen = 'seller'; }
  else if(session.role === 'admin'){ ui.screen = 'admin'; ui.adminTab = appData.entries.length ? 'resumen' : 'importar'; }
  else{ ui.screen = 'login'; }
  render();
  if(navigator.onLine){
    syncPendingLogs(false);
    autoUpdateRouteData(false);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
