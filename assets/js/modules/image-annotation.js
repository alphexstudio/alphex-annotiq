/* Image annotation plugin for the shared workspace controller (ws-core.js).
   Modes: icls (classification), bbox, poly (polygon), point, seg (brush mask). Geometry is normalized 0-1; masks live in IndexedDB (mock) and only metadata is in annotation_data. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, M = A.model, $ = s => document.querySelector(s);
  let C = null, E = null, usage = {}, active = null, maskP = Promise.resolve();
  const TOOLS = [['select', 'Select', 'V'], ['bbox', 'Box', 'B'], ['polygon', 'Polygon', 'P'], ['point', 'Point', 'O'], ['brush', 'Brush', 'R'], ['eraser', 'Eraser', 'E'], ['pan', 'Pan', 'H']], ALLOW = { icls: [], bbox: ['bbox'], poly: ['polygon'], point: ['point'], seg: ['brush', 'eraser'] };
  const HINT = { select: 'Click an object to select it. Drag to move; use handles to resize or reshape. Alt+click a polygon vertex deletes it; double-click an edge adds one.', bbox: 'Drag on the image to draw a box.', polygon: 'Click to add vertices. Click the first vertex, press Enter or use Finish to close. Esc cancels, Backspace removes the last vertex.', point: 'Click on the image to add a point.', brush: 'Paint the mask with the active label. Hold Space to pan.', eraser: 'Erase mask pixels.', pan: 'Drag to pan. Scroll to zoom.' };
  const LB = () => C.CFG.label_objs, lab = id => LB().find(l => l.id === id) || null, col = id => (lab(id) || {}).color || '#ea005a', nm = id => (lab(id) || {}).name || null;
  const canTool = t => t === 'select' || t === 'pan' || (!C.readOnly && ALLOW[C.mode].includes(t));
  const msg = (t, err) => { const e = $('#pend'); if (e) e.innerHTML = err ? '<span class="msg">' + esc(t) + '</span>' : esc(t); };
  function counts() { const n = {}; ((C.data.classification || {}).label_ids || []).forEach(i => { n[i] = (n[i] || 0) + 1; }); (C.data.objects || []).forEach(o => { n[o.label_id] = (n[o.label_id] || 0) + 1; }); if (C.data.mask) C.data.mask.classes.forEach(i => { n[i] = (n[i] || 0) + 1; }); return n; }
  const geo = o => { const im = C.task.payload.image, r = v => Math.round(v); return o.type === 'bbox' ? 'x ' + r(o.x * im.width) + ', y ' + r(o.y * im.height) + ', ' + r(o.w * im.width) + ' x ' + r(o.h * im.height) + ' px' : o.type === 'polygon' ? o.points.length + ' vertices' : 'x ' + r(o.x * im.width) + ', y ' + r(o.y * im.height) + ' px'; };
  function drawSide() {
    const mode = C.mode, d = C.data, cnt = counts(), ro = C.readOnly, sel = E && E.cur();
    $('#lab').innerHTML = '<h2>Labels</h2><div class="lbls">' + LB().map((l, i) => { const on = mode === 'icls' ? d.classification.label_ids.includes(l.id) : l.id === active;
      return '<div class="lrow"><button type="button" class="lb" data-l="' + esc(l.id) + '" aria-pressed="' + on + '" style="--c:' + esc(l.color) + '" title="' + esc(l.description) + '"' + (ro && mode === 'icls' ? ' disabled' : '') + '><kbd>' + (i < 9 ? i + 1 : '') + '</kbd>' + esc(l.name) + '<span class="small">' + (cnt[l.id] || 0) + ' here' + (usage[l.id] != null ? ', ' + usage[l.id] + ' in project' : '') + '</span></button>' + (ro ? '' : '<button class="btn ghost" type="button" data-edit="' + esc(l.id) + '" aria-label="Edit label ' + esc(l.name) + '">Edit</button>') + '</div>'; }).join('') + '</div>' +
      (ro ? '' : '<button class="btn sec" type="button" data-newl>New label</button><p class="small">Label changes apply to the whole project. In production they need manager permission.</p>');
    if (mode === 'icls') { $('#objs').innerHTML = ''; $('#prop').innerHTML = ''; return; }
    const objs = d.objects || [];
    $('#objs').innerHTML = mode === 'seg' ? '<h2>Mask</h2><p class="small">' + (E && E.mask ? E.mask.w + ' x ' + E.mask.h + ' px working resolution, ' + E.nonzero() + ' painted px' : 'Loading...') + '</p>' + (E && E.mask ? E.mask.classes.map(id => '<span class="badge"><span class="dot" style="--c:' + esc(col(id)) + '"></span> ' + esc(nm(id) || '?') + '</span>').join(' ') : '') + (ro ? '' : '<p><button class="btn sec" type="button" id="clearm">Clear mask</button></p>') :
      '<h2>Objects (' + objs.length + ')</h2>' + (objs.length ? '<div class="olist">' + objs.map(o => '<div class="lrow"><button type="button" class="orow" data-sel="' + esc(o.id) + '" aria-pressed="' + (sel && sel.id === o.id) + '"><span class="dot" style="--c:' + esc(col(o.label_id)) + '"></span>' + esc(o.type) + ' <b>' + esc(nm(o.label_id) || o.label) + '</b></button>' + (ro ? '' : '<button class="btn ghost" type="button" data-del="' + esc(o.id) + '" aria-label="Delete ' + esc(o.type) + '">Delete</button>') + '</div>').join('') + '</div>' : '<p class="mu">Nothing annotated yet.</p>');
    $('#prop').innerHTML = sel ? '<h2>Selected</h2><label class="fld">Label<select id="plab"' + (ro ? ' disabled' : '') + '>' + LB().map(l => '<option value="' + esc(l.id) + '"' + (l.id === sel.label_id ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select></label><label class="fld">Confidence (optional, 0-1)<input id="pconf" type="number" min="0" max="1" step="0.01" value="' + (sel.confidence == null ? '' : sel.confidence) + '"' + (ro ? ' disabled' : '') + '></label><p class="small">' + esc(geo(sel)) + '</p>' : '';
  }
  function changed(kind) {
    if (kind === 'mask') { const m = E.mask, tid = C.task.id, snap = { w: m.w, h: m.h, classes: m.classes.slice(), data: m.data.slice() }; C.data.mask = { key: 'mask:' + tid, width: m.w, height: m.h, classes: m.classes.slice(), rev: Date.now(), nonzero: E.nonzero() };
      maskP = maskP.then(() => A.images.maskPut(tid, snap)).catch(e => msg('Could not store the mask: ' + e.message, true)); }
    C.touch(); drawSide();
  }
  function hist() { const u = $('#undo'), r = $('#redo'); if (u && E) { u.disabled = !E.hs.length || C.readOnly; r.disabled = !E.rs.length || C.readOnly; } }
  function setTool(t) { if (!canTool(t)) return; E.setTool(t); document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t)); $('#polyb').hidden = t !== 'polygon'; msg(HINT[t]); }
  async function loadMask() {
    const my = E, im = C.task.payload.image, k = Math.min(1, 1024 / Math.max(im.width, im.height)); let m = null;
    if (C.data.mask) { try { m = await A.images.maskGet(C.task.id); } catch (e) { msg('Mask storage error: ' + e.message, true); } } if (E !== my) return;
    if (m) E.initMask(m.w, m.h, m.classes, m.data); else { E.initMask(Math.max(1, Math.round(im.width * k)), Math.max(1, Math.round(im.height * k)), []); if (C.data.mask) msg('The saved mask was not found in this browser; starting with an empty mask.', true); } drawSide();
  }
  async function saveLabels(L) { C.P = await A.projects.update(C.P.id, { config: Object.assign({}, C.P.config || {}, { labels: L }) }); C.CFG = M.config(C.P); if (!lab(active)) active = LB()[0] && LB()[0].id; E.label = lab(active); E.refreshMask(); E.invalidate(true); drawSide(); }
  function labelDialog(l) {
    const used = l ? Math.max(counts()[l.id] || 0, usage[l.id] || 0) : 0;
    const d = ui.dialog('<form><h2>' + (l ? 'Edit label' : 'New label') + '</h2>' + ui.fld('Name', '<input name="name" required maxlength="50" value="' + esc(l ? l.name : '') + '">') + ui.fld('Description', '<textarea name="description" maxlength="200">' + esc(l ? l.description : '') + '</textarea>') + ui.fld('Color', '<input type="color" name="color" value="' + esc(l ? l.color : M.PAL[LB().length % M.PAL.length]) + '">') +
      '<p class="msg" role="alert"></p>' + (used ? '<p class="small">Used by ' + used + ' annotation(s), so it cannot be deleted.</p>' : '') + '<div class="acts">' + (l ? '<button class="btn sec" type="button" data-del' + (used || LB().length < 2 ? ' disabled' : '') + '>Delete</button>' : '') + '<button class="btn sec" type="button" data-x>Cancel</button><button class="btn pri" type="submit">Save</button></div></form>'), f = d.querySelector('form'), em = f.querySelector('.msg');
    f.querySelector('[data-x]').onclick = () => d.close(); const del = f.querySelector('[data-del]');
    if (del) del.onclick = async () => { try { await saveLabels(LB().filter(x => x.id !== l.id)); d.close(); } catch (e) { em.textContent = e.message; } };
    f.onsubmit = async e => { e.preventDefault(); const n = f.elements.name.value.trim(), L = LB().map(x => Object.assign({}, x));
      if (L.some(x => x.name.toLowerCase() === n.toLowerCase() && (!l || x.id !== l.id))) { em.textContent = 'A label with that name already exists.'; return; }
      const rec = { name: n, description: f.elements.description.value.trim(), color: f.elements.color.value };
      if (l) Object.assign(L.find(x => x.id === l.id), rec); else L.push(Object.assign({ id: 'lbl_' + Date.now().toString(36), created_at: new Date().toISOString() }, rec));
      try { await saveLabels(L); if (l) (C.data.objects || []).forEach(o => { if (o.label_id === l.id) o.label = n; }); d.close(); } catch (er) { em.textContent = er.message; } };
  }
  function mount(c) {
    if (E) { E.dispose(); E = null; } C = c; c.engine = null; const mode = c.mode; usage = {}; c.data.objects = c.data.objects || [];
    $('#body').innerHTML = '<div class="tb" role="toolbar" aria-label="Image tools"><span class="seg" id="tools">' + TOOLS.map(([k, l, key]) => '<button type="button" data-tool="' + k + '" aria-pressed="false" title="' + l + ' (' + key + ')"' + (canTool(k) ? '' : ' disabled') + '>' + l + '</button>').join('') +
      '</span><span class="seg"><button type="button" id="undo" title="Undo (Ctrl+Z)">Undo</button><button type="button" id="redo" title="Redo (Ctrl+Shift+Z)">Redo</button></span><span class="seg"><button type="button" id="zo" aria-label="Zoom out">-</button><span id="zp" class="zp">100%</span><button type="button" id="zi" aria-label="Zoom in">+</button><button type="button" id="zf">Fit</button><button type="button" id="z1">100%</button></span>' +
      '<span id="polyb" hidden><button class="btn sec" type="button" id="pfin">Finish polygon</button> <button class="btn ghost" type="button" id="pcan">Cancel</button></span>' + (mode === 'seg' ? '<span class="tbs"><label class="small" for="bs">Brush <span id="bsv">24</span> px</label><input id="bs" type="range" min="2" max="200" value="24"></span>' : '') + '<button class="btn sec" type="button" id="dsel">Delete selected</button></div><div class="stage" id="stage" aria-label="Image canvas"></div><div id="pend" role="status"></div>';
    $('#side').innerHTML = '<div id="lab"></div><div id="objs"></div><div id="prop"></div>'; active = lab(active) ? active : (LB()[0] && LB()[0].id);
    E = new A.ImageCanvas($('#stage'), { readOnly: c.readOnly, minPx: c.CFG.min_box_px, userId: A.auth.user && A.auth.user.id, taskId: c.task.id, colorOf: col, nameOf: nm, onChange: changed, onSelect: drawSide, onView: s => { const z = $('#zp'); if (z) z.textContent = Math.round(s * 100) + '%'; }, onHist: hist, onMsg: msg });
    c.engine = E; E.objects = c.data.objects; E.label = lab(active); const me = E;
    A.images.load(c.task.payload.image).then(async r => { if (E !== me) return; E.setImage(r); if (mode === 'seg') await loadMask(); }).catch(e => msg('Image error: ' + e.message, true));
    $('#tools').onclick = e => { const b = e.target.closest('[data-tool]'); if (b && !b.disabled) setTool(b.dataset.tool); };
    $('#undo').onclick = () => E.undo(); $('#redo').onclick = () => E.redo(); $('#zi').onclick = () => E.zoomAt(1.25); $('#zo').onclick = () => E.zoomAt(1 / 1.25); $('#zf').onclick = () => E.fit(); $('#z1').onclick = () => E.reset(); $('#dsel').onclick = () => E.deleteSelected(); $('#dsel').disabled = c.readOnly;
    $('#pfin').onclick = () => E.finishPoly(); $('#pcan').onclick = () => E.cancelPoly(); const bs = $('#bs'); if (bs) bs.oninput = () => { E.brush = +bs.value; $('#bsv').textContent = bs.value; };
    $('#side').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.l) { if (mode === 'icls') { if (c.readOnly) return; const d = c.data.classification, a = d.label_ids, i = a.indexOf(b.dataset.l); if (c.CFG.selection === 'single') d.label_ids = i >= 0 ? [] : [b.dataset.l]; else if (i >= 0) a.splice(i, 1); else a.push(b.dataset.l); d.labels = d.label_ids.map(nm); c.touch(); drawSide(); }
        else { active = b.dataset.l; E.label = lab(active); if (E.tool === 'select' && E.sel && !c.readOnly) E.relabel(E.sel, lab(active)); drawSide(); } }
      else if (b.dataset.edit) labelDialog(lab(b.dataset.edit)); else if (b.hasAttribute('data-newl')) labelDialog(null); else if (b.dataset.sel) E.select(b.dataset.sel); else if (b.dataset.del) { E.select(b.dataset.del); E.deleteSelected(); } else if (b.id === 'clearm') E.clearMask(); };
    $('#side').onchange = e => { const t = e.target; if (c.readOnly) return; if (t.id === 'plab') E.relabel(E.sel, lab(t.value)); else if (t.id === 'pconf') { const v = t.value === '' ? null : Number(t.value); if (v != null && !(v >= 0 && v <= 1)) { msg('Confidence must be between 0 and 1.', true); return; } E.setField(E.sel, 'confidence', v); } };
    setTool(c.readOnly ? 'select' : (ALLOW[mode][0] || 'select')); hist(); drawSide();
    A.tasks.labelUsage(c.P.id).then(u => { if (C === c) { usage = u; drawSide(); } }).catch(() => {});
  }
  document.addEventListener('keydown', e => {
    if (!C || !C.task || !E) return; const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return; const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === ' ') { if (!E.space) { E.space = true; E.cursor(); } e.preventDefault(); return; }
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); if (!C.readOnly) e.shiftKey ? E.redo() : E.undo(); return; } if (mod && k.toLowerCase() === 'y') { e.preventDefault(); if (!C.readOnly) E.redo(); return; } if (mod || e.altKey) return;
    const T = { v: 'select', b: 'bbox', p: 'polygon', o: 'point', r: 'brush', e: 'eraser', h: 'pan' }[k.toLowerCase()]; if (T) { setTool(T); return; }
    if (k === '+' || k === '=') E.zoomAt(1.25); else if (k === '-') E.zoomAt(1 / 1.25); else if (k === '0') E.fit();
    else if (k === 'Enter' && E.poly) { e.preventDefault(); E.finishPoly(); } else if (k === 'Escape') { if (E.poly) E.cancelPoly(); else E.select(null); }
    else if (k === 'Backspace' && E.poly) { e.preventDefault(); E.undoVertex(); } else if ((k === 'Delete' || k === 'Backspace') && E.sel && !C.readOnly) { e.preventDefault(); E.deleteSelected(); }
    else if (/^[1-9]$/.test(k) && LB()[+k - 1]) { const l = LB()[+k - 1]; if (C.mode === 'icls') { if (!C.readOnly) $('#lab').querySelector('[data-l="' + l.id + '"]').click(); } else { active = l.id; E.label = l; if (E.tool === 'select' && E.sel && !C.readOnly) E.relabel(E.sel, l); drawSide(); } }
  });
  document.addEventListener('keyup', e => { if (e.key === ' ' && E) { E.space = false; E.cursor(); } });
  A.ws.start({ title: 'Image Annotation', ptype: 'image_annotation', modes: M.IMG, who: 'Annotator', svc: A.annotations, mount,
    keys: '<dt><kbd>V</kbd> <kbd>B</kbd> <kbd>P</kbd> <kbd>O</kbd> <kbd>R</kbd> <kbd>E</kbd> <kbd>H</kbd></dt><dd>Select, box, polygon, point, brush, eraser, pan</dd><dt><kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd></dt><dd>Undo (Shift for redo)</dd><dt><kbd>Del</kbd></dt><dd>Delete selected</dd><dt><kbd>Enter</kbd> <kbd>Esc</kbd></dt><dd>Finish / cancel polygon</dd><dt><kbd>+</kbd> <kbd>-</kbd> <kbd>0</kbd></dt><dd>Zoom in, out, fit</dd><dt><kbd>Space</kbd></dt><dd>Hold to pan</dd><dt><kbd>1</kbd>-<kbd>9</kbd></dt><dd>Choose label</dd>',
    init: t => { const d = (t.annotation && t.annotation.annotation_data) || {}; return JSON.parse(JSON.stringify({ classification: d.classification || { label_ids: [], labels: [] }, objects: d.objects || [], mask: d.mask || null })); },
    validate: (P, t, d, s) => M.vImage(P, t.payload.image, d, s),
    chips: c => { const im = c.task.payload.image; return [['Image', esc(im.filename)], ['Dimensions', im.width + ' x ' + im.height + ' px' + (im.size_bytes ? ', ' + ui.bytes(im.size_bytes) : '')]]; },
    instr: c => c.mode === 'bbox' ? '<p class="small">Minimum box size: ' + c.CFG.min_box_px + ' px.</p>' : '',
    summary: c => { const d = c.data, n = (d.objects || []).length; if (c.mode === 'icls') return '<p><b>Labels:</b> ' + esc(d.classification.labels.join(', ')) + '</p>';
      if (c.mode === 'seg') return d.mask && d.mask.nonzero ? '<p><b>Mask:</b> ' + d.mask.nonzero + ' painted pixels, ' + d.mask.classes.length + ' class(es).</p>' : '<p class="msg">The mask is empty. Submit this image as "nothing to segment"?</p>';
      return n ? '<p><b>' + n + ' ' + (c.mode === 'poly' ? 'polygon' : c.mode) + (n > 1 ? 's' : '') + '</b></p><div class="scroll"><table class="tbl"><tbody>' + d.objects.map(o => '<tr><td>' + esc(o.type) + '</td><td>' + esc(nm(o.label_id) || o.label) + '</td><td>' + esc(geo(o)) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="msg">No objects were annotated. Submit this image as "nothing to label"?</p>'; } });
})(window.Alphex);
