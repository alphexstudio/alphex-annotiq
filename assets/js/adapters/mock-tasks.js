/* MOCK task backend (Phase 3): tasks, assignments, annotations, evaluations, reviews. Stand-in for server logic. Local to this browser, no multi-user sync.
   Metadata persists in localStorage (alphex.mock.v3). Task payloads are small snapshots of dataset records. */
(function (A) {
  const C = A.mock.core, M = A.model, E = C.E, ok = C.ok, K = 'alphex.mock.v3', ME = 'usr_demo_1';
  let T; try { T = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  T = T || { tasks: [], assignments: [], annotations: [], evaluations: [], reviews: [] };
  const save = () => { try { localStorage.setItem(K, JSON.stringify(T)); } catch (e) {} }, now = () => new Date().toISOString();
  const proj = id => C.find(C.db.projects, id, 'Project'), task = id => C.find(T.tasks, id, 'Task');
  const tlog = (t, a, s) => { C.db.activity.unshift({ id: C.uid('act'), organization_id: t.organization_id, project_id: t.project_id, dataset_id: t.dataset_id, task_id: t.id, actor_id: ME, action: a, summary: s, created_at: now() }); C.save(); };
  const tv = t => Object.assign({}, t, { assigned_to_name: t.assigned_to ? C.uname(t.assigned_to) : null, annotation: T.annotations.find(x => x.task_id === t.id) || null, evaluation: T.evaluations.find(x => x.task_id === t.id) || null, reviews: T.reviews.filter(r => r.task_id === t.id) });
  function generate(pid) {
    const p = proj(pid), m = M.mode(p); if (!m) throw E(422, 'UNSUPPORTED', 'This project type has no workspace yet.');
    const ev = ['single', 'side', 'rubric', 'ranking'].includes(m); let created = 0, skipped = 0;
    C.db.datasets.filter(d => d.project_id === pid).forEach(d => C.recordsOf(d.id, 25).forEach((r, i) => {
      const id = 'tsk_' + d.id.replace('ds_', '') + '_' + (i + 1); if (T.tasks.some(t => t.id === id)) return;
      const pl = ev ? M.evalPayload(r) : M.textPayload(r); if (!pl) { skipped++; return; }
      T.tasks.push({ id, organization_id: p.organization_id, project_id: pid, dataset_id: d.id, record_id: 'rec_' + d.id + '_' + (i + 1), index: i + 1, task_type: ev ? 'ai_evaluation' : 'text_annotation', status: 'unassigned', review_status: 'none', assigned_to: null, payload: pl, created_at: now(), updated_at: now() }); created++;
    }));
    save(); return { created, skipped, total: T.tasks.filter(t => t.project_id === pid).length };
  }
  function check(t, data, submit) {
    const p = proj(t.project_id), er = t.task_type === 'text_annotation' ? M.vAnnotation(p, t.payload.text, data, submit) : M.vEvaluation(p, t.payload, data, submit);
    if (er.length) throw E(422, 'VALIDATION', er.join(' '));
  }
  function upsert(t, data, status) {
    const ann = t.task_type === 'text_annotation', p = proj(t.project_id), list = ann ? T.annotations : T.evaluations; let x = list.find(y => y.task_id === t.id);
    if (!x) { x = Object.assign({ id: C.uid(ann ? 'ann' : 'evl'), organization_id: t.organization_id, project_id: t.project_id, task_id: t.id, version: 0, created_at: now() }, ann ? { annotator_id: ME, annotation_type: p.annotation_type } : { evaluator_id: ME, method: p.annotation_type }); list.push(x); }
    x[ann ? 'annotation_data' : 'evaluation_data'] = JSON.parse(JSON.stringify(data)); x.status = status; x.updated_at = now(); return x;
  }
  async function mine(m, p, q, b) {
    const r = m + ' ' + p; let mm = p.match(/^\/projects\/([^/]+)\/tasks\/generate$/);
    if (mm && m === 'POST') { const g = generate(mm[1]); return ok(g); }
    if (r === 'GET /tasks') { const a = T.tasks.filter(t => (!q.project_id || t.project_id === q.project_id) && (!q.status || t.status === q.status) && (!q.organization_id || t.organization_id === q.organization_id)).sort((x, y) => x.dataset_id.localeCompare(y.dataset_id) || x.index - y.index);
      const lim = Math.min(+q.limit || 20, 200), pg = Math.max(1, +q.page || 1); return ok(a.slice((pg - 1) * lim, pg * lim).map(tv), { page: pg, limit: lim, total: a.length }); }
    mm = p.match(/^\/tasks\/([^/]+)(?:\/(assign|skip|submit|draft))?$/);
    if (mm) { const t = task(mm[1]), a = mm[2];
      if (!a && m === 'GET') return ok(tv(t));
      if (a === 'assign' && m === 'POST') { if (t.assigned_to && t.assigned_to !== ME) throw E(409, 'ALREADY_ASSIGNED', 'This task is assigned to another user.');
        if (t.status === 'unassigned' || t.status === 'skipped') { t.status = 'assigned'; t.assigned_to = ME; t.updated_at = now(); T.assignments.push({ id: C.uid('asg'), task_id: t.id, organization_id: t.organization_id, user_id: ME, assigned_at: now() }); tlog(t, 'task_assigned', 'Task assigned: ' + t.id); save(); } return ok(tv(t)); }
      if (a === 'skip' && m === 'POST') { if (t.status === 'completed') throw E(409, 'ALREADY_SUBMITTED', 'A submitted task cannot be skipped.'); t.status = 'skipped'; t.assigned_to = null; t.updated_at = now(); tlog(t, 'task_skipped', 'Task skipped: ' + t.id); save(); return ok(tv(t)); }
      if ((a === 'draft' && m === 'PUT') || (a === 'submit' && m === 'POST')) { const sub = a === 'submit';
        if (t.assigned_to !== ME) throw E(403, 'NOT_ASSIGNED', 'This task is not assigned to you.'); if (t.status === 'completed') throw E(409, 'ALREADY_SUBMITTED', 'This task was already submitted.');
        check(t, b.data, sub); const x = upsert(t, b.data, sub ? 'submitted' : 'draft');
        if (sub) { x.version++; t.status = 'completed'; t.review_status = 'pending'; tlog(t, 'task_submitted', 'Task submitted: ' + t.id + (x.version > 1 ? ' (revision ' + x.version + ')' : '')); } else t.status = 'in_progress';
        t.updated_at = now(); save(); return ok(sub ? tv(t) : { saved_at: x.updated_at, task: tv(t) }); } }
    if (r === 'GET /reviews') { const st = q.status || 'pending', a = T.tasks.filter(t => t.review_status === st && (!q.organization_id || t.organization_id === q.organization_id) && (!q.project_id || t.project_id === q.project_id)).sort((x, y) => y.updated_at.localeCompare(x.updated_at));
      const lim = Math.min(+q.limit || 10, 100), pg = Math.max(1, +q.page || 1); return ok(a.slice((pg - 1) * lim, pg * lim).map(t => Object.assign(tv(t), { project_name: (C.db.projects.find(x => x.id === t.project_id) || {}).name })), { page: pg, limit: lim, total: a.length }); }
    if (r === 'POST /reviews') { const t = task(b.task_id); if (t.review_status !== 'pending') throw E(409, 'NOT_PENDING', 'This submission is not awaiting review.');
      if (!['approved', 'rejected'].includes(b.decision)) throw E(422, 'VALIDATION', 'Decision must be approved or rejected.'); const cm = String(b.comments || '').trim().slice(0, 2000);
      if (b.decision === 'rejected' && !cm) throw E(422, 'VALIDATION', 'Comments are required when rejecting.');
      const ann = t.task_type === 'text_annotation', s = (ann ? T.annotations : T.evaluations).find(x => x.task_id === t.id), rv = { id: C.uid('rev'), organization_id: t.organization_id, project_id: t.project_id, task_id: t.id, subject_type: ann ? 'annotation' : 'evaluation', subject_id: s.id, reviewer_id: ME, decision: b.decision, comments: cm, created_at: now() };
      T.reviews.push(rv); t.review_status = b.decision; s.status = b.decision; if (b.decision === 'rejected') t.status = 'in_progress'; t.updated_at = now(); tlog(t, 'review_completed', 'Review ' + b.decision + ': ' + t.id); save(); return ok(rv); }
  }
  const prev = A.mock.ext; A.mock.ext = async function (m, p, q, b) { const x = await mine(m, p, q, b || {}); return x || prev(m, p, q, b); };
})(window.Alphex);
