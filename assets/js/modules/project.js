(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons(), id = new URLSearchParams(location.search).get('id'), mock = A.config.MODE === 'mock';
  const TABS = [['overview', 'Overview'], ['datasets', 'Datasets'], ['tasks', 'Tasks'], ['team', 'Team'], ['instructions', 'Instructions'], ['activity', 'Activity']]; let P, DS = [], ACT = [], TK = [], TKn = 0, TKerr = null, tab = 'overview';
  const kv = a => '<dl class="kv">' + a.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
  const actl = l => l.length ? '<ul class="act">' + l.map(a => '<li><i data-lucide="activity"></i><div>' + esc(a.summary) + '<time>' + esc(a.actor_name || '') + ', ' + U.ago(a.created_at) + '</time></div></li>').join('') + '</ul>' : '<p class="mu">No activity yet.</p>';
  const ann = () => ((ui.ANN[P.type] || []).find(x => x[0] === P.annotation_type) || [0, P.annotation_type || '-'])[1];
  const stack = '<span class="stack">';
  const WS = { cls: 'text-annotation', ner: 'text-annotation', span: 'text-annotation', single: 'ai-evaluation', side: 'ai-evaluation', rubric: 'ai-evaluation', ranking: 'ai-evaluation' };
  function tasksPanel() {
    if (TKerr) return '<section class="card">' + ui.fail(TKerr) + '</section>'; const w = WS[A.model.mode(P)], n = s => TK.filter(t => t.status === s).length;
    const L = { unassigned: 'Unassigned', assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed', skipped: 'Skipped' };
    return '<section class="card"><div class="tool" style="justify-content:space-between"><h2>Tasks (' + TKn + ')</h2><span class="ra">' + (w ? '<a class="btn pri" href="../workspace/' + w + '.html?project=' + esc(id) + '">Open workspace</a>' : '') + '<button class="btn sec" type="button" data-act="gen">Generate tasks</button><button class="btn sec" type="button" data-act="cfg">Configure workspace</button></span></div>' +
      (w ? '' : '<p class="mu">This project type has no workspace yet.</p>') + (mock ? '<p class="small">Mock mode: tasks are generated in this browser from dataset records (up to 25 per dataset). No multi-user sync.</p>' : '') +
      (TK.length ? '<p>' + Object.keys(L).map(k => ui.badge(L[k] + ' ' + n(k))).join(' ') + '</p><div class="scroll"><table class="tbl"><thead><tr><th>Task</th><th>Status</th><th>Review</th><th>Assigned to</th><th></th></tr></thead><tbody>' + TK.map(t => '<tr><td>' + esc(t.id) + '</td><td>' + esc(L[t.status]) + '</td><td>' + esc(t.review_status) + '</td><td>' + esc(t.assigned_to_name || '-') + '</td><td>' + (w ? '<a href="../workspace/' + w + '.html?project=' + esc(id) + '&task=' + esc(t.id) + '">Open</a>' : '') + '</td></tr>').join('') + '</tbody></table></div>' + (TKn > TK.length ? '<p class="small">Showing the first ' + TK.length + ' tasks.</p>' : '') : ui.empty('No tasks yet. Generate tasks from this project\'s datasets.')) + '</section>';
  }
  async function gen() { try { const r = await A.tasks.generate(id); U.toast(r.created + ' tasks created' + (r.skipped ? ', ' + r.skipped + ' records skipped.' : '.')); load(); } catch (e) { U.toast(e.message); } }
  const PANELS = {
    overview: () => '<div class="cols"><section class="card"><h2>Details</h2>' + kv([['Description', esc(P.description || '-')], ['Status', ui.badge(P.status, P.status === 'active')], ['Type', esc(U.TYPES[P.type] || P.type)], ['Annotation type', esc(ann())], ['Priority', esc(P.priority)], ['Start date', ui.date(P.start_date)], ['Due date', ui.date(P.due_date)],
      ['Datasets', P.dataset_count], ['Tasks', TKn + (mock ? ' <span class="badge">Demo</span>' : '')], ['Created', ui.date(P.created_at)], ['Updated', ui.date(P.updated_at)]]) + '</section>' +
      '<section class="card"><h2>Team</h2>' + (P.members.length ? stack + P.members.map(m => '<span class="av" title="' + esc(m.name) + '">' + esc(ui.ini(m.name)) + '</span>').join('') + '</span>' : '<p class="mu">No members.</p>') + '<h2 style="margin:20px 0 14px">Recent activity</h2>' + actl(ACT.slice(0, 5)) + '</section></div>',
    datasets: () => '<section class="card"><div class="tool" style="justify-content:space-between"><h2>Datasets</h2><a class="btn pri" href="datasets.html?project=' + esc(id) + '&upload=1">Upload dataset</a></div>' + (DS.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Format</th><th>Records</th><th>Validation</th><th>Uploaded</th></tr></thead><tbody>' +
      DS.map(d => '<tr><td><a class="lnk" href="dataset.html?id=' + esc(d.id) + '">' + esc(d.name) + '</a></td><td>' + esc(d.format.toUpperCase()) + '</td><td>' + d.record_count + '</td><td>' + ui.badge(d.validation.status, d.validation.status === 'valid') + '</td><td>' + ui.date(d.created_at) + '</td></tr>').join('') + '</tbody></table></div>' : ui.empty('No datasets are linked to this project yet.')) + '</section>',
    tasks: tasksPanel,
    team: () => '<section class="card"><h2>Team</h2>' + (P.members.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>' + P.members.map(m => '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.email || '-') + '</td><td>' + esc(m.role) + '</td></tr>').join('') + '</tbody></table></div>' : ui.empty('No members yet.')) +
      '<p class="small" style="margin-top:12px">Inviting members and changing roles arrives with team management. Roles shown here are display only; the backend must enforce permissions.</p></section>',
    instructions: () => '<section class="card"><h2>Instructions</h2>' + (P.instructions ? '<p style="white-space:pre-wrap">' + esc(P.instructions) + '</p>' : '<p class="mu">No instructions yet. Add them with Edit.</p>') + '</section>',
    activity: () => '<section class="card"><h2>Activity</h2>' + actl(ACT) + '</section>' };
  function render() {
    $('#head').innerHTML = '<a class="mu" href="projects.html">Projects</a><div class="tool" style="justify-content:space-between;align-items:flex-start;margin:6px 0 0"><div><h1>' + esc(P.name) + '</h1><p class="small">' + esc(P.id) + '</p><p>' + ui.badge(P.status, P.status === 'active') + ' ' + ui.badge(U.TYPES[P.type] || P.type) + ' ' + ui.badge(P.priority + ' priority') + '</p></div>' +
      '<div class="ra"><button class="btn sec" type="button" data-act="edit">Edit</button>' + (P.status !== 'archived' ? '<button class="btn sec" type="button" data-act="archive">Archive</button>' : '') + '<button class="btn sec" type="button" data-act="delete">Delete</button></div></div>';
    $('#tabs').innerHTML = TABS.map(([k, l]) => '<button role="tab" type="button" data-t="' + k + '" aria-selected="' + (k === tab) + '">' + l + '</button>').join(''); $('#panel').innerHTML = PANELS[tab](); ic();
  }
  async function load() {
    $('#panel').innerHTML = ui.skel(4);
    try { P = await A.projects.get(id); [DS, ACT] = await Promise.all([A.datasets.page({ project_id: id, limit: 50 }).then(r => r.items), A.activity.list({ project_id: id, limit: 30 })]);
      try { const r = await A.tasks.page({ project_id: id, limit: 100 }); TK = r.items; TKn = r.total; TKerr = null; } catch (e) { TKerr = e; } render(); }
    catch (e) { $('#panel').innerHTML = e.status === 404 ? ui.empty('Project not found. It may have been deleted.', '<a class="btn sec" href="projects.html">Back to projects</a>') : ui.fail(e); }
  }
  async function act(a) {
    if (a === 'retry') return load(); if (a === 'gen') return gen(); if (a === 'cfg') return A.wsConfig.open(P); if (a === 'edit') return A.projectForm.open(P);
    try {
      if (a === 'archive' && await ui.confirm('Archive project', 'Archive "' + P.name + '"? It will be hidden from the default project list.', 'Archive')) { await A.projects.archive(id); U.toast('Project archived.'); load(); }
      if (a === 'delete' && await ui.confirm('Delete project', 'Permanently delete "' + P.name + '"? Its datasets stay but become unassigned. This cannot be undone.')) { await A.projects.remove(id); location.href = 'projects.html'; }
    } catch (e) { U.toast(e.message); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; render(); } });
  document.addEventListener('alphex:project-saved', load);
  A.shell.init().then(load).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
})(window.Alphex);
