/* Annotation export: COCO JSON, YOLO (bounding boxes, zipped) and Alphex basic JSON. Builders are pure; nothing is silently dropped (see report).
   In mock mode the export is built in the browser from task data and IndexedDB masks. Production: a server endpoint (GET /projects/{id}/export). */
(function (A) {
  const G = A.geo, r2 = a => Array.isArray(a) ? a.map(r2) : Math.round(a * 100) / 100, stem = n => n.replace(/\.[^.]+$/, '');
  function names(items) { const seen = {}; items.forEach(it => { let n = it.task.payload.image.filename; const k = n.toLowerCase(); if (seen[k]) { const dot = n.lastIndexOf('.'); n = (dot > 0 ? n.slice(0, dot) : n) + '_' + it.task.id + (dot > 0 ? n.slice(dot) : ''); } seen[k] = 1; it.fname = n; }); }
  function count(items) { const c = { bbox: 0, polygon: 0, point: 0, mask: 0, classification: 0, images: items.length }; items.forEach(it => { (it.data.objects || []).forEach(o => { c[o.type]++; }); if (it.mask) c.mask++; if ((it.data.classification || {}).label_ids && it.data.classification.label_ids.length) c.classification++; }); return c; }
  function coco(x) {
    const L = x.labels, cat = Object.fromEntries(L.map((l, i) => [l.id, i + 1])), images = [], anns = [], rep = [], c = count(x.items); let aid = 1;
    x.items.forEach((it, i) => { const im = it.task.payload.image, id = i + 1, iw = im.width, ih = im.height, row = { id, file_name: it.fname, width: iw, height: ih, alphex_task_id: it.task.id }, cl = (it.data.classification || {}).label_ids;
      if (cl && cl.length) row.alphex_image_labels = cl.map(v => (L.find(l => l.id === v) || {}).name); images.push(row);
      (it.data.objects || []).forEach(o => { const b = { id: aid++, image_id: id, category_id: cat[o.label_id], iscrowd: 0, alphex_object_id: o.id };
        if (o.type === 'bbox') anns.push(Object.assign(b, { bbox: r2([o.x * iw, o.y * ih, o.w * iw, o.h * ih]), area: r2(o.w * iw * o.h * ih), segmentation: [] }));
        else if (o.type === 'polygon') { const xs = o.points.map(p => p.x * iw), ys = o.points.map(p => p.y * ih), x0 = Math.min(...xs), y0 = Math.min(...ys); anns.push(Object.assign(b, { segmentation: [o.points.reduce((a, p) => a.concat(r2([p.x * iw, p.y * ih])), [])], bbox: r2([x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0]), area: r2(G.area(o.points) * iw * ih) })); }
        else anns.push(Object.assign(b, { keypoints: r2([o.x * iw, o.y * ih]).concat(2), num_keypoints: 1, bbox: [0, 0, 0, 0], area: 0, segmentation: [], alphex_type: 'point' })); });
      if (it.mask) { const m = it.mask, full = G.resample(m.data, m.w, m.h, iw, ih);
        m.classes.forEach((lid, k) => { let n = 0, x0 = iw, y0 = ih, x1 = -1, y1 = -1; for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) if (full[yy * iw + xx] === k + 1) { n++; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
          if (n) anns.push({ id: aid++, image_id: id, category_id: cat[lid], iscrowd: 1, segmentation: { counts: G.cocoRle(full, iw, ih, k + 1), size: [ih, iw] }, area: n, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], alphex_type: 'mask' }); }); } });
    rep.push('COCO export: ' + c.images + ' images, ' + anns.length + ' annotations.');
    if (c.point) rep.push('Limitation: COCO has no standalone point type. ' + c.point + ' point(s) were exported as single-keypoint annotations (keypoints [x,y,2], bbox zeros, alphex_type "point").');
    if (c.classification) rep.push('Limitation: COCO detection has no image-level classification. Labels for ' + c.classification + ' image(s) are stored in the custom field images[].alphex_image_labels.');
    if (c.mask) rep.push('Limitation: masks are semantic (one region per class), exported as per-class uncompressed RLE with iscrowd=1, resampled to the full image size. They are not instance masks.');
    return { files: [{ name: x.slug + '_coco.json', mime: 'application/json', content: JSON.stringify({ info: { description: x.project.name, version: '1.0', date_created: x.now, contributor: 'Alphex Workbench' }, licenses: [], images, categories: L.map((l, i) => ({ id: i + 1, name: l.name })), annotations: anns }, null, 2) }], report: rep, counts: c };
  }
  function yolo(x) {
    const L = x.labels, idx = Object.fromEntries(L.map((l, i) => [l.id, i])), c = count(x.items), files = [{ name: 'classes.txt', content: L.map(l => l.name).join('\n') + '\n' }], rep = []; let n = 0;
    x.items.forEach(it => { const lines = (it.data.objects || []).filter(o => o.type === 'bbox').map(o => { n++; return [idx[o.label_id], o.x + o.w / 2, o.y + o.h / 2, o.w, o.h].map((v, i) => i ? v.toFixed(6) : v).join(' '); }); files.push({ name: 'labels/' + stem(it.fname) + '.txt', content: lines.join('\n') + (lines.length ? '\n' : '') }); });
    rep.push('YOLO export: ' + c.images + ' label files, ' + n + ' bounding boxes. Format: class_id center_x center_y width height, normalized 0-1, class ids follow classes.txt.');
    [['polygon', c.polygon, 'YOLO detection format cannot represent polygons'], ['point', c.point, 'YOLO detection format cannot represent points'], ['mask', c.mask, 'YOLO detection format cannot represent segmentation masks'], ['classification', c.classification, 'YOLO detection format has no image-level classification']].forEach(([t, k, why]) => { if (k) rep.push('Skipped: ' + k + ' ' + t + ' item(s). ' + why + '. Use the COCO or Alphex JSON export to keep them.'); });
    files.push({ name: 'export_report.txt', content: rep.join('\n') + '\n' }); return { files: [{ name: x.slug + '_yolo.zip', mime: 'application/zip', content: zip(files) }], report: rep, counts: c };
  }
  function basic(x) {
    const c = count(x.items), rep = ['Alphex JSON export: ' + c.images + ' images with every annotation type kept (' + c.bbox + ' boxes, ' + c.polygon + ' polygons, ' + c.point + ' points, ' + c.mask + ' masks, ' + c.classification + ' classified images).'];
    const out = { format: 'alphex-image-annotations-v1', exported_at: x.now, coordinate_system: 'Normalized 0-1 relative to the original image, origin top-left, y down. Multiply by image width/height for pixels.', project: { id: x.project.id, name: x.project.name, type: x.project.type, annotation_type: x.project.annotation_type, organization_id: x.project.organization_id },
      labels: x.labels, datasets: Object.entries(x.datasets).map(([id, name]) => ({ id, name })),
      images: x.items.map(it => ({ task_id: it.task.id, dataset_id: it.task.dataset_id, dataset_name: x.datasets[it.task.dataset_id] || null, record_id: it.task.record_id, filename: it.fname, width: it.task.payload.image.width, height: it.task.payload.image.height, review_status: it.task.review_status,
        annotator: { id: it.annotator_id, name: it.annotator_name }, created_at: it.created_at, updated_at: it.updated_at, version: it.version, classification: it.data.classification || null, objects: it.data.objects || [],
        mask: it.mask ? { width: it.mask.w, height: it.mask.h, classes: it.mask.classes, encoding: 'rle-pairs-row-major [value,run,...]; value 0 = background, value k = classes[k-1]', rle: Array.from(G.rleEncode(it.mask.data)) } : null })) };
    return { files: [{ name: x.slug + '_annotations.json', mime: 'application/json', content: JSON.stringify(out, null, 2) }], report: rep, counts: c };
  }
  function crc32(b) { const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { /* minimal ZIP writer, entries stored without compression */
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    files.forEach(f => { const n = enc.encode(f.name), d = typeof f.content === 'string' ? enc.encode(f.content) : f.content, crc = crc32(d);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true); parts.push(new Uint8Array(h.buffer), n, d);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true); cd.push(new Uint8Array(c.buffer), n); off += 30 + n.length + d.length; });
    const cl = cd.reduce((s, y) => s + y.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
    const all = parts.concat(cd, [new Uint8Array(e.buffer)]), out = new Uint8Array(all.reduce((s, y) => s + y.length, 0)); let p = 0; all.forEach(y => { out.set(y, p); p += y.length; }); return out;
  }
  function build(fmt, x) { x.slug = A.model.slug(x.project.name) || 'project'; x.now = x.now || new Date().toISOString(); names(x.items); return { coco, yolo, json: basic }[fmt](x); }
  async function gather(P, scope) {
    const items = []; let page = 1, total = 1, got = 0; const mock = A.config.MODE === 'mock', seg = A.model.mode(P) === 'seg';
    while (got < total) { const r = await A.tasks.page({ project_id: P.id, status: 'completed', page, limit: 100 }); total = r.total; got += r.items.length; if (!r.items.length) break; page++;
      for (const t of r.items) { if (!t.annotation || (scope === 'approved' && t.review_status !== 'approved')) continue; const d = t.annotation.annotation_data || {}, it = { task: t, data: d, annotator_id: t.annotation.annotator_id, annotator_name: t.assigned_to_name, created_at: t.annotation.created_at, updated_at: t.annotation.updated_at, version: t.annotation.version };
        if (seg && d.mask && mock) it.mask = await A.images.maskGet(t.id); items.push(it); } }
    const ds = {}; (await A.datasets.page({ project_id: P.id, limit: 100 })).items.forEach(d => { ds[d.id] = d.name; }); return { items, datasets: ds };
  }
  function openDialog(P) {
    const U = A.util, esc = U.esc, ui = A.ui, C = A.model.config(P);
    const d = ui.dialog('<h2>Export annotations</h2><p class="mu small">' + esc(P.name) + '</p>' + ui.fld('Format', '<select id="xf"><option value="coco">COCO JSON (boxes, polygons, points, masks)</option><option value="yolo">YOLO (bounding boxes only, ZIP)</option><option value="json">Alphex JSON (everything)</option></select>') +
      ui.fld('Include', '<select id="xs"><option value="approved">Approved tasks only</option><option value="all">Approved and awaiting review</option></select>') + '<div id="xr"></div><div class="acts"><button class="btn sec" type="button" data-x>Close</button><button class="btn pri" type="button" id="xb">Build export</button></div>', 'wide');
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('#xb').onclick = async () => { const out = d.querySelector('#xr'); out.innerHTML = ui.skel(2);
      try { const g = await gather(P, d.querySelector('#xs').value); if (!g.items.length) { out.innerHTML = ui.empty('No completed tasks match. Submit and approve some work first.'); return; }
        const res = build(d.querySelector('#xf').value, { project: P, labels: C.label_objs, items: g.items, datasets: g.datasets });
        if (A.config.MODE !== 'mock' && A.model.mode(P) === 'seg') res.report.push('Limitation: segmentation masks are not included because mask storage is mock-only in this prototype.');
        out.innerHTML = '<ul class="iss">' + res.report.map(r => '<li class="' + (/^(Limitation|Skipped)/.test(r) ? 'error' : '') + '">' + esc(r) + '</li>').join('') + '</ul><p>' + res.files.map((f, i) => '<button class="btn sec" type="button" data-dl="' + i + '">Download ' + esc(f.name) + '</button>').join(' ') + '</p>';
        out.onclick = e => { const b = e.target.closest('[data-dl]'); if (!b) return; const f = res.files[+b.dataset.dl], a = document.createElement('a'), u = URL.createObjectURL(new Blob([f.content], { type: f.mime })); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
      } catch (e) { out.innerHTML = '<p class="msg" role="alert">' + esc(e.message) + '</p>'; } };
  }
  A.exporter = { build, zip, crc32, count, openDialog };
})(window.Alphex);
