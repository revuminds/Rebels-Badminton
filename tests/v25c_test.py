#!/usr/bin/env python3
"""v25.3: our own confirm dialog (no browser box) · automatic sync (every 30 s, on open/focus, tiny 'nothing new' check) ·
the server always wins (safety snapshot; this device's extra game results kept). Usage: python3 tests/v25c_test.py <copy-of-backup.txt>"""
import sys, json, pathlib, subprocess
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; RAW = pathlib.Path(sys.argv[1]).read_text(); DATA = json.loads(RAW); APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']; R = []
def rec(n, ok, d=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (' · ' + str(d) if d != '' else ''))
def curl(m, p, body=None, tok=None):
    a = ['curl', '-s', '-X', m, U + p, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + (['--data-binary', '@-'] if body is not None else [])
    return json.loads(subprocess.run(a, input=json.dumps(body) if body is not None else None, capture_output=True, text=True).stdout or '{}')
def open_dev(b, data, net=True):
    c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834}); nat = []
    c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:') + ((U,) if net else ())) else r.abort())
    c.add_init_script("if(!sessionStorage.getItem('s')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('s','1')}" % (json.dumps(json.dumps(data)), U))
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: (nat.append(d.message), d.accept()))
    pg.goto(APP); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(500)
    return c, pg, errs, nat
def login(pg):
    pg.evaluate("async()=>{await RB.lgPassword('admin','%s')}" % PW['admin']); pg.wait_for_timeout(300)
    if pg.evaluate("!!(RB.ui.lg&&RB.ui.lg.step==='qpnew')"): pg.evaluate("RB.act.qpno()")
    pg.wait_for_timeout(2500)
