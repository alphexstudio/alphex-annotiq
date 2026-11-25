"""Browser smoke test (Playwright + Chromium). Run: python3 tests/ui-smoke.py   (serves the app on localhost:8765)
CDN assets (Lucide icons, Google Fonts) are blocked, so icons are missing in this run; behaviour is unaffected."""
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
B = 'http://127.0.0.1:8765/'; res = []; errs = []
def check(name, ok, info=''): res.append(('PASS' if ok else 'FAIL', name, info))
try:
    with sync_playwright() as p:
        br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1366, 'height': 900})
        pg.route('**/*', lambda r: r.abort() if not r.request.url.startswith(B) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto(B + 'login.html'); pg.fill('#email', 'ui.tester@example.invalid'); pg.fill('#password', 'secret'); pg.click('button[type=submit]'); pg.wait_for_url('**/dashboard/index.html')
        pg.wait_for_selector('#metrics strong'); check('login and dashboard load', pg.locator('#metrics strong').count() == 6)
        # text annotation (NER)
        pg.goto(B + 'workspace/text-annotation.html?project=prj_demo_001'); pg.wait_for_selector('[data-act=gen]'); pg.click('[data-act=gen]'); pg.wait_for_selector('#doc')
        check('tasks generated, workspace open', pg.locator('#tlist li').count() == 25)
        pg.evaluate("""()=>{const d=document.querySelector('#doc'),n=d.firstChild,i=n.textContent.indexOf('Maria Lopez');const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+11);const s=getSelection();s.removeAllRanges();s.addRange(r);d.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))}""")
        pg.wait_for_selector('#pend b'); pg.click('.lb[data-l=PERSON]'); pg.wait_for_selector('mark')
        check('NER span created with exact text', pg.inner_text('mark').startswith('Maria Lopez') and pg.eval_on_selector('#doc', 'd=>d.textContent').startswith('Maria Lopez from'))
        pg.evaluate("""()=>{const d=document.querySelector('#doc'),m=d.querySelector('mark'),n=m.nextSibling,i=n.textContent.indexOf('Maria');const r=document.createRange();r.setStart(m.firstChild,2);r.setEnd(n,5);const s=getSelection();s.removeAllRanges();s.addRange(r);d.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))}""")
        check('overlapping selection is refused with explanation', 'Overlapping' in pg.inner_text('#pend'))
        pg.wait_for_function("document.querySelector('#sv').textContent.startsWith('Saved')"); check('autosave indicator shows Saved', True)
        pg.reload(); pg.wait_for_selector('mark'); check('annotation survives reload', pg.locator('mark').count() == 1)
        pg.click('mark'); pg.keyboard.press('Delete'); check('selected span deleted with Delete key', pg.locator('mark').count() == 0)
        pg.evaluate("""()=>{const d=document.querySelector('#doc'),n=d.firstChild,i=n.textContent.indexOf('14 March');const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+8);const s=getSelection();s.removeAllRanges();s.addRange(r);d.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))}""")
        pg.keyboard.press('4'); pg.wait_for_selector('mark'); check('keyboard shortcut applies label (4 = DATE)', pg.get_attribute('mark', 'data-l') == 'DATE')
        pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')"); check('submit with confirmation, next task opens', True)
        # evaluation side by side
        pg.goto(B + 'workspace/ai-evaluation.html?project=prj_demo_003'); pg.wait_for_selector('[data-act=gen]'); pg.click('[data-act=gen]'); pg.wait_for_selector('.cmp')
        check('side-by-side shows two responses', pg.locator('.cmp .resp').count() == 2)
        pg.click('[data-p]:nth-of-type(1)'); pg.fill('#rat', 'Response A matches the reference.'); pg.wait_for_function("document.querySelector('#sv').textContent.startsWith('Saved')")
        pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); check('review screen lists preference and rationale', 'Preferred' in pg.inner_text('dialog') and 'matches the reference' in pg.inner_text('dialog')); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')")
        # review
        pg.goto(B + 'workspace/review.html'); pg.wait_for_selector('[data-i]'); check('review queue lists both submissions', pg.locator('[data-i]').count() == 2)
        pg.click('[data-i]'); pg.wait_for_selector('#rc'); pg.click('[data-d=rejected]'); check('reject without comment is blocked', 'comment' in pg.inner_text('#rm').lower())
        pg.fill('#rc', 'Please also tag the product.'); pg.click('[data-d=rejected]'); pg.wait_for_function("document.querySelectorAll('[data-i]').length===1"); check('reject with comment removes it from pending', True)
        pg.goto(B + 'dashboard/project.html?id=prj_demo_001'); pg.click('[data-t=tasks]'); check('project Tasks tab lists tasks', pg.locator('#panel tbody tr').count() == 25)
        pg.set_viewport_size({'width': 800, 'height': 900}); pg.goto(B + 'workspace/text-annotation.html?project=prj_demo_001'); pg.wait_for_selector('#doc')
        check('tablet layout has no horizontal overflow', pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'))
        check('no uncaught page errors', not errs, '; '.join(errs)); br.close()
finally:
    srv.terminate()
for r in res: print(*r)
print(sum(r[0] == 'PASS' for r in res), 'passed,', sum(r[0] == 'FAIL' for r in res), 'failed'); sys.exit(1 if any(r[0] == 'FAIL' for r in res) else 0)
