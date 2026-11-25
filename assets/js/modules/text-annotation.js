/* Text annotation plugin: single/multi-label classification, NER and span annotation. Spans are stored as {id,start,end,text,label}, never as HTML. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, M = A.model, T = A.textui, $ = s => document.querySelector(s);
  let C = null, pend = null, active = null, last = null;
  const spans = () => C.data.spans, cls = () => C.mode === 'cls', msg = h => { const e = $('#pend'); if (e) e.innerHTML = h; };
  const drawDoc = () => { $('#doc').innerHTML = T.html(C.task.payload.text, cls() ? [] : spans(), C.CFG.labels, active); };
  function drawSide() {
    const L = C.CFG.labels, a = active && spans && !cls() ? spans().find(s => s.id === active) : null;
    $('#lab').innerHTML = '<h2>Labels</h2>' + (L.length ? '<div class="lbls">' + L.map((l, i) => { const on = cls() ? C.data.labels.includes(l) : !!(a && a.label === l);
      return '<button type="button" class="lb" data-l="' + esc(l) + '" aria-pressed="' + on + '" style="--c:' + T.color(L, l) + '"' + (C.readOnly ? ' disabled' : '') + '><kbd>' + (i < 9 ? i + 1 : '') + '</kbd>' + esc(l) + '</button>'; }).join('') + '</div>' : '<p class="mu">No labels configured.</p>') +
      (C.readOnly ? '' : '<form id="addl" class="tool"><label class="sr" for="nl">New label</label><input id="nl" maxlength="50" placeholder="Add custom label"><button class="btn sec" type="submit">Add</button></form><p class="small">Custom labels are added to the project configuration.</p>');
    $('#ents').innerHTML = cls() ? '<h2>Selected</h2><p>' + (C.data.labels.length ? C.data.labels.map(l => ui.badge(l, true)).join(' ') : '<span class="mu">None yet.</span>') + '</p>' :
      '<h2>Entities (' + spans().length + ')</h2>' + (spans().length ? '<div class="scroll"><table class="tbl"><tbody>' + spans().map(s => '<tr' + (s.id === active ? ' style="background:var(--card2)"' : '') + '><td class="trunc"><button class="btn ghost" type="button" data-sel="' + esc(s.id) + '">' + esc(s.text.slice(0, 40)) + '</button></td><td>' + esc(s.label) + '<div class="small">[' + s.start + ', ' + s.end + ')</div></td><td>' + (C.readOnly ? '' : '<button class="btn ghost icon" type="button" data-del="' + esc(s.id) + '" aria-label="Remove annotation ' + esc(s.text.slice(0, 40)) + '"><i data-lucide="trash-2"></i></button>') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="mu">Select text in the document, then choose a label.</p>');
    if (window.lucide) lucide.createIcons();
  }
  function selected() {
    if (C.readOnly || cls()) return; const s = T.selection($('#doc')); if (!s) return;
    if (spans().some(x => s.start < x.end && s.end > x.start)) { pend = null; msg('<span class="msg">Overlapping spans are not supported: each character can carry only one label. Select the existing span to relabel or delete it, or choose text outside it.</span>'); return; }
    pend = s; active = null; $('#doc').querySelectorAll('mark.act').forEach(m => m.classList.remove('act')); drawSide(); msg('Selected <b>"' + esc(s.text.slice(0, 80)) + '"</b> <span class="small">[' + s.start + ', ' + s.end + ')</span>. Choose a label, or press 1-9 or Enter.');
  }
  function apply(l) {
    if (C.readOnly) return;
    if (cls()) { const a = C.data.labels, i = a.indexOf(l); if (C.CFG.selection === 'single') C.data.labels = i >= 0 ? [] : [l]; else if (i >= 0) a.splice(i, 1); else a.push(l); C.touch(); drawSide(); return; }
    if (pend) { const s = { id: 'sp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), start: pend.start, end: pend.end, text: pend.text, label: l }, er = M.vAnnotation(C.P, C.task.payload.text, { spans: spans().concat(s) });
      if (er.length) { msg('<span class="msg">' + esc(er[0]) + '</span>'); return; } spans().push(s); spans().sort((a, b) => a.start - b.start); last = l; active = s.id; pend = null; getSelection().removeAllRanges(); msg(''); }
    else if (active) { const s = spans().find(x => x.id === active); if (s) s.label = l; } else return;
    C.touch(); drawDoc(); drawSide();
  }
  function remove(id) { C.data.spans = spans().filter(s => s.id !== id); active = null; C.touch(); drawDoc(); drawSide(); }
  function pickSpan(id) { active = id; pend = null; msg(''); drawDoc(); drawSide(); }
  function mount(c) {
    C = c; pend = null; active = null; $('#body').innerHTML = '<div class="doc" id="doc" tabindex="0" aria-label="Text to annotate"></div><div id="pend" role="status"></div>'; $('#side').innerHTML = '<div id="lab"></div><div id="ents"></div>'; drawDoc(); drawSide();
    $('#doc').onmouseup = () => setTimeout(selected, 0); $('#doc').onkeyup = e => { if (e.shiftKey) selected(); };
    $('#doc').onclick = e => { const m = e.target.closest('mark'); if (m && getSelection().isCollapsed) pickSpan(m.dataset.id); }; $('#doc').onkeydown = e => { const m = e.target.closest && e.target.closest('mark'); if (m && e.key === 'Enter') { e.preventDefault(); pickSpan(m.dataset.id); } };
    $('#side').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.l !== undefined) apply(b.dataset.l); if (b.dataset.del) remove(b.dataset.del); if (b.dataset.sel) pickSpan(b.dataset.sel); };
    $('#side').onsubmit = async e => { e.preventDefault(); const n = $('#nl').value.trim(), L = C.CFG.labels;
      if (!n || n.length > 50) return C.flash('Label names must be 1-50 characters.'); if (L.some(x => x.toLowerCase() === n.toLowerCase())) return C.flash('That label already exists.');
      try { const cfg = Object.assign({}, C.P.config || {}, { labels: L.concat(n) }); C.P = await A.projects.update(C.P.id, { config: cfg }); C.CFG = M.config(C.P); C.flash(''); drawSide(); U.toast('Label added to the project.'); } catch (er) { C.flash(er.message); } };
  }
  document.addEventListener('keydown', e => {
    if (!C || !C.task || C.readOnly || e.ctrlKey || e.metaKey || e.altKey) return; const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || tg === 'BUTTON') return; const L = C.CFG.labels;
    if (/^[1-9]$/.test(e.key) && L[+e.key - 1]) apply(L[+e.key - 1]); else if (e.key === 'Enter' && pend && !cls()) { e.preventDefault(); apply(last || L[0]); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && active && !cls()) { e.preventDefault(); remove(active); } else if (e.key === 'Escape' && pend) { pend = null; msg(''); getSelection().removeAllRanges(); }
  });
  A.ws.start({ title: 'Text Annotation', ptype: 'text_annotation', modes: ['cls', 'ner', 'span'], who: 'Annotator', svc: A.annotations, mount,
    keys: '<dt><kbd>1</kbd>-<kbd>9</kbd></dt><dd>Choose label</dd><dt><kbd>Enter</kbd></dt><dd>Apply last label to selection</dd><dt><kbd>Del</kbd></dt><dd>Remove selected span</dd><dt><kbd>Esc</kbd></dt><dd>Clear selection</dd>',
    init: (t, c) => { const d = t.annotation && t.annotation.annotation_data; return JSON.parse(JSON.stringify(c.mode === 'cls' ? { labels: (d && d.labels) || [] } : { spans: (d && d.spans) || [] })); },
    validate: (P, t, d, s) => M.vAnnotation(P, t.payload.text, d, s),
    summary: c => c.mode === 'cls' ? '<p><b>Labels:</b> ' + esc(c.data.labels.join(', ')) + '</p>' : (c.data.spans.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Text</th><th>Label</th><th>Offsets</th></tr></thead><tbody>' + c.data.spans.map(s => '<tr><td class="trunc">' + esc(s.text) + '</td><td>' + esc(s.label) + '</td><td>[' + s.start + ', ' + s.end + ')</td></tr>').join('') + '</tbody></table></div>' : '<p class="msg">No spans were annotated. Submit this task as "nothing to label"?</p>') });
})(window.Alphex);
