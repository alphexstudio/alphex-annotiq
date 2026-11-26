/* Pure geometry and mask helpers (no DOM). All geometry in annotations is normalized: x,y in [0,1] relative to the ORIGINAL image, origin top-left. */
(function (A) {
  const EPS = 1e-9, inUnit = v => Number.isFinite(v) && v >= -EPS && v <= 1 + EPS;
  const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
  const distinct = pts => new Set(pts.map(p => p.x.toFixed(6) + ',' + p.y.toFixed(6))).size;
  /* Indexed mask RLE: [value, run, value, run, ...] over row-major pixels. */
  function rleEncode(a) { const o = []; let v = a[0], n = 0; for (let i = 0; i < a.length; i++) { if (a[i] === v) n++; else { o.push(v, n); v = a[i]; n = 1; } } if (a.length) o.push(v, n); return Uint32Array.from(o); }
  function rleDecode(r, len) { const a = new Uint8Array(len); let p = 0; for (let i = 0; i < r.length; i += 2) { a.fill(r[i], p, p + r[i + 1]); p += r[i + 1]; } return a; }
  /* COCO uncompressed RLE for one class: column-major, counts alternate starting with a run of zeros. */
  function cocoRle(d, w, h, cls) { const c = []; let cur = 0, run = 0; for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const v = d[y * w + x] === cls ? 1 : 0; if (v === cur) run++; else { c.push(run); run = 1; cur = v; } } c.push(run); return c; }
  function resample(d, w, h, W, H) { if (w === W && h === H) return d; const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) { const sy = Math.min(h - 1, Math.floor((y + .5) * h / H)); for (let x = 0; x < W; x++) o[y * W + x] = d[sy * w + Math.min(w - 1, Math.floor((x + .5) * w / W))]; } return o; }
  A.geo = { inUnit, area, distinct, rleEncode, rleDecode, cocoRle, resample };
})(window.Alphex = window.Alphex || {});
