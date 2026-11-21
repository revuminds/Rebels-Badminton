#!/usr/bin/env python3
"""v22 checks. Usage: python3 tests/v22_test.py <copy-of-backup.txt> [shots-dir]
Live court height stable while scrolling (svh, height-only resizes ignored); score sheet: no double-tap zoom, hold to repeat, typeable, big +/−.
Local Worker (Miniflare) + headless Chrome. Never touches a device or the real cloud."""
import sys, json, pathlib, subprocess, datetime, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text()
SHOTS = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + detail if detail else ''))
def shot(pg, n):
    if SHOTS: SHOTS.mkdir(parents=True, exist_ok=True); pg.screenshot(path=str(SHOTS / n), full_page=False)

srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']
def curl(m, path, body=None, tok=None, hdr=None):
    a = ['curl', '-s', '-w', '\n%{http_code}', '-X', m, U + path, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + (['-H', hdr] if hdr else []) + (['--data-binary', '@-'] if body is not None else [])
    o = subprocess.run(a, input=json.dumps(body) if body is not None else None, capture_output=True, text=True).stdout
    t, c = o.rsplit('\n', 1)
    try: j = json.loads(t)
    except Exception: j = {}
    return int(c), j, t
live = lambda t=None: curl('GET', '/api/live', hdr=('X-Claim: ' + t) if t else None)[1]
try:
    now = int(time.time() * 1000); dub = datetime.datetime.fromtimestamp(now / 1000 + 4 * 3600, datetime.UTC).replace(tzinfo=None)
    today = dub.strftime('%Y-%m-%d'); st = now - 40 * 60e3
    S = json.loads(DATA)
    on = ['p1', 'p2', 'p4', 'p5', 'p9', 'p10', 'p11', 'p12', 'p15', 'p17', 'p18', 'p25']
    S['days'][today] = {'sch': 1, 'time': (dub - datetime.timedelta(minutes=40)).strftime('%H:%M'), 'loc': 'Sportsbay', 'courts': [{'n': 'Court 6', 'h': 2}, {'n': 'Court 7', 'h': 2}], 'on': {k: True for k in on}, 'att': {k: {'a': int(st)} for k in on}}
    hist = [{'r': 1, 'c': 1, 'ids': ['p11', 'p25', 'p17', 'p18'], 'sa': 21, 'sb': 15, 's': 600, 'at': int(st + 12 * 60e3)},   # Saif's game, scored on the tablet
            {'r': 1, 'c': 2, 'ids': ['p2', 'p9', 'p12', 'p10'], 'sa': 0, 'sb': 0, 's': 640, 'at': int(st + 13 * 60e3)}]     # Annie's game, no score
    for h in hist: h['a'] = h['ids'][:2]; h['b'] = h['ids'][2:]
    G = {'d': today, 'courts': 2, 'round': 2, 'st': int(st), 'en': 0, 'pts': 21, 'deuce': False, 'slot': 15, 'chg': 1,
         'cur': [['p1', 'p4', 'p5', 'p15'], [None] * 4], 'live': [{'run': True, 'start': now - 5 * 60e3, 'sa': 9, 'sb': 7, 'el': 0, 'w': ''}, {'run': False, 'start': 0, 'sa': 0, 'sb': 0, 'el': 0, 'w': ''}],
         'nxt': [[None] * 4] * 2, 'qq': [[], [{'q': ['p11', 'p9', 'p12', 'p10']}]], 'up': [{'q': ['p2', 'p17', 'p18', 'p25']}], 'hist': hist, 'since': {}, 'btot': {}, 'ros': on, 'last': [None, None], 'plan': [], 'log': [], 'strk': {}, 'pre': [], 'auto': [], 'closed': {}, 'nman': [], 'man': 1, 'curN': [0, 0]}
    S['games'][today] = G
    A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})[1]['token']
    rev = [0]
    def put(SS):
        c, j, t = curl('PUT', '/api/data', {'base': rev[0], 'data': SS}, A); rev[0] = j.get('rev', rev[0]); return c
    rec('Test session uploaded to the local Worker (today %s)' % today, put(S) == 200)
    key = {x['name']: x['k'] for x in live()['pick']}
    k_saif = [r for r in live()['results'] if r['sc']][0]['k']

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        def phone(w=390, h=844):
            c = b.new_context(viewport={'width': w, 'height': h}, timezone_id='Asia/Dubai', is_mobile=True, has_touch=True)
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(U + '/live'); pg.wait_for_timeout(1500); return c, pg, errs
        def pick(pg, name):
            pg.click('#m [data-a="player"]'); pg.wait_for_timeout(200); pg.click('.pk button:has-text("%s")' % name); pg.wait_for_timeout(1500)
        vh = lambda pg: pg.evaluate("document.querySelector('.vct').getBoundingClientRect().height")
        # ---- item 1: court height ----
        cg, pg, eg = phone(); pg.click('#m [data-a="guest"]'); pg.wait_for_timeout(1200)
        css = pg.evaluate("[...document.styleSheets].map(s=>[...s.cssRules].map(r=>r.cssText).join(' ')).join(' ')")
        rec('Item 1: court height uses 100svh (not 100dvh)', '100svh' in css and '100dvh' not in css)
        h0 = vh(pg); fits = pg.evaluate("document.querySelector('.vc').getBoundingClientRect().bottom<=innerHeight+1")
        rec('Item 1: court still fits one screen (390×844)', fits, '%.0f px' % h0)
        pg.set_viewport_size({'width': 390, 'height': 760}); pg.wait_for_timeout(400); h1 = vh(pg)
        pg.set_viewport_size({'width': 390, 'height': 900}); pg.wait_for_timeout(400); h2 = vh(pg)
        rec('Item 1: address bar show/hide (height-only resize) → court height unchanged', abs(h1 - h0) < 1 and abs(h2 - h0) < 1, '%.0f / %.0f / %.0f' % (h0, h1, h2))
        pg.mouse.wheel(0, 600); pg.wait_for_timeout(300); pg.mouse.wheel(0, -600); pg.wait_for_timeout(300)
        rec('Item 1: scrolling down/up → court height unchanged', abs(vh(pg) - h0) < 1)
        pg.set_viewport_size({'width': 844, 'height': 390}); pg.wait_for_timeout(600)
        land = pg.evaluate("[parseInt(getComputedStyle(document.documentElement).getPropertyValue('--vh')),document.querySelector('.vct').getBoundingClientRect().height]")
        rec('Item 1: rotation (width change) → re-measured', land[0] == 390 and abs(land[1] - h0) > 1, str(land))
        pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(600)
        rec('Item 1: back to portrait → same height as at load', abs(vh(pg) - h0) < 2, '%.0f' % vh(pg))
        cg.close()
        # ---- item 2: score sheet (Send score – Annie's unscored game) ----
        ca, pa, ea = phone(); pick(pa, 'Annie')
        pa.click('[data-a="open"]'); pa.wait_for_timeout(300)
        sty = pa.evaluate("(()=>{const b=document.querySelector('.srow button'),s=getComputedStyle(b),r=b.getBoundingClientRect();return [s.touchAction,getComputedStyle(document.querySelector('.sh')).touchAction,r.width,r.height]})()")
        rec('Item 2: +/− and sheet use touch-action: manipulation (no double-tap zoom)', sty[0] == 'manipulation' and sty[1] == 'manipulation', str(sty))
        rec('Item 2: +/− buttons ≥ 48 px', sty[2] >= 48 and sty[3] >= 48, '%.0f×%.0f' % (sty[2], sty[3]))
        ia = pa.evaluate("(()=>{const i=document.getElementById('insa');return [i.type,i.inputMode,i.pattern]})()")
        rec('Item 2: score box opens the number keypad', ia == ['text', 'numeric', '[0-9]*'], str(ia))
        for _ in range(6): pa.tap('[data-a="up"][data-s="sa"]'); pa.wait_for_timeout(60)
        rec('Item 2: 6 fast taps on + → 6 (every tap counts)', pa.input_value('#insa') == '6', pa.input_value('#insa'))
        rec('Item 2: no zoom after fast taps', pa.evaluate("visualViewport.scale") == 1)
        bx = pa.locator('[data-a="up"][data-s="sb"]').bounding_box(); cx, cy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
        pa.mouse.move(cx, cy); pa.mouse.down(); pa.wait_for_timeout(1000); v1 = int(pa.input_value('#insb') or 0); pa.wait_for_timeout(1000); v2 = int(pa.input_value('#insb') or 0); pa.mouse.up()
        rec('Item 2: hold + → keeps counting and speeds up', v1 >= 3 and (v2 - v1) > v1, '1 s: %d, 2 s: %d' % (v1, v2))
        pa.wait_for_timeout(500); v3 = int(pa.input_value('#insb'))
        rec('Item 2: release stops it', v3 == v2, str(v3))
        pa.mouse.move(cx, cy); pa.mouse.down(); pa.wait_for_timeout(3500); pa.mouse.up()
        rec('Item 2: clamped at the game maximum (21, no deuce)', pa.input_value('#insb') == '21', pa.input_value('#insb'))
        dx = pa.locator('[data-a="dn"][data-s="sa"]').bounding_box()
        pa.mouse.move(dx['x'] + 20, dx['y'] + 20); pa.mouse.down(); pa.wait_for_timeout(3000); pa.mouse.up()
        rec('Item 2: hold − never below 0', pa.input_value('#insa') == '0', pa.input_value('#insa'))
        pa.fill('#insa', ''); pa.type('#insa', '1x9'); 
        rec('Item 2: typing keeps digits only', pa.input_value('#insa') == '19', pa.input_value('#insa'))
        pa.fill('#insb', '25'); pa.click('[data-a="send"]'); pa.wait_for_timeout(300)
        rec('Item 2: typed score still validated against game points', 'Max 21' in pa.inner_text('#er'), pa.inner_text('#er'))
        pa.fill('#insb', '21'); pa.click('[data-a="send"]'); pa.wait_for_timeout(1500)
        rec('Item 2: valid score sends', 'Score sent · waiting for approval' in pa.inner_text('#v'))
        shot(pa, 'v22_sent.png')
        # ---- same sheet for Suggest correction (Saif's scored game 21–15) ----
        cb, pb, eb = phone(); pick(pb, 'Saif'); pb.click('[data-a="fix"]'); pb.wait_for_timeout(300)
        pb.tap('[data-a="dn"][data-s="sb"]'); pb.wait_for_timeout(60); pb.tap('[data-a="dn"][data-s="sb"]'); pb.wait_for_timeout(60)
        rec('Item 2 (correction): same controls – taps change the prefilled score', pb.input_value('#insb') == '13' and pb.evaluate("document.getElementById('insb').inputMode") == 'numeric', pb.input_value('#insb'))
        shot(pb, 'v22_correction.png')
        pb.click('[data-a="send"]'); pb.wait_for_timeout(1500)
        rec('Item 2 (correction): sends', 'Correction sent · waiting for approval' in pb.inner_text('#v'))
        rec('No page errors', not (eg or ea or eb), '; '.join((eg + ea + eb)[:3]))
        b.close()
finally:
    srv.terminate()
n = sum(ok for _, ok, _ in R); print('\n%d/%d passed' % (n, len(R)))
sys.exit(0 if n == len(R) else 1)
