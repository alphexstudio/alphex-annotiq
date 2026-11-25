/* Logic tests for the shared model, parser and mock backend. Run: node tests/run-tests.js
   They do not test the DOM. See tests/ui-smoke.py for the browser smoke test. */
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'assets', 'js/');
const FILES = 'core/config.js core/state.js core/api-client.js core/ui.js core/task-model.js adapters/mock-adapter.js adapters/mock-data.js adapters/mock-tasks.js core/auth-service.js services/project-service.js services/dataset-service.js services/dataset-parser.js services/task-service.js services/annotation-service.js services/evaluation-service.js services/review-service.js modules/text-render.js modules/eval-render.js'.split(' ');
const store = () => { const m = {}; return { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
const LS = store(), SS = store();
function boot() { const c = { localStorage: LS, sessionStorage: SS, URLSearchParams, console, setTimeout: f => { f(); return 0; }, clearTimeout() {}, Date }; c.window = c; vm.createContext(c); FILES.forEach(f => vm.runInContext(fs.readFileSync(root + f, 'utf8'), c, { filename: f })); return c.Alphex; }
let pass = 0, fail = 0; const out = [];
async function t(name, f) { try { await f(); pass++; out.push('PASS ' + name); } catch (e) { fail++; out.push('FAIL ' + name + ' - ' + e.message); } }
const rej = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ', got ' + e.code + ' (' + e.message + ')'); return e; } throw new Error('expected rejection ' + code); };
(async () => {
  let A = boot(); const ORG = 'org_demo_1';
  await t('login (mock)', async () => { const u = await A.auth.login('a.tester@example.invalid', 'x'); assert.strictEqual(u.id, 'usr_demo_1'); });
  await t('parser: CSV inconsistent columns, missing values, blank rows', () => { const r = A.parser.parse('text,label\nhello,a\nonly\n,\n\nlast,b,extra\n', 'csv'); assert.strictEqual(r.status, 'warnings'); assert(r.issues.some(i => /expected 2/.test(i.message))); assert(r.issues.some(i => /blank row/.test(i.message))); });
  await t('parser: empty file, invalid JSON, non-array JSON, bad JSONL, unsupported', () => { assert.strictEqual(A.parser.parse('  ', 'csv').status, 'errors'); assert.strictEqual(A.parser.parse('{bad', 'json').status, 'errors'); assert.strictEqual(A.parser.parse('{"a":1}', 'json').status, 'errors');
    const j = A.parser.parse('{"a":1}\nnot json\n{"a":2}', 'jsonl'); assert.strictEqual(j.records.length, 2); assert.strictEqual(j.status, 'warnings'); assert.strictEqual(A.parser.parse('x', 'txt').status, 'errors'); });
  await t('config defaults for old projects and config validation', () => { const c = A.model.config({ annotation_type: 'ner' }); assert.strictEqual(c.labels.length, 8); assert.strictEqual(c.rubric.max, 5); assert.strictEqual(c.rubric.dimensions.length, 6);
    assert(A.model.vConfig({ rubric: { min: 5, max: 1 } }).length); assert(A.model.vConfig({ labels: ['a', 'A'] }).length); assert.strictEqual(A.model.vConfig({ labels: ['x'], selection: 'multi' }).length, 0); });
  const tasksOf = async pid => (await A.tasks.page({ project_id: pid, limit: 200 })).items;
  await t('NER: generate tasks, draft, offset validation, submit, duplicate submit', async () => {
    const g = await A.tasks.generate('prj_demo_001'); assert.strictEqual(g.created, 25); assert.strictEqual((await A.tasks.generate('prj_demo_001')).created, 0);
    let tk = (await tasksOf('prj_demo_001'))[0]; assert.strictEqual(tk.status, 'unassigned'); tk = await A.tasks.assign(tk.id); assert.strictEqual(tk.status, 'assigned');
    const txt = tk.payload.text, s = 'Maria Lopez', st = txt.indexOf(s); assert(st >= 0); const sp = (a, b, l, id) => ({ id, start: a, end: b, text: txt.slice(a, b), label: l });
    await A.annotations.saveDraft(tk.id, { spans: [sp(st, st + s.length, 'PERSON', 'sp1')] }); assert.strictEqual((await A.tasks.get(tk.id)).status, 'in_progress');
    await rej(A.annotations.saveDraft(tk.id, { spans: [{ id: 'x', start: 0, end: 5, text: 'WRONG', label: 'PERSON' }] }), 'VALIDATION');
    await rej(A.annotations.saveDraft(tk.id, { spans: [sp(0, 10, 'PERSON', 'a'), sp(5, 15, 'DATE', 'b')] }), 'VALIDATION');
    await rej(A.annotations.saveDraft(tk.id, { spans: [sp(0, 5, 'NOPE', 'a')] }), 'VALIDATION'); await rej(A.annotations.saveDraft(tk.id, { spans: [{ id: 'z', start: -1, end: 4, text: 'x', label: 'DATE' }] }), 'VALIDATION');
    const done = await A.annotations.submit(tk.id, { spans: [sp(st, st + s.length, 'PERSON', 'sp1')] }); assert.strictEqual(done.status, 'completed'); assert.strictEqual(done.review_status, 'pending');
    await rej(A.annotations.submit(tk.id, { spans: [] }), 'ALREADY_SUBMITTED'); });
  await t('skip a task and reopen it', async () => { const tk = (await tasksOf('prj_demo_001'))[1]; const s = await A.tasks.skip(tk.id); assert.strictEqual(s.status, 'skipped'); assert.strictEqual((await A.tasks.assign(tk.id)).status, 'assigned'); });
  await t('review: reject needs comments, reject, revise, resubmit, approve, no double review', async () => {
    const tk = (await tasksOf('prj_demo_001'))[0]; const q = await A.reviews.list({ status: 'pending', organization_id: ORG }); assert.strictEqual(q.total, 1);
    await rej(A.reviews.decide(tk.id, 'rejected', ' '), 'VALIDATION'); await A.reviews.decide(tk.id, 'rejected', 'Missing the date.');
    let r = await A.tasks.get(tk.id); assert.strictEqual(r.status, 'in_progress'); assert.strictEqual(r.review_status, 'rejected'); assert.strictEqual(r.annotation.status, 'rejected');
    const txt = r.payload.text, d = txt.indexOf('14 March'); const spans = r.annotation.annotation_data.spans.concat({ id: 'sp2', start: d, end: d + 8, text: '14 March', label: 'DATE' });
    await A.annotations.saveDraft(tk.id, { spans }); r = await A.annotations.submit(tk.id, { spans }); assert.strictEqual(r.review_status, 'pending'); assert.strictEqual(r.annotation.version, 2);
    await A.reviews.decide(tk.id, 'approved', ''); assert.strictEqual((await A.tasks.get(tk.id)).review_status, 'approved'); await rej(A.reviews.decide(tk.id, 'approved', ''), 'NOT_PENDING'); });
  await t('classification: single vs multi-label, custom labels, empty submit', async () => {
    const cfg = { labels: ['Spam', 'Ham', 'Promo'] }; const p = await A.projects.create({ name: 'Cls', type: 'text_annotation', annotation_type: 'text_classification', organization_id: ORG, config: cfg });
    const m = await A.projects.create({ name: 'Multi', type: 'text_annotation', annotation_type: 'multilabel_classification', organization_id: ORG });
    const recs = [{ text: 'win a prize now' }, { text: 'meeting at noon' }]; for (const pr of [p, m]) await A.datasets.create({ name: 'd' + pr.id, format: 'jsonl', organization_id: ORG, project_id: pr.id, record_count: 2, schema: [], validation: { status: 'valid', issues: [] } }, null, recs);
    await A.tasks.generate(p.id); await A.tasks.generate(m.id); const a = (await tasksOf(p.id))[0], b = (await tasksOf(m.id))[0]; await A.tasks.assign(a.id); await A.tasks.assign(b.id);
    await rej(A.annotations.submit(a.id, { labels: ['Spam', 'Ham'] }), 'VALIDATION'); await rej(A.annotations.submit(a.id, { labels: [] }), 'VALIDATION'); await rej(A.annotations.submit(a.id, { labels: ['Unknown'] }), 'VALIDATION');
    assert.strictEqual((await A.annotations.submit(a.id, { labels: ['Spam'] })).status, 'completed');
    await rej(A.annotations.submit(b.id, { labels: ['Positive', 'Positive'] }), 'VALIDATION'); assert.strictEqual((await A.annotations.submit(b.id, { labels: ['Positive', 'Negative'] })).status, 'completed'); });
  await t('side-by-side: preference, tie, invalid, randomised order stored', async () => {
    await A.tasks.generate('prj_demo_003'); const tk = (await tasksOf('prj_demo_003'))[0]; await A.tasks.assign(tk.id); const ids = tk.payload.responses.map(r => r.id); assert(ids.length >= 3);
    await rej(A.evaluations.submit(tk.id, { presented_order: ids, preferred: null }), 'VALIDATION'); await rej(A.evaluations.submit(tk.id, { presented_order: ids, preferred: 'nonsense' }), 'VALIDATION');
    const r = await A.evaluations.submit(tk.id, { presented_order: [ids[1], ids[0], ids[2]], preferred: ids[0], rationale: 'A is accurate.', blind: true }); assert.strictEqual(r.evaluation.evaluation_data.preferred, ids[0]); assert.strictEqual(r.evaluation.evaluation_data.presented_order[0], ids[1]); });
  await t('rubric: default 1-5 and custom 0-10 scale, range checks', async () => {
    await A.tasks.generate('prj_demo_006'); const tk = (await tasksOf('prj_demo_006'))[0]; await A.tasks.assign(tk.id); const dims = A.model.config({ annotation_type: 'rubric' }).rubric.dimensions; const sc = n => Object.fromEntries(dims.map(d => [d.id, { score: n }]));
    await rej(A.evaluations.submit(tk.id, { scores: sc(6) }), 'VALIDATION'); await rej(A.evaluations.submit(tk.id, { scores: {} }), 'VALIDATION'); await rej(A.evaluations.submit(tk.id, { scores: sc(2.5) }), 'VALIDATION'); assert.strictEqual((await A.evaluations.submit(tk.id, { scores: sc(4), rationale: 'ok' })).status, 'completed');
    const p = await A.projects.create({ name: 'R10', type: 'ai_response_evaluation', annotation_type: 'rubric', organization_id: ORG, config: { rubric: { min: 0, max: 10, dimensions: [{ id: 'quality', name: 'Quality', description: '', guidance: '' }] } } });
    await A.datasets.create({ name: 'dr', format: 'json', organization_id: ORG, project_id: p.id, record_count: 1, schema: [], validation: { status: 'valid', issues: [] } }, null, [{ prompt: 'q', response_a: 'a' }]); await A.tasks.generate(p.id); const x = (await tasksOf(p.id))[0]; await A.tasks.assign(x.id);
    await rej(A.evaluations.submit(x.id, { scores: { quality: { score: 11 } } }), 'VALIDATION'); assert.strictEqual((await A.evaluations.submit(x.id, { scores: { quality: { score: 0 } } })).status, 'completed'); });
  await t('ranking: needs 3+, no duplicates, complete order', async () => {
    const p = await A.projects.create({ name: 'Rank', type: 'ai_response_evaluation', annotation_type: 'ranking', organization_id: ORG });
    await A.datasets.create({ name: 'dk', format: 'json', organization_id: ORG, project_id: p.id, record_count: 2, schema: [], validation: { status: 'valid', issues: [] } }, null, [{ prompt: 'q', response_a: 'a', response_b: 'b', response_c: 'c' }, { prompt: 'q2', response_a: 'a', response_b: 'b' }]);
    await A.tasks.generate(p.id); const [x, y] = await tasksOf(p.id); await A.tasks.assign(x.id); const ids = x.payload.responses.map(r => r.id); assert.strictEqual(ids.length, 3); assert(A.model.supports(p, y.payload));
    await rej(A.evaluations.submit(x.id, { ranking: [ids[0], ids[0], ids[1]] }), 'VALIDATION'); await rej(A.evaluations.submit(x.id, { ranking: [ids[0], ids[1]] }), 'VALIDATION'); await rej(A.evaluations.submit(x.id, { ranking: null }), 'VALIDATION');
    assert.strictEqual((await A.evaluations.submit(x.id, { ranking: [ids[2], ids[0], ids[1]], rationale: 'c best' })).status, 'completed'); });
  await t('project config round trip and bad config rejected', async () => {
    await rej(A.projects.update('prj_demo_001', { config: { rubric: { min: 3, max: 3 } } }), 'VALIDATION'); const p = await A.projects.update('prj_demo_001', { config: { labels: ['PERSON', 'CUSTOM'] } }); assert.deepStrictEqual(A.model.config(p).labels, ['PERSON', 'CUSTOM']); });
  await t('HTML escaping and span rendering keep original text', () => { const text = 'A <script>alert(1)</script> & "q" Bob.', s = [{ id: 's1', start: text.indexOf('Bob'), end: text.indexOf('Bob') + 3, text: 'Bob', label: 'PERSON' }];
    const h = A.textui.html(text, s, ['PERSON']); assert(!h.includes('<script>')); const back = h.replace(/<\/?mark[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); assert.strictEqual(back, text); });
  await t('persistence across reload (new boot, same storage)', async () => { A = boot(); await A.auth.login('a@example.invalid', 'x'); const l = await tasksOf('prj_demo_001'); assert.strictEqual(l.length, 25); assert.strictEqual(l[0].review_status, 'approved'); assert.strictEqual(l[0].annotation.version, 2); });
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