try:
    A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})['token']
    rv = curl('PUT', '/api/data', {'base': 0, 'data': DATA}, A)['rev']
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---- A: our dialog ----
        c, pg, errs, nat = open_dev(b, DATA, net=False); pg.evaluate("()=>{RB.remember('admin','admin','pw12345','');RB.enterAs('admin','admin')}")
        pg.evaluate("RB.act.hist()"); pg.wait_for_timeout(300)
        d0 = '2026-11-15'; n0 = pg.evaluate("Object.keys(RB.S.days).length")
        pg.evaluate("()=>{RB.ui.h=null}"); pg.evaluate("RB.act.tab('players')"); pg.wait_for_timeout(200)
        pg.evaluate("()=>{RB.ui.cur='%s';RB.S.days['%s'].on={p1:true,p2:true,p3:true};RB.render()}" % (d0, d0)); pg.wait_for_timeout(200)
        pg.click('[data-a="alloff"]') if pg.locator('[data-a="alloff"]').count() else None; pg.wait_for_timeout(300)
        dlg = pg.evaluate("()=>{const e=document.querySelector('#cnf');return e&&!e.hidden?e.textContent:''}")
        on1 = pg.evaluate("RB.S.days['%s']?Object.values(RB.S.days['%s'].on).filter(Boolean).length:-1" % (d0, d0))
        pg.screenshot(path='/tmp/w/cnf_dialog.png')
        pg.click('#cnf button[data-a="cnfno"]'); pg.wait_for_timeout(200)
        on2 = pg.evaluate("Object.values(RB.S.days['%s'].on).filter(Boolean).length" % d0)
        pg.click('[data-a="alloff"]'); pg.wait_for_timeout(200); pg.click('#cnf [data-a="cnfok"]'); pg.wait_for_timeout(300)
        on3 = pg.evaluate("Object.values(RB.S.days['%s'].on).filter(Boolean).length" % d0)
        rec('A: “Turn all off” asks in our own dialog (no browser box); Cancel keeps, OK does it', dlg and 'Turn all players off' in dlg and not nat and on1 == on2 and on2 >= 0 and on3 == 0, [dlg[:60], nat, on1, on2, on3])
        nat.clear(); pg.evaluate("RB.act.sedit2('%s')" % d0); pg.wait_for_timeout(200)
        pg.evaluate("()=>{RB.act.tab('settings')}"); pg.wait_for_timeout(200)
        r2 = pg.evaluate("()=>{RB.act.ruledel&&0;let fired=0;const o=window.confirm;const res=confirm('outside RUN');return res}") if False else None
        rec('A: no page errors', not errs, errs[:2]); c.close()
        # ---- B: open → latest; 30 s poll picks up a change from another device without tapping anything ----
        c, pg, errs, nat = open_dev(b, DATA); login(pg)
        st = pg.evaluate("()=>({rev:RB.SY.rev,stat:document.querySelector('#stat').textContent})")
        new = json.loads(RAW); new['days']['2026-11-29'] = {'sch': 1, 'time': '10:00', 'loc': 'Sportsbay', 'courts': [{'n': 'Court 1', 'h': 2}], 'on': {}, 'att': {}}
        rv2 = curl('PUT', '/api/data', {'base': st['rev'], 'data': new}, A)['rev']
        pg.wait_for_timeout(33000)
        b2 = pg.evaluate("()=>({has:!!RB.S.days['2026-11-29'],rev:RB.SY.rev,stat:document.querySelector('#stat').textContent})")
        rec('B: website/app left open picks up the other device’s change by itself within 30 s (no ↻)', b2['has'] and b2['rev'] == rv2 and 'Behind' not in b2['stat'], [st, b2])
        same = curl('GET', '/api/data?have=%d' % rv2, None, A)
        rec('B: “nothing new” poll is tiny (no data sent when the revision is the same)', same.get('same') == 1 and 'data' not in same, list(same.keys()))
        c.close()
        # ---- C: server always wins; this device's extra game results kept ----
        loc = json.loads(RAW); loc['days']['2026-11-29'] = {'sch': 1, 'time': '10:00', 'loc': 'Sportsbay', 'courts': [{'n': 'Court 1', 'h': 2}], 'on': {}, 'att': {}}
        loc['games']['2026-11-15']['hist'] = [{'r': 1, 'c': 1, 'ids': ['p1', 'p2', 'p4', 'p5'], 'a': ['Raj kumar', 'Annie'], 'b': ['Sreeraj', 'Tej'], 'sa': 21, 'sb': 18, 's': 600, 'at': 1794722000000}]
        loc['days']['2026-12-06'] = {'sch': 1, 'time': '09:00', 'loc': 'Venue X', 'courts': [{'n': 'Court 1', 'h': 1}], 'on': {}, 'att': {}}   # an unsent edit that the server overrides
        srvd = json.loads(RAW); srvd['days']['2026-11-29'] = {'sch': 1, 'time': '11:30', 'loc': 'Sportsbay', 'courts': [{'n': 'Court 1', 'h': 2}], 'on': {}, 'att': {}}
        cur = curl('GET', '/api/data', None, A)['rev']; rv3 = curl('PUT', '/api/data', {'base': cur, 'data': srvd}, A)['rev']
        c, pg, errs, nat = open_dev(b, loc)
        pg.evaluate("()=>{const y=JSON.parse(localStorage.getItem('rebels.sync'));y.rev=1;y.dirty=1;y.last=Date.now()-1e6;localStorage.setItem('rebels.sync',JSON.stringify(y))}")
        pg.reload(); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(400); login(pg); pg.wait_for_timeout(2500)
        cc = pg.evaluate("()=>({t:(RB.S.days['2026-11-29']||{}).time,x:!!RB.S.days['2026-12-06'],h15:RB.S.games['2026-11-15'].hist.length,snap:(JSON.parse(localStorage.getItem('rebels.snaps'))||[]).map(s=>s.why).slice(0,2),dlg:(document.querySelector('#cnf')||{}).hidden===false,toast:document.querySelector('#toast').textContent,stat:document.querySelector('#stat').textContent})")
        rec('C: server always wins – no question, safety snapshot taken, server’s 11:30 kept, unsent edit replaced', cc['t'] == '11:30' and not cc['x'] and not nat and not cc['dlg'] and any('server' in s for s in cc['snap']), cc)
        rec('C: this device’s extra game results (15 Nov played here, not on the server) are kept and uploaded', cc['h15'] == 1 and 'kept this device' in cc['toast'], cc['toast'])
        pg.wait_for_timeout(3000); up = curl('GET', '/api/data', None, A)
        sv = up['data'] if isinstance(up.get('data'), dict) else json.loads(up.get('data') or '{}')
        rec('C: …and the server now has them too', len(sv['games']['2026-11-15']['hist']) == 1, up.get('rev'))
        rec('No page errors', not errs, errs[:2]); c.close(); b.close()
finally:
    srv.kill()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
