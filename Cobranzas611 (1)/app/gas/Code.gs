/**
 * ==========================================================================
 * SARC-611 · Backend de sincronización (Google Apps Script)
 * ==========================================================================
 * Qué hace:
 *  1) Recibe la gestión de cobro que manda la app desde el celular del vendedor.
 *  2) Sube la foto o el PDF del comprobante a la carpeta de Drive indicada.
 *  3) Agrega una fila a la hoja de cálculo indicada, con el link al comprobante
 *     y la Prioridad ya coloreada (rojo = Prioridad 1, azul = Prioridad 2).
 *
 * CÓMO INSTALARLO (una sola vez):
 *  1. Andá a https://script.google.com/ → Proyecto nuevo.
 *  2. Borrá el contenido de "Code.gs" y pegá TODO este archivo.
 *  3. Revisá que FOLDER_ID y SPREADSHEET_ID (abajo) sean los correctos —
 *     ya vienen cargados con los que me pasaste.
 *  4. Arriba a la derecha: Implementar → Nueva implementación.
 *     - Tipo: Aplicación web
 *     - Ejecutar como: Yo (tu usuario, el que tiene acceso a la carpeta y la hoja)
 *     - Quién tiene acceso: Cualquier usuario
 *  5. Autorizá los permisos que pida Google (Drive + Sheets).
 *  6. Copiá la URL que termina en "/exec" que te da al implementar.
 *  7. Pegá esa URL en el archivo config.js de la carpeta de la app,
 *     en la constante SCRIPT_URL.
 *
 * Si en el futuro cambiás de carpeta o de hoja, solo tenés que actualizar
 * FOLDER_ID / SPREADSHEET_ID acá abajo y volver a "Implementar" (Gestionar
 * implementaciones → editar → Nueva versión).
 */

const FOLDER_ID = '1O4JPeUnD3gA8ubmEw9aG_A7xFyiPfsWq';
const SPREADSHEET_ID = '1w-VUF3cy4NW-U2mNwnrZy6nXe_SHCaqyDzWmlHCBUkc';
const SHEET_NAME = null; // null = usa la primera hoja (gid=0). Si querés forzar un nombre, ponelo acá, ej: 'Hoja 1'

const COLOR_PRIORIDAD_1 = '#ff0000'; // Despacho en el Acto
const COLOR_PRIORIDAD_1_TEXT = '#ffffff';
const COLOR_PRIORIDAD_2 = '#4a86e8'; // Gestión Regular
const COLOR_PRIORIDAD_2_TEXT = '#ffffff';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = procesarGestion(payload);
    return respond({ ok: true, ...result });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  // Simple ping para probar que la implementación quedó publicada correctamente.
  return respond({ ok: true, msg: 'SARC-611 backend activo' });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function procesarGestion(payload) {
  const {
    vendedorCode, vendedorNombre, clienteCodigo, clienteNombre,
    fechaTransferencia, facturasDetalle, montoCobrado, observaciones,
    prioridad, fotoBase64, fotoMime, fotoNombre,
  } = payload;

  let driveLink = '';
  if (fotoBase64 && fotoMime) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const bytes = Utilities.base64Decode(fotoBase64);
    const ext = fotoMime === 'application/pdf' ? 'pdf' : 'jpg';
    const nombreArchivo = (fotoNombre || ('comprobante_' + clienteCodigo)) +
      '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires', 'yyyyMMdd_HHmmss') +
      (fotoNombre && fotoNombre.indexOf('.') > -1 ? '' : '.' + ext);
    const blob = Utilities.newBlob(bytes, fotoMime, nombreArchivo);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    driveLink = file.getUrl();
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];

  // Si las columnas K/L todavía no tienen encabezado, se lo ponemos una sola vez
  // (no tocamos ninguna columna existente A-J para no romper tu planilla actual).
  if (sheet.getRange(1, 11).getValue() === '') {
    sheet.getRange(1, 11).setValue('Facturas Pagadas');
  }
  if (sheet.getRange(1, 12).getValue() === '') {
    sheet.getRange(1, 12).setValue('Monto Cobrado');
  }

  const fechaCarga = new Date();
  const row = [
    fechaCarga,                                  // A Fecha de carga
    'V' + vendedorCode,                          // B NRO VENDEDOR
    vendedorNombre || ('V' + vendedorCode),       // C VENDEDOR
    clienteCodigo,                                // D CLIENTE
    fechaTransferencia || '',                     // E Fecha Transferencia
    driveLink,                                    // F IMAGEN
    observaciones || '',                          // G observaciones
    '',                                            // H check (lo completa administración)
    '',                                            // I nombre quien imputo (lo completa administración)
    prioridad || '',                               // J PRIORIDAD
    facturasDetalle || '',                         // K Facturas Pagadas (separadas por ";")
    Number(montoCobrado) || 0,                     // L Monto Cobrado
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();

  // Coloreamos la celda de prioridad igual que en la planilla de referencia.
  const prioridadCell = sheet.getRange(lastRow, 10); // columna J
  if (String(prioridad).indexOf('Prioridad 1') === 0) {
    prioridadCell.setBackground(COLOR_PRIORIDAD_1).setFontColor(COLOR_PRIORIDAD_1_TEXT);
  } else if (String(prioridad).indexOf('Prioridad 2') === 0) {
    prioridadCell.setBackground(COLOR_PRIORIDAD_2).setFontColor(COLOR_PRIORIDAD_2_TEXT);
  }

  // Checkbox real en la columna H, para que administración solo tenga que tildar.
  sheet.getRange(lastRow, 8).insertCheckboxes();

  return { driveLink: driveLink, row: lastRow };
}
