#!/usr/bin/env python3
"""v25b: opening the app on another device always gets the latest cloud data (login + quick PIN never block the pull).
Usage: python3 tests/v25b_sync_test.py <copy-of-backup.txt>  · local Worker (Miniflare), headless Chrome."""
import sys, json, pathlib, subprocess
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; DATA = json.loads(pathlib.Path(sys.argv[1]).read_text()); APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']; R = []
def rec(n, ok, d=''): R.append(ok); print(('PASS ' if ok else 'FAIL ') + n + (' · ' + str(d) if d != '' else ''))
def curl(m, p, body=None, tok=None):
    a = ['curl', '-s', '-X', m, U + p, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + (['--data-binary', '@-'] if body is not None else [])
    return json.loads(subprocess.run(a, input=json.dumps(body) if body is not None else None, capture_output=True, text=True).stdout or '{}')
try:
    A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})['token']
    new = json.loads(json.dumps(DATA)); new['days']['2026-11-29'] = {'sch': 1, 'time': '10:00', 'loc': 'Sportsbay', 'courts': [{'n': 'Court 1', 'h': 2}], 'on': {}, 'att': {}}
    rv = curl('PUT', '/api/data', {'base': 0, 'data': new}, A).get('rev')
    old = json.loads(json.dumps(DATA))   # this browser: an older copy, never synced
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for case in ('password + set PIN now', 'password + Not now', 'quick PIN'):
            c = b.new_context(timezone_id='Asia/Dubai'); c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:', U)) else r.abort())
            c.add_init_script("if(!sessionStorage.getItem('s')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('s','1')}" % (json.dumps(json.dumps(old)), U))
            pg = c.new_page(); pg.on('dialog', lambda d: d.accept()); pg.goto(APP); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(500)
            if case == 'quick PIN':
                pg.evaluate("async()=>{await RB.lgPassword('admin','%s');['1','2','3','4','1','2','3','4'].forEach(k=>RB.act.qpk(k))}" % PW['admin']); pg.wait_for_timeout(2500)
                pg.evaluate("()=>{RB.lockApp()}"); pg.evaluate("()=>{const S=RB.S;delete S.days['2026-11-29'];localStorage.setItem('rebels.v1',JSON.stringify(S));const y=JSON.parse(localStorage.getItem('rebels.sync'));y.rev=0;y.dirty=0;localStorage.setItem('rebels.sync',JSON.stringify(y))}")
                pg.reload(); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(400)
                pg.evaluate("()=>{RB.act.lgpick('admin');['1','2','3','4'].forEach(k=>RB.act.qpk(k))}")
            else:
                pg.evaluate("async()=>{await RB.lgPassword('admin','%s')}" % PW['admin']); pg.wait_for_timeout(300)
                if case.endswith('Not now'): pg.evaluate("RB.act.qpno()")
                else: pg.evaluate("()=>['1','2','3','4','1','2','3','4'].forEach(k=>RB.act.qpk(k))")
            pg.wait_for_timeout(3000)
            st = pg.evaluate("()=>({has:!!RB.S.days['2026-11-29'],behind:!!RB.SY.behind,stat:document.querySelector('#stat').textContent})")
            rec('Opening on another browser pulls the latest cloud data automatically (%s)' % case, st['has'] and not st['behind'] and 'Behind' not in st['stat'], st)
            c.close()
        b.close()
finally:
    srv.kill()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
