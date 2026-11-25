/* Dataset upload wizard (6 steps) and metadata editor. Parsing happens in the browser; see dataset-parser.js. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, mock = A.config.MODE === 'mock';
  const TY = [['text', 'Text'], ['image_manifest', 'Image manifest'], ['ai_responses', 'AI responses'], ['multimodal', 'Multimodal'], ['other', 'Other']];
  const STEPS = ['Select project', 'Upload file', 'Configure dataset', 'Preview records', 'Validation', 'Confirm'];
  const opts = (a, v) => a.map(([k, l]) => '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  const pOpts = (ps, v) => opts([['', 'No project (unassigned)']].concat(ps.map(p => [p.id, p.name])), v || '');
  const tagsOf = s => [...new Set(String(s).split(',').map(x => x.trim()).filter(Boolean))].slice(0, 10);
  const cell = v => esc(String(v && typeof v === 'object' ? JSON.stringify(v) : v == null ? '' : v).slice(0, 60));
  async function upload(pre) {
    const st = { n: 1, project_id: pre || '', file: null, res: null, name: '', description: '', dataset_type: 'text', tags: '' }, d = ui.dialog('<div></div>', 'wide'), w = d.firstChild; let ps = [], perr = '';
    try { ps = await A.projects.list({ organization_id: A.state.get('org'), limit: 100 }); } catch (e) { perr = 'Could not load projects: ' + e.message; }
    const msg = t => { const m = w.querySelector('#wm'); if (m) m.textContent = t; };
    const body = [() => ui.fld('Project', '<select id="wp">' + pOpts(ps, st.project_id) + '</select>') + '<p class="small">Optional. You can change the association later.</p>' + (perr ? '<p class="msg">' + esc(perr) + '</p>' : ''),
      () => '<div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a file">' + (st.file ? '<b>' + esc(st.file.name) + '</b><br>' + ui.bytes(st.file.size) + ', ' + st.res.records.length + ' records parsed' : 'Drop a CSV, JSON or JSONL file here, or click to choose') + '</div><input id="wf" type="file" accept=".csv,.json,.jsonl" hidden><p class="small">' + (mock ? 'Mock mode: the file is parsed in your browser and never uploaded. ' : '') + 'Maximum size ' + ui.bytes(A.config.MAX_UPLOAD_BYTES) + '.</p>',
      () => ui.fld('Dataset name', '<input id="wn" maxlength="120" value="' + esc(st.name) + '">') + ui.fld('Description', '<textarea id="wd">' + esc(st.description) + '</textarea>') + '<div class="two">' + ui.fld('Dataset type', '<select id="wt">' + opts(TY, st.dataset_type) + '</select>') + ui.fld('Tags (optional, comma separated)', '<input id="wg" value="' + esc(st.tags) + '">') + '</div>',
      () => { const r = st.res, cols = r.columns.slice(0, 8); return r.records.length ? '<div class="scroll"><table class="tbl"><thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + r.records.slice(0, 10).map(x => '<tr>' + cols.map(c => '<td class="trunc">' + cell(x[c]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="small">First ' + Math.min(10, r.records.length) + ' of ' + r.records.length + ' records' + (r.columns.length > 8 ? ', first 8 of ' + r.columns.length + ' columns' : '') + '.</p>' : ui.empty('No records to preview.'); },
      () => { const r = st.res; return ui.badge(r.status === 'errors' ? 'Errors found' : r.status === 'warnings' ? 'Passed with warnings' : 'Valid', r.status === 'valid') + '<p class="mu" style="margin-top:8px">' + r.records.length + ' records, ' + r.columns.length + ' columns, ' + r.issues.length + ' issue(s).</p>' + (r.issues.length ? '<ul class="iss">' + r.issues.map(i => '<li class="' + i.level + '">' + esc(i.level) + ': ' + esc(i.message) + '</li>').join('') + '</ul>' : '<p class="mu">No problems found.</p>'); },
      () => { const r = st.res, p = ps.find(x => x.id === st.project_id); return '<dl class="kv"><dt>Dataset name</dt><dd>' + esc(st.name) + '</dd><dt>Project</dt><dd>' + esc(p ? p.name : 'Unassigned') + '</dd><dt>File</dt><dd>' + esc(st.file.name) + ' (' + ui.bytes(st.file.size) + ', ' + r.format.toUpperCase() + ')</dd><dt>Records</dt><dd>' + r.records.length + '</dd><dt>Type</dt><dd>' + esc(st.dataset_type) + '</dd><dt>Tags</dt><dd>' + esc(tagsOf(st.tags).join(', ') || 'None') + '</dd><dt>Validation</dt><dd>' + esc(r.status) + '</dd></dl>' + (mock ? '<p class="small">Mock mode: metadata is stored in this browser. Records stay in memory and are cleared when you reload.</p>' : ''); }];
    function render() {
      const n = st.n; w.innerHTML = '<h2>Upload dataset</h2><div class="steps">' + STEPS.map((_, i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('') + '</div><p class="small">Step ' + n + ' of 6: ' + STEPS[n - 1] + '</p>' + body[n - 1]() +
        '<p class="msg" id="wm" role="alert"></p><div class="acts"><button class="btn sec" type="button" data-a="cancel">Cancel</button>' + (n > 1 ? '<button class="btn sec" type="button" data-a="back">Back</button>' : '') + '<button class="btn pri" type="button" data-a="next">' + (n === 6 ? 'Save dataset' : 'Continue') + '</button></div>';
      if (n === 2) { const dz = w.querySelector('#drop'), fi = w.querySelector('#wf'); dz.onclick = () => fi.click(); dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } };
        fi.onchange = () => fi.files[0] && take(fi.files[0]); dz.ondragover = e => { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = () => dz.classList.remove('on'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('on'); e.dataTransfer.files[0] && take(e.dataTransfer.files[0]); }; }
    }
    async function take(f) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!['csv', 'json', 'jsonl'].includes(ext)) return msg('Unsupported format. Use CSV, JSON or JSONL.');
      if (f.size > A.config.MAX_UPLOAD_BYTES) return msg('The file is larger than ' + ui.bytes(A.config.MAX_UPLOAD_BYTES) + '.');
      msg('Reading file...'); try { st.res = A.parser.parse(await f.text(), ext); st.file = f; if (!st.name) st.name = f.name.replace(/\.[^.]+$/, ''); render(); } catch (e) { msg('Could not read the file: ' + e.message); }
    }
    async function save(btn) {
      const r = st.res; btn.disabled = true;
      try { await A.datasets.create({ name: st.name, description: st.description, dataset_type: st.dataset_type, tags: tagsOf(st.tags), project_id: st.project_id || null, organization_id: A.state.get('org'), file_name: st.file.name, format: r.format, size_bytes: st.file.size, record_count: r.records.length,
          schema: A.parser.schema(r.records), validation: { status: r.status, issues: r.issues.slice(0, 50), checked_at: new Date().toISOString() } }, st.file, r.records);
        d.close(); U.toast('Dataset created.'); document.dispatchEvent(new CustomEvent('alphex:dataset-saved')); } catch (e) { msg(e.message); btn.disabled = false; }
    }
    w.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, v = s => w.querySelector(s) && w.querySelector(s).value;
      if (a === 'cancel') return d.close(); if (a === 'back') { st.n--; return render(); }
      if (st.n === 1) st.project_id = v('#wp'); if (st.n === 2 && !st.file) return msg('Choose a file to continue.');
      if (st.n === 3) { st.name = v('#wn').trim(); st.description = v('#wd'); st.dataset_type = v('#wt'); st.tags = v('#wg'); if (!st.name) return msg('Dataset name is required.'); }
      if (st.n === 5 && st.res.status === 'errors') return msg('Fix the errors in the file and upload it again.');
      if (st.n === 6) return save(b); st.n++; render(); });
    render();
  }
  async function edit(ds) {
    let ps = []; try { ps = await A.projects.list({ organization_id: ds.organization_id, limit: 100 }); } catch (e) {}
    if (ds.project_id && !ps.some(p => p.id === ds.project_id)) ps.push({ id: ds.project_id, name: ds.project_name || ds.project_id });
    const d = ui.dialog('<form><h2>Edit dataset</h2>' + ui.fld('Dataset name', '<input name="name" required maxlength="120" value="' + esc(ds.name) + '">') + ui.fld('Description', '<textarea name="description">' + esc(ds.description || '') + '</textarea>') +
      '<div class="two">' + ui.fld('Dataset type', '<select name="dataset_type">' + opts(TY, ds.dataset_type) + '</select>') + ui.fld('Project', '<select name="project_id">' + pOpts(ps, ds.project_id) + '</select>') + '</div>' + ui.fld('Tags (comma separated)', '<input name="tags" value="' + esc((ds.tags || []).join(', ')) + '">') +
      '<p class="msg" role="alert"></p><div class="acts"><button class="btn sec" type="button" data-x>Cancel</button><button class="btn pri" type="submit">Save changes</button></div></form>'), f = d.querySelector('form'), msg = f.querySelector('.msg');
    f.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = async e => { e.preventDefault(); const x = Object.fromEntries(new FormData(f)); x.tags = tagsOf(x.tags); const b = f.querySelector('[type=submit]'); b.disabled = true;
      try { await A.datasets.update(ds.id, x); d.close(); U.toast('Dataset saved.'); document.dispatchEvent(new CustomEvent('alphex:dataset-saved')); } catch (err) { msg.textContent = err.message; b.disabled = false; } };
  }
  A.datasetForms = { upload, edit };
})(window.Alphex);
