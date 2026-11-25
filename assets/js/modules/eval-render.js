/* Read-only rendering of evaluation data, shared by the submit review screen and the review queue. */
(function (A) {
  const esc = A.util.esc, M = A.model;
  function summary(P, pl, d, reveal) {
    const m = M.mode(P), C = M.config(P), ord = d.presented_order || pl.responses.map(r => r.id), R = id => pl.responses.find(r => r.id === id) || {};
    const L = id => 'Response ' + String.fromCharCode(65 + Math.max(0, ord.indexOf(id))) + (reveal && R(id).model ? ' (' + esc(R(id).model) + ')' : ''); let h = '';
    if (m === 'single' || m === 'rubric') h += '<div class="scroll"><table class="tbl"><thead><tr><th>Dimension</th><th>Score</th><th>Justification</th></tr></thead><tbody>' + C.rubric.dimensions.map(x => { const s = (d.scores || {})[x.id] || {}; return '<tr><td>' + esc(x.name) + '</td><td>' + (s.score == null ? '-' : s.score + ' / ' + C.rubric.max) + '</td><td class="trunc">' + esc(s.justification || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (m === 'side') h += '<p><b>Preferred:</b> ' + (d.preferred === 'tie' ? 'Tie' : d.preferred === 'both_poor' ? 'Both poor' : d.preferred ? L(d.preferred) : '-') + '</p>';
    if (m === 'ranking') h += '<ol>' + (d.ranking || []).map(id => '<li>' + L(id) + '</li>').join('') + '</ol>';
    return h + '<p><b>Rationale:</b> ' + esc(d.rationale || 'None') + '</p>';
  }
  function detail(P, t, d) {
    const pl = t.payload, ord = d.presented_order || pl.responses.map(r => r.id);
    return '<section class="resp"><h3>Prompt</h3>' + esc(pl.prompt) + '</section>' + (pl.reference ? '<section class="resp"><h3>Reference answer</h3>' + esc(pl.reference) + '</section>' : '') +
      ord.map((id, i) => { const r = pl.responses.find(x => x.id === id); return r ? '<section class="resp"><h3>Response ' + String.fromCharCode(65 + i) + ' <span class="small">' + esc(r.id) + (r.model ? ', ' + esc(r.model) : '') + (d.blind ? ', blind mode' : '') + '</span></h3>' + esc(r.text) + '</section>' : ''; }).join('') + summary(P, pl, d, true);
  }
  A.evalui = { summary, detail };
})(window.Alphex);
