'use strict';

// ═══════════════════════════════════════════════════════════════════
// PROCESSED-MEDIA CACHE — IndexedDB wrapper that persists derived data
// (marker-derived source BPM, marker positions, optional sprite sheet)
// keyed by file path. Survives reloads so a marked clip auto-applies
// its BPM the next time it's selected.
//
// Falls back to an in-memory Map if IndexedDB is unavailable (e.g.
// private-mode Firefox), so the rest of the app keeps working — only
// persistence is lost.
//
// Record shape:
//   {
//     key:         string,     // file path, e.g. "resources/foo.mp4"
//     sourceBPM:   number,     // marker-derived BPM
//     markers:     number[],   // marker positions (video: seconds;
//                              //                   image: frame indices)
//     sprite?:     { blob, frameW, frameH, count, baseDurationMs },
//     updatedAt:   number      // ms epoch
//   }
// ═══════════════════════════════════════════════════════════════════

var DB_NAME    = 'raccoon-visualiser';
var DB_VERSION = 1;
var DB_STORE   = 'processed';

var _dbPromise = null;
var _memFallback = new Map();
var _usingMemFallback = false;

function dbOpen() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch(err => {
    console.warn('IndexedDB unavailable, using in-memory cache:', err);
    _usingMemFallback = true;
    return null;
  });
  return _dbPromise;
}

function dbRun(mode, fn) {
  return dbOpen().then(db => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);
      let result;
      const p = fn(store);
      if (p && typeof p.then === 'function') {
        p.then(r => { result = r; }, reject);
      } else {
        result = p;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error);
    });
  });
}

async function dbGet(key) {
  if (_usingMemFallback) return _memFallback.get(key) || null;
  return dbRun('readonly', store => {
    if (!store) return _memFallback.get(key) || null;
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  });
}

async function dbPut(key, value) {
  const record = Object.assign({}, value, { key, updatedAt: Date.now() });
  if (_usingMemFallback) { _memFallback.set(key, record); return record; }
  await dbRun('readwrite', store => {
    if (!store) { _memFallback.set(key, record); return; }
    store.put(record);
  });
  return record;
}

async function dbDelete(key) {
  if (_usingMemFallback) { _memFallback.delete(key); return; }
  await dbRun('readwrite', store => {
    if (!store) { _memFallback.delete(key); return; }
    store.delete(key);
  });
}

async function dbList() {
  if (_usingMemFallback) return Array.from(_memFallback.values());
  return dbRun('readonly', store => {
    if (!store) return Array.from(_memFallback.values());
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  });
}

// Public surface used by other scripts.
var processedCache = {
  get:    dbGet,
  put:    dbPut,
  delete: dbDelete,
  list:   dbList
};
