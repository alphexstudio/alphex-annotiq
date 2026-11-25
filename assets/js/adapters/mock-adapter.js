/* MOCK ADAPTER (development only). Answers the same REST routes as docs/API_CONTRACTS.md so services need no changes
   when MODE becomes 'production'. Everything here is sample data kept in this browser. It is not a database. */
(function (A) {
  const K = 'alphex.mock.v1', S = 'alphex.mock.session', PEND = 'alphex.mock.pending';
  const iso = m => new Date(Date.now() - m * 6e4).toISOString();
  const ORGS = [{ id: 'org_demo_1', name: 'Demo Organization' }, { id: 'org_demo_2', name: 'Sample Labs' }];
  const TASKS = { org_demo_1: { pending: 540, in_progress: 310, completed: 1480, awaiting_review: 120 }, org_demo_2: { pending: 200, in_progress: 90, completed: 410, awaiting_review: 35 } };
  const DS = { org_demo_1: 7, org_demo_2: 3 };
  const P = (id, name, type, status, org, n, pct, m) => ({ id: 'prj_demo_' + id, name, description: 'Sample project (demo data).', type, annotation_type: null, status, organization_id: org, guidelines: '', created_at: iso(m + 4000), updated_at: iso(m), stats: { dataset_items: n, progress_pct: pct } });
  let db; try { db = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  db = db || { projects: [P('001', 'Support ticket entities', 'text_annotation', 'active', 'org_demo_1', 1200, 64, 35), P('002', 'Retail shelf images', 'image_annotation', 'active', 'org_demo_1', 860, 31, 190),
    P('003', 'Assistant response review', 'ai_response_evaluation', 'active', 'org_demo_1', 400, 78, 1500), P('004', 'Product catalogue', 'multimodal_annotation', 'draft', 'org_demo_1', 0, 0, 3000),
    P('005', 'Contract clause tagging', 'text_annotation', 'completed', 'org_demo_2', 300, 100, 5000), P('006', 'Safety prompt comparison', 'ai_response_evaluation', 'active', 'org_demo_2', 150, 12, 90)] };
  const save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) {} };
  const E = (s, c, m) => new A.ApiError(s, c, m), ok = d => ({ data: d, meta: { demo: true } });
  const nm = e => e.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Demo User';
  const sess = () => { try { return JSON.parse(sessionStorage.getItem(S)); } catch (e) { return null; } };
  const signIn = (email, name) => { const u = { id: 'usr_demo_1', name, email, avatar: null, organization_id: 'org_demo_1', role: 'owner' }; sessionStorage.setItem(S, JSON.stringify(u)); return u; };
  async function handle(method, path, body) {
    await new Promise(r => setTimeout(r, 250)); body = body || {};
    const [p, qs] = path.split('?'), q = Object.fromEntries(new URLSearchParams(qs || '')), r = method + ' ' + p;
    const x = A.mock.ext && await A.mock.ext(method, p, q, body); if (x) return x;
    switch (r) {
      case 'POST /auth/login': if (!body.email || !body.password) throw E(422, 'VALIDATION', 'Email and password are required.'); return ok({ user: signIn(body.email, nm(body.email)), token: null });
      case 'POST /auth/register': if (!body.name || !body.email || (body.password || '').length < 8) throw E(422, 'VALIDATION', 'Name, email and a password of at least 8 characters are required.');
        sessionStorage.setItem(PEND, JSON.stringify({ name: body.name, email: body.email })); return ok({ email: body.email, verification_required: true });
      case 'POST /auth/verify': { const u = JSON.parse(sessionStorage.getItem(PEND) || 'null'); if (!u) throw E(400, 'NO_PENDING_SIGNUP', 'Create an account first.');
        if (!/^\d{6}$/.test(body.code || '')) throw E(422, 'INVALID_CODE', 'Enter the 6-digit code.'); sessionStorage.removeItem(PEND); return ok({ user: signIn(u.email, u.name) }); }
      case 'POST /auth/resend': case 'POST /auth/forgot-password': return ok({ sent: true });
      case 'POST /auth/logout': sessionStorage.removeItem(S); return ok(null);
      case 'GET /auth/me': { const u = sess(); if (!u) throw E(401, 'UNAUTHENTICATED', 'Sign in to continue.'); return ok(u); }
      case 'GET /organizations': return ok(ORGS);
      case 'GET /projects': { const l = db.projects.filter(x => (!q.organization_id || x.organization_id === q.organization_id) && (q.status ? x.status === q.status : x.status !== 'archived'));
        l.sort((a, b) => b.updated_at.localeCompare(a.updated_at)); return ok(l.slice(0, +q.limit || 50)); }
      case 'POST /projects': { const n = (body.name || '').trim(); if (!n) throw E(422, 'VALIDATION', 'Project name is required.'); const now = new Date().toISOString();
        const x = { id: 'prj_demo_' + Date.now().toString(36), name: n, description: body.description || '', type: body.type, annotation_type: body.annotation_type || null, status: body.status === 'active' ? 'active' : 'draft',
          organization_id: body.organization_id, guidelines: body.guidelines || '', created_at: now, updated_at: now, stats: { dataset_items: 0, progress_pct: 0 } };
        db.projects.unshift(x); save(); return ok(x); }
      case 'GET /dashboard/summary': { const o = q.organization_id, ps = db.projects.filter(x => x.organization_id === o && x.status !== 'archived'), t = TASKS[o] || { pending: 0, in_progress: 0, completed: 0, awaiting_review: 0 };
        return ok({ projects_total: ps.length, projects_active: ps.filter(x => x.status === 'active').length, tasks: t, tasks_total: t.pending + t.in_progress + t.completed + t.awaiting_review, datasets_total: DS[o] || 0 }); }
      case 'GET /dashboard/activity': return ok([{ id: 'act_1', type: 'annotation_submitted', text: 'Annotation submitted in Support ticket entities', at: iso(12) }, { id: 'act_2', type: 'review_completed', text: 'Review completed in Assistant response review', at: iso(48) },
        { id: 'act_3', type: 'dataset_uploaded', text: 'Dataset uploaded to Retail shelf images', at: iso(200) }, { id: 'act_4', type: 'task_created', text: 'Tasks created in Safety prompt comparison', at: iso(900) }, { id: 'act_5', type: 'project_updated', text: 'Project settings updated: Product catalogue', at: iso(1700) }]);
      default: throw E(404, 'NOT_FOUND', 'No mock route for ' + r);
    }
  }
  A.mock = { handle };
})(window.Alphex);
