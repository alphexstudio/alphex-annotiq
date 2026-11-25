(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons();
  const S = { q: '', project_id: '', format: '', status: '', sort: 'created_at', order: 'desc', page: 1 }, LIM = 10; let rows = [];
  const acts = d => '<span class="ra"><a class="btn ghost icon" href="dataset.html?id=' + esc(d.id) + '" aria-label="View ' + esc(d.name) + '"><i data-lucide="eye"></i></a><button class="btn ghost icon" type="button" data-act="edit" data-id="' + esc(d.id) + '" aria-label="Edit ' + esc(d.name) + '"><i data-lucide="pencil"></i></button><button class="btn ghost icon" type="button" data-act="delete" data-id="' + esc(d.id) + '" aria-label="Delete ' + esc(d.name) + '"><i data-lucide="trash-2"></i></button></span>';
  const table = l => '<div class="scroll"><table class="tbl"><thead><tr><th>Dataset</th><th>Project</th><th>File</th><th>Format</th><th>Records</th><th>Type</th><th>Size</th><th>Uploaded</th><th>By</th><th>Validation</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
    l.map(d => '<tr><td><a class="lnk" href="dataset.html?id=' + esc(d.id) + '">' + esc(d.name) + '</a><div class="small">' + esc(d.id) + '</div></td><td>' + (d.project_id ? '<a href="project.html?id=' + esc(d.project_id) + '">' + esc(d.project_name || d.project_id) + '</a>' : '<span class="small">Unassigned</span>') + '</td><td class="trunc">' + esc(d.file_name) + '</td><td>' + esc(d.format.toUpperCase()) + '</td><td>' + d.record_count + '</td><td>' + esc(d.dataset_type) + '</td><td>' + ui.bytes(d.size_bytes) + '</td><td>' + ui.date(d.created_at) + '</td><td>' + esc(d.uploaded_by_name) + '</td><td>' + ui.badge(d.validation.status, d.validation.status === 'valid') + '</td><td>' + acts(d) + '</td></tr>').join('') + '</tbody></table></div>';
  async function load() {
    const el = $('#list'); el.innerHTML = ui.skel(5);
    try { const r = await A.datasets.page(Object.assign({ organization_id: A.state.get('org'), limit: LIM }, S)); rows = r.items;
      el.innerHTML = r.items.length ? table(r.items) : ui.empty(S.q || S.project_id || S.format || S.status ? 'No datasets match these filters.' : 'No datasets yet. Upload a CSV, JSON or JSONL file to get started.', '<button class="btn pri" type="button" data-act="new">Upload dataset</button>');
      ui.pager($('#pgr'), { page: S.page, limit: LIM, total: r.total, onPage: p => { S.page = p; load(); } }); ic();
    } catch (e) { el.innerHTML = ui.fail(e); $('#pgr').innerHTML = ''; }
  }
  async function act(a, id) {
    const d = rows.find(x => x.id === id);
    if (a === 'retry') return load(); if (a === 'new') return A.datasetForms.upload(); if (!d) return; if (a === 'edit') return A.datasetForms.edit(d);
    try { if (a === 'delete' && await ui.confirm('Delete dataset', 'Permanently delete "' + d.name + '" and its records? This cannot be undone.')) { await A.datasets.remove(id); U.toast('Dataset deleted.'); load(); } } catch (e) { U.toast(e.message); }
  }
  async function projectFilter() { try { const ps = await A.projects.list({ organization_id: A.state.get('org'), limit: 100 }); $('#fp').innerHTML = '<option value="">All projects</option>' + ps.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join(''); $('#fp').value = S.project_id; } catch (e) { U.toast('Could not load projects: ' + e.message); } }
  function wire() {
    const q = new URLSearchParams(location.search); S.project_id = q.get('project') || ''; projectFilter();
    $('#list').onclick = e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset.id); }; $('#up').onclick = () => A.datasetForms.upload(S.project_id);
    $('#q').oninput = ui.debounce(e => { S.q = e.target.value.trim(); S.page = 1; load(); });
    [['fp', 'project_id'], ['ff', 'format'], ['fv', 'status']].forEach(([i, k]) => { $('#' + i).onchange = e => { S[k] = e.target.value; S.page = 1; load(); }; });
    $('#so').onchange = e => { [S.sort, S.order] = e.target.value.split(':'); S.page = 1; load(); };
    A.state.on('org', () => { S.page = 1; S.project_id = ''; projectFilter(); load(); }); document.addEventListener('alphex:dataset-saved', load);
    if (q.get('upload')) A.datasetForms.upload(S.project_id);
  }
  A.shell.init().then(() => { wire(); load(); }).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
})(window.Alphex);
