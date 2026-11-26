/* Vanilla canvas annotation engine (no external library). Two stacked canvases: the image layer redraws only when the view changes; the overlay layer draws annotations, mask and drafts.
   Annotation geometry is stored NORMALIZED to the original image (0-1). The view transform (scale, offset) is applied only when drawing, so zoom, pan and resize never change stored data.
   Undo history keeps JSON snapshots of the (small) object list and per-stroke pixel diffs for masks; images are never copied. */
(function (A) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), G = () => A.geo, HIT = 8, MAXH = 80, rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  const inPoly = (pts, p) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  class ImageCanvas {
    constructor(host, o) {
      this.o = Object.assign({ readOnly: false, minPx: 2, userId: null, taskId: null, colorOf: () => '#ea005a', nameOf: () => null, onChange() {}, onSelect() {}, onView() {}, onHist() {}, onMsg() {} }, o);
      host.innerHTML = '<canvas class="cv"></canvas><canvas class="cv"></canvas>'; this.host = host; this.ci = host.children[0]; this.co = host.children[1]; this.xi = this.ci.getContext('2d'); this.xo = this.co.getContext('2d');
      Object.assign(this, { objects: [], sel: null, tool: 'select', label: null, v: { s: 1, ox: 0, oy: 0 }, hs: [], rs: [], drag: null, poly: null, hover: null, mask: null, iw: 1, ih: 1, img: null, fitMode: true, brush: 24, ptrs: new Map(), raf: 0, space: false, pinch: 0, dpr: 1, cw: 1, ch: 1 });
      this.bind(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    }
    dispose() { this.ro.disconnect(); cancelAnimationFrame(this.raf); }
    /* ---- view ---- */
    resize() { const r = this.host.getBoundingClientRect(), d = window.devicePixelRatio || 1; this.cw = Math.max(1, r.width); this.ch = Math.max(1, r.height); this.dpr = d; for (const c of [this.ci, this.co]) { c.width = Math.round(this.cw * d); c.height = Math.round(this.ch * d); c.style.width = this.cw + 'px'; c.style.height = this.ch + 'px'; } if (this.img && this.fitMode) this.fit(); else this.invalidate(true); }
    setImage(src) { this.img = src.el; this.iw = src.w; this.ih = src.h; this.fit(); }
    fit() { if (!this.img) return; const s = Math.min(this.cw / this.iw, this.ch / this.ih) * .96; this.v = { s, ox: (this.cw - this.iw * s) / 2, oy: (this.ch - this.ih * s) / 2 }; this.fitMode = true; this.viewChanged(); }
    reset() { this.v = { s: 1, ox: (this.cw - this.iw) / 2, oy: (this.ch - this.ih) / 2 }; this.fitMode = false; this.viewChanged(); }
    zoomAt(f, sx, sy) { const v = this.v, s = clamp(v.s * f, .02, 32); if (sx == null) { sx = this.cw / 2; sy = this.ch / 2; } v.ox = sx - (sx - v.ox) * s / v.s; v.oy = sy - (sy - v.oy) * s / v.s; v.s = s; this.fitMode = false; this.viewChanged(); }
    viewChanged() { this.o.onView(this.v.s); this.invalidate(true); }
    sx(nx) { return nx * this.iw * this.v.s + this.v.ox; } sy(ny) { return ny * this.ih * this.v.s + this.v.oy; }
    toClient(nx, ny) { const r = this.co.getBoundingClientRect(); return { x: r.left + this.sx(nx), y: r.top + this.sy(ny) }; }
    pt(e) { const r = this.co.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, v = this.v; return { x, y, nx: (x - v.ox) / (v.s * this.iw), ny: (y - v.oy) / (v.s * this.ih) }; }
    invalidate(base) { if (base) this.dBase = true; this.dOv = true; if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; if (this.dBase) this.drawBase(); if (this.dOv) this.drawOv(); this.dBase = this.dOv = false; }); }
    drawBase() { const x = this.xi, d = this.dpr, v = this.v; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.ci.width, this.ci.height); if (!this.img) return; x.setTransform(d * v.s, 0, 0, d * v.s, d * v.ox, d * v.oy); x.imageSmoothingEnabled = v.s < 3; x.drawImage(this.img, 0, 0, this.iw, this.ih); }
    /* ---- drawing ---- */
    sq(x, cx, cy) { x.fillStyle = '#fff'; x.strokeStyle = '#ea005a'; x.lineWidth = 1.5; x.fillRect(cx - 4, cy - 4, 8, 8); x.strokeRect(cx - 4, cy - 4, 8, 8); }
    tag(x, o, X, Y) { const t = this.o.nameOf(o.label_id) || o.label || ''; if (!t) return; x.font = '600 11px sans-serif'; const w = x.measureText(t).width + 8; x.fillStyle = this.o.colorOf(o.label_id); x.fillRect(X, Y - 16, w, 15); x.fillStyle = '#000'; x.fillText(t, X + 4, Y - 5); }
    handles(o) { const X = this.sx(o.x), Y = this.sy(o.y), W = o.w * this.iw * this.v.s, H = o.h * this.ih * this.v.s; return [['nw', X, Y], ['n', X + W / 2, Y], ['ne', X + W, Y], ['e', X + W, Y + H / 2], ['se', X + W, Y + H], ['s', X + W / 2, Y + H], ['sw', X, Y + H], ['w', X, Y + H / 2]].map(([k, x, y]) => ({ k, x, y })); }
    drawObj(x, o, sel) {
      const c = this.o.colorOf(o.label_id); x.lineWidth = sel ? 2.5 : 1.5; x.strokeStyle = sel ? '#fff' : c; x.fillStyle = c + '33';
      if (o.type === 'bbox') { const X = this.sx(o.x), Y = this.sy(o.y), W = o.w * this.iw * this.v.s, H = o.h * this.ih * this.v.s; x.fillRect(X, Y, W, H); x.strokeRect(X, Y, W, H); if (sel) { x.setLineDash([5, 3]); x.strokeStyle = c; x.strokeRect(X, Y, W, H); x.setLineDash([]); if (!this.o.readOnly) this.handles(o).forEach(h => this.sq(x, h.x, h.y)); } this.tag(x, o, X, Y); }
      else if (o.type === 'polygon') { x.beginPath(); o.points.forEach((p, i) => { const X = this.sx(p.x), Y = this.sy(p.y); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); x.fill(); x.stroke(); if (sel) { x.setLineDash([5, 3]); x.strokeStyle = c; x.stroke(); x.setLineDash([]); if (!this.o.readOnly) o.points.forEach(p => this.sq(x, this.sx(p.x), this.sy(p.y))); } this.tag(x, o, this.sx(o.points[0].x), this.sy(o.points[0].y)); }
      else { const X = this.sx(o.x), Y = this.sy(o.y); x.beginPath(); x.arc(X, Y, sel ? 7 : 5, 0, 7); x.fillStyle = c; x.fill(); x.lineWidth = 2; x.strokeStyle = sel ? '#fff' : '#000'; x.stroke(); this.tag(x, o, X + 8, Y - 4); }
    }
    drawOv() {
      const x = this.xo, d = this.dpr, v = this.v; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.co.width, this.co.height); x.setTransform(d, 0, 0, d, 0, 0);
      if (this.mask) { x.save(); x.globalAlpha = .55; x.imageSmoothingEnabled = false; x.drawImage(this.mask.cv, this.sx(0), this.sy(0), this.iw * v.s, this.ih * v.s); x.restore(); }
      this.objects.forEach(o => this.drawObj(x, o, o.id === this.sel));
      const dr = this.drag; if (dr && dr.k === 'draw') { x.strokeStyle = this.label ? this.o.colorOf(this.label.id) : '#fff'; x.lineWidth = 2; x.setLineDash([6, 3]); x.strokeRect(this.sx(Math.min(dr.x0, dr.x1)), this.sy(Math.min(dr.y0, dr.y1)), Math.abs(dr.x1 - dr.x0) * this.iw * v.s, Math.abs(dr.y1 - dr.y0) * this.ih * v.s); x.setLineDash([]); }
      if (this.poly) { const P = this.poly.pts, c = this.label ? this.o.colorOf(this.label.id) : '#fff'; x.strokeStyle = c; x.lineWidth = 2; x.beginPath(); P.forEach((p, i) => { const X = this.sx(p.x), Y = this.sy(p.y); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); if (this.hover) x.lineTo(this.hover.x, this.hover.y); x.stroke(); P.forEach((p, i) => { x.beginPath(); x.arc(this.sx(p.x), this.sy(p.y), i ? 4 : 6, 0, 7); x.fillStyle = i ? c : '#fff'; x.fill(); }); }
      if ((this.tool === 'brush' || this.tool === 'eraser') && this.hover && !this.o.readOnly) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); x.arc(this.hover.x, this.hover.y, Math.max(1, this.brush / 2 * v.s), 0, 7); x.stroke(); }
    }
    /* ---- history ---- */
    push(e) { this.hs.push(e); this.rs.length = 0; if (this.hs.length > MAXH) this.hs.shift(); this.o.onHist(); }
    finish(before) {
      const bad = this.objects.find(o => o.type === 'polygon' && (G().distinct(o.points) < 3 || G().area(o.points) * this.iw * this.ih < 1));
      if (bad) { this.objects.splice(0, this.objects.length, ...JSON.parse(before)); this.o.onMsg('That edit would make the polygon invalid, so it was reverted.', true); this.invalidate(); return; }
      const after = JSON.stringify(this.objects); if (after !== before) { this.push({ k: 'obj', b: before, a: after }); this.o.onChange('objects'); }
    }
    apply(e, back) {
      if (e.k === 'obj') { this.objects.splice(0, this.objects.length, ...JSON.parse(back ? e.b : e.a)); if (this.sel && !this.byId(this.sel)) { this.sel = null; this.o.onSelect(null); } }
      else if (e.k === 'mask') { const m = this.mask, v = back ? e.o : e.n; for (let i = 0; i < e.idx.length; i++) { m.data[e.idx[i]] = v[i]; this.setPix(e.idx[i], v[i]); } m.ctx.putImageData(m.img, 0, 0); }
      else if (e.k === 'mfull') { this.mask.data.set(back ? e.b : e.a); this.paintAll(); } this.invalidate();
    }
    undo() { const e = this.hs.pop(); if (!e) return; this.apply(e, true); this.rs.push(e); this.o.onHist(); this.o.onChange(e.k === 'obj' ? 'objects' : 'mask'); }
    redo() { const e = this.rs.pop(); if (!e) return; this.apply(e, false); this.hs.push(e); this.o.onHist(); this.o.onChange(e.k === 'obj' ? 'objects' : 'mask'); }
    /* ---- objects ---- */
    byId(id) { return this.objects.find(o => o.id === id) || null; } cur() { return this.byId(this.sel); }
    select(id) { this.sel = id; this.o.onSelect(id); this.invalidate(); }
    setTool(t) { if (t !== 'polygon') this.poly = null; this.tool = t; this.cursor(); this.invalidate(); }
    add(p) {
      if (!this.label) { this.o.onMsg('Select a label first.', true); return null; } const before = JSON.stringify(this.objects);
      const o = Object.assign({ id: 'obj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label_id: this.label.id, label: this.label.name, annotator_id: this.o.userId, created_at: new Date().toISOString() }, p); if (this.o.taskId) o.task_id = this.o.taskId;
      this.objects.push(o); this.sel = o.id; this.finish(before); if (!this.byId(o.id)) { this.sel = null; return null; } this.o.onSelect(o.id); this.invalidate(); return o;
    }
    deleteSelected() { const o = this.cur(); if (!o || this.o.readOnly) return; const b = JSON.stringify(this.objects); this.objects.splice(this.objects.indexOf(o), 1); this.sel = null; this.finish(b); this.o.onSelect(null); this.invalidate(); }
    relabel(id, lab) { const o = this.byId(id); if (!o || this.o.readOnly) return; const b = JSON.stringify(this.objects); o.label_id = lab.id; o.label = lab.name; this.finish(b); this.invalidate(); }
    setField(id, k, v) { const o = this.byId(id); if (!o || this.o.readOnly) return; const b = JSON.stringify(this.objects); if (v == null) delete o[k]; else o[k] = v; this.finish(b); }
    /* ---- hit testing ---- */
    hitHandle(p) { const o = this.cur(); if (!o) return null; if (o.type === 'bbox') return this.handles(o).find(h => Math.hypot(h.x - p.x, h.y - p.y) <= HIT) || null;
      if (o.type === 'polygon') { const i = o.points.findIndex(q => Math.hypot(this.sx(q.x) - p.x, this.sy(q.y) - p.y) <= HIT); return i >= 0 ? { k: 'v', i } : null; } return null; }
    scr(o) { return o.points.map(q => ({ x: this.sx(q.x), y: this.sy(q.y) })); }
    nearEdge(o, p) { const P = this.scr(o); for (let i = 0; i < P.length; i++) if (segDist(p, P[i], P[(i + 1) % P.length]) <= 6) return i; return -1; }
    hitObj(p) {
      for (let i = this.objects.length - 1; i >= 0; i--) { const o = this.objects[i];
        if (o.type === 'bbox') { const X = this.sx(o.x), Y = this.sy(o.y), W = o.w * this.iw * this.v.s, H = o.h * this.ih * this.v.s; if (p.x >= X && p.x <= X + W && p.y >= Y && p.y <= Y + H) return o; }
        else if (o.type === 'polygon') { if (inPoly(this.scr(o), p) || this.nearEdge(o, p) >= 0) return o; } else if (Math.hypot(this.sx(o.x) - p.x, this.sy(o.y) - p.y) <= HIT + 2) return o; } return null;
    }
    /* ---- pointer input (mouse, pen, touch) ---- */
    bind() {
      const c = this.co; c.style.touchAction = 'none';
      c.addEventListener('pointerdown', e => this.down(e)); c.addEventListener('pointermove', e => this.move(e)); c.addEventListener('pointerup', e => this.up(e)); c.addEventListener('pointercancel', e => this.up(e)); c.addEventListener('dblclick', e => this.dbl(e)); c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('wheel', e => { e.preventDefault(); const p = this.pt(e); this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
    }
    pd() { const a = [...this.ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    pc() { const a = [...this.ptrs.values()], r = this.co.getBoundingClientRect(); return { x: (a[0].x + a[1].x) / 2 - r.left, y: (a[0].y + a[1].y) / 2 - r.top }; }
    cursor(p) { const t = this.tool; let c = t === 'pan' || this.space ? 'grab' : t === 'select' ? 'default' : 'crosshair'; if (t === 'select' && p && !this.o.readOnly) c = this.hitHandle(p) ? 'pointer' : this.hitObj(p) ? 'move' : 'default'; this.co.style.cursor = this.drag && this.drag.k === 'pan' ? 'grabbing' : c; }
    down(e) {
      const p = this.pt(e); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { this.co.setPointerCapture(e.pointerId); } catch (er) {}
      if (this.ptrs.size === 2) { this.pinch = this.pd(); this.drag = null; return; }
      if (e.button === 1 || this.tool === 'pan' || this.space) { this.drag = { k: 'pan', x: e.clientX, y: e.clientY, ox: this.v.ox, oy: this.v.oy }; this.cursor(); return; }
      if (e.button !== 0 || !this.img) return; const t = this.tool;
      if (this.o.readOnly) { if (t === 'select') { const h = this.hitObj(p); this.select(h ? h.id : null); } return; }
      if (t === 'select') return this.downSelect(e, p);
      if (t === 'bbox') { const x = clamp(p.nx, 0, 1), y = clamp(p.ny, 0, 1); this.drag = { k: 'draw', x0: x, y0: y, x1: x, y1: y }; this.invalidate(); }
      else if (t === 'polygon') this.polyClick(p); else if (t === 'point') { if (p.nx >= 0 && p.nx <= 1 && p.ny >= 0 && p.ny <= 1) this.add({ type: 'point', x: p.nx, y: p.ny }); } else if (t === 'brush' || t === 'eraser') this.strokeStart(p, t === 'eraser');
    }
    downSelect(e, p) {
      const sel = this.cur();
      if (sel) { const h = this.hitHandle(p); if (h) { const before = JSON.stringify(this.objects);
        if (h.k === 'v' && e.altKey) { if (sel.points.length > 3) { sel.points.splice(h.i, 1); this.finish(before); this.invalidate(); } else this.o.onMsg('A polygon needs at least 3 vertices.', true); return; }
        this.drag = { k: 'handle', h, before, id: sel.id, fix: sel.type === 'bbox' ? { l: sel.x, t: sel.y, r: sel.x + sel.w, b: sel.y + sel.h } : null }; return; } }
      const o = this.hitObj(p); this.select(o ? o.id : null); if (o) this.drag = { k: 'move', before: JSON.stringify(this.objects), id: o.id, nx: p.nx, ny: p.ny };
    }
    move(e) {
      const p = this.pt(e); if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2 && this.pinch) { const d = this.pd(), c = this.pc(); this.zoomAt(d / this.pinch, c.x, c.y); this.pinch = d; return; }
      const d = this.drag; this.hover = p; if (!d) { this.cursor(p); if (this.poly || this.tool === 'brush' || this.tool === 'eraser') this.invalidate(); return; }
      if (d.k === 'pan') { this.v.ox = d.ox + e.clientX - d.x; this.v.oy = d.oy + e.clientY - d.y; this.fitMode = false; this.viewChanged(); }
      else if (d.k === 'draw') { d.x1 = clamp(p.nx, 0, 1); d.y1 = clamp(p.ny, 0, 1); this.invalidate(); } else if (d.k === 'move') this.dragMove(d, p); else if (d.k === 'handle') this.dragHandle(d, p); else if (d.k === 'stroke') this.strokeTo(p);
    }
    up(e) {
      this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = 0; const d = this.drag; if (!d) return; this.drag = null; this.cursor();
      if (d.k === 'draw') { const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
        if (w * this.iw < this.o.minPx || h * this.ih < this.o.minPx) { if (w > 0 || h > 0) this.o.onMsg('Box discarded: smaller than the minimum size of ' + this.o.minPx + ' px.', true); this.invalidate(); return; } this.add({ type: 'bbox', x, y, w, h }); }
      else if (d.k === 'move' || d.k === 'handle') this.finish(d.before); else if (d.k === 'stroke') this.strokeEnd(d);
    }
    dragMove(d, p) {
      const o = this.byId(d.id); if (!o) return; let dx = p.nx - d.nx, dy = p.ny - d.ny;
      if (o.type === 'bbox') { dx = clamp(dx, -o.x, 1 - o.w - o.x); dy = clamp(dy, -o.y, 1 - o.h - o.y); o.x += dx; o.y += dy; }
      else if (o.type === 'polygon') { const xs = o.points.map(q => q.x), ys = o.points.map(q => q.y); dx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs)); dy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys)); o.points.forEach(q => { q.x += dx; q.y += dy; }); }
      else { dx = clamp(dx, -o.x, 1 - o.x); dy = clamp(dy, -o.y, 1 - o.y); o.x += dx; o.y += dy; } d.nx += dx; d.ny += dy; this.invalidate();
    }
    dragHandle(d, p) {
      const o = this.byId(d.id); if (!o) return; const nx = clamp(p.nx, 0, 1), ny = clamp(p.ny, 0, 1);
      if (d.h.k === 'v') { o.points[d.h.i] = { x: nx, y: ny }; this.invalidate(); return; }
      const f = d.fix, k = d.h.k; let l = f.l, r = f.r, t = f.t, b = f.b; if (k.includes('w')) l = nx; if (k.includes('e')) r = nx; if (k.includes('n')) t = ny; if (k.includes('s')) b = ny;
      const x = Math.min(l, r), y = Math.min(t, b), w = Math.abs(r - l), h = Math.abs(b - t); if (w * this.iw < this.o.minPx || h * this.ih < this.o.minPx) return; Object.assign(o, { x, y, w, h }); this.invalidate();
    }
    polyClick(p) {
      const x = clamp(p.nx, 0, 1), y = clamp(p.ny, 0, 1); if (!this.poly) { this.poly = { pts: [{ x, y }] }; this.invalidate(); return; } const P = this.poly.pts, f = P[0], l = P[P.length - 1];
      if (P.length >= 3 && Math.hypot(this.sx(f.x) - p.x, this.sy(f.y) - p.y) <= HIT + 2) { this.finishPoly(); return; } if (Math.hypot(this.sx(l.x) - p.x, this.sy(l.y) - p.y) < 3) return; P.push({ x, y }); this.invalidate();
    }
    finishPoly() { const P = this.poly; if (!P) return false; const pts = P.pts; if (pts.length < 3 || G().distinct(pts) < 3 || G().area(pts) * this.iw * this.ih < 1) { this.o.onMsg('A polygon needs at least 3 distinct vertices and a non-zero area.', true); return false; }
      this.poly = null; const o = this.add({ type: 'polygon', points: pts.map(q => ({ x: q.x, y: q.y })) }); this.invalidate(); return !!o; }
    cancelPoly() { this.poly = null; this.invalidate(); } undoVertex() { if (this.poly) { this.poly.pts.pop(); if (!this.poly.pts.length) this.poly = null; this.invalidate(); } }
    dbl(e) { if (this.o.readOnly) return; const p = this.pt(e);
      if (this.tool === 'polygon' && this.poly) this.finishPoly(); else if (this.tool === 'select') { const o = this.cur(); if (o && o.type === 'polygon') { const i = this.nearEdge(o, p); if (i >= 0) { const b = JSON.stringify(this.objects); o.points.splice(i + 1, 0, { x: clamp(p.nx, 0, 1), y: clamp(p.ny, 0, 1) }); this.finish(b); this.invalidate(); } } } }
    /* ---- segmentation mask (indexed, one byte per pixel at working resolution; 0 = background, k = classes[k-1]) ---- */
    initMask(w, h, classes, data) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); this.mask = { w, h, data: data || new Uint8Array(w * h), classes: classes.slice(), cv, ctx, img: ctx.createImageData(w, h) }; this.paintAll(); this.invalidate(); }
    lut() { const m = this.mask; return m.classes.map(id => rgb(this.o.colorOf(id))); }
    setPix(i, v) { const m = this.mask, o = i * 4; if (v) { const c = (m.lut || (m.lut = this.lut()))[v - 1] || [255, 0, 90]; m.img.data[o] = c[0]; m.img.data[o + 1] = c[1]; m.img.data[o + 2] = c[2]; m.img.data[o + 3] = 255; } else m.img.data[o + 3] = 0; }
    paintAll() { const m = this.mask; m.lut = this.lut(); for (let i = 0; i < m.data.length; i++) this.setPix(i, m.data[i]); m.ctx.putImageData(m.img, 0, 0); }
    refreshMask() { if (this.mask) { this.paintAll(); this.invalidate(); } }
    classIndex(id) { const c = this.mask.classes; let i = c.indexOf(id); if (i < 0) { if (c.length >= 254) return -1; c.push(id); i = c.length - 1; this.mask.lut = null; } return i + 1; }
    nonzero() { const d = this.mask ? this.mask.data : []; let n = 0; for (let i = 0; i < d.length; i++) if (d[i]) n++; return n; }
    strokeStart(p, erase) {
      if (!this.mask) { this.o.onMsg('The mask is not ready yet.', true); return; } let cls = 0; if (!erase) { if (!this.label) { this.o.onMsg('Select a label first.', true); return; } cls = this.classIndex(this.label.id); if (cls < 0) { this.o.onMsg('Too many classes in one mask.', true); return; } }
      this.drag = { k: 'stroke', cls, old: new Map(), last: null, dirty: [1e9, 1e9, -1, -1] }; this.strokeTo(p);
    }
    stamp(d, cx, cy, r) {
      const m = this.mask, r2 = r * r; for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(m.h - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(m.w - 1, Math.ceil(cx + r)); x++) {
        if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 > r2) continue; const i = y * m.w + x; if (m.data[i] === d.cls) continue; if (!d.old.has(i)) d.old.set(i, m.data[i]); m.data[i] = d.cls; this.setPix(i, d.cls); const q = d.dirty; if (x < q[0]) q[0] = x; if (y < q[1]) q[1] = y; if (x > q[2]) q[2] = x; if (y > q[3]) q[3] = y; }
    }
    strokeTo(p) {
      const m = this.mask, d = this.drag, mx = p.nx * m.w, my = p.ny * m.h, r = Math.max(.6, this.brush / 2 * m.w / this.iw);
      if (d.last) { const dx = mx - d.last[0], dy = my - d.last[1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r / 2))); for (let i = 1; i <= n; i++) this.stamp(d, d.last[0] + dx * i / n, d.last[1] + dy * i / n, r); } else this.stamp(d, mx, my, r); d.last = [mx, my];
      const q = d.dirty; if (q[2] >= 0) { m.ctx.putImageData(m.img, 0, 0, q[0], q[1], q[2] - q[0] + 1, q[3] - q[1] + 1); d.dirty = [1e9, 1e9, -1, -1]; this.invalidate(); }
    }
    strokeEnd(d) { if (!d.old.size) return; const m = this.mask, idx = Uint32Array.from(d.old.keys()), o = Uint8Array.from(d.old.values()), n = new Uint8Array(idx.length); for (let i = 0; i < idx.length; i++) n[i] = m.data[idx[i]]; this.push({ k: 'mask', idx, o, n }); this.o.onChange('mask'); }
    clearMask() { const m = this.mask; if (!m || this.o.readOnly || !this.nonzero()) return; const b = m.data.slice(); m.data.fill(0); this.paintAll(); this.push({ k: 'mfull', b, a: m.data.slice() }); this.invalidate(); this.o.onChange('mask'); }
  }
  /* Read-only view for the review queue: image + overlays + (optional) mask + object table. */
  ImageCanvas.view = async function (host, listEl, P, t, d) {
    const C = A.model.config(P), esc = A.util.esc, col = id => (C.label_objs.find(l => l.id === id) || {}).color || '#ea005a', nm = id => (C.label_objs.find(l => l.id === id) || {}).name || '?';
    const eng = new ImageCanvas(host, { readOnly: true, colorOf: col, nameOf: nm });
    try { eng.setImage(await A.images.load(t.payload.image)); eng.objects = JSON.parse(JSON.stringify(d.objects || [])); if (d.mask) { const m = await A.images.maskGet(t.id); if (m) eng.initMask(m.w, m.h, m.classes, m.data); else listEl.innerHTML = '<p class="msg">The mask data is not available in this browser.</p>'; } eng.invalidate(true); }
    catch (e) { host.innerHTML = '<p class="msg">' + esc(e.message) + '</p>'; return eng; }
    const cl = ((d.classification || {}).label_ids || []).map(id => '<span class="badge pk">' + esc(nm(id)) + '</span>').join(' '), im = t.payload.image;
    listEl.insertAdjacentHTML('beforeend', '<p class="small">' + esc(im.filename) + ', ' + im.width + ' x ' + im.height + ' px</p>' + (cl ? '<p>' + cl + '</p>' : '') + ((d.objects || []).length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Type</th><th>Label</th><th>Geometry (px)</th></tr></thead><tbody>' +
      d.objects.map(o => '<tr><td>' + esc(o.type) + '</td><td>' + esc(nm(o.label_id)) + '</td><td>' + (o.type === 'bbox' ? [o.x * im.width, o.y * im.height, o.w * im.width, o.h * im.height].map(v => Math.round(v)).join(', ') : o.type === 'polygon' ? o.points.length + ' vertices' : Math.round(o.x * im.width) + ', ' + Math.round(o.y * im.height)) + '</td></tr>').join('') + '</tbody></table></div>' : '') + (d.mask ? '<p class="small">Mask: ' + d.mask.width + ' x ' + d.mask.height + ', ' + d.mask.nonzero + ' painted pixels, ' + d.mask.classes.length + ' class(es).</p>' : ''));
    return eng;
  };
  A.ImageCanvas = ImageCanvas;
})(window.Alphex);
