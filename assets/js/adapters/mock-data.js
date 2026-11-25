/* MOCK DATA for Phase 2: projects, datasets, dataset_records, project_members, activity_logs.
   Plugs into mock-adapter.js through A.mock.ext and answers the same routes as the planned backend contract.
   Metadata is kept in localStorage (small). Uploaded records live in memory only and are lost on reload.
   Demo data only: no multi-user sync, no server storage, no tenant isolation. */
(function (A) {
  const K = 'alphex.mock.v2', E = (s, c, m) => new A.ApiError(s, c, m), ok = (d, m) => ({ data: d, meta: Object.assign({ demo: true }, m || {}) });
  const iso = m => new Date(Date.now() - m * 6e4).toISOString(), day = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const USERS = [{ id: 'usr_demo_1', name: 'Demo User', email: 'demo@example.invalid' }, { id: 'usr_demo_2', name: 'Aisha Khan', email: 'aisha@example.invalid' }, { id: 'usr_demo_3', name: 'Marco Rossi', email: 'marco@example.invalid' }, { id: 'usr_demo_4', name: 'Lena Fischer', email: 'lena@example.invalid' }];
  const KIND = { text: { cols: ['id', 'text', 'source'], gen: i => ({ id: i + 1, text: 'Sample customer message number ' + (i + 1) + ' about an order.', source: ['email', 'chat', 'web'][i % 3] }) },
    images: { cols: ['id', 'image_path', 'width', 'height'], gen: i => ({ id: i + 1, image_path: 'images/shelf_' + String(i + 1).padStart(4, '0') + '.jpg', width: 1920, height: 1080 }) },
    responses: { cols: ['id', 'prompt', 'response_a', 'response_b'], gen: i => ({ id: i + 1, prompt: 'Sample prompt ' + (i + 1), response_a: 'Sample answer A', response_b: 'Sample answer B' }) } };
  const sch = k => KIND[k].cols.map(c => ({ name: c, type: /^(id|width|height)$/.test(c) ? 'number' : 'string', missing: 0 }));
  const PR = (n, name, type, ann, status, pri, org, tasks, pct, mins) => ({ id: 'prj_demo_00' + n, name, description: 'Sample project (demo data).', type, annotation_type: ann, status, priority: pri, organization_id: org, start_date: day(-30), due_date: day(30),
    instructions: 'Sample instructions (demo data).\n1. Read each item fully.\n2. Apply labels according to the guidelines.\n3. Flag unclear items for review.', created_by: 'usr_demo_1', task_count: tasks, progress_pct: pct, created_at: iso(mins + 5000), updated_at: iso(mins) });
  const DS = (n, name, proj, org, fmt, kind, count, size, type, st, mins) => ({ id: 'ds_demo_00' + n, name, description: 'Sample dataset (demo data).', project_id: proj, organization_id: org, file_name: name.toLowerCase().replace(/\W+/g, '_') + '.' + fmt, format: fmt,
    record_count: count, dataset_type: type, size_bytes: size, tags: ['demo'], uploaded_by: 'usr_demo_1', created_at: iso(mins), updated_at: iso(mins), kind, schema: sch(kind),
    validation: { status: st, checked_at: iso(mins), issues: st === 'warnings' ? [{ level: 'warning', message: 'Column "height" has 12 missing values.' }] : [] } });
  const MB = (p, ...u) => u.map(x => ({ id: 'mem_' + p + '_' + x[0], project_id: 'prj_demo_00' + p, user_id: 'usr_demo_' + x[0], organization_id: p < 5 ? 'org_demo_1' : 'org_demo_2', role: x[1] }));
  let db; try { db = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  db = db || {
    projects: [PR(1, 'Support ticket entities', 'text_annotation', 'ner', 'active', 'high', 'org_demo_1', 1200, 64, 35), PR(2, 'Retail shelf images', 'image_annotation', 'bounding_boxes', 'active', 'medium', 'org_demo_1', 860, 31, 190),
      PR(3, 'Assistant response review', 'ai_response_evaluation', 'side_by_side', 'active', 'high', 'org_demo_1', 400, 78, 1500), PR(4, 'Product catalogue review', 'multimodal_evaluation', 'multimodal', 'draft', 'low', 'org_demo_1', 0, 0, 3000),
      PR(5, 'Contract clause tagging', 'text_annotation', 'span_annotation', 'completed', 'medium', 'org_demo_2', 300, 100, 5000), PR(6, 'Safety prompt comparison', 'ai_response_evaluation', 'rubric', 'active', 'urgent', 'org_demo_2', 150, 12, 90)],
    datasets: [DS(1, 'Support tickets Q3', 'prj_demo_001', 'org_demo_1', 'csv', 'text', 1200, 412000, 'text', 'valid', 60), DS(2, 'Shelf photo manifest', 'prj_demo_002', 'org_demo_1', 'json', 'images', 860, 188000, 'image_manifest', 'warnings', 300),
      DS(3, 'Assistant prompts', 'prj_demo_003', 'org_demo_1', 'jsonl', 'responses', 400, 236000, 'ai_responses', 'valid', 1600), DS(4, 'Contract clauses', 'prj_demo_005', 'org_demo_2', 'csv', 'text', 300, 98000, 'text', 'valid', 5200), DS(5, 'Safety prompts', 'prj_demo_006', 'org_demo_2', 'jsonl', 'responses', 150, 61000, 'ai_responses', 'valid', 100)],
    members: [].concat(MB(1, [1, 'manager'], [2, 'annotator'], [3, 'reviewer']), MB(2, [1, 'manager'], [4, 'annotator']), MB(3, [1, 'manager'], [2, 'annotator'], [3, 'reviewer'], [4, 'annotator']), MB(4, [1, 'manager']), MB(5, [1, 'manager'], [3, 'reviewer']), MB(6, [1, 'manager'], [2, 'annotator'])),
    activity: [{ id: 'act_s1', organization_id: 'org_demo_1', project_id: 'prj_demo_001', dataset_id: 'ds_demo_001', actor_id: 'usr_demo_1', action: 'dataset_uploaded', summary: 'Dataset uploaded: Support tickets Q3', created_at: iso(60) },
      { id: 'act_s2', organization_id: 'org_demo_1', project_id: 'prj_demo_001', dataset_id: null, actor_id: 'usr_demo_1', action: 'project_updated', summary: 'Project updated: Support ticket entities', created_at: iso(35) },
      { id: 'act_s3', organization_id: 'org_demo_1', project_id: 'prj_demo_003', dataset_id: 'ds_demo_003', actor_id: 'usr_demo_1', action: 'dataset_uploaded', summary: 'Dataset uploaded: Assistant prompts', created_at: iso(1600) }] };
  const MEM = {}, save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) {} };
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const uname = id => { if (id === 'usr_demo_1') { try { return JSON.parse(sessionStorage.getItem('alphex.mock.session')).name; } catch (e) {} } const u = USERS.find(x => x.id === id); return u ? u.name : 'Unknown'; };
  const log = (action, o) => { db.activity.unshift({ id: uid('act'), organization_id: o.organization_id, project_id: o.project_id || null, dataset_id: o.dataset_id || null, actor_id: 'usr_demo_1', action, summary: o.s, created_at: new Date().toISOString() }); db.activity = db.activity.slice(0, 200); };
  const pv = p => { const ds = db.datasets.filter(d => d.project_id === p.id); return Object.assign({}, p, { dataset_count: ds.length, stats: { dataset_items: ds.reduce((s, d) => s + d.record_count, 0), progress_pct: p.progress_pct },
    members: db.members.filter(m => m.project_id === p.id).map(m => ({ user_id: m.user_id, name: uname(m.user_id), email: (USERS.find(u => u.id === m.user_id) || {}).email, role: m.role })) }); };
  const dv = d => { const x = Object.assign({}, d, { project_name: (db.projects.find(p => p.id === d.project_id) || {}).name || null, uploaded_by_name: uname(d.uploaded_by) }); delete x.kind; x.records_in_memory = !!MEM[d.id] || !!d.kind; return x; };
  const flt = (a, q, keys) => { const s = (q.q || '').toLowerCase(); return a.filter(x => (!q.organization_id || x.organization_id === q.organization_id) && (!s || keys.some(k => String(x[k] || '').toLowerCase().includes(s)))); };
  const paged = (a, q, key, map) => { key = q.sort || key; const dir = q.order === 'asc' ? 1 : -1, lim = Math.min(+q.limit || 10, 100), pg = Math.max(1, +q.page || 1);
    a = a.slice().sort((x, y) => String(x[key]).localeCompare(String(y[key]), undefined, { numeric: true, sensitivity: 'base' }) * dir); return ok(a.slice((pg - 1) * lim, pg * lim).map(map), { page: pg, limit: lim, total: a.length }); };
  const pick = (b, k) => { const o = {}; k.forEach(f => { if (b[f] !== undefined) o[f] = typeof b[f] === 'string' ? b[f].trim() : b[f]; }); return o; };
  const PF = ['name', 'description', 'type', 'annotation_type', 'priority', 'start_date', 'due_date', 'instructions', 'status'], DF = ['name', 'description', 'dataset_type', 'tags', 'project_id'];
  const vp = o => { if (!o.name || o.name.length > 120) throw E(422, 'VALIDATION', 'Project name is required (max 120 characters).'); if (!A.util.TYPES[o.type]) throw E(422, 'VALIDATION', 'Unknown project type.');
    if (o.start_date && o.due_date && o.due_date < o.start_date) throw E(422, 'VALIDATION', 'Due date cannot be before the start date.'); };
  const TASKS = { org_demo_1: { pending: 540, in_progress: 310, completed: 1480, awaiting_review: 120 }, org_demo_2: { pending: 200, in_progress: 90, completed: 410, awaiting_review: 35 } };
  const find = (a, id, what) => { const x = a.find(y => y.id === id); if (!x) throw E(404, 'NOT_FOUND', what + ' not found.'); return x; };
  A.mock.ext = async function (m, p, q, b) {
    b = b || {}; const r = m + ' ' + p, mm = p.match(/^\/(projects|datasets)\/([^/]+)(\/records)?$/), id = mm && mm[2], kind = mm && mm[1];
    if (r === 'GET /projects') { let a = flt(db.projects, q, ['name', 'description', 'id']).filter(x => q.status ? x.status === q.status : x.status !== 'archived'); if (q.type) a = a.filter(x => x.type === q.type); return paged(a.map(pv), q, 'created_at', x => x); }
    if (r === 'POST /projects') { const o = Object.assign({ priority: 'medium', status: 'draft', description: '', instructions: '' }, pick(b, PF)); o.organization_id = b.organization_id; vp(o); if (!o.organization_id) throw E(422, 'VALIDATION', 'organization_id is required.');
      const now = new Date().toISOString(), x = Object.assign(o, { id: uid('prj_demo'), created_by: 'usr_demo_1', task_count: 0, progress_pct: 0, created_at: now, updated_at: now });
      db.projects.unshift(x); db.members.push({ id: uid('mem'), project_id: x.id, user_id: 'usr_demo_1', organization_id: x.organization_id, role: 'manager' }); log('project_created', { organization_id: x.organization_id, project_id: x.id, s: 'Project created: ' + x.name }); save(); return ok(pv(x)); }
    if (kind === 'projects' && !mm[3]) { const x = find(db.projects, id, 'Project');
      if (m === 'GET') return ok(pv(x));
      if (m === 'PATCH') { const n = Object.assign({}, x, pick(b, PF)); vp(n); Object.assign(x, n, { updated_at: new Date().toISOString() }); log(x.status === 'archived' && b.status === 'archived' ? 'project_archived' : 'project_updated', { organization_id: x.organization_id, project_id: x.id, s: (b.status === 'archived' ? 'Project archived: ' : 'Project updated: ') + x.name }); save(); return ok(pv(x)); }
      if (m === 'DELETE') { db.projects = db.projects.filter(y => y.id !== id); db.members = db.members.filter(y => y.project_id !== id); db.datasets.forEach(d => { if (d.project_id === id) d.project_id = null; }); log('project_deleted', { organization_id: x.organization_id, s: 'Project deleted: ' + x.name }); save(); return ok(null); } }
    if (r === 'GET /datasets') { let a = flt(db.datasets, q, ['name', 'description', 'file_name', 'id']); if (q.project_id) a = a.filter(x => x.project_id === q.project_id); if (q.format) a = a.filter(x => x.format === q.format); if (q.status) a = a.filter(x => x.validation.status === q.status); return paged(a, q, 'created_at', dv); }
    if (r === 'POST /datasets') { const o = pick(b, DF); if (!o.name || o.name.length > 120) throw E(422, 'VALIDATION', 'Dataset name is required (max 120 characters).'); if (!['csv', 'json', 'jsonl'].includes(b.format)) throw E(422, 'VALIDATION', 'Format must be csv, json or jsonl.');
      if (!b.organization_id) throw E(422, 'VALIDATION', 'organization_id is required.'); if (o.project_id) find(db.projects, o.project_id, 'Project'); const now = new Date().toISOString();
      const x = Object.assign({ description: '', project_id: null, dataset_type: 'text', tags: [] }, o, { id: uid('ds_demo'), organization_id: b.organization_id, file_name: String(b.file_name || o.name).slice(0, 200), format: b.format, record_count: +b.record_count || 0, size_bytes: +b.size_bytes || 0,
        schema: b.schema || [], validation: b.validation || { status: 'valid', issues: [], checked_at: now }, uploaded_by: 'usr_demo_1', created_at: now, updated_at: now });
      if (Array.isArray(b._records)) MEM[x.id] = b._records; db.datasets.unshift(x); log('dataset_uploaded', { organization_id: x.organization_id, project_id: x.project_id, dataset_id: x.id, s: 'Dataset uploaded: ' + x.name }); save(); return ok(dv(x)); }
    if (kind === 'datasets') { const x = find(db.datasets, id, 'Dataset');
      if (mm[3] && m === 'GET') { const lim = +q.limit || 10, pg = +q.page || 1, s = (pg - 1) * lim; let rows = [], av = true;
        if (MEM[id]) rows = MEM[id].slice(s, s + lim); else if (x.kind) for (let i = s; i < Math.min(x.record_count, s + lim); i++) rows.push(KIND[x.kind].gen(i)); else av = false;
        return ok(rows.map((d, i) => ({ id: 'rec_' + id + '_' + (s + i + 1), dataset_id: id, organization_id: x.organization_id, index: s + i + 1, data: d })), { page: pg, limit: lim, total: x.record_count, available: av }); }
      if (!mm[3]) { if (m === 'GET') return ok(dv(x));
        if (m === 'PATCH') { const o = pick(b, DF); if ('name' in o && !o.name) throw E(422, 'VALIDATION', 'Dataset name is required.'); if (o.project_id) find(db.projects, o.project_id, 'Project'); if (o.project_id === '') o.project_id = null;
          Object.assign(x, o, { updated_at: new Date().toISOString() }); log('dataset_updated', { organization_id: x.organization_id, project_id: x.project_id, dataset_id: x.id, s: 'Dataset updated: ' + x.name }); save(); return ok(dv(x)); }
        if (m === 'DELETE') { db.datasets = db.datasets.filter(y => y.id !== id); delete MEM[id]; log('dataset_deleted', { organization_id: x.organization_id, project_id: x.project_id, s: 'Dataset deleted: ' + x.name }); save(); return ok(null); } } }
    if (r === 'GET /activity-logs') { let a = db.activity.filter(x => (!q.organization_id || x.organization_id === q.organization_id) && (!q.project_id || x.project_id === q.project_id) && (!q.dataset_id || x.dataset_id === q.dataset_id));
      return ok(a.slice(0, +q.limit || 20).map(x => Object.assign({}, x, { actor_name: uname(x.actor_id) }))); }
    if (r === 'GET /dashboard/summary') { const o = q.organization_id, ps = db.projects.filter(x => x.organization_id === o && x.status !== 'archived'), t = TASKS[o] || { pending: 0, in_progress: 0, completed: 0, awaiting_review: 0 };
      return ok({ projects_total: ps.length, projects_active: ps.filter(x => x.status === 'active').length, tasks: t, tasks_total: t.pending + t.in_progress + t.completed + t.awaiting_review, datasets_total: db.datasets.filter(x => x.organization_id === o).length }); }
    if (r === 'GET /dashboard/activity') return ok(db.activity.filter(x => x.organization_id === q.organization_id).slice(0, 6).map(x => ({ id: x.id, type: x.action, text: x.summary, at: x.created_at })));
  };
})(window.Alphex);
