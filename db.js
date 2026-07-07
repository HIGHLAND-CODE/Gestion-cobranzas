/* ==========================================================================
   Almacenamiento persistente (IndexedDB)
   ==========================================================================
   Antes todo se guardaba en localStorage, que en la mayoría de los
   navegadores tiene un techo de 5-10MB por sitio — con las fotos de
   comprobantes eso se llenaba rápido. IndexedDB no tiene ese techo bajo:
   permite guardar muchísimo más (cientos de MB, atado al espacio libre del
   dispositivo), así que ahora es el lugar donde vive todo de forma
   persistente: los datos de ruta, el historial de gestiones y las fotos.
   ========================================================================== */

const IDB_NAME = 'sarc611_db';
const IDB_VERSION = 1;
const STORE_KV = 'kv';         // appData y logs, cada uno como un único valor bajo su clave
const STORE_PHOTOS = 'photos'; // comprobantes (fotos/PDF), uno por gestión, clave = id de la gestión

let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    if(!('indexedDB' in window)){
      reject(new Error('Este navegador no soporta IndexedDB'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
      if(!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS);
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return _dbPromise;
}

function idbGet(store, key){
  return openDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  }));
}

function idbSet(store, key, value){
  return openDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  }));
}

function idbDelete(store, key){
  return openDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  }));
}

function idbClear(store){
  return openDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  }));
}

// Devuelve un objeto {clave: valor} con TODO lo guardado en el store (se usa
// para precargar las fotos en memoria una sola vez al abrir la app).
function idbGetAll(store){
  return openDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const keysReq = os.getAllKeys();
    const valsReq = os.getAll();
    tx.oncomplete = ()=>{
      const result = {};
      const keys = keysReq.result || [];
      const vals = valsReq.result || [];
      keys.forEach((k, i)=>{ result[k] = vals[i]; });
      resolve(result);
    };
    tx.onerror = ()=> reject(tx.error);
  }));
}

async function estimateIdbUsage(){
  try{
    if(navigator.storage && navigator.storage.estimate){
      const est = await navigator.storage.estimate();
      return { usage: est.usage || 0, quota: est.quota || 0 };
    }
  }catch(e){}
  return { usage: null, quota: null };
}
