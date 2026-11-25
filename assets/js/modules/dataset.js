(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons(), id = new URLSearchParams(location.search).get('id');
  const TABS = [['overview', 'Overview'], ['records', 'Records'], ['schema', 'Schema'], ['validation', 'Validation'], ['activity', 'Activity']]; let D, tab = 'overview', pg = 1, items = [];
  const kv = a => '<dl class="kv">' + a.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
  const cell = v => esc(String(v && typeof v === 'object' ? JSON.stringify(v) : v == null ? '' : v).slice(0, 80));
  const P = {
    overview: () => '<section class="card"><h2>Overview</h2>' + kv([['Dataset name', esc(D.name)], ['Dataset ID', esc(D.id)], ['Description', esc(D.description || '-')], ['Project', D.project_id ? '<a href="project.html?id=' + esc(D.project_id) + '">' + esc(D.project_name || D.project_id) + '</a>' : 'Unassigned'], ['File name', esc(D.file_name)], ['File format', esc(D.format.toUpperCase())],
      ['Record count', D.record_count], ['Dataset type', esc(D.dataset_type)], ['File size', ui.bytes(D.size_bytes)], ['Tags', esc((D.tags || []).join(', ') || 'None')], ['Uploaded', ui.date(D.created_at)], ['Uploaded by', esc(D.uploaded_by_name)], ['Validation', ui.badge(D.validation.status, D.validation.status === 'valid')]]) + '</section>',
    schema: () => '<section class="card"><h2>Schema</h2>' + (D.schema.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Field</th><th>Type</th><th>Missing values</th></tr></thead><tbody>' + D.schema.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.type) + '</td><td>' + c.missing + '</td></tr>').join('') + '</tbody></table></div><p class="small" style="margin-top:10px">Types are inferred from the uploaded values.</p>' : ui.empty('No schema was recorded for this dataset.')) + '</section>',
    validation: () => { const v = D.validation; return '<section class="card"><h2>Validation</h2><p>' + ui.badge(v.status, v.status === 'valid') + ' <span class="small">Checked ' + ui.date(v.checked_at) + '</span></p>' + (v.issues.length ? '<ul class="iss">' + v.issues.map(i => '<li class="' + esc(i.level) + '">' + esc(i.level) + ': ' + esc(i.message) + '</li>').join('') + '</ul>' : '<p class="mu" style="margin-top:8px">No problems were found.</p>') +
      '<p class="small" style="margin-top:12px">This check ran in the browser at upload time. The backend must validate files again before they are accepted.</p></section>'; } };
  async function records() {
    const el = $('#panel'); el.innerHTML = '<section class="card">' + ui.skel(5) + '</section>';
    try { const r = await A.datasets.records(id, { page: pg, limit: 10 }); items = r.items; const cols = (D.schema.map(c => c.name)).slice(0, 8);
      el.innerHTML = '<section class="card"><h2>Records</h2>' + (!r.available ? ui.empty('Records for uploaded files are kept in browser memory only in mock mode and were cleared on reload. Upload the file again to inspect its records.') :
        '<div class="scroll"><table class="tbl"><thead><tr><th>#</th>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + items.map((x, i) => '<tr class="rec" tabindex="0" data-i="' + i + '"><td>' + x.index + '</td>' + cols.map(c => '<td class="trunc">' + cell(x.data[c]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="pgr" id="pgr"></div><p class="small">Select a row to preview the full record.</p>') + '</section>';
      if (r.available) ui.pager($('#pgr'), { page: pg, limit: 10, total: r.total, onPage: p => { pg = p; records(); } });
    } catch (e) { el.innerHTML = '<section class="card">' + ui.fail(e) + '</section>'; }
  }
  async function activity() { try { const l = await A.activity.list({ dataset_id: id, limit: 30 }); $('#panel').innerHTML = '<section class="card"><h2>Activity</h2>' + (l.length ? '<ul class="act">' + l.map(a => '<li><i data-lucide="activity"></i><div>' + esc(a.summary) + '<time>' + esc(a.actor_name || '') + ', ' + U.ago(a.created_at) + '</time></div></li>').join('') + '</ul>' : '<p class="mu">No activity yet.</p>') + '</section>'; ic(); } catch (e) { $('#panel').innerHTML = ui.fail(e); } }
  function render() {
    $('#head').innerHTML = '<a class="mu" href="datasets.html">Datasets</a><div class="tool" style="justify-content:space-between;align-items:flex-start;margin:6px 0 0"><div><h1>' + esc(D.name) + '</h1><p class="small">' + esc(D.id) + '</p></div><div class="ra"><button class="btn sec" type="button" data-act="edit">Edit metadata</button><button class="btn sec" type="button" data-act="delete">Delete</button></div></div>';
    $('#tabs').innerHTML = TABS.map(([k, l]) => '<button role="tab" type="button" data-t="' + k + '" aria-selected="' + (k === tab) + '">' + l + '</button>').join('');
    if (tab === 'records') records(); else if (tab === 'activity') activity(); else $('#panel').innerHTML = P[tab](); ic();
  }
  async function load() { $('#panel').innerHTML = ui.skel(4); try { D = await A.datasets.get(id); render(); } catch (e) { $('#panel').innerHTML = e.status === 404 ? ui.empty('Dataset not found. It may have been deleted.', '<a class="btn sec" href="datasets.html">Back to datasets</a>') : ui.fail(e); } }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; pg = 1; render(); }
    const r = e.target.closest('tr.rec'); if (r) { const x = items[+r.dataset.i]; const d = ui.dialog('<h2>Record ' + x.index + '</h2><p class="small">' + esc(x.id) + '</p><pre class="json">' + esc(JSON.stringify(x.data, null, 2)) + '</pre><div class="acts"><button class="btn sec" type="button">Close</button></div>', 'wide'); d.querySelector('button').onclick = () => d.close(); }
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'retry') load(); if (b.dataset.act === 'edit') A.datasetForms.edit(D);
    if (b.dataset.act === 'delete') ui.confirm('Delete dataset', 'Permanently delete "' + D.name + '" and its records? This cannot be undone.').then(async ok => { if (ok) try { await A.datasets.remove(id); location.href = 'datasets.html'; } catch (er) { U.toast(er.message); } });
  });
  document.addEventListener('alphex:dataset-saved', load);
  A.shell.init().then(load).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
})(window.Alphex);
