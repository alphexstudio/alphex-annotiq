/* Browser-side parsing and validation for CSV, JSON and JSONL. Files never leave the browser here.
   The backend must re-validate every upload; this is a convenience preview, not a trust boundary. */
(function (A) {
  const EXT = ['csv', 'json', 'jsonl'], miss = v => v == null || (typeof v === 'string' && v.trim() === '');
  function csv(t) {
    const rows = []; let r = [], f = '', q = false;
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; } else f += c; }
    if (f !== '' || r.length) { r.push(f); rows.push(r); }
    return { rows, unclosed: q };
  }
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  function parse(text, ext) {
    const issues = [], add = (level, message) => issues.push({ level, message }); let recs = [];
    text = String(text).replace(/^\uFEFF/, '');
    if (!EXT.includes(ext)) add('error', 'Unsupported format ".' + ext + '". Use CSV, JSON or JSONL.');
    else if (!text.trim()) add('error', 'The file is empty.');
    else if (ext === 'csv') {
      const p = csv(text), rows = p.rows, head = (rows.shift() || []).map(h => h.trim()); let bad = 0, blank = 0;
      if (p.unclosed) add('warning', 'A quoted value is never closed; later rows may be merged.');
      if (head.some(h => !h)) add('warning', 'The header row contains empty column names.');
      if (new Set(head).size < head.length) add('warning', 'The header row has duplicate column names; later values overwrite earlier ones.');
      rows.forEach((r, i) => { if (r.every(c => c.trim() === '')) { blank++; return; }
        if (r.length !== head.length && ++bad <= 5) add('warning', 'Row ' + (i + 2) + ' has ' + r.length + ' columns, expected ' + head.length + '.');
        const o = {}; head.forEach((h, j) => { o[h || 'column_' + (j + 1)] = r[j] === undefined ? '' : r[j]; }); recs.push(o); });
      if (bad > 5) add('warning', (bad - 5) + ' more rows have an inconsistent column count.');
      if (blank) add('warning', blank + ' blank row(s) were skipped.');
    } else if (ext === 'json') {
      let j, ok = true; try { j = JSON.parse(text); } catch (e) { ok = false; add('error', 'Invalid JSON: ' + e.message); }
      if (ok) { if (!Array.isArray(j)) add('error', 'JSON must be an array of records.'); else { let n = 0; j.forEach((x, i) => { if (isObj(x)) recs.push(x); else if (++n <= 5) add('warning', 'Item ' + (i + 1) + ' is not an object and was skipped.'); }); if (n > 5) add('warning', (n - 5) + ' more items were skipped.'); } }
    } else {
      let bad = 0, skip = 0;
      text.split(/\r?\n/).forEach((l, i) => { if (!l.trim()) return; let j; try { j = JSON.parse(l); } catch (e) { if (++bad <= 5) add('warning', 'Line ' + (i + 1) + ' is not valid JSON.'); return; }
        if (isObj(j)) recs.push(j); else if (++skip <= 5) add('warning', 'Line ' + (i + 1) + ' is not a JSON object and was skipped.'); });
      if (bad > 5) add('warning', (bad - 5) + ' more lines are not valid JSON.');
    }
    const n0 = recs.length; recs = recs.filter(r => Object.values(r).some(v => !miss(v)));
    if (n0 - recs.length) add('warning', (n0 - recs.length) + ' empty record(s) were removed.');
    const cs = new Set(); recs.forEach(r => Object.keys(r).forEach(k => cs.add(k)));
    const columns = [...cs], mc = columns.map(c => [c, recs.reduce((n, r) => n + (miss(r[c]) ? 1 : 0), 0)]).filter(x => x[1]);
    mc.slice(0, 5).forEach(([c, n]) => add('warning', 'Column "' + c + '" has ' + n + ' missing value' + (n > 1 ? 's' : '') + '.'));
    if (mc.length > 5) add('warning', (mc.length - 5) + ' more columns have missing values.');
    if (!recs.length && !issues.some(i => i.level === 'error')) add('error', 'No valid records found.');
    return { format: ext, records: recs, columns, issues, status: issues.some(i => i.level === 'error') ? 'errors' : issues.length ? 'warnings' : 'valid' };
  }
  function schema(recs) {
    const cs = new Set(); recs.forEach(r => Object.keys(r).forEach(k => cs.add(k)));
    return [...cs].map(c => { let m = 0; const ts = new Set();
      recs.forEach(r => { const v = r[c]; if (miss(v)) m++; else ts.add(typeof v === 'string' ? (isNaN(v) ? 'string' : 'number') : Array.isArray(v) ? 'array' : typeof v); });
      return { name: c, type: ts.size > 1 ? 'mixed' : [...ts][0] || 'empty', missing: m }; });
  }
  A.parser = { parse, schema };
})(window.Alphex);
