/* Shared workspace controller: project and task loading, task list, autosave, navigation, submit, skip, shortcuts.
   A workspace plugin (text-annotation.js, evaluation.js) supplies: title, ptype, modes, who, svc, keys, init, mount, validate, summary, instr. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, M = A.model, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons(), qp = new URLSearchParams(location.search);
  const ST = [['', 'All tasks'], ['unassigned', 'Unassigned'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['skipped', 'Skipped']], LBL = { unassigned: 'Unassigned', assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed', skipped: 'Skipped' };
  const KEYS = '<dl class="kv"><dt><kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd></dt><dd>Save</dd><dt><kbd>Alt</kbd>+<kbd>Left</kbd>/<kbd>Right</kbd></dt><dd>Previous / next task</dd>';
  const dlg = (h, ok) => new Promise(res => { const d = ui.dialog('<h2>Review before submitting</h2>' + h + '<div class="acts"><button class="btn sec" type="button" value="0">Go back</button><button class="btn pri" type="button" value="1">' + esc(ok) + '</button></div>', 'wide'); let v = false;
    d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { v = b.value === '1'; d.close(); } }); d.addEventListener('close', () => res(v)); });
  function start(pl) {
    const c = { P: null, CFG: null, mode: null, task: null, data: null, readOnly: false, blocked: false, dirty: false, list: [], filter: '', touch, flash }; let seq = 0, timer = null; const dsn = {};
    const me = () => A.auth.user && A.auth.user.id, shown = () => c.list.filter(t => !c.filter || t.status === c.filter);
    function flash(t) { $('#flash').textContent = t || ''; }
    function setSave(t) { $('#sv').textContent = t; }
    function touch() { c.dirty = true; seq++; setSave('Unsaved changes'); clearTimeout(timer); timer = setTimeout(save, 800); }
    function patch(t) { const i = c.list.findIndex(x => x.id === t.id); if (i >= 0) c.list[i] = t; if (c.task && c.task.id === t.id) c.task = t; }
    async function save() {
      if (!c.dirty || c.readOnly) return true; const my = seq; setSave('Saving...');
      try { const r = await pl.svc.saveDraft(c.task.id, c.data); if (seq === my) c.dirty = false; patch(r.task); drawList(); setSave(c.dirty ? 'Unsaved changes' : 'Saved ' + new Date().toLocaleTimeString()); return !c.dirty; }
      catch (e) { setSave('Save failed: ' + e.message); return false; }
    }
    async function flush() { clearTimeout(timer); if (!c.dirty) return true; if (await save()) return true; return ui.confirm('Unsaved changes', 'Your latest changes could not be saved. Leave anyway and lose them?', 'Leave'); }
    function drawList() {
      $('#tf').innerHTML = ST.map(([v, l]) => '<option value="' + v + '"' + (v === c.filter ? ' selected' : '') + '>' + l + '</option>').join(''); const s = shown();
      $('#tlist').innerHTML = s.length ? s.map(t => '<li><button type="button" data-id="' + esc(t.id) + '"' + (c.task && t.id === c.task.id ? ' aria-current="true"' : '') + '><span><b>#' + t.index + '</b> ' + ui.badge(LBL[t.status] + (t.review_status !== 'none' ? ', ' + t.review_status : ''), t.status === 'completed') + '</span><span class="trunc">' + esc((t.payload.text || t.payload.prompt || '').slice(0, 60)) + '</span></button></li>').join('') : '<li class="mu small">No tasks match.</li>';
    }
    function drawBar() {
      const s = shown(), i = s.findIndex(t => t.id === c.task.id), done = c.list.filter(t => t.status === 'completed').length;
      $('#prev').disabled = i <= 0; $('#next').disabled = i < 0 || i >= s.length - 1; $('#prog').textContent = 'Task ' + (c.list.findIndex(t => t.id === c.task.id) + 1) + ' of ' + c.list.length + ', ' + done + ' completed';
      $('#sub').disabled = c.readOnly || c.blocked; $('#skip').disabled = c.task.status === 'completed' || !!(c.task.assigned_to && c.task.assigned_to !== me());
    }
    function chips() {
      const t = c.task, done = c.list.filter(x => x.status === 'completed').length;
      if (dsn[t.dataset_id] === undefined) { dsn[t.dataset_id] = null; A.datasets.get(t.dataset_id).then(d => { dsn[t.dataset_id] = d.name; chips(); }).catch(() => { dsn[t.dataset_id] = t.dataset_id; chips(); }); }
      $('#chips').innerHTML = [['Task', esc(t.id)], ['Project', '<a href="../dashboard/project.html?id=' + esc(c.P.id) + '">' + esc(c.P.name) + '</a>'], ['Dataset', esc(dsn[t.dataset_id] || '...')], [pl.who, esc(t.assigned_to_name || 'Unassigned')], ['Status', esc(LBL[t.status])], ['Progress', done + '/' + c.list.length]].map(([k, v]) => '<span class="badge">' + k + ': <b>' + v + '</b></span>').join('');
    }
    function banner() {
      const t = c.task, rv = (t.reviews || []).slice(-1)[0]; let h = '';
      if (t.review_status === 'rejected') h = '<b>Returned for revision.</b> ' + esc(rv ? rv.comments : '') + ' Revise the work and submit it again.'; else if (t.review_status === 'pending') h = 'Submitted and awaiting review. This task is read-only.';
      else if (t.review_status === 'approved') h = 'Approved by a reviewer. This task is read-only.'; else if (c.readOnly) h = 'This task is read-only' + (t.assigned_to && t.assigned_to !== me() ? ' because it is assigned to ' + esc(t.assigned_to_name) : '') + '.';
      $('#banner').innerHTML = h ? '<div class="banner">' + h + '</div>' : '';
    }
    async function openTask(id, first) {
      if (!first && !await flush()) return; flash(''); setSave('');
      try { let t = await A.tasks.get(id); if (t.status === 'unassigned' || t.status === 'skipped') t = await A.tasks.assign(id);
        patch(t); c.task = t; c.readOnly = t.status === 'completed' || !!(t.assigned_to && t.assigned_to !== me()); c.blocked = false; c.data = pl.init(t, c); c.dirty = false;
        history.replaceState(null, '', '?project=' + encodeURIComponent(c.P.id) + '&task=' + encodeURIComponent(id));
        $('#instr').innerHTML = '<p style="white-space:pre-wrap">' + esc(c.P.instructions || 'No instructions provided.') + '</p>' + (pl.instr ? pl.instr(c) : ''); $('#keys').innerHTML = KEYS + pl.keys + '</dl>';
        drawList(); chips(); banner(); pl.mount(c); drawBar(); ic();
      } catch (e) { flash(e.message); }
    }
    const step = d => { const s = shown(), n = s[s.findIndex(t => t.id === c.task.id) + d]; if (n) openTask(n.id); };
    function advance() { const i = c.list.findIndex(t => t.id === c.task.id), n = c.list.slice(i + 1).concat(c.list.slice(0, i)).find(t => t.status !== 'completed'); if (n) openTask(n.id, true); else { drawList(); drawBar(); chips(); banner(); pl.mount(c); flash('All tasks in this list are complete.'); } }
    async function submit() {
      const er = pl.validate(c.P, c.task, c.data, true); if (er.length) { flash(er.join(' ')); return; }
      if (!await dlg(pl.summary(c), 'Submit')) return;
      try { clearTimeout(timer); const t = await pl.svc.submit(c.task.id, c.data); c.dirty = false; patch(t); U.toast('Submitted for review.'); advance(); } catch (e) { flash(e.message); }
    }
    async function skip() { if (!await ui.confirm('Skip task', 'Skip task ' + c.task.id + '? It returns to the pool and can be reopened later.', 'Skip')) return; try { clearTimeout(timer); c.dirty = false; patch(await A.tasks.skip(c.task.id)); advance(); } catch (e) { flash(e.message); } }
    async function load(pid) {
      try { c.P = await A.projects.get(pid); c.mode = M.mode(c.P);
        if (!pl.modes.includes(c.mode)) { $('#pick').innerHTML = ui.empty('This project is configured for "' + (c.P.annotation_type || 'none') + '", which this workspace does not handle.', '<a class="btn sec" href="../dashboard/project.html?id=' + esc(pid) + '">Back to project</a>'); return; }
        c.CFG = M.config(c.P); c.list = (await A.tasks.page({ project_id: pid, limit: 200 })).items;
        if (!c.list.length) { $('#pick').innerHTML = ui.empty('This project has no tasks yet.', '<button class="btn pri" data-act="gen" type="button">Generate tasks from datasets</button>'); return; }
        $('#pick').innerHTML = ''; $('#ws').hidden = false; await openTask(qp.get('task') || (c.list.find(t => t.status !== 'completed') || c.list[0]).id, true);
      } catch (e) { $('#pick').innerHTML = ui.fail(e); }
    }
    async function picker() {
      $('#pick').innerHTML = ui.skel(3);
      try { const ps = await A.projects.list({ organization_id: A.state.get('org'), type: pl.ptype, limit: 50 });
        $('#pick').innerHTML = '<div class="pagehead"><h1>' + esc(pl.title) + '</h1><p>Choose a project to open its workspace.</p></div>' + (ps.length ? '<div class="cards">' + ps.map(p => '<a class="card" href="?project=' + esc(p.id) + '"><b class="lnk">' + esc(p.name) + '</b><span class="small">' + esc(p.id) + '</span><span class="mu">' + esc(p.status) + '</span></a>').join('') + '</div>' : ui.empty('No ' + pl.title.toLowerCase() + ' projects yet.', '<a class="btn pri" href="../dashboard/projects.html">Go to projects</a>'));
      } catch (e) { $('#pick').innerHTML = ui.fail(e); }
    }
    $('#tlist').onclick = e => { const b = e.target.closest('[data-id]'); if (b) openTask(b.dataset.id); }; $('#tf').onchange = e => { c.filter = e.target.value; drawList(); if (c.task) drawBar(); };
    $('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1); $('#sub').onclick = submit; $('#skip').onclick = skip;
    $('#pick').onclick = async e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'retry') return load(qp.get('project'));
      if (b.dataset.act === 'gen') try { const r = await A.tasks.generate(qp.get('project')); U.toast(r.created + ' tasks created' + (r.skipped ? ', ' + r.skipped + ' records skipped (no usable fields).' : '.')); load(qp.get('project')); } catch (er) { U.toast(er.message); } };
    document.addEventListener('keydown', e => { const k = e.key; if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') { e.preventDefault(); save(); } else if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight') && c.task) { e.preventDefault(); step(k === 'ArrowLeft' ? -1 : 1); } });
    window.addEventListener('beforeunload', e => { if (c.dirty) { e.preventDefault(); e.returnValue = ''; } });
    A.shell.init().then(() => { A.state.on('org', () => { location.href = location.pathname; }); const pid = qp.get('project'); pid ? load(pid) : picker(); }).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
  }
  A.ws = { start };
})(window.Alphex);
