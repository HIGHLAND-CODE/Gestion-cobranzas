# Cobranzas 611 — Sistema de Ruteo y Gestión de Cobranzas

Aplicación web local para que los vendedores vean automáticamente su ruta de
cobranza del día (solo lo que está **vencido**), registren el cobro con
comprobante, y todo quede reflejado en tu Google Sheet + Google Drive
automáticamente.

## 🔴 Antes de nada: por qué no se veía nada en el celular

El problema era este: cuando importabas los dos Excel en la PC, esos datos
quedaban guardados **solo en el navegador de esa PC**. El celular del
vendedor nunca los recibía, por eso veías la ruta en la PC pero el celular
aparecía vacío (eso también explica el link de GitHub "sin mostrar nada").

**Ya está resuelto**: ahora, cuando administración importa los Excel, la app
sube automáticamente esos datos a Google (usando el mismo backend de Drive/
Sheets que ya configuramos), y cada celular los descarga solo al abrir la
app o iniciar sesión. Para que esto funcione **es obligatorio completar el
Paso 1** de este instructivo (`config.js` con la URL del Apps Script) — sin
eso, la app sigue funcionando pero cada dispositivo queda otra vez aislado.

Si ya habías configurado `config.js` con una versión anterior del script,
tenés que **reemplazar el contenido de tu Apps Script por el nuevo
`gas/Code.gs`** y volver a implementar (Implementar → Gestionar
implementaciones → editar → Nueva versión). La URL no cambia.

## Qué cambió en esta versión

⚠️ **Esta actualización incluye cambios en `gas/Code.gs`.** Para que tomen
efecto, reemplazá el contenido de tu Apps Script por el de este zip y volvé
a implementar como "Nueva versión" (Implementar → Gestionar implementaciones
→ ✏️ editar → Nueva versión → Implementar). La URL no cambia, no hace falta
tocar `config.js` de nuevo.

- **El vendedor ahora puede elegir el día** desde un desplegable arriba de
  su ruta. Por defecto se posiciona en el día de hoy, pero si un cliente de
  otro día (ej. viernes) le paga hoy (ej. martes), puede cambiar el
  desplegable a "Viernes" y cargarle el cobro igual. Hay un botón "Volver a
  hoy" cuando está viendo un día distinto.
