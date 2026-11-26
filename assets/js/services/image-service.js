/* Image assets (MOCK storage in IndexedDB), demo placeholder images and segmentation masks. Production: signed uploads to object storage; masks as PNG/RLE objects. */
(function (A) {
  const OK = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }, MAXB = 15 * 1024 * 1024, MAXD = 8192, MAXMP = 40e6, MAXN = 100;
  const ext = n => (String(n).split('.').pop() || '').toLowerCase(), rid = () => 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function fileError(f) { const x = ext(f.name); if (!OK[x]) return 'Unsupported type. Use JPG, JPEG, PNG or WebP.'; if (f.type && f.type !== OK[x]) return 'File type does not match its extension.'; if (f.size === 0) return 'The file is empty.'; if (f.size > MAXB) return 'File is larger than 15 MB.'; return null; }
  async function check(files) {
    const ok = [], bad = []; if (files.length > MAXN) { bad.push({ name: '(selection)', error: 'Select at most ' + MAXN + ' images at a time.' }); files = files.slice(0, MAXN); }
    for (const f of files) { const e = fileError(f); if (e) { bad.push({ name: f.name, error: e }); continue; }
      let b; try { b = await createImageBitmap(f); } catch (er) { bad.push({ name: f.name, error: 'Not a readable image.' }); continue; }
      const w = b.width, h = b.height; if (b.close) b.close(); if (w > MAXD || h > MAXD || w * h > MAXMP) { bad.push({ name: f.name, error: 'Image is too large (' + w + 'x' + h + '). Limit: ' + MAXD + ' px per side and 40 megapixels.' }); continue; } ok.push({ file: f, w, h }); }
    return { ok, bad };
  }
  async function store(items) { const recs = []; for (const it of items) { const id = rid(); await A.idb.put('images', id, { blob: it.file, filename: it.file.name, type: it.file.type, size: it.file.size, width: it.w, height: it.h, created_at: new Date().toISOString() }); recs.push({ image_path: 'asset:' + id, filename: it.file.name, width: it.w, height: it.h, size_bytes: it.file.size }); } return recs; }
  function demo(name, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); let s = 0; for (const ch of name) s = (s * 31 + ch.charCodeAt(0)) >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16161a'); g.addColorStop(1, '#2a1420'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { const bw = w * (.08 + r() * .14), bh = h * (.1 + r() * .2), bx = r() * (w - bw), by = r() * (h - bh); x.fillStyle = 'hsl(' + (Math.floor(r() * 40 + 320) % 360) + ',55%,' + (30 + r() * 25) + '%)'; if (i % 2) x.fillRect(bx, by, bw, bh); else { x.beginPath(); x.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, 7); x.fill(); } }
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 ' + Math.round(h / 22) + 'px sans-serif'; x.fillText('DEMO IMAGE (placeholder): ' + name, w * .03, h * .06); return c;
  }
  const cache = new Map();
  async function load(im) {
    const k = im.source + ':' + im.ref; if (cache.has(k)) return cache.get(k); let el;
    if (im.source === 'demo') el = demo(im.filename || im.ref, im.width, im.height);
    else if (im.source === 'asset') { const r = await A.idb.get('images', im.ref); if (!r) throw new Error('Image data is missing from this browser (mock storage was cleared). Import the images again.'); el = await createImageBitmap(r.blob); }
    else el = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load the image URL.')); i.src = im.ref; });
    const out = { el, w: im.width || el.width, h: im.height || el.height }; cache.set(k, out); if (cache.size > 4) cache.delete(cache.keys().next().value); return out;
  }
  const mk = id => 'mask:' + id;
  const maskPut = (id, m) => A.idb.put('masks', mk(id), { width: m.w, height: m.h, classes: m.classes, rle: A.geo.rleEncode(m.data), updated_at: new Date().toISOString() });
  async function maskGet(id) { const r = await A.idb.get('masks', mk(id)); return r ? { w: r.width, h: r.height, classes: r.classes, data: A.geo.rleDecode(r.rle, r.width * r.height) } : null; }
  A.images = { check, store, demo, load, maskPut, maskGet, LIMITS: { maxBytes: MAXB, maxSide: MAXD, maxMegapixels: 40, maxFiles: MAXN } };
})(window.Alphex);
