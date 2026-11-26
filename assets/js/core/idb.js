/* Tiny IndexedDB key-value wrapper for MOCK mode only: image blobs ('images') and segmentation masks ('masks'). Large data never goes to localStorage. */
(function (A) {
  const ST = ['images', 'masks']; let p = null;
  const open = () => p || (p = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('IndexedDB is not available in this browser.')); const r = indexedDB.open('alphex-workbench-mock', 1); r.onupgradeneeded = () => ST.forEach(s => r.result.createObjectStore(s)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (s, m, f) => open().then(db => new Promise((res, rej) => { const t = db.transaction(s, m), q = f(t.objectStore(s)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  A.idb = { put: (s, k, v) => tx(s, 'readwrite', o => o.put(v, k)), get: (s, k) => tx(s, 'readonly', o => o.get(k)), del: (s, k) => tx(s, 'readwrite', o => o.delete(k)), keys: s => tx(s, 'readonly', o => o.getAllKeys()) };
})(window.Alphex);
