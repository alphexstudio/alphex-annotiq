/* Reusable UI helpers: dialogs, confirm, pagination, formatting, empty/loading/error states. */
(function (A) {
  const U = A.util, esc = U.esc;
  const ANN = { text_annotation: [['text_classification', 'Text Classification'], ['ner', 'Named Entity Recognition'], ['span_annotation', 'Span Annotation'], ['multilabel_classification', 'Multi-label Text Classification']],
    image_annotation: [['image_classification', 'Image Classification'], ['bounding_boxes', 'Bounding Boxes'], ['polygon', 'Polygon Annotation'], ['segmentation', 'Image Segmentation']],
    ai_response_evaluation: [['single_response', 'Single Response Evaluation'], ['side_by_side', 'Side-by-Side Comparison'], ['rubric', 'Rubric-Based Evaluation'], ['ranking', 'Response Ranking']],
    multimodal_evaluation: [['multimodal', 'Multimodal Annotation']] };
  A.ui = {
    ANN,
    debounce: (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms || 250); }; },
    date: i => i ? new Date(i).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    bytes: n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB',
    ini: n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
    badge: (t, pk) => '<span class="badge' + (pk ? ' pk' : '') + '">' + esc(t) + '</span>',
    fld: (l, h) => '<label class="fld">' + esc(l) + h + '</label>',
    empty: (t, a) => '<div class="empty"><p>' + esc(t) + '</p>' + (a || '') + '</div>',
    fail: e => '<div class="empty" role="alert"><p>' + esc(e.message) + ' (' + esc(e.code || 'ERROR') + ')</p><button class="btn sec" type="button" data-act="retry">Retry</button></div>',
    skel: n => Array.from({ length: n }, () => '<div class="sk" style="height:44px;margin-bottom:8px"></div>').join(''),
    dialog(html, cls) { const d = document.createElement('dialog'); if (cls) d.className = cls; d.innerHTML = html; document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.showModal(); return d; },
    confirm(title, text, ok) {
      return new Promise(res => { const d = A.ui.dialog('<h2>' + esc(title) + '</h2><p class="mu">' + esc(text) + '</p><div class="acts"><button class="btn sec" value="0" type="button">Cancel</button><button class="btn pri" value="1" type="button">' + esc(ok || 'Delete') + '</button></div>'); let v = false;
        d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { v = b.value === '1'; d.close(); } }); d.addEventListener('close', () => res(v)); });
    },
    pager(el, o) {
      const n = Math.max(1, Math.ceil(o.total / o.limit));
      el.innerHTML = o.total ? '<span class="mu">' + ((o.page - 1) * o.limit + 1) + '-' + Math.min(o.page * o.limit, o.total) + ' of ' + o.total + '</span><span><button class="btn sec" type="button" data-p="' + (o.page - 1) + '"' + (o.page <= 1 ? ' disabled' : '') + '>Previous</button> <button class="btn sec" type="button" data-p="' + (o.page + 1) + '"' + (o.page >= n ? ' disabled' : '') + '>Next</button></span>' : '';
      el.onclick = e => { const b = e.target.closest('button[data-p]'); if (b && !b.disabled) o.onPage(+b.dataset.p); };
    }
  };
})(window.Alphex);
