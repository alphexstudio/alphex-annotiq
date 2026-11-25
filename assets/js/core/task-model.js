/* Shared task model: workspace config defaults, record-to-task mapping and validators.
   Used by the UI and by the mock adapter (stand-in for backend rules). A real backend MUST re-implement these checks.
   Offsets are zero-based, end-exclusive UTF-16 code-unit indexes (JavaScript string indexes). */
(function (A) {
  const ENT = ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME', 'MONEY', 'PRODUCT', 'OTHER'];
  const DIMS = [['factuality', 'Factuality', 'Are the claims accurate and verifiable?', 'Check specific facts against the reference or trusted knowledge.'], ['instruction_following', 'Instruction Following', 'Does the response do what the prompt asked?', 'Check format, constraints and every explicit request.'],
    ['relevance', 'Relevance', 'Does it stay on topic?', 'Penalise content unrelated to the prompt.'], ['completeness', 'Completeness', 'Does it cover everything needed?', 'Look for missing parts of a multi-part request.'],
    ['safety', 'Safety', 'Is it free of harmful or unsafe content?', 'Flag harmful instructions, hate, or private data.'], ['fluency', 'Fluency', 'Is it well written?', 'Grammar, tone and readability.']];
  const MODE = { text_classification: 'cls', multilabel_classification: 'cls', ner: 'ner', span_annotation: 'span', single_response: 'single', side_by_side: 'side', rubric: 'rubric', ranking: 'ranking' };
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const mode = p => MODE[p && p.annotation_type] || null, int = (v, d) => Number.isInteger(v) ? v : d;
  function config(p) { /* backward compatible: Phase 2 projects have no p.config */
    const c = p.config || {}, at = p.annotation_type, r = c.rubric || {};
    const labels = c.labels && c.labels.length ? c.labels : (mode(p) === 'cls' ? ['Positive', 'Neutral', 'Negative'] : at === 'span_annotation' ? ['Claim', 'Evidence', 'Other'] : ENT);
    return { labels: labels.map(x => typeof x === 'string' ? x : x.name), selection: c.selection || (at === 'multilabel_classification' ? 'multi' : 'single'), blind: !!c.blind, randomize: !!c.randomize, assignment: c.assignment || 'self',
      rubric: { min: int(r.min, 1), max: int(r.max, 5), instructions: r.instructions || '', dimensions: r.dimensions && r.dimensions.length ? r.dimensions : DIMS.map(([id, name, description, guidance]) => ({ id, name, description, guidance })) } };
  }
  function vConfig(c) {
    const e = []; if (!c || typeof c !== 'object') return ['Config must be an object.'];
    if (c.labels !== undefined) { if (!Array.isArray(c.labels) || c.labels.length > 50) e.push('Provide up to 50 labels.'); else { const n = c.labels.map(x => typeof x === 'string' ? x.trim() : '');
      if (n.some(x => !x || x.length > 50)) e.push('Labels must be 1-50 characters.'); if (new Set(n.map(x => x.toLowerCase())).size !== n.length) e.push('Label names must be unique.'); } }
    if (c.selection !== undefined && !['single', 'multi'].includes(c.selection)) e.push('Selection must be single or multi.');
    if (c.assignment !== undefined && !['self', 'manual'].includes(c.assignment)) e.push('Assignment must be self or manual.');
    const r = c.rubric; if (r) { if (!Number.isInteger(r.min) || !Number.isInteger(r.max) || r.min < 0 || r.max > 100 || r.min >= r.max) e.push('Scale needs whole numbers with 0 <= min < max <= 100.');
      if (r.dimensions !== undefined) { const d = r.dimensions; if (!Array.isArray(d) || !d.length || d.length > 20) e.push('Provide 1-20 scoring dimensions.'); else { if (d.some(x => !x || !String(x.name || '').trim() || String(x.name).length > 60)) e.push('Each dimension needs a name (60 characters max).'); if (new Set(d.map(x => x && x.id)).size !== d.length) e.push('Dimension names must be unique.'); } } }
    return e;
  }
  const pick = (d, ks) => { for (const k of ks) if (typeof d[k] === 'string' && d[k].trim()) return k; return null; };
  const textPayload = d => { const k = pick(d, ['text', 'content', 'sentence', 'body', 'review', 'message']) || Object.keys(d).find(x => typeof d[x] === 'string' && d[x].trim()); return k ? { field: k, text: d[k] } : null; };
  function evalPayload(d) {
    const pk = pick(d, ['prompt', 'question', 'instruction', 'input', 'query']), rk = Object.keys(d).filter(k => /^(response|answer|output|completion)/i.test(k) && typeof d[k] === 'string' && d[k].trim()), ref = pick(d, ['reference', 'reference_answer', 'ideal_answer', 'ground_truth']);
    if (!pk || !rk.length) return null;
    return { prompt: d[pk], reference: ref ? d[ref] : null, responses: rk.map(k => ({ id: 'resp_' + slug(k), field: k, text: d[k], model: d['model_' + k.replace(/^[a-z]+_/i, '')] || null })) };
  }
  function vAnnotation(p, text, d, submit) {
    const c = config(p), m = mode(p), e = []; d = d || {};
    if (m === 'cls') { const L = d.labels; if (!Array.isArray(L)) return ['labels must be a list.'];
      if (new Set(L).size !== L.length) e.push('Duplicate labels are not allowed.'); L.forEach(l => { if (!c.labels.includes(l)) e.push('Unknown label "' + l + '".'); });
      if (c.selection === 'single' && L.length > 1) e.push('Only one label is allowed.'); if (submit && !L.length) e.push('Select at least one label.'); }
    else if (m === 'ner' || m === 'span') { const S = d.spans; if (!Array.isArray(S)) return ['spans must be a list.']; const s = S.slice().sort((a, b) => a.start - b.start);
      s.forEach((x, i) => { const n = 'Span ' + (i + 1) + ': ';
        if (!Number.isInteger(x.start) || !Number.isInteger(x.end) || x.start < 0 || x.end > text.length || x.start >= x.end) { e.push(n + 'invalid offsets.'); return; }
        if (text.slice(x.start, x.end) !== x.text) e.push(n + 'text does not match its offsets.'); if (i && Number.isInteger(s[i - 1].end) && s[i - 1].end > x.start) e.push(n + 'overlaps the previous span.');
        if (!c.labels.includes(x.label)) e.push(n + 'unknown label "' + x.label + '".'); });
      if (new Set(S.map(x => x.id)).size !== S.length) e.push('Span ids must be unique.'); }
    else e.push('This project is not a text annotation project.');
    return e;
  }
  const supports = (p, pl) => { const m = mode(p), n = pl.responses.length; return m === 'side' && n < 2 ? 'Side-by-side comparison needs at least 2 responses in the record.' : m === 'ranking' && n < 3 ? 'Ranking needs at least 3 responses in the record.' : null; };
  function vEvaluation(p, pl, d, submit) {
    const c = config(p), m = mode(p), ids = pl.responses.map(r => r.id), e = []; d = d || {}; const R = c.rubric;
    if (m === 'single' || m === 'rubric') R.dimensions.forEach(x => { const s = (d.scores || {})[x.id];
      if (s && s.score != null) { if (!Number.isInteger(s.score) || s.score < R.min || s.score > R.max) e.push(x.name + ': score must be a whole number from ' + R.min + ' to ' + R.max + '.'); } else if (submit) e.push(x.name + ': a score is required.');
      if (s && typeof s.justification === 'string' && s.justification.length > 2000) e.push(x.name + ': justification is too long.'); });
    else if (m === 'side') { if (d.preferred != null && ![ids[0], ids[1], 'tie', 'both_poor'].includes(d.preferred)) e.push('Invalid preference.'); if (submit && d.preferred == null) e.push('Choose a preferred response, Tie or Both poor.'); }
    else if (m === 'ranking') { const r = d.ranking; if (r != null) { if (!Array.isArray(r) || new Set(r).size !== r.length || r.some(x => !ids.includes(x))) e.push('Ranking must list each response once.'); else if (submit && r.length !== ids.length) e.push('Rank every response.'); } else if (submit) e.push('A ranking is required.'); }
    else e.push('This project is not an evaluation project.');
    if (d.rationale != null && (typeof d.rationale !== 'string' || d.rationale.length > 5000)) e.push('Rationale must be text of at most 5000 characters.');
    return e;
  }
  A.model = { ENT, DIMS, mode, config, vConfig, textPayload, evalPayload, vAnnotation, vEvaluation, supports, slug };
})(window.Alphex);
