/* Shared application shell: sidebar (collapsible; drawer on small screens), top bar, session guard.
   Entry format: [label, lucide icon, href, planned phase]. Only pages listed in BUILT are linked; others show a notice. */
(function (A) {
  const U = A.util, esc = U.esc, root = document.body.dataset.root || '', $ = s => document.querySelector(s);
  const BUILT = ['dashboard/index.html'];
  const NAV = [['Workspace', [['Overview', 'layout-dashboard', 'dashboard/index.html'], ['Projects', 'folder-kanban', 'dashboard/projects.html', 2], ['Datasets', 'database', 'dashboard/datasets.html', 2]]],
    ['Annotation', [['Text Annotation', 'text-cursor-input', 'workspace/text-annotation.html', 3], ['Image Annotation', 'image', 'workspace/image-annotation.html', 4], ['Video Annotation', 'video', '', 0], ['Audio Annotation', 'audio-lines', '', 0], ['Multimodal Annotation', 'layers', '', 0]]],
    ['Evaluation', [['AI Response Evaluation', 'scale', 'workspace/ai-evaluation.html', 3], ['Response Comparison', 'columns-2', 'workspace/ai-evaluation.html#compare', 3], ['Rubric Evaluation', 'list-checks', 'workspace/ai-evaluation.html#rubric', 3], ['Evaluation History', 'history', 'workspace/ai-evaluation.html#history', 3]]],
    ['Quality', [['Review Queue', 'inbox', 'workspace/review.html', 5], ['Gold Tasks', 'trophy', 'workspace/review.html#gold', 5], ['Agreement Analysis', 'git-compare', 'dashboard/analytics.html#agreement', 5], ['Quality Reports', 'bar-chart-3', 'dashboard/analytics.html', 5]]],
    ['Organization', [['Team Members', 'users', 'dashboard/team.html', 5], ['Roles & Permissions', 'shield-check', 'dashboard/team.html#roles', 5], ['Activity Logs', 'activity', 'dashboard/team.html#logs', 5]]]];
  const BOTTOM = [['Documentation', 'book-open', '', 6], ['Settings', 'settings', 'dashboard/settings.html', 6]];
  const ALL = NAV.flatMap(g => g[1]).concat(BOTTOM);
  const link = ([l, i, h, ph]) => { const on = BUILT.includes(h), cur = on && location.pathname.endsWith(h);
    return '<a href="' + (on ? root + h : '#') + '"' + (cur ? ' class="cur" aria-current="page"' : '') + ' data-label="' + esc(l) + '" title="' + esc(l) + '"><i data-lucide="' + i + '"></i><span class="lbl">' + esc(l) + '</span>' + (!on && ph === 0 ? '<em class="badge">Soon</em>' : '') + '</a>'; };
  function go(label) { const it = ALL.find(x => x[0] === label); if (it && BUILT.includes(it[2])) { location.href = root + it[2]; return; }
    U.toast(label + (it && it[3] === 0 ? ' is coming soon.' : ' is not built yet. It is planned for Phase ' + (it ? it[3] : '?') + '.')); }
  async function init() {
    const user = await A.auth.me(); let orgs = [];
    try { orgs = await A.team.orgs(); } catch (e) { U.toast('Could not load organizations: ' + e.message); }
    A.state.set('orgs', orgs); A.state.set('org', user.organization_id);
    const ini = user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(), app = $('#shell');
    $('#sidebar').innerHTML = '<a class="wordmark" href="' + root + 'dashboard/index.html"><span class="lbl">Alphex <b>AI</b></span></a><span class="sub">Workbench</span><nav class="nav" aria-label="Primary">' +
      NAV.map(([g, it]) => '<div class="grp lbl">' + g + '</div>' + it.map(link).join('')).join('') + '</nav><div class="bot">' + BOTTOM.map(link).join('') +
      '<div class="who"><span class="av">' + esc(ini) + '</span><span class="lbl"><b>' + esc(user.name) + '</b><small>' + esc(user.role) + '</small></span></div><button class="out" id="out" type="button"><i data-lucide="log-out"></i><span class="lbl">Sign out</span></button></div>';
    $('#topbar').innerHTML = '<button class="btn ghost icon" id="tog" type="button" aria-label="Toggle navigation"><i data-lucide="panel-left"></i></button><label class="sr" for="org">Organization</label>' +
      '<select id="org" class="org">' + orgs.map(o => '<option value="' + esc(o.id) + '"' + (o.id === user.organization_id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select><span class="sp"></span>' +
      '<div class="rel"><button class="btn ghost icon" id="bell" type="button" aria-label="Notifications" aria-expanded="false"><i data-lucide="bell"></i></button><div class="pop" id="pop"><b>Notifications</b><p>No notifications yet. They will appear here once the backend is connected.</p></div></div>' +
      '<button class="btn ghost icon" id="help" type="button" aria-label="Help"><i data-lucide="help-circle"></i></button><button class="btn pri" id="newp" type="button"><i data-lucide="plus"></i><span class="hide-sm">Create project</span></button>';
    if (A.config.MODE === 'mock') $('#page').insertAdjacentHTML('afterbegin', '<div class="banner" role="note">Mock mode: all figures and records are sample data stored in this browser. Nothing is sent to a server.</div>');
    try { if (localStorage.getItem('alphex.sb') === '1') app.classList.add('collapsed'); } catch (e) {}
    const close = () => { app.classList.remove('open'); $('#pop').classList.remove('open'); $('#bell').setAttribute('aria-expanded', 'false'); };
    $('#tog').onclick = () => { if (matchMedia('(max-width:900px)').matches) app.classList.toggle('open'); else { app.classList.toggle('collapsed'); try { localStorage.setItem('alphex.sb', app.classList.contains('collapsed') ? '1' : '0'); } catch (e) {} } };
    $('#scrim').onclick = close; document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    $('#bell').onclick = e => { e.stopPropagation(); const o = $('#pop').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); };
    document.addEventListener('click', e => { if (!e.target.closest('.rel')) { $('#pop').classList.remove('open'); $('#bell').setAttribute('aria-expanded', 'false'); } });
    $('#help').onclick = () => go('Documentation'); $('#out').onclick = () => A.auth.logout();
    $('#newp').onclick = () => document.dispatchEvent(new CustomEvent('alphex:create-project'));
    $('#org').onchange = e => A.state.set('org', e.target.value);
    $('#sidebar').addEventListener('click', e => { const a = e.target.closest('a[href="#"]'); if (a) { e.preventDefault(); go(a.dataset.label); } });
    if (window.lucide) lucide.createIcons();
    return user;
  }
  A.shell = { init, go };
})(window.Alphex);
