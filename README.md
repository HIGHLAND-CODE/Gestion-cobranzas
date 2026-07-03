# Cobranzas 611 — Sistema de Ruteo y Gestión de Cobranzas

Aplicación web local para que los vendedores vean automáticamente su ruta de
cobranza del día (solo lo que está **vencido**), registren el cobro con
comprobante, y todo quede reflejado en tu Google Sheet + Google Drive
automáticamente.

## Qué cambió en esta versión

- Los vendedores ahora ven **solo las facturas vencidas** (vencimiento hoy o
  anterior), no toda la deuda. Un cliente con facturas que todavía no
  vencieron no aparece en la ruta del día hasta que efectivamente venzan.
- Al gestionar un cobro, el vendedor **marca qué facturas puntuales está
  cobrando** (podés cobrar 1, 2 o todas). Esas facturas quedan registradas
  separadas por `;` en la columna **Facturas Pagadas**.
- Se agregaron **fecha de transferencia** y **prioridad de gestión**
  (la elige el vendedor con 2 botones: 🚀 *Despacho en el Acto* / 📋 *Gestión
  Regular*).
- El comprobante admite **foto o PDF** (por si el cliente manda un
  comprobante generado digitalmente).
- Cada gestión se sube automáticamente a:
  - Google Drive → carpeta que me pasaste (el comprobante, foto o PDF)
  - Google Sheets → tu planilla, con el link al comprobante y la fila
    coloreada según la prioridad, igual que en tu planilla de referencia.
  - Las columnas **check** y **nombre quien imputo** quedan **vacías**: las
    completa administración directamente en la planilla.
- Si el vendedor se queda sin señal, el cobro se guarda igual en el celular
  y se sincroniza solo apenas vuelve la conexión (o con el botón manual).

## Paso 1 — Conectar la app con tu Google Sheet y Drive (una sola vez)

La app corre 100% en el navegador, así que para que pueda escribir en tu
Drive y tu Sheet sin pedirle a cada vendedor que inicie sesión con una
cuenta de Google, usamos un **Google Apps Script** como "cartero": recibe el
cobro desde el celular y lo deja donde corresponde, usando tu propia cuenta.

1. Andá a **https://script.google.com/** → **Proyecto nuevo**.
2. Ponele un nombre, por ejemplo "Backend Cobranzas 611".
3. Borrá todo el contenido del archivo `Code.gs` que aparece por defecto, y
   pegá **todo** el contenido del archivo `gas/Code.gs` que te entregué.
   (Ya tiene cargados el ID de tu carpeta de Drive y el ID de tu hoja de
   cálculo, no hace falta que toques nada ahí salvo que cambien.)
4. Arriba a la derecha: **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo** (tu cuenta, la que tiene acceso a la carpeta y la hoja)
   - Quién tiene acceso: **Cualquier usuario**
5. Google te va a pedir autorizar permisos (Drive y Sheets) — es normal,
   aceptalos.
6. Te va a dar una URL que termina en `/exec`. Copiala.
7. Abrí el archivo `config.js` de la carpeta de la app y pegala así:
   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
8. Guardá el archivo. Listo, no hace falta tocar nada más.

> Si en algún momento cambiás de carpeta de Drive o de hoja de cálculo,
> actualizá `FOLDER_ID` / `SPREADSHEET_ID` dentro de `gas/Code.gs`, volvé a
> "Implementar" (Gestionar implementaciones → editar → Nueva versión) y la
> URL sigue siendo la misma.

### Sobre la columna "Facturas Pagadas" y "Monto Cobrado"

Tu planilla actual tiene las columnas A-J (Fecha de carga … PRIORIDAD). El
sistema agrega automáticamente dos columnas nuevas al final, **sin tocar
ninguna de las que ya existen**:
- **K — Facturas Pagadas**: los números de comprobante cobrados, separados por `;`
- **L — Monto Cobrado**: el monto total de esa gestión

Si no las querés ver, las podés ocultar desde Google Sheets — igual se
siguen completando.

## Paso 2 — Abrir la app

1. Descomprimí la carpeta completa (los archivos tienen que quedar juntos).
2. Abrí `index.html` con el navegador (Chrome recomendado), tanto en el
   celular de cada vendedor como en la PC del administrador.
3. Podés usarla sin internet para ver la ruta y cargar cobros; en cuanto
   haya señal, sincroniza sola con Google.

## Uso diario — Vendedor

1. Tocá **Vendedor** → ingresá tu código (ej: `31` o `V31`).
2. Vas a ver **solo** los clientes con facturas **vencidas** para hoy.
3. Tocá **Gestionar** en un cliente:
   - Marcá qué facturas vencidas estás cobrando (por defecto vienen todas
     tildadas — destildá las que no cobrás).
   - El monto se autocompleta con la suma de lo tildado (lo podés ajustar).
   - Poné la fecha de transferencia.
   - Elegí la prioridad: 🚀 Despacho en el Acto o 📋 Gestión Regular.
   - Adjuntá el comprobante (foto con la cámara, de la galería, o un PDF).
   - **Guardar cobro** — se sube solo a Drive y a la planilla.
   - Si visitaste al cliente y no cobraste nada, usá **"Registrar visita sin
     cobro"** (no requiere foto ni sube nada a la planilla, queda solo en tu
     historial local).
4. Arriba a la derecha ves el estado de sincronización (✓ sincronizado,
   o cuántas gestiones están pendientes de subir).

## Panel del Administrador

- **Resumen**: deuda vencida activa, deuda total, cobrado hoy, estado de la
  conexión con Google, uso de almacenamiento.
- **Importar**: carga de las dos planillas de Excel (rutas y cuentas
  corrientes), igual que antes.
- **Ruteo**: auditá cualquier vendedor/día, con la misma vista y las mismas
  acciones que ve el vendedor (podés gestionar en su nombre).
- **Gestiones**: historial completo, con el estado de sincronización de cada
  una y un botón para reintentar si alguna quedó pendiente. Exportable a
  Excel como respaldo local además de lo que ya quedó en Sheets.
- **Clientes**: consolidado con deuda vencida y deuda total por cliente.
- **Vendedores**: completá el nombre real de cada vendedor (el Excel de
  rutas solo trae el código numérico) — así la columna VENDEDOR de la
  planilla queda con el nombre y no solo "V31".

## Notas importantes

- **Facturas "vencidas"** = fecha de vencimiento igual o anterior a hoy. Se
  recalcula todos los días solo, no hace falta reimportar para que una
  factura "entre" a la ruta cuando llega su vencimiento.
- El check y el nombre de quien imputa el pago **los completa
  administración directamente en Google Sheets** — la app nunca los escribe.
- Si un vendedor carga un cobro sin conexión, queda guardado en su celular
  y se sube solo apenas hay señal (también podés forzarlo con el botón de
  sincronización).
- Los PDFs no se comprimen (se suben tal cual); las fotos sí, para no gastar
  espacio ni datos móviles. Límite de 8MB por comprobante.
- Contraseña de administrador: `admin611` (se puede cambiar editando
  `ADMIN_PASS` en `app.js`).

## Estructura de archivos

```
index.html          → abrir este archivo
styles.css
app.js               → datos, importación de Excel, lógica de vencidos
config.js            → ⚠️ acá va la URL de tu Apps Script (Paso 1)
sync.js               → sincronización con Google Sheets/Drive
export.js             → exportación a Excel local (respaldo)
ui.js                  → interfaz
xlsx.full.min.js      → librería para leer/escribir Excel
gas/Code.gs            → pegar esto en script.google.com (Paso 1)
```
