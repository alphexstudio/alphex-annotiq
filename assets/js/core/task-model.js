/* Shared task model: workspace config defaults, record-to-task mapping and validators.
   Used by the UI and by the mock adapter (stand-in for backend rules). A real backend MUST re-implement these checks.
   Offsets are zero-based, end-exclusive UTF-16 code-unit indexes (JavaScript string indexes). */
(function (A) {
  const ENT = ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME', 'MONEY', 'PRODUCT', 'OTHER'];
  const DIMS = [['factuality', 'Factuality', 'Are the claims accurate and verifiable?', 'Check specific facts against the reference or trusted knowledge.'], ['instruction_following', 'Instruction Following', 'Does the response do what the prompt asked?', 'Check format, constraints and every explicit request.'],
    ['relevance', 'Relevance', 'Does it stay on topic?', 'Penalise content unrelated to the prompt.'], ['completeness', 'Completeness', 'Does it cover everything needed?', 'Look for missing parts of a multi-part request.'],
    ['safety', 'Safety', 'Is it free of harmful or unsafe content?', 'Flag harmful instructions, hate, or private data.'], ['fluency', 'Fluency', 'Is it well written?', 'Grammar, tone and readability.']];
  const IMG = ['icls', 'bbox', 'poly', 'point', 'seg'], PAL = ['#ea005a', '#ff7aa9', '#f5a524', '#2dd4bf', '#a78bfa', '#60a5fa', '#facc15', '#fb7185', '#94a3b8', '#ffffff'];
  const MODE = { image_classification: 'icls', bounding_boxes: 'bbox', polygon: 'poly', point_annotation: 'point', segmentation: 'seg', text_classification: 'cls', multilabel_classification: 'cls', ner: 'ner', span_annotation: 'span', single_response: 'single', side_by_side: 'side', rubric: 'rubric', ranking: 'ranking' };
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const mode = p => MODE[p && p.annotation_type] || null, int = (v, d) => Number.isInteger(v) ? v : d;
  function config(p) { /* backward compatible: older projects have no p.config. Labels may be strings (text) or objects {id,name,description,color,created_at} (image). */
    const c = p.config || {}, at = p.annotation_type, m = mode(p), r = c.rubric || {};
    const dflt = m === 'cls' ? ['Positive', 'Neutral', 'Negative'] : at === 'span_annotation' ? ['Claim', 'Evidence', 'Other'] : m === 'icls' ? ['Good', 'Defective', 'Unclear'] : IMG.includes(m) ? ['Object', 'Person', 'Vehicle', 'Other'] : ENT;
    const objs = (c.labels && c.labels.length ? c.labels : dflt).map((x, i) => { const o = typeof x === 'string' ? { name: x } : x; return { id: o.id || 'lbl_' + slug(o.name), name: o.name, description: o.description || '', color: o.color || PAL[i % PAL.length], created_at: o.created_at || null }; });
    return { labels: objs.map(o => o.name), label_objs: objs, min_box_px: Number.isFinite(c.min_box_px) ? c.min_box_px : 2, selection: c.selection || (at === 'multilabel_classification' ? 'multi' : 'single'), blind: !!c.blind, randomize: !!c.randomize, assignment: c.assignment || 'self',
      rubric: { min: int(r.min, 1), max: int(r.max, 5), instructions: r.instructions || '', dimensions: r.dimensions && r.dimensions.length ? r.dimensions : DIMS.map(([id, name, description, guidance]) => ({ id, name, description, guidance })) } };
  }
  function vConfig(c) {
    const e = []; if (!c || typeof c !== 'object') return ['Config must be an object.'];
    if (c.labels !== undefined) { if (!Array.isArray(c.labels) || c.labels.length > 50) e.push('Provide up to 50 labels.'); else { const n = c.labels.map(x => typeof x === 'string' ? x.trim() : (x && typeof x.name === 'string' ? x.name.trim() : '')); c.labels.forEach(x => { if (x && typeof x === 'object') { if (x.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(x.color)) e.push('Label colors must be #rrggbb.'); if (x.description !== undefined && String(x.description).length > 200) e.push('Label descriptions are limited to 200 characters.'); } }); if (c.labels.every(x => x && typeof x === 'object') && new Set(c.labels.map(x => x.id)).size !== c.labels.length) e.push('Label ids must be unique.');
      if (n.some(x => !x || x.length > 50)) e.push('Labels must be 1-50 characters.'); if (new Set(n.map(x => x.toLowerCase())).size !== n.length) e.push('Label names must be unique.'); } }
    if (c.selection !== undefined && !['single', 'multi'].includes(c.selection)) e.push('Selection must be single or multi.');
    if (c.assignment !== undefined && !['self', 'manual'].includes(c.assignment)) e.push('Assignment must be self or manual.');
    if (c.min_box_px !== undefined && !(Number.isFinite(c.min_box_px) && c.min_box_px >= 0 && c.min_box_px <= 100)) e.push('Minimum box size must be 0-100 pixels.');
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
  function imagePayload(d) {
    const k = pick(d, ['image_path', 'image', 'image_url', 'path', 'url', 'file']); if (!k) return null; const v = d[k], w = parseInt(d.width, 10), h = parseInt(d.height, 10); if (!(w > 0 && h > 0)) return null;
    let source = 'url', ref = v; if (/^asset:/.test(v)) { source = 'asset'; ref = v.slice(6); } else if (/^demo:/.test(v)) { source = 'demo'; ref = v.slice(5); } else if (!/^(https:\/\/|[\w.\/-]+$)/.test(v)) return null;
    return { image: { source, ref, filename: String(d.filename || d.file_name || v.split('/').pop()).slice(0, 200), width: w, height: h, size_bytes: Number(d.size_bytes) || null } };
  }
  function vImage(p, img, d, submit) {
    const c = config(p), m = mode(p), e = [], G = A.geo; d = d || {}; const ids = c.label_objs.map(l => l.id), iw = img.width, ih = img.height;
    if (m === 'icls') { const L = (d.classification || {}).label_ids; if (!Array.isArray(L)) return ['classification.label_ids must be a list.'];
      if (new Set(L).size !== L.length) e.push('Duplicate labels are not allowed.'); L.forEach(l => { if (!ids.includes(l)) e.push('Unknown label.'); });
      if (c.selection === 'single' && L.length > 1) e.push('Only one label is allowed.'); if (submit && !L.length) e.push('Select at least one label.'); return e; }
    const O = d.objects; if (!Array.isArray(O) || O.length > 500) return ['objects must be a list of at most 500 items.'];
    const want = { bbox: 'bbox', poly: 'polygon', point: 'point', seg: null }[m]; if (new Set(O.map(o => o && o.id)).size !== O.length) e.push('Object ids must be unique.');
    O.forEach((o, i) => { const n = 'Object ' + (i + 1) + ': '; if (!o || typeof o !== 'object') { e.push(n + 'invalid.'); return; }
      if (o.type !== want) { e.push(n + 'type "' + o.type + '" is not allowed in this project.'); return; } if (!ids.includes(o.label_id)) e.push(n + 'unknown label.');
      if (o.confidence != null && !(o.confidence >= 0 && o.confidence <= 1)) e.push(n + 'confidence must be between 0 and 1.');
      if (o.type === 'bbox') { const x = o.x, y = o.y, w = o.w, h = o.h; if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) e.push(n + 'width and height must be positive.');
        else if (!G.inUnit(x) || !G.inUnit(y) || x + w > 1 + 1e-9 || y + h > 1 + 1e-9) e.push(n + 'box is outside the image.'); else if (w * iw < c.min_box_px || h * ih < c.min_box_px) e.push(n + 'box is smaller than the minimum size (' + c.min_box_px + ' px).'); }
      else if (o.type === 'polygon') { const P = o.points; if (!Array.isArray(P) || P.length < 3 || P.length > 1000) e.push(n + 'a polygon needs 3 to 1000 vertices.'); else if (!P.every(q => q && G.inUnit(q.x) && G.inUnit(q.y))) e.push(n + 'vertices must be inside the image.');
        else if (G.distinct(P) < 3) e.push(n + 'a polygon needs 3 distinct vertices.'); else if (G.area(P) * iw * ih < 1) e.push(n + 'polygon has no area.'); }
      else if (!G.inUnit(o.x) || !G.inUnit(o.y)) e.push(n + 'point is outside the image.'); });
    if (d.mask != null) { const k = d.mask; if (m !== 'seg') e.push('Masks are only allowed in segmentation projects.');
      else if (!Number.isInteger(k.width) || !Number.isInteger(k.height) || k.width < 1 || k.height < 1 || k.width > 4096 || k.height > 4096 || !Array.isArray(k.classes) || new Set(k.classes).size !== k.classes.length || k.classes.length > 254 || k.classes.some(x => !ids.includes(x)) || typeof k.key !== 'string') e.push('Invalid mask metadata.'); }
    return e;
  }
  A.model = { ENT, DIMS, IMG, PAL, mode, config, vConfig, textPayload, evalPayload, imagePayload, vImage, vAnnotation, vEvaluation, supports, slug };
})(window.Alphex);
