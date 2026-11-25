/* Human evaluation plugin: single response, side-by-side (optionally blind/randomised), rubric and ranking. No AI model is involved. */
(function (A) {
  const U = A.util, esc = U.esc, M = A.model, E = A.evalui, $ = s => document.querySelector(s); let C = null, drag = null;
  const hash = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const shuffled = (ids, seed) => { const a = ids.slice(); let h = hash(seed); for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const R = id => C.task.payload.responses.find(r => r.id === id), L = i => String.fromCharCode(65 + i), ord = () => C.data.presented_order;
  const resp = (id, i) => { const r = R(id); return '<article class="resp"><h3>Response ' + L(i) + (!C.data.blind && r.model ? ' <span class="small">' + esc(r.model) + '</span>' : '') + '</h3>' + esc(r.text) + '</article>'; };
  function drawRank() {
    const o = C.data.ranking || ord(); $('#rk').innerHTML = o.map((id, i) => '<li draggable="' + !C.readOnly + '" data-id="' + esc(id) + '"><b>' + (i + 1) + '</b><div style="flex:1;white-space:pre-wrap"><span class="small">Response ' + L(ord().indexOf(id)) + (!C.data.blind && R(id).model ? ', ' + esc(R(id).model) : '') + '</span><br>' + esc(R(id).text) + '</div>' +
      (C.readOnly ? '' : '<span class="ra"><button class="btn ghost icon" type="button" data-mv="-1" data-id="' + esc(id) + '" aria-label="Move response ' + L(ord().indexOf(id)) + ' up"' + (i === 0 ? ' disabled' : '') + '>&#8593;</button><button class="btn ghost icon" type="button" data-mv="1" data-id="' + esc(id) + '" aria-label="Move response ' + L(ord().indexOf(id)) + ' down"' + (i === o.length - 1 ? ' disabled' : '') + '>&#8595;</button></span>') + '</li>').join('');
  }
  function drawSide() {
    const m = C.mode, d = C.data, rb = C.CFG.rubric; let h = '';
    if (m === 'single' || m === 'rubric') h = rb.dimensions.map(x => { const s = d.scores[x.id] || {}, many = rb.max - rb.min > 9;
      const sc = many ? '<input type="number" data-n="' + esc(x.id) + '" min="' + rb.min + '" max="' + rb.max + '" value="' + (s.score == null ? '' : s.score) + '" aria-label="' + esc(x.name) + ' score"' + (C.readOnly ? ' disabled' : '') + '>' : Array.from({ length: rb.max - rb.min + 1 }, (_, i) => rb.min + i).map(v => '<button type="button" data-d="' + esc(x.id) + '" data-v="' + v + '" aria-pressed="' + (s.score === v) + '"' + (C.readOnly ? ' disabled' : '') + '>' + v + '</button>').join('');
      return '<fieldset class="dim"><legend>' + esc(x.name) + '</legend><p class="small">' + esc(x.description) + '</p>' + (m === 'rubric' ? '<p class="small">Guidance: ' + esc(x.guidance) + '</p>' : '') + '<div class="sc" role="group" aria-label="' + esc(x.name) + ' score">' + sc + '</div>' + (m === 'rubric' ? '<label class="fld">Justification (optional)<textarea data-j="' + esc(x.id) + '"' + (C.readOnly ? ' disabled' : '') + '>' + esc(s.justification || '') + '</textarea></label>' : '') + '</fieldset>'; }).join('') + '<p class="small">Scale ' + rb.min + ' to ' + rb.max + '.</p>';
    if (m === 'side') h = '<h2>Which response is better?</h2><div class="lbls">' + [[ord()[0], 'Response A is better <kbd>A</kbd>'], [ord()[1], 'Response B is better <kbd>B</kbd>'], ['tie', 'Tie <kbd>T</kbd>'], ['both_poor', 'Both poor <kbd>P</kbd>']].map(([v, t]) => '<button type="button" class="lb" data-p="' + esc(v) + '" aria-pressed="' + (d.preferred === v) + '"' + (C.readOnly ? ' disabled' : '') + '>' + t + '</button>').join('') + '</div>';
    if (m === 'ranking') h = '<h2>Ranking</h2><p class="small">Drag items or use the arrow buttons. Rank 1 is best.</p><p>' + (d.ranking ? '<span class="badge pk">Ranking set</span>' : '<span class="badge">Not confirmed</span> ' + (C.readOnly ? '' : '<button class="btn sec" type="button" data-use>Use this order</button>')) + '</p>';
    $('#side').innerHTML = h + '<label class="fld">' + (m === 'ranking' ? 'Ranking rationale (optional)' : 'Rationale and evidence') + '<textarea id="rat"' + (C.readOnly ? ' disabled' : '') + '>' + esc(d.rationale || '') + '</textarea></label>';
  }
  function mount(c) {
    C = c; const p = c.task.payload, why = M.supports(c.P, p), o = c.data.presented_order; let h = '<section class="resp"><h3>Prompt</h3>' + esc(p.prompt) + '</section>' + (p.reference ? '<section class="resp"><h3>Reference answer</h3>' + esc(p.reference) + '</section>' : '');
    if (why) { c.blocked = true; $('#body').innerHTML = h + '<p class="msg">' + esc(why) + '</p>'; $('#side').innerHTML = ''; return; }
    if (c.mode === 'side') h += '<div class="cmp">' + o.slice(0, 2).map((id, i) => resp(id, i)).join('') + '</div>'; else if (c.mode === 'ranking') h += '<ol class="rk" id="rk"></ol>'; else h += resp(o[0], 0);
    $('#body').innerHTML = h; drawSide(); if (c.mode === 'ranking') drawRank();
    $('#side').onclick = e => { const b = e.target.closest('button'); if (!b || c.readOnly) return;
      if (b.dataset.d) { const s = c.data.scores[b.dataset.d] || (c.data.scores[b.dataset.d] = {}); s.score = +b.dataset.v; } else if (b.dataset.p) c.data.preferred = b.dataset.p; else if (b.hasAttribute('data-use')) c.data.ranking = o.slice(); else return; c.touch(); drawSide(); };
    $('#side').oninput = e => { const t = e.target; if (c.readOnly) return;
      if (t.id === 'rat') c.data.rationale = t.value; else if (t.dataset.j) (c.data.scores[t.dataset.j] || (c.data.scores[t.dataset.j] = {})).justification = t.value; else if (t.dataset.n) { const s = c.data.scores[t.dataset.n] || (c.data.scores[t.dataset.n] = {}); s.score = t.value === '' ? null : Number(t.value); } else return; c.touch(); };
    if (c.mode === 'ranking' && !c.readOnly) {
      const move = (id, to) => { const a = (c.data.ranking || o).slice(), i = a.indexOf(id); if (to < 0 || to >= a.length) return; a.splice(i, 1); a.splice(to, 0, id); c.data.ranking = a; c.touch(); drawRank(); drawSide(); };
      $('#rk').onclick = e => { const b = e.target.closest('[data-mv]'); if (b) { const a = c.data.ranking || o; move(b.dataset.id, a.indexOf(b.dataset.id) + +b.dataset.mv); } };
      $('#rk').ondragstart = e => { const li = e.target.closest('li'); if (li) { drag = li.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag); } };
      $('#rk').ondragover = e => { if (drag) e.preventDefault(); }; $('#rk').ondrop = e => { e.preventDefault(); const li = e.target.closest('li'); if (li && drag) move(drag, (c.data.ranking || o).indexOf(li.dataset.id)); drag = null; };
    }
  }
  document.addEventListener('keydown', e => {
    if (!C || !C.task || C.readOnly || C.mode !== 'side' || e.ctrlKey || e.metaKey || e.altKey) return; const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    const v = { a: C.data.presented_order[0], b: C.data.presented_order[1], t: 'tie', p: 'both_poor' }[e.key.toLowerCase()]; if (v) { C.data.preferred = v; C.touch(); drawSide(); }
  });
  A.ws.start({ title: 'AI Response Evaluation', ptype: 'ai_response_evaluation', modes: ['single', 'side', 'rubric', 'ranking'], who: 'Evaluator', svc: A.evaluations, mount,
    keys: '<dt><kbd>A</kbd> <kbd>B</kbd> <kbd>T</kbd> <kbd>P</kbd></dt><dd>Side-by-side: A better, B better, Tie, Both poor</dd>', instr: c => c.CFG.rubric.instructions ? '<p style="white-space:pre-wrap">' + esc(c.CFG.rubric.instructions) + '</p>' : '',
    init: (t, c) => { const d = t.evaluation && t.evaluation.evaluation_data; if (d) return JSON.parse(JSON.stringify(d)); const ids = t.payload.responses.map(r => r.id); return { scores: {}, preferred: null, ranking: null, rationale: '', blind: !!c.CFG.blind, presented_order: c.CFG.randomize ? shuffled(ids, t.id) : ids }; },
    validate: (P, t, d, s) => M.vEvaluation(P, t.payload, d, s), summary: c => (c.data.blind ? '<p class="small">Blind mode: model identities are hidden from you and stored with the result.</p>' : '') + E.summary(c.P, c.task.payload, c.data, false) });
})(window.Alphex);
