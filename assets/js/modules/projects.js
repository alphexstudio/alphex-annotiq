(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons();
  const S = { q: '', status: '', type: '', sort: 'created_at', order: 'desc', page: 1, view: 'table' }, LIM = 8; let rows = [];
  const ann = (t, a) => ((ui.ANN[t] || []).find(x => x[0] === a) || [0, a || '-'])[1];
  const team = p => '<span class="stack">' + p.members.slice(0, 4).map(m => '<span class="av" title="' + esc(m.name) + '">' + esc(ui.ini(m.name)) + '</span>').join('') + '</span>' + (p.members.length > 4 ? ' +' + (p.members.length - 4) : '') + (p.members.length ? '' : '<span class="small">None</span>');
  const acts = p => '<span class="ra"><a class="btn ghost icon" href="project.html?id=' + esc(p.id) + '" aria-label="View ' + esc(p.name) + '"><i data-lucide="eye"></i></a>' +
    [['edit', 'pencil', 'Edit'], ['archive', 'archive', 'Archive'], ['delete', 'trash-2', 'Delete']].filter(x => !(x[0] === 'archive' && p.status === 'archived')).map(([a, i, l]) => '<button class="btn ghost icon" type="button" data-act="' + a + '" data-id="' + esc(p.id) + '" aria-label="' + l + ' ' + esc(p.name) + '"><i data-lucide="' + i + '"></i></button>').join('') + '</span>';
  const table = l => '<div class="scroll"><table class="tbl"><thead><tr><th>Project</th><th>Type</th><th>Annotation</th><th>Status</th><th>Priority</th><th>Datasets</th><th>Tasks</th><th>Team</th><th>Created</th><th>Updated</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
    l.map(p => '<tr><td><a class="lnk" href="project.html?id=' + esc(p.id) + '">' + esc(p.name) + '</a><div class="small">' + esc(p.id) + '</div><div class="trunc">' + esc(p.description) + '</div></td><td>' + esc(U.TYPES[p.type] || p.type) + '</td><td>' + esc(ann(p.type, p.annotation_type)) + '</td><td>' + ui.badge(p.status, p.status === 'active') + '</td><td>' + esc(p.priority) + '</td><td>' + p.dataset_count + '</td><td>' + p.task_count + '</td><td>' + team(p) + '</td><td>' + ui.date(p.created_at) + '</td><td>' + ui.date(p.updated_at) + '</td><td>' + acts(p) + '</td></tr>').join('') + '</tbody></table></div>';
  const cards = l => '<div class="cards">' + l.map(p => '<article class="card"><div><a class="lnk" href="project.html?id=' + esc(p.id) + '">' + esc(p.name) + '</a> ' + ui.badge(p.status, p.status === 'active') + '<div class="small">' + esc(p.id) + '</div></div><p class="mu clamp">' + esc(p.description) + '</p>' +
    '<dl class="kv"><dt>Type</dt><dd>' + esc(U.TYPES[p.type] || p.type) + '</dd><dt>Annotation</dt><dd>' + esc(ann(p.type, p.annotation_type)) + '</dd><dt>Priority</dt><dd>' + esc(p.priority) + '</dd><dt>Datasets / tasks</dt><dd>' + p.dataset_count + ' / ' + p.task_count + '</dd><dt>Created</dt><dd>' + ui.date(p.created_at) + '</dd><dt>Updated</dt><dd>' + ui.date(p.updated_at) + '</dd></dl>' +
    '<div class="tool" style="justify-content:space-between;margin:0">' + team(p) + acts(p) + '</div></article>').join('') + '</div>';
  async function load() {
    const el = $('#list'); el.innerHTML = ui.skel(5);
    try { const r = await A.projects.page({ organization_id: A.state.get('org'), q: S.q, status: S.status, type: S.type, sort: S.sort, order: S.order, page: S.page, limit: LIM }); rows = r.items;
      el.innerHTML = r.items.length ? (S.view === 'table' ? table(r.items) : cards(r.items)) : ui.empty(S.q || S.status || S.type ? 'No projects match these filters.' : 'No projects yet. Create a project to get started.', '<button class="btn pri" type="button" data-act="new">Create project</button>');
      ui.pager($('#pgr'), { page: S.page, limit: LIM, total: r.total, onPage: p => { S.page = p; load(); } }); ic();
    } catch (e) { el.innerHTML = ui.fail(e); $('#pgr').innerHTML = ''; }
  }
  async function act(a, id) {
    const p = rows.find(x => x.id === id);
    if (a === 'retry') return load(); if (a === 'new') return A.projectForm.open(); if (!p) return;
    if (a === 'edit') return A.projectForm.open(p);
    try {
      if (a === 'archive' && await ui.confirm('Archive project', 'Archive "' + p.name + '"? It will be hidden from the default list. You can find it with the Archived filter.', 'Archive')) { await A.projects.archive(id); U.toast('Project archived.'); load(); }
      if (a === 'delete' && await ui.confirm('Delete project', 'Permanently delete "' + p.name + '"? Its datasets stay but become unassigned. This cannot be undone.')) { await A.projects.remove(id); U.toast('Project deleted.'); load(); }
    } catch (e) { U.toast(e.message); }
  }
  function wire() {
    $('#list').onclick = e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset.id); }; $('#new').onclick = () => A.projectForm.open();
    $('#q').oninput = ui.debounce(e => { S.q = e.target.value.trim(); S.page = 1; load(); }); $('#fs').onchange = e => { S.status = e.target.value; S.page = 1; load(); }; $('#ft').onchange = e => { S.type = e.target.value; S.page = 1; load(); };
    $('#so').onchange = e => { [S.sort, S.order] = e.target.value.split(':'); S.page = 1; load(); };
    [['vt', 'table'], ['vg', 'grid']].forEach(([i, v]) => { $('#' + i).onclick = () => { S.view = v; $('#vt').setAttribute('aria-pressed', v === 'table'); $('#vg').setAttribute('aria-pressed', v === 'grid'); load(); }; });
    A.state.on('org', () => { S.page = 1; load(); }); document.addEventListener('alphex:project-saved', load);
  }
  A.shell.init().then(() => { wire(); load(); }).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
})(window.Alphex);
