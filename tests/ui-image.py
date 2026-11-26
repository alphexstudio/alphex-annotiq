"""Browser tests for the Phase 4 image workspace (Playwright + Chromium). Run: python3 tests/ui-image.py
Drives real mouse and keyboard input on the canvas. CDN assets (Lucide, fonts) are blocked, so icons are missing; behaviour is unaffected."""
import subprocess, sys, os, time, json, zlib, struct, zipfile, io, traceback
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
B = 'http://127.0.0.1:8766/'; res = []; errs = []
def check(n, ok, info=''): res.append(('PASS' if ok else 'FAIL', n, '' if ok else str(info)))
def near(a, b, tol=0.012): return abs(a - b) <= tol
def png(w, h, rgb=(200, 30, 90)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
def section(name):
    def deco(f):
        try: f()
        except Exception as e: check(name + ' (aborted)', False, ''.join(traceback.format_exception_only(type(e), e)).strip()[:300])
        return f
    return deco
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 1000}, accept_downloads=True); pg = ctx.new_page()
    pg.route('**/*', lambda r: r.abort() if not r.request.url.startswith(B) else r.continue_()); pg.on('pageerror', lambda e: errs.append(str(e)))
    def E(js): return pg.evaluate("()=>{const c=Alphex.ws.ctx,E=c.engine;return " + js + "}")
    def cl(nx, ny): return pg.evaluate("([x,y])=>Alphex.ws.ctx.engine.toClient(x,y)", [nx, ny])
    def click(nx, ny, **k): c = cl(nx, ny); pg.mouse.click(c['x'], c['y'], **k)
    def drag(a, b, steps=10): p0 = cl(*a); p1 = cl(*b); pg.mouse.move(p0['x'], p0['y']); pg.mouse.down(); pg.mouse.move(p1['x'], p1['y'], steps=steps); pg.mouse.up()
    def objs(): return E("JSON.parse(JSON.stringify(E.objects))")
    def saved(): pg.wait_for_function("document.querySelector('#sv').textContent.startsWith('Saved')", timeout=8000)
    def open_ws(pid, task=None):
        pg.goto(B + 'workspace/image-annotation.html?project=' + pid + ('&task=' + task if task else '')); pg.wait_for_selector('#stage canvas'); pg.wait_for_function("Alphex.ws.ctx&&Alphex.ws.ctx.engine&&Alphex.ws.ctx.engine.img", timeout=8000); pg.evaluate("document.querySelector('#stage').scrollIntoView()")
    pg.goto(B + 'login.html'); pg.fill('#email', 'img.tester@example.invalid'); pg.fill('#password', 'x'); pg.click('button[type=submit]'); pg.wait_for_url('**/dashboard/index.html'); pg.wait_for_selector('#metrics strong')
    ids = pg.evaluate("""async()=>{const A=Alphex,org=A.state.get('org'),L=[{id:'lbl_a',name:'Car',color:'#ea005a'},{id:'lbl_b',name:'Bike',color:'#2dd4bf'}];
      const mk=async(at,extra)=>{const p=await A.projects.create({name:'UI '+at+(extra?' multi':''),type:'image_annotation',annotation_type:at,organization_id:org,config:Object.assign({labels:L,min_box_px:4},extra||{})});
        const recs=[0,1,2].map(i=>({image_path:'demo:ui_'+i,filename:'ui_'+i+'.jpg',width:1000,height:600,size_bytes:0}));
        await A.datasets.create({name:'ds '+at,format:'images',dataset_type:'image_manifest',organization_id:org,project_id:p.id,record_count:3,schema:[],validation:{status:'valid',issues:[]}},null,recs);await A.tasks.generate(p.id);return p.id};
      return {bbox:await mk('bounding_boxes'),poly:await mk('polygon'),point:await mk('point_annotation'),seg:await mk('segmentation'),cls:await mk('image_classification'),multi:await mk('image_classification',{selection:'multi'})}}""")
    @section('bbox')
    def _():
        open_ws(ids['bbox']); check('image workspace opens, demo image loaded with its natural size', E("E.iw===1000&&E.ih===600"))
        check('chips show filename and dimensions', '1000 x 600' in pg.inner_text('#chips') and 'ui_0.jpg' in pg.inner_text('#chips'))
        drag((.2, .2), (.5, .6)); o = objs(); check('bbox drawn with normalized coordinates', len(o) == 1 and near(o[0]['x'], .2) and near(o[0]['y'], .2) and near(o[0]['w'], .3) and near(o[0]['h'], .4), o)
        check('bbox record has id, label, annotator, task and timestamp', all(k in o[0] for k in ['id', 'label_id', 'label', 'annotator_id', 'task_id', 'created_at']) and o[0]['label'] == 'Car', o[0])
        before = json.dumps(objs()); s0 = E("E.v.s"); pg.click('#zi'); pg.click('#zi'); pg.mouse.wheel(0, -200); pg.wait_for_timeout(100)
        check('zoom in changes the view, not the stored data', E("E.v.s") > s0 * 1.5 and json.dumps(objs()) == before and '%' in pg.inner_text('#zp'), pg.inner_text('#zp'))
        pg.click('#zf'); pg.wait_for_timeout(100); check('fit restores the view; data unchanged', near(E("E.v.s"), s0, 0.05) and json.dumps(objs()) == before)
        pg.set_viewport_size({'width': 1100, 'height': 800}); pg.wait_for_timeout(300); check('resizing the window leaves coordinates unchanged', json.dumps(objs()) == before); pg.set_viewport_size({'width': 1400, 'height': 1000}); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('#stage').scrollIntoView()")
        pg.keyboard.press('v'); click(.3, .4); check('select tool selects the box', E("E.sel") == objs()[0]['id'])
        drag((.35, .4), (.45, .5)); o = objs()[0]; check('box moves by the drag distance', near(o['x'], .3) and near(o['y'], .3) and near(o['w'], .3), o)
        drag((o['x'] + o['w'], o['y'] + o['h']), (.7, .8)); o = objs()[0]; check('corner handle resizes the box', near(o['w'], .4) and near(o['h'], .5) and near(o['x'], .3), o)
        pg.click('#zi'); pg.wait_for_timeout(100); o1 = objs()[0]; drag((o1['x'] + o1['w'] / 2, o1['y'] + o1['h']), (o1['x'] + o1['w'] / 2, o1['y'] + o1['h'] + .05)); o2 = objs()[0]; check('edge handle resizes correctly while zoomed', near(o2['h'], o1['h'] + .05, .02) and near(o2['w'], o1['w'], .005), (o1, o2)); pg.click('#zf')
        c = cl(.5, .5); drag((o2['x'] + o2['w'] / 2, o2['y'] + o2['h'] / 2), (1.4, o2['y'] + o2['h'] / 2)); o = objs()[0]; check('moving past the edge keeps the box inside the image', o['x'] + o['w'] <= 1.0000001 and o['x'] >= 0, o)
        n = len(objs()); pg.keyboard.press('b'); drag((.1, .8), (.1 + .002, .8 + .002)); check('tiny box is discarded (minimum size)', len(objs()) == n and 'minimum' in pg.inner_text('#pend'), pg.inner_text('#pend'))
        h = E("E.hs.length"); pg.keyboard.press('Control+z'); o_after = objs()[0]; pg.keyboard.press('Control+Shift+z'); check('undo and redo move through history', E("E.hs.length") == h and json.dumps(objs()[0]) != json.dumps(o_after))
        pg.keyboard.press('v'); click(o['x'] + o['w'] / 2, o['y'] + o['h'] / 2); pg.click('.lb[data-l=lbl_b]'); check('changing the label of the selected box', objs()[0]['label_id'] == 'lbl_b' and objs()[0]['label'] == 'Bike')
        pg.keyboard.press('Delete'); check('Delete removes the selected box', len(objs()) == 0); pg.keyboard.press('Control+z'); check('undo restores a deleted box', len(objs()) == 1)
        saved(); keep = json.dumps(objs()); pg.reload(); pg.wait_for_function("Alphex.ws.ctx&&Alphex.ws.ctx.engine&&Alphex.ws.ctx.engine.img"); check('annotation survives reload with identical coordinates', json.dumps(objs()) == keep)
        pg.evaluate("document.querySelector('#stage').scrollIntoView()"); pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); check('submit shows a review screen', 'box' in pg.inner_text('dialog')); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')")
        check('task submitted and next image opened', E("c.task.index")== 2)
    @section('review')
    def _():
        pg.goto(B + 'workspace/review.html'); pg.wait_for_selector('[data-i]'); pg.click('[data-i]'); pg.wait_for_selector('#rv-img canvas'); pg.wait_for_function("document.querySelector('#rv-list').textContent.includes('bbox')")
        check('review dialog shows the image canvas and object table', pg.locator('#rv-img canvas').count() == 2 and 'ui_0.jpg' in pg.inner_text('#rv-list'))
        pg.fill('#rc', 'Please tighten the box.'); pg.click('[data-d=rejected]'); pg.wait_for_selector('.toast')
        tid = pg.evaluate("async()=>(await Alphex.tasks.page({project_id:Alphex.util.qs?'" + ids['bbox'] + "':'',limit:5})).items[0].id"); open_ws(ids['bbox'], tid); check('rejected task shows reviewer comments and is editable', 'Returned for revision' in pg.inner_text('#banner') and 'tighten' in pg.inner_text('#banner') and E("!c.readOnly"))
        pg.keyboard.press('b'); drag((.6, .1), (.8, .3)); saved(); pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')")
        pg.goto(B + 'workspace/review.html'); pg.wait_for_selector('[data-i]'); pg.click('[data-i]'); pg.wait_for_selector('#rc'); check('resubmitted work is back in the pending queue (version 2)', 'version 2' in pg.inner_text('dialog')); pg.click('[data-d=approved]'); pg.wait_for_selector('.toast')
        check('approved', pg.evaluate("async()=>(await Alphex.tasks.get('" + tid + "')).review_status") == 'approved')
    def export_dl(pid, fmt, scope=None):
        pg.goto(B + 'dashboard/project.html?id=' + pid); pg.wait_for_selector('[data-t=tasks]'); pg.click('[data-t=tasks]'); pg.click('[data-act=exp]'); pg.select_option('#xf', fmt)
        if scope: pg.select_option('#xs', scope)
        pg.click('#xb'); pg.wait_for_selector('[data-dl]'); rep = pg.inner_text('#xr')
        with pg.expect_download() as d: pg.click('[data-dl]')
        path = d.value.path(); return open(path, 'rb').read(), rep, d.value.suggested_filename
    @section('export')
    def _():
        data, rep, fn = export_dl(ids['bbox'], 'coco'); j = json.loads(data); t = pg.evaluate("async()=>{const r=await Alphex.tasks.page({project_id:'" + ids['bbox'] + "',limit:5});return r.items[0].annotation.annotation_data.objects}")
        check('COCO download: images, categories and boxes in pixels', fn.endswith('_coco.json') and len(j['images']) == 1 and j['images'][0]['width'] == 1000 and len(j['annotations']) == len(t) and len(j['categories']) == 2, (fn, rep))
        b = [a for a in j['annotations'] if a['alphex_object_id'] == t[0]['id']][0]['bbox']; check('COCO bbox equals normalized x image size', near(b[0], t[0]['x'] * 1000, 1) and near(b[3], t[0]['h'] * 600, 1), (b, t[0]))
        data, rep, fn = export_dl(ids['bbox'], 'yolo'); z = zipfile.ZipFile(io.BytesIO(data)); names = z.namelist(); line = [l.split() for l in z.read('labels/ui_0.txt').decode().strip().split('\n')]
        check('YOLO ZIP is valid with classes, labels and report', z.testzip() is None and 'classes.txt' in names and 'export_report.txt' in names and len(line) >= 1 and all(len(l) == 5 and all(0 <= float(v) <= 1 for v in l[1:]) for l in line), (names, line))
        data, rep, fn = export_dl(ids['bbox'], 'json'); j = json.loads(data); check('Alphex JSON download keeps objects, labels and annotator', j['images'][0]['annotator']['name'] and len(j['images'][0]['objects']) == len(t) and 'Normalized' in j['coordinate_system'])
        pg.goto(B + 'dashboard/project.html?id=' + ids['bbox']); pg.click('[data-t=tasks]'); pg.click('[data-act=exp]'); pg.select_option('#xs', 'all'); pg.select_option('#xf', 'coco'); pg.click('#xb'); pg.wait_for_selector('[data-dl]'); check('export dialog states what it exported', 'COCO export' in pg.inner_text('#xr'))
    @section('polygon')
    def _():
        open_ws(ids['poly']); check('polygon tool is the default for polygon projects', E("E.tool") == 'polygon')
        for pt in [(.2, .2), (.6, .2), (.6, .6), (.2, .6)]: click(*pt)
        pg.keyboard.press('Enter'); o = objs(); check('polygon completed with Enter, normalized vertices', len(o) == 1 and o[0]['type'] == 'polygon' and len(o[0]['points']) == 4 and near(o[0]['points'][2]['x'], .6) and near(o[0]['points'][2]['y'], .6), o)
        for pt in [(.1, .9), (.2, .9), (.3, .9)]: click(*pt)
        pg.keyboard.press('Enter'); check('collinear (zero-area) polygon is rejected', len(objs()) == 1 and 'non-zero area' in pg.inner_text('#pend'), pg.inner_text('#pend')); pg.keyboard.press('Escape'); check('Escape cancels the unfinished polygon', E("E.poly===null"))
        for pt in [(.7, .1), (.9, .1), (.9, .3)]: click(*pt)
        click(.7, .1); check('clicking the first vertex closes the polygon', len(objs()) == 2 and len(objs()[1]['points']) == 3)
        pg.keyboard.press('v'); click(.4, .4); check('select tool selects a polygon', E("E.sel") == objs()[0]['id']); drag((.6, .6), (.65, .7)); pts = objs()[0]['points']; check('vertex drag edits one vertex', near(pts[2]['x'], .65) and near(pts[2]['y'], .7) and near(pts[0]['x'], .2), pts)
        drag((.4, .4), (.45, .45)); q = objs()[0]['points']; check('dragging the body moves every vertex', near(q[0]['x'], .25) and near(q[2]['x'], .7), q)
        mid = {'x': (q[0]['x'] + q[1]['x']) / 2, 'y': (q[0]['y'] + q[1]['y']) / 2}; c = cl(mid['x'], mid['y']); pg.mouse.dblclick(c['x'], c['y']); check('double-click on an edge inserts a vertex', len(objs()[0]['points']) == 5, len(objs()[0]['points']))
        pv = objs()[0]['points'][2]; pg.keyboard.down('Alt'); click(pv['x'], pv['y']); pg.keyboard.up('Alt'); check('Alt+click deletes a vertex', len(objs()[0]['points']) == 4)
        drag((.4, .45), (1.3, .45)); check('all vertices stay inside the image after a drag', all(0 <= v['x'] <= 1 and 0 <= v['y'] <= 1 for v in objs()[0]['points']), objs()[0]['points'])
        pg.keyboard.press('Delete'); check('polygon deleted', len(objs()) == 1); pg.keyboard.press('Control+z'); check('polygon delete is undoable', len(objs()) == 2)
    @section('point')
    def _():
        open_ws(ids['point']); click(.3, .3); click(.7, .5); o = objs(); check('points added with normalized coordinates', len(o) == 2 and near(o[0]['x'], .3) and near(o[1]['y'], .5), o)
        click(1.012, .5); check('clicking outside the image adds nothing', len(objs()) == 2)
        pg.keyboard.press('v'); drag((.3, .3), (.35, .4)); o = objs(); check('a point can be moved', near(o[0]['x'], .35) and near(o[0]['y'], .4), o[0])
        pg.select_option('#plab', 'lbl_b'); check('label assignment for a point', objs()[0]['label_id'] == 'lbl_b')
        pg.keyboard.press('Delete'); check('a point can be deleted', len(objs()) == 1); saved(); pg.reload(); pg.wait_for_function("Alphex.ws.ctx&&Alphex.ws.ctx.engine&&Alphex.ws.ctx.engine.img"); check('points persist', len(objs()) == 1)
    @section('segmentation')
    def _():
        open_ws(ids['seg']); pg.wait_for_function("Alphex.ws.ctx.engine.mask"); check('segmentation starts with an empty mask at working resolution', E("E.nonzero()") == 0 and E("E.mask.w===1000&&E.mask.h===600"))
        drag((.2, .3), (.6, .3)); n1 = E("E.nonzero()"); check('brush paints pixels', n1 > 500, n1)
        pg.evaluate("()=>{const s=document.querySelector('#bs');s.value=90;s.dispatchEvent(new Event('input',{bubbles:true}))}"); drag((.2, .7), (.6, .7)); n2 = E("E.nonzero()") - n1; check('larger brush size paints a larger area', n2 > 2 * n1, (n1, n2))
        total = E("E.nonzero()"); pg.keyboard.press('e'); drag((.2, .3), (.6, .3)); n3 = E("E.nonzero()"); check('eraser removes pixels', n3 < total, (total, n3))
        pg.keyboard.press('Control+z'); check('undo restores erased pixels exactly', E("E.nonzero()") == total); pg.keyboard.press('Control+Shift+z'); check('redo re-applies the erase', E("E.nonzero()") == n3)
        pg.wait_for_function("Alphex.ws.ctx.data.mask&&Alphex.ws.ctx.data.mask.nonzero===" + str(n3)); saved(); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_function("Alphex.ws.ctx&&Alphex.ws.ctx.engine&&Alphex.ws.ctx.engine.mask&&Alphex.ws.ctx.engine.nonzero()>0", timeout=8000)
        check('mask reloads from IndexedDB with the same pixel count', E("E.nonzero()") == n3, (E("E.nonzero()"), n3)); check('annotation_data holds only mask metadata, not pixels', E("JSON.stringify(c.data).length<600&&c.data.mask.classes[0]==='lbl_a'"))
        pg.click('#clearm'); check('clear mask empties it', E("E.nonzero()") == 0); pg.keyboard.press('Control+z'); check('clear mask is undoable', E("E.nonzero()") == n3)
        pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')")
        tid = pg.evaluate("async()=>(await Alphex.tasks.page({project_id:'" + ids['seg'] + "',limit:5})).items[0].id"); pg.evaluate("async()=>Alphex.reviews.decide('" + tid + "','approved','')")
        data, rep, fn = export_dl(ids['seg'], 'coco'); j = json.loads(data); m = [a for a in j['annotations'] if a.get('alphex_type') == 'mask']
        check('COCO export contains the mask as RLE and the report explains the limitation', len(m) == 1 and m[0]['iscrowd'] == 1 and m[0]['segmentation']['size'] == [600, 1000] and 'semantic' in rep and m[0]['area'] == n3, (rep, m[:1] and m[0]['area'], n3))
    @section('classification')
    def _():
        open_ws(ids['cls']); pg.click('.lb[data-l=lbl_a]'); pg.click('.lb[data-l=lbl_b]'); a = pg.get_attribute('.lb[data-l=lbl_a]', 'aria-pressed'); b = pg.get_attribute('.lb[data-l=lbl_b]', 'aria-pressed'); check('single-label: selecting another label replaces the first', a == 'false' and b == 'true')
        pg.click('.lb[data-l=lbl_b]'); pg.click('#sub'); check('cannot submit without a label', 'Select at least one' in pg.inner_text('#flash'), pg.inner_text('#flash'))
        pg.click('.lb[data-l=lbl_a]'); saved(); check('label saved', E("JSON.stringify(c.data.classification.label_ids)")== '["lbl_a"]'); pg.click('#sub'); pg.wait_for_selector('dialog .btn.pri'); pg.click('dialog .btn.pri'); pg.wait_for_function("document.querySelector('#chips').textContent.includes('Progress: 1/')"); check('single-label task submitted', True)
        open_ws(ids['multi']); pg.click('.lb[data-l=lbl_a]'); pg.click('.lb[data-l=lbl_b]'); check('multi-label: both labels selected', pg.get_attribute('.lb[data-l=lbl_a]', 'aria-pressed') == 'true' and pg.get_attribute('.lb[data-l=lbl_b]', 'aria-pressed') == 'true'); pg.click('.lb[data-l=lbl_a]'); check('multi-label: a label can be unselected', pg.get_attribute('.lb[data-l=lbl_a]', 'aria-pressed') == 'false')
    @section('labels')
    def _():
        open_ws(ids['bbox']); pg.click('[data-newl]'); pg.fill('dialog input[name=name]', 'Truck'); pg.fill('dialog textarea[name=description]', 'Large vehicle'); pg.click('dialog button[type=submit]'); pg.wait_for_function("document.querySelectorAll('#lab .lb').length===3")
        check('new label created with a generated id, description and colour', pg.evaluate("Alphex.ws.ctx.CFG.label_objs.find(l=>l.name==='Truck')&&Alphex.ws.ctx.CFG.label_objs.find(l=>l.name==='Truck').id.startsWith('lbl_')"))
        pg.click('[data-edit=lbl_a]'); check('a label in use cannot be deleted', pg.is_disabled('dialog [data-del]') and 'cannot be deleted' in pg.inner_text('dialog')); pg.fill('dialog input[name=name]', 'Automobile'); pg.click('dialog button[type=submit]'); pg.wait_for_function("document.querySelector('#lab').textContent.includes('Automobile')")
        pg.click('[data-newl]'); pg.fill('dialog input[name=name]', 'automobile'); pg.click('dialog button[type=submit]'); check('duplicate label names are refused', 'already exists' in pg.inner_text('dialog')); pg.click('dialog [data-x]')
        pg.click('[data-edit=' + pg.evaluate("Alphex.ws.ctx.CFG.label_objs.find(l=>l.name==='Truck').id") + ']'); pg.click('dialog [data-del]'); pg.wait_for_function("document.querySelectorAll('#lab .lb').length===2"); check('an unused label can be deleted', True)
    @section('import')
    def _():
        pg.goto(B + 'dashboard/datasets.html'); pg.wait_for_selector('#list tbody tr'); pg.click('#upi'); pg.wait_for_selector('dialog input[name=files]')
        pg.set_input_files('dialog input[name=files]', [{'name': 'one.png', 'mimeType': 'image/png', 'buffer': png(64, 48)}, {'name': 'two.png', 'mimeType': 'image/png', 'buffer': png(32, 32, (10, 200, 90))}, {'name': 'fake.png', 'mimeType': 'image/png', 'buffer': b'this is not an image'}, {'name': 'anim.gif', 'mimeType': 'image/gif', 'buffer': b'GIF89a'}, {'name': 'empty.jpg', 'mimeType': 'image/jpeg', 'buffer': b''}])
        pg.wait_for_function("document.querySelector('#chk').textContent.includes('accepted')"); t = pg.inner_text('#chk'); check('import accepts valid images and reports each rejected file', '2 image(s) accepted' in t and 'fake.png' in t and 'Not a readable image' in t and 'anim.gif' in t and 'Unsupported' in t and 'empty.jpg' in t, t)
        pg.select_option('dialog select[name=project_id]', ids['bbox']); pg.fill('dialog input[name=name]', 'Local PNGs'); pg.click('dialog button[type=submit]'); pg.wait_for_selector('.toast')
        pg.wait_for_function("document.body.textContent.includes('Local PNGs')"); n = pg.evaluate("async()=>(await Alphex.tasks.generate('" + ids['bbox'] + "')).created"); check('tasks generated from the imported dataset after a page load (records persisted)', n == 2, n)
        tid = pg.evaluate("async()=>(await Alphex.tasks.page({project_id:'" + ids['bbox'] + "',limit:50})).items.find(t=>t.payload.image.source==='asset').id"); open_ws(ids['bbox'], tid)
        check('local image loads from IndexedDB at its real size', E("E.iw>=32&&E.img.width===E.iw&&c.task.payload.image.source==='asset'"), E("[E.iw,E.ih]")); drag((.2, .2), (.7, .7)); check('annotating a local image works', len(objs()) == 1 and near(objs()[0]['w'], .5))
        pg.goto(B + 'dashboard/datasets.html'); pg.wait_for_selector('#list tbody tr'); pg.click('#upi'); pg.click('dialog [data-demo]'); pg.wait_for_selector('.toast'); pg.wait_for_function("document.body.textContent.includes('Demo image placeholders')", timeout=8000); check('demo placeholder dataset can be created', True)
    @section('regression')
    def _():
        pg.goto(B + 'dashboard/projects.html'); pg.wait_for_selector('#list tbody tr'); check('projects page still works', pg.locator('#list tbody tr').count() >= 6); pg.goto(B + 'dashboard/datasets.html'); pg.wait_for_selector('#list tbody tr'); check('datasets page lists image datasets', 'IMAGES' in pg.inner_text('#list'))
        pg.goto(B + 'workspace/text-annotation.html?project=prj_demo_001'); pg.wait_for_selector('[data-act=gen],#doc'); check('text annotation workspace still loads', pg.locator('[data-act=gen],#doc').count() >= 1)
        pg.goto(B + 'dashboard/project.html?id=' + ids['bbox']); pg.wait_for_selector('[data-t=tasks]'); pg.click('[data-t=tasks]'); check('project Tasks tab shows Export and Open workspace for image projects', pg.locator('[data-act=exp]').count() == 1 and 'Open workspace' in pg.inner_text('#panel'))
    check('no uncaught page errors', not errs, '; '.join(errs)); br.close()
srv.terminate()
for r in res: print(*r)
print(sum(r[0] == 'PASS' for r in res), 'passed,', sum(r[0] == 'FAIL' for r in res), 'failed'); sys.exit(1 if any(r[0] == 'FAIL' for r in res) else 0)
