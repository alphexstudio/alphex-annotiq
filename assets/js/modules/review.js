/* Review queue: list submitted annotations and evaluations, approve or reject with comments. Role enforcement belongs to the backend. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, M = A.model, $ = s => document.querySelector(s), ic = () => window.lucide && lucide.createIcons(); const S = { status: 'pending', page: 1 }; let rows = [];
  const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
  async function load() {
    $('#tabs').innerHTML = TABS.map(([k, l]) => '<button role="tab" type="button" data-t="' + k + '" aria-selected="' + (k === S.status) + '">' + l + '</button>').join(''); $('#list').innerHTML = ui.skel(4);
    try { const r = await A.reviews.list({ organization_id: A.state.get('org'), status: S.status, page: S.page, limit: 10 }); rows = r.items;
      $('#list').innerHTML = r.items.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Task</th><th>Project</th><th>Type</th><th>Submitted by</th><th>Updated</th><th>Version</th><th></th></tr></thead><tbody>' + r.items.map((t, i) => { const s = t.annotation || t.evaluation;
        return '<tr><td>' + esc(t.id) + '</td><td>' + esc(t.project_name || t.project_id) + '</td><td>' + (t.annotation ? 'Annotation' : 'Evaluation') + '</td><td>' + esc(t.assigned_to_name || '-') + '</td><td>' + U.ago(t.updated_at) + '</td><td>' + (s ? s.version : '-') + '</td><td><button class="btn sec" type="button" data-i="' + i + '">Open</button></td></tr>'; }).join('') + '</tbody></table></div>' : ui.empty('Nothing here yet. Submitted annotations and evaluations appear in the Pending tab.');
      ui.pager($('#pgr'), { page: S.page, limit: 10, total: r.total, onPage: p => { S.page = p; load(); } });
    } catch (e) { $('#list').innerHTML = ui.fail(e); $('#pgr').innerHTML = ''; }
  }
  async function open(i) {
    const t = rows[i]; let P; try { P = await A.projects.get(t.project_id); } catch (e) { return U.toast(e.message); }
    const ann = !!t.annotation, d = ann ? t.annotation.annotation_data : t.evaluation.evaluation_data, L = M.config(P).labels; let body;
    if (ann) body = M.mode(P) === 'cls' ? '<p>' + (d.labels || []).map(l => ui.badge(l, true)).join(' ') + '</p><div class="doc">' + esc(t.payload.text) + '</div>' : '<div class="doc">' + A.textui.html(t.payload.text, d.spans || [], L) + '</div><p class="small">' + (d.spans || []).length + ' span(s).</p>';
    else body = A.evalui.detail(P, t, d);
    const past = t.reviews.length ? '<h2 style="margin-top:16px">Previous reviews</h2><ul class="iss">' + t.reviews.map(r => '<li>' + esc(r.decision) + ': ' + esc(r.comments || 'No comments') + '</li>').join('') + '</ul>' : '';
    const dl = ui.dialog('<h2>' + esc(t.id) + '</h2><p class="small">' + esc(t.project_name) + ', ' + (ann ? 'annotation' : 'evaluation') + ', version ' + (t.annotation || t.evaluation).version + '</p>' + body + past +
      (S.status === 'pending' ? '<label class="fld">Reviewer comments (required to reject)<textarea id="rc" maxlength="2000"></textarea></label><p class="msg" id="rm" role="alert"></p><div class="acts"><button class="btn sec" type="button" data-x>Close</button><button class="btn sec" type="button" data-d="rejected">Reject</button><button class="btn pri" type="button" data-d="approved">Approve</button></div>' : '<div class="acts"><button class="btn sec" type="button" data-x>Close</button></div>'), 'wide');
    dl.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-x')) return dl.close(); const c = dl.querySelector('#rc').value.trim();
      if (b.dataset.d === 'rejected' && !c) { dl.querySelector('#rm').textContent = 'Add a comment explaining what to fix.'; return; }
      try { await A.reviews.decide(t.id, b.dataset.d, c); dl.close(); U.toast(b.dataset.d === 'approved' ? 'Approved.' : 'Returned to the annotator for revision.'); load(); } catch (er) { dl.querySelector('#rm').textContent = er.message; } };
  }
  document.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (t) { S.status = t.dataset.t; S.page = 1; load(); } const o = e.target.closest('[data-i]'); if (o) open(+o.dataset.i); const r = e.target.closest('[data-act="retry"]'); if (r) load(); });
  A.shell.init().then(() => { A.state.on('org', load); load(); ic(); }).catch(e => document.body.insertAdjacentHTML('afterbegin', '<div class="banner" role="alert">' + esc(e.message) + '</div>'));
})(window.Alphex);