- **La marca temporal ahora siempre muestra la hora exacta** (no solo el
  día), y además refleja el momento real en que el vendedor cargó el dato
  en su celular — no cuándo se terminó de sincronizar (importante si estuvo
  sin señal y sincronizó más tarde). Así se puede detectar si algo se cargó
  fuera del horario administrativo.- **Se resolvió el problema de fondo del almacenamiento local**: antes todo
  (rutas, deudas, gestiones y fotos de comprobantes) se guardaba en
  `localStorage`, que en la mayoría de los navegadores tiene un techo de
  5-10MB — con las fotos eso se llenaba rápido. Ahora todo vive en
  **IndexedDB**, que no tiene ese techo bajo (permite guardar muchísimo
  más, atado al espacio libre del dispositivo). Esto es automático: al
  abrir la app por primera vez con esta versión, migra sola todo lo que
  ya tenías guardado y libera el espacio viejo. No hay que hacer nada.- **Se arregló que no llegaban la marca temporal, la fecha de cobro y los
  comentarios a la planilla**: el script buscaba esas columnas por nombres
  que no coincidían exactamente con los tuyos (vos las llamás "marca
  temporal", "fecha de cobro" y "comentarios"). Ahora las reconoce por esos
  nombres reales, y además tiene un respaldo por palabra clave para el
  futuro, por si volvés a renombrar alguna columna.
- **Se arregló que no llegaba el nombre real del vendedor**: al cambiar un
  nombre en la pestaña "Vendedores" del panel admin, antes solo se
  guardaba en la PC y nunca se subía a Google — por eso en la planilla
  seguía apareciendo "V31" en vez del nombre. Ahora se sube automáticamente
  apenas lo cargás.
- **Ahora se pueden cobrar facturas que todavía no vencieron**, no hace
  falta esperar al día de vencimiento. Aparecen como una lista aparte (en
  verde) con checkbox, igual que las vencidas.
- **Las notas de crédito ahora se pueden seleccionar para descontar del
  cobro**: si el cliente debe una factura de $5.000 y tiene una nota de
  crédito de $500 a favor, el vendedor puede tildar las dos y el monto se
  autocompleta en $4.500 (lo que realmente hay que cobrar). Quedan
  registradas ambas en "Facturas Pagadas", separadas por `;`.
- **El script de Google ahora ubica cada columna por su nombre**, no por
  posición fija. Esto significa que podés **borrar la columna PRIORIDAD**
  (o cualquier otra que ya no uses) sin miedo a que se desalinee el resto de
  la fila — el script simplemente deja de escribir ahí. **Importante:**
  para que este arreglo tome efecto tenés que volver a implementar el script
  (ver "Si ya tenías una versión anterior" más abajo).
- **Se sacó el botón de prioridad** ("Despacho en el Acto" / "Gestión
  Regular"). Si borraste la columna PRIORIDAD de tu hoja, no pasa nada; si
  la dejaste, va a quedar vacía.
- **Se corrigieron las notas de crédito**: los saldos negativos (montos a
  favor del cliente) antes se sumaban al total pero no aparecían listados en
  ningún lado. Ahora se muestran como ítems propios, en **azul**, tanto en
  el detalle de facturas como en la pantalla de gestión — separados de lo
  vencido (rojo) y lo no vencido (verde) para que quede clara la diferencia.
- **Se resolvió que el celular no recibía los datos** (ver más abajo).
- La ruta muestra **toda la deuda del cliente**, no solo lo vencido: lo
  vencido se ve en **rojo**, lo que todavía no vence en **verde**, y las
  notas de crédito a favor en **azul**. Solo lo vencido se puede seleccionar
  para cobrar (el resto es informativo).
- **Todas las vistas con montos** (ruta del día, ruteo del administrador,
  consolidado de clientes, historial de gestiones, tabla de vendedores) están
  **ordenadas de mayor a menor monto**, priorizando primero lo vencido y
  luego la deuda total, para priorizar los cobros más importantes primero.
- Botón **"⟳ Actualizar ruta"** en la vista del vendedor y en el panel de
  importación del administrador, para forzar una actualización manual en
  cualquier momento.
- Al ingresar como vendedor por primera vez en un celular nuevo, la app
  busca la ruta actualizada automáticamente antes de dejarte entrar.
- Al gestionar un cobro, el vendedor **marca qué facturas puntuales está
  cobrando** (podés cobrar 1, 2 o todas). Esas facturas quedan registradas
  separadas por `;` en la columna **Facturas Pagadas**.
- El comprobante admite **foto o PDF** (por si el cliente manda un
  comprobante generado digitalmente).
- Cada gestión se sube automáticamente a:
  - Google Drive → carpeta que me pasaste (el comprobante, foto o PDF)
  - Google Sheets → tu planilla, con el link al comprobante.
  - Las columnas **check**, **nombre quien imputo** y **PRIORIDAD** quedan
    **vacías**: las completa administración directamente en la planilla.
- Si el vendedor se queda sin señal, el cobro se guarda igual en el celular
  y se sincroniza solo apenas vuelve la conexión (o con el botón manual).
  y se sincroniza solo apenas vuelve la conexión (o con el botón manual).

## Paso 1 — Conectar la app con tu Google Sheet y Drive (una sola vez)

✅ **Ya está hecho.** `config.js` ya tiene cargada la URL de tu Apps Script
(`.../exec`) que me pasaste, así que no tenés que hacer nada de este paso
salvo que en algún momento vuelvas a implementar el script y te dé una URL
distinta — en ese caso, actualizá `config.js` con la nueva.

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

### Si la publicás en GitHub Pages (recomendado para que los vendedores entren desde un link)

1. Subí **todo el contenido** de la carpeta `app` a la raíz del repositorio
   (que `index.html` quede en la raíz, no dentro de una subcarpeta, salvo
   que tu link ya apunte a esa subcarpeta).
2. Activalo en el repo: **Settings → Pages → Deploy from a branch**.
3. Con el fix de esta versión, una vez que `config.js` tiene la URL del
   Apps Script, **ya no importa si el celular nunca tuvo los Excel
   importados**: al ingresar el vendedor, la app los busca sola en Google.
4. Si después de publicar seguís viendo la página vieja o vacía en el
   celular: es casi siempre caché. Probá:
   - Cerrar y volver a abrir la pestaña, o modo incógnito.
   - Mantener presionado el botón de recargar y elegir "recarga forzada" (o
     borrar datos de navegación del sitio).
   - Esperar 1-2 minutos después de publicar: GitHub Pages tarda un poco en
     actualizar el link tras cada cambio.

## Uso diario — Vendedor

1. Tocá **Vendedor** → ingresá tu código (ej: `31` o `V31`).
2. Vas a ver **todos** los clientes con deuda para hoy: lo vencido en rojo,
   lo no vencido en verde, y si tienen notas de crédito a favor, en azul.
   Arriba hay un desplegable con tus días de ruta — si un cliente de otro
   día te paga hoy, cambiá el día ahí para encontrarlo y gestionarlo.
3. Tocá **Gestionar** en un cliente:
   - Marcá qué facturas **vencidas** estás cobrando (por defecto vienen
     todas tildadas — destildá las que no cobrás). Las facturas **no
     vencidas** también se pueden tildar por si el cliente quiere pagar
     por anticipado, sin esperar al vencimiento. Las **notas de crédito**
     a favor del cliente también se pueden tildar para descontarlas del
     monto (ej: factura $5.000 + nota de crédito $500 tildada = $4.500 a
     cobrar).
   - El monto se autocompleta con la suma de lo tildado (lo podés ajustar).
   - Poné la fecha de transferencia.
   - Adjuntá el comprobante (foto con la cámara, de la galería, o un PDF).
   - **Guardar cobro** — se sube solo a Drive y a la planilla.
   - Si visitaste al cliente y no cobraste nada, usá **"Registrar visita sin
     cobro"** (no requiere foto ni sube nada a la planilla, queda solo en tu
     historial local).
4. Arriba a la derecha ves el estado de sincronización (✓ sincronizado,
   o cuántas gestiones están pendientes de subir). Si administración acaba
   de importar planillas nuevas y no las ves, tocá **"⟳ Actualizar ruta"**.
5. Los clientes se muestran ordenados de **mayor a menor deuda vencida**,
   para que ataques primero los cobros más importantes.

## Panel del Administrador

- **Resumen**: deuda vencida activa, deuda total, cobrado hoy, estado de la
  conexión con Google, uso de almacenamiento.
- **Importar**: carga de las dos planillas de Excel (rutas y cuentas
  corrientes). Al terminar, sube automáticamente la ruta a Google para que
  los vendedores la reciban en su celular.
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
- Todo (rutas, deudas, gestiones y fotos) se guarda en **IndexedDB**, no en
  `localStorage`, así que el aviso de "almacenamiento local" del panel de
  Resumen prácticamente no debería volver a aparecer.
- Contraseña de administrador: `admin611` (se puede cambiar editando
  `ADMIN_PASS` en `app.js`).

## Estructura de archivos

```
index.html          → abrir este archivo
styles.css
db.js                → almacenamiento persistente (IndexedDB)
app.js               → datos, importación de Excel, lógica de vencidos
config.js            → ⚠️ acá va la URL de tu Apps Script (Paso 1)
sync.js               → sincronización con Google Sheets/Drive
export.js             → exportación a Excel local (respaldo)
ui.js                  → interfaz
xlsx.full.min.js      → librería para leer/escribir Excel
gas/Code.gs            → pegar esto en script.google.com (Paso 1)
```
