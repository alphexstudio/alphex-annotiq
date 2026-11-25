(function (A) {
  const U = A.util, esc = U.esc, $ = s => document.querySelector(s), mock = A.config.MODE === 'mock';
  const ic = () => window.lucide && lucide.createIcons(), fmt = n => Number(n).toLocaleString('en-US');
  const ICON = { task_created: 'plus-square', annotation_submitted: 'check-circle-2', review_completed: 'badge-check', dataset_uploaded: 'upload', project_updated: 'pencil' };
  const MET = [['Total projects', d => d.projects_total], ['Active projects', d => d.projects_active], ['Total tasks', d => d.tasks_total], ['Completed tasks', d => d.tasks.completed], ['Pending reviews', d => d.tasks.awaiting_review], ['Datasets', d => d.datasets_total]];
  const DIST = [['Pending', 'pending', '#3a3a3a'], ['In progress', 'in_progress', '#8a8a90'], ['Completed', 'completed', '#ea005a'], ['Awaiting review', 'awaiting_review', '#ff7aa9']];
  const QA = [['Create project', 'folder-plus', ''], ['Upload dataset', 'upload', 'Datasets'], ['Start text annotation', 'text-cursor-input', 'Text Annotation'], ['Start image annotation', 'image', 'Image Annotation'], ['Evaluate AI responses', 'scale', 'AI Response Evaluation']];
  const sk = (h, w) => '<div class="sk" style="height:' + h + 'px;width:' + (w || '100%') + '"></div>';
  const badge = mock ? '<span class="badge">Demo</span>' : '';
  function projects(list) {
    if (!list.length) return '<p class="mu">No projects yet. Create a project to start annotating or evaluating.</p>';
    return '<table class="tbl"><thead><tr><th>Project</th><th>Type</th><th>Dataset size</th><th>Completion</th><th>Status</th><th>Updated</th></tr></thead><tbody>' + list.map(p => { const pc = Number(p.stats.progress_pct) || 0;
      return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(U.TYPES[p.type] || p.type) + '</td><td>' + fmt(p.stats.dataset_items) + ' items</td><td><div class="pct"><div class="bar"><i style="width:' + pc + '%"></i></div>' + pc + '%</div></td><td><span class="badge' + (p.status === 'active' ? ' pk' : '') + '">' + esc(p.status) + '</span></td><td>' + U.ago(p.updated_at) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  async function load() {
    const org = A.state.get('org');
    $('#err').hidden = true; $('#metrics').innerHTML = MET.map(() => '<div class="card">' + sk(14, '60%') + sk(30, '40%') + '</div>').join('');
    ['#projects', '#dist', '#activity'].forEach(s => $(s).innerHTML = sk(120));
    try {
      const [sum, prj, act] = await Promise.all([A.analytics.summary(org), A.projects.list({ organization_id: org, limit: 5 }), A.analytics.activity(org)]);
      $('#metrics').innerHTML = MET.map(([l, f]) => '<div class="card"><span class="l">' + l + badge + '</span><strong>' + fmt(f(sum)) + '</strong></div>').join('');
      $('#projects').innerHTML = projects(prj);
      const t = sum.tasks, tot = sum.tasks_total;
      $('#dist').innerHTML = tot ? '<div class="dist" role="img" aria-label="Task status distribution">' + DIST.map(([, k, c]) => '<i style="--c:' + c + ';width:' + (t[k] / tot * 100) + '%"></i>').join('') + '</div><ul class="leg">' + DIST.map(([l, k, c]) => '<li><span class="dot" style="--c:' + c + '"></span>' + l + '<b>' + fmt(t[k]) + '</b></li>').join('') + '</ul>' : '<p class="mu">No tasks yet.</p>';
      $('#activity').innerHTML = act.length ? act.map(a => '<li><i data-lucide="' + (ICON[a.type] || 'circle') + '"></i><div>' + esc(a.text) + '<time>' + U.ago(a.at) + '</time></div></li>').join('') : '<li class="mu">No activity yet.</li>';
    } catch (e) {
      ['#metrics', '#projects', '#dist', '#activity'].forEach(s => $(s).innerHTML = ''); $('#err-msg').textContent = e.message + ' (' + (e.code || 'ERROR') + ')'; $('#err').hidden = false;
    }
    ic();
  }
  function wire() {
    $('#qa').innerHTML = QA.map(([l, i, t]) => '<button class="btn sec" type="button" data-t="' + esc(t) + '"><i data-lucide="' + i + '"></i>' + l + '</button>').join('');
    $('#qa').onclick = e => { const b = e.target.closest('button'); if (!b) return; b.dataset.t ? A.shell.go(b.dataset.t) : document.dispatchEvent(new CustomEvent('alphex:create-project')); };
    $('#retry').onclick = load; A.state.on('org', load);
    document.addEventListener('alphex:project-saved', load);
  }
  (async () => {
    try {
      const u = await A.shell.init(); const h = new Date().getHours();
      $('#hello').textContent = 'Good ' + (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening') + ', ' + u.name.split(' ')[0];
      $('#sub').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      wire(); load();
    } catch (e) { document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'); }
  })();
})(window.Alphex);
