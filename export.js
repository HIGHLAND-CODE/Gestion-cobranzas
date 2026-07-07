/* ==========================================================================
   Exportación de reportes .xlsx
   ========================================================================== */

function exportLogsToExcel(filteredLogs){
  const rows = filteredLogs.map(l=>({
    'Fecha de carga': new Date(l.ts).toLocaleDateString('es-AR'),
    'Hora': new Date(l.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
    'Vendedor': 'V'+l.vendedorCode,
    'Nombre Vendedor': l.vendedorNombre || '',
    'Codigo Cliente': l.codigo,
    'Cliente': l.razon,
    'Estado': l.tipo,
    'Monto Cobrado': l.monto,
    'Facturas Pagadas': l.facturasDetalle || '',
    'Fecha Transferencia': l.fechaTransferencia || '',
    'Prioridad': l.prioridad || '',
    'Saldo Vencido al Momento': l.saldoVencidoAlMomento != null ? l.saldoVencidoAlMomento : '',
    'Comentario': l.comentario || '',
    'Con Comprobante': l.hasFoto ? 'SI' : 'NO',
    'Sincronizado con Sheets': l.synced ? 'SI' : 'NO',
    'Link Drive': l.driveLink || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{wch:11},{wch:8},{wch:9},{wch:20},{wch:13},{wch:28},{wch:11},{wch:14},{wch:24},{wch:15},{wch:24},{wch:16},{wch:30},{wch:12},{wch:14},{wch:34}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gestiones');
  const fname = 'gestiones_611_' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}

function exportConsolidatedToExcel(entries){
  const rows = entries.map(e=>({
    'Codigo': e.codigo,
    'Cliente': e.razon,
    'Direccion': e.direccion,
    'Localidad': e.localidad || '',
    'Zona': e.zona,
    'Vendedor': e.vendedor ? ('V'+e.vendedor) : '',
    'Dias de Visita': e.dias.join(', '),
    'Deuda Vencida': getSaldoVencido(e),
    'Deuda Total': e.saldo,
    'Cant. Comprobantes Vencidos': getDetalleVencido(e).length,
    'Condicion de Pago': e.cond_pago || '',
    'Telefono': e.telefono || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{wch:9},{wch:28},{wch:26},{wch:16},{wch:8},{wch:10},{wch:16},{wch:13},{wch:13},{wch:14},{wch:10},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado Deudas');
  const fname = 'consolidado_deudas_611_' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}
