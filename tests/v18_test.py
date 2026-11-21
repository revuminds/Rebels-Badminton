#!/usr/bin/env python3
"""v18 checks + screenshots (v19: sender = picked name; screenshots skipped with --noshots). Usage: python3 tests/v18_test.py <copy-of-backup.txt> <out-dir>
A) app (headless Chrome, COPY of the backup, fake clock 22 Nov 10:35): Games lock button, A/B won buttons, running game ✎ Edit,
   Stop & save colours, court grid 1/2/3/4 courts + portrait + phone, ⏻ power button, tablet-pin hint.
B) local Worker (Miniflare): /live order, Up next without plan, one-line results, phone layout, player score → tablet review
   (accept / edit / reject / tablet score wins / accept all). Never touches a device or the real cloud."""
import sys, json, pathlib, subprocess, time, io, datetime
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text(); OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + detail if detail else ''))
CLOCK = """(()=>{const off=Date.parse('2026-11-22T10:35:00+04:00')-Date.now(),D=Date;class FD extends D{constructor(...a){a.length?super(...a):super(D.now()+off)}static now(){return D.now()+off}};window.Date=FD})();"""
NBMOCK = "window.Android={isPinned:()=>window.__pin===true,pinScreen:()=>{window.__pin=true},unlock:()=>{window.__unl=(window.__unl||0)+1}};"
def setup(nc):
    return """()=>{const d='2026-11-22',D=RB.S.days[d];D.courts=Array.from({length:%d},(_,i)=>({n:'Court '+(i+1),h:2}));const g=RB.G(d);g.courts=%d;delete g.fp;
  RB.planFull(g,false);RB.act.startsess();Object.keys(D.on).forEach(id=>RB.act.ckin(id));RB.act.closeck&&RB.act.closeck();
  for(let i=0;i<%d;i++){RB.act.cfopen(String(i));RB.act.cfok()}for(let k=0;k<9;k++)RB.act.sc('0','a+');for(let k=0;k<6;k++)RB.act.sc('0','b+');RB.act.won('0','a');RB.save();RB.act.tab('games')}""" % (nc, nc, nc)

def app_ctx(b, w=1194, h=834, light=False, store='', net=None, clock=True):
    c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': w, 'height': h})
    ext = []
    def route(r):
        u = r.request.url
        if u.startswith(('file:', 'data:', 'blob:')) or (net and u.startswith(net)): return r.continue_()
        ext.append(u); r.abort()
    c.route('**/*', route)
    c.add_init_script((CLOCK if clock else '') + NBMOCK + "if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);%s%s;sessionStorage.setItem('seeded','1')}" % (json.dumps(DATA), "localStorage.setItem('rebels.theme','light');" if light else '', store))
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'net::ERR' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(APP); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(700)
    return c, pg, errs, ext

def local_admin(pg):
    pg.evaluate("()=>{if(!RB.ACC.admin)RB.remember('admin','admin','testpw1','');RB.enterAs('admin','admin')}"); pg.wait_for_timeout(200)

NOSHOT = '--noshots' in sys.argv
def shot(pg, name, full=False):
    if NOSHOT: return None
    p = OUT / (name + '.png'); pg.screenshot(path=str(p), full_page=full); return p

def bg(pg, sel):
    return pg.evaluate("s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return [c.backgroundColor,c.color,c.fontWeight,e.textContent.trim()]}", sel)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # ================= A. app =================
    for light in (False, True):
        c, pg, errs, ext = app_ctx(b, light=light); local_admin(pg); pg.evaluate(setup(2)); pg.wait_for_timeout(300)
        th = 'light' if light else 'dark'
        rec('[%s] Games: 🔒 tablet lock button on Games tab' % th, pg.locator('#main [data-a="devlock"]').count() == 1)
        a, bb = bg(pg, '[data-a="won"][data-x="0"][data-y="a"]'), bg(pg, '[data-a="won"][data-x="0"][data-y="b"]')
        rec('[%s] A won selected = solid yellow, dark text, ✓' % th, a[0] == 'rgb(255, 210, 63)' and a[1] == 'rgb(20, 22, 26)' and a[3].startswith('✓'), str(a))
        rec('[%s] B won (not selected) = solid white, dark text' % th, bb[0] == 'rgb(255, 255, 255)' and bb[1] == 'rgb(20, 22, 26)' and '✓' not in bb[3], str(bb))
        ss = bg(pg, '[data-a="timer"][data-x="0"]')
        if light: rec('[light] Stop & save = solid Rebels red, white bold', ss[0] == 'rgb(214, 47, 51)' and ss[1] == 'rgb(255, 255, 255)' and int(ss[2]) >= 700, str(ss))
        else: rec('[dark] Stop & save unchanged (amber)', ss[0] == 'rgb(245, 165, 36)', str(ss))
        rec('[%s] Running game: no ⇄ Swap buttons' % th, pg.locator('[data-a="cswap"]').count() == 0)
        nxt = pg.evaluate("()=>{const t=document.querySelector('[data-a=\"timer\"][data-x=\"0\"]');return t&&t.nextElementSibling&&t.nextElementSibling.dataset.a}")
        rec('[%s] ✎ Edit sits right of Stop & save' % th, nxt == 'ced', str(nxt))
        rec('[%s] power icon (SVG) is the top-right item of the status bar' % th, pg.evaluate("()=>{const s=document.querySelector('#stat');const l=s.lastElementChild;const r=l.getBoundingClientRect();return l.classList.contains('pwr')&&!!l.querySelector('svg')&&r.right>innerWidth-30&&r.top<40&&!document.querySelector('[data-a=\"switchacc\"] span')}"))
        pg.evaluate("window.scrollTo(0,0)"); shot(pg, 'games_' + th)
        pg.evaluate("window.scrollTo(0,0)"); shot(pg, 'games_' + th + '_full', True)
        if not light:
            # ✎ Edit: change a player on a running game, timer + score kept
            before = pg.evaluate("()=>{const g=RB.G('2026-11-22');return JSON.stringify([g.live[0].start,g.live[0].sa,g.live[0].sb,g.live[0].run])}")
            pg.click('[data-a="ced"][data-x="0"]'); pg.wait_for_timeout(200)
            rec('Edit: player-change shown for that court (Swap ×4 + Done)', pg.locator('[data-a="cswap"][data-x="0"]').count() == 4 and pg.locator('[data-a="cswap"][data-x="1"]').count() == 0 and pg.locator('[data-a="cedx"]').count() == 1)
            shot(pg, 'games_edit_running')
            new = pg.evaluate("()=>{const g=RB.G('2026-11-22'),d=g.d,busy=new Set(g.cur.flat());return Object.keys(RB.S.days[d].on).find(id=>!busy.has(id)&&RB.S.players.find(p=>p.id===id).sx===RB.S.players.find(p=>p.id===g.cur[0][0]).sx)}")
            old = pg.evaluate("RB.G('2026-11-22').cur[0][0]")
            pg.evaluate("RB.act.cswap('0','0')"); pg.wait_for_timeout(150); pg.evaluate("id=>RB.act.apick(id)", new); pg.wait_for_timeout(200)
            after = pg.evaluate("()=>{const g=RB.G('2026-11-22');return JSON.stringify([g.live[0].start,g.live[0].sa,g.live[0].sb,g.live[0].run])}")
            rec('Edit: player swapped, timer + score kept', pg.evaluate("RB.G('2026-11-22').cur[0][0]") == new and before == after, '%s → %s' % (old, new))
            busy = pg.evaluate("RB.G('2026-11-22').cur[1][0]")
            pg.evaluate("RB.act.cswap('0','1')"); pg.evaluate("id=>RB.act.apick(id)", busy); pg.wait_for_timeout(150)
            rec('Edit: same validation (player on another court refused)', pg.evaluate("RB.G('2026-11-22').cur[0][1]") != busy)
            pg.evaluate("RB.act.cedx()"); pg.wait_for_timeout(150)
            rec('Edit: Done hides the player-change again', pg.locator('[data-a="cswap"]').count() == 0 and pg.locator('[data-a="ced"]').count() == 2)
            # tablet pinned: power disabled + unlock hint, icon follows the real state
            pg.evaluate("RB.act.tab('players')"); pg.evaluate("RB.act.devlock()"); pg.wait_for_timeout(900)
            rec('Lock: 🔒 pins the tablet (icon shows locked)', pg.evaluate("window.__pin===true") and pg.locator('[data-a="devlock"].on').count() == 1)
            pg.evaluate("RB.act.tab('games')"); pg.wait_for_timeout(100)
            pg.evaluate("RB.act.devlock()"); pg.wait_for_timeout(100)
            t = pg.inner_text('#toast')
            rec('Lock: tapping 🔒 while pinned shows the swipe-up hint (no in-app unlock)', 'swipe up from the bottom and hold 3 seconds' in t and pg.evaluate("!window.__unl"), t)
            rec('Power icon hidden while pinned (v20), still logged in', pg.locator('#stat .pwr:visible').count() == 0 and pg.evaluate("RB.AUTH.role") == 'admin')
            pg.evaluate("window.__pin=false"); pg.wait_for_timeout(5000)
            rec('Unpinned by the tablet gesture → icons update by themselves', pg.locator('#main [data-a="devlock"].on').count() == 0 and pg.locator('#stat .pwr.dis').count() == 0, pg.evaluate("JSON.stringify([window.__pin,document.querySelectorAll('#main [data-a=devlock].on').length,document.querySelectorAll('#stat .pwr.dis').length,RB.ui.tab,!!document.querySelector('.modal')])"))
            rec('No console errors (Games tab v18)', not errs, '; '.join(errs[:3]))
            rec('No external network requests (offline app)', not ext, ', '.join(ext[:3]))
        c.close()
    # court grid by court count
    lay = {}
    for nc in (1, 2, 3, 4):
        c, pg, errs, ext = app_ctx(b); local_admin(pg); pg.evaluate(setup(nc)); pg.wait_for_timeout(300)
        r = pg.evaluate("()=>{const g=document.querySelector('.cgrid'),W=g.getBoundingClientRect().width;return [...g.children].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.width/W*100),Math.round(r.top)]})}")
        lay[nc] = r
        tops = sorted(set(t for _, t in r))
        exp = {1: (69, 1), 2: (49, 1), 3: (49, 2), 4: (49, 2)}[nc]        # v21: max 2 side by side; 1 court capped at 760 px
        rec('%d court%s: cards %s%% wide, %d row%s' % (nc, 's' if nc > 1 else '', exp[0], exp[1], 's' if exp[1] > 1 else ''), all(abs(w - exp[0]) <= 3 for w, _ in r) and len(tops) == exp[1], str(r))
        pg.evaluate("window.scrollTo(0,0)"); shot(pg, 'courts_%d' % nc)
        c.close()
    for lab, w, h in (('portrait', 834, 1194), ('phone', 390, 844)):
        c, pg, errs, ext = app_ctx(b, w, h); local_admin(pg); pg.evaluate(setup(3)); pg.wait_for_timeout(300)
        r = pg.evaluate("()=>{const g=document.querySelector('.cgrid'),W=g.getBoundingClientRect().width;return [...g.children].map(e=>Math.round(e.getBoundingClientRect().width/W*100))}")
        rec('3 courts on %s: cards stack (1 column)' % lab, all(x >= 98 for x in r), str(r))
        pg.evaluate("document.querySelector('.cgrid').scrollIntoView()"); shot(pg, 'courts_3_' + lab)
        c.close()

    # ================= B. Worker: live page + player scores =================
    srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']
    try:
        now = int(time.time() * 1000); dub = datetime.datetime.fromtimestamp(now / 1000 + 4 * 3600, datetime.UTC).replace(tzinfo=None)
        today = dub.strftime('%Y-%m-%d'); st = now - 40 * 60e3
        S = json.loads(DATA); S['players'][20]['hidePub'] = 1   # Ricky → Guest on the live page
        src = S['days']['2026-11-22']; on = [k for k, v in src['on'].items() if v]
        S['days'][today] = {'sch': 1, 'time': (dub - datetime.timedelta(minutes=40)).strftime('%H:%M'), 'loc': 'Sportsbay', 'courts': [{'n': 'Court 6', 'h': 2}, {'n': 'Court 7', 'h': 2}, {'n': 'Court 8', 'h': 2}], 'on': src['on'], 'att': {k: {'a': int(st)} for k in on}}
        q = lambda i: on[i * 4:(i + 1) * 4]
        hist = [{'r': 1, 'c': 1, 'ids': ['p20', 'p16', 'p24', 'p9'], 'sa': 21, 'sb': 15, 's': 600, 'at': int(st + 12 * 60e3)},
                {'r': 1, 'c': 2, 'ids': q(1), 'sa': 0, 'sb': 0, 's': 640, 'at': int(st + 13 * 60e3)},
                {'r': 1, 'c': 3, 'ids': q(2), 'sa': 0, 'sb': 0, 's': 700, 'at': int(st + 14 * 60e3)},
                {'r': 2, 'c': 1, 'ids': ['p25', 'p21', 'p19', 'p15'], 'sa': 19, 'sb': 21, 's': 690, 'at': int(st + 25 * 60e3)},
                {'r': 2, 'c': 2, 'ids': q(0), 'sa': 0, 'sb': 0, 's': 720, 'at': int(st + 26 * 60e3)},
                {'r': 2, 'c': 3, 'ids': ['p22', 'p12', 'p11', 'p10'], 'sa': 0, 'sb': 0, 's': 700, 'at': int(st + 27 * 60e3)}]
        for h in hist: h['a'] = h['ids'][:2]; h['b'] = h['ids'][2:]
        S['games'][today] = {'d': today, 'courts': 3, 'round': 2, 'st': int(st), 'en': 0, 'pts': 21, 'deuce': False, 'slot': 15, 'chg': 1,
            'cur': [['p2', 'p18', 'p24', 'p19'], q(1), ['p1', 'p15', 'p9', 'p11']], 'live': [{'run': True, 'start': now - 7 * 60e3, 'sa': 14, 'sb': 11, 'el': 0, 'w': ''}, {'run': True, 'start': now - 4 * 60e3, 'sa': 6, 'sb': 8, 'el': 0, 'w': ''}, {'run': True, 'start': now - 60e3, 'sa': 1, 'sb': 0, 'el': 0, 'w': '', 'pts': 15}],
            'nxt': [[None] * 4] * 3, 'qq': [[], [], []], 'up': [{'q': ['p25', 'p10', 'p12', 'p18']}, {'q': ['p1', 'p15', 'p20', 'p21']}],
            'hist': hist, 'since': {}, 'btot': {}, 'ros': on, 'last': [None, None, None], 'plan': [], 'log': [], 'strk': {}, 'pre': [], 'auto': [], 'closed': {}, 'nman': [], 'man': 0, 'curN': [0, 0, 0]}
        post = lambda path, body, tok=None: json.loads(subprocess.run(['curl', '-s', '-X', 'POST', U + path, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + ['--data-binary', '@-'], input=json.dumps(body), capture_output=True, text=True).stdout or '{}')
        code = lambda m, path, body=None, tok=None: int(subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', m, U + path, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + (['--data-binary', json.dumps(body)] if body is not None else []), capture_output=True, text=True).stdout)
        A = post('/api/login', {'u': 'admin', 'p': PW['admin']})['token']
        put = subprocess.run(['curl', '-s', '-X', 'PUT', U + '/api/data', '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer ' + A, '--data-binary', '@-'], input=json.dumps({'base': 0, 'data': S}), capture_output=True, text=True).stdout
        rec('Test session uploaded to the local Worker (today %s, 3 courts running)' % today, '"rev":1' in put, put)
        L = json.loads(subprocess.run(['curl', '-s', U + '/api/live'], capture_output=True, text=True).stdout)
        rec('Live API: on court has format + points', L['live'] and [c['ty'] for c in L['now']] and L['now'][2]['pts'] == 15, str([(c['court'], c['ty'], c['pts']) for c in L['now']]))
        rec('Live API: Up next shows app-picked games with no court (no full plan)', len(L['next']) == 2 and all(n['court'] == '' for n in L['next']), str(L['next'][:1]))
        rec('Live API: results newest first, scored ones locked, unscored can be sent', [r['sc'] for r in L['results']] == [False, False, True, False, False, True] and [r['send'] for r in L['results']] == [True, True, False, True, True, False])
        rec('Live API: hidden player shown as Guest, no ids/phones/finance', 'Guest' in json.dumps(L) and 'Ricky' not in json.dumps(L) and not __import__('re').search(r'"p\d+"', json.dumps(L)) and '+971' not in json.dumps(L) and 'fin' not in L)
        # phone page
        for w, h, nm in ((390, 844, 'phone'), (1194, 834, 'tablet')):
            c = b.new_context(viewport={'width': w, 'height': h}, timezone_id='Asia/Dubai', device_scale_factor=2 if nm == 'phone' else 1, is_mobile=nm == 'phone', has_touch=nm == 'phone')
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(U + '/live'); pg.wait_for_timeout(1500)
            # v19: first visit asks Guest / Player – the phone plays as Saif (p11), the tablet watches as guest
            if nm == 'phone': pg.click('[data-a="player"]'); pg.click('.pk button:has-text("Saif")'); pg.wait_for_timeout(1200)
            if pg.is_visible('#turn.on'): pg.click('[data-a="turnok"]'); pg.wait_for_timeout(200)      # v21: Saif is on court → "your turn" popup
            else: pg.click('[data-a="guest"]'); pg.wait_for_timeout(800)
            if nm == 'phone':
                hs = pg.eval_on_selector_all('h2', 'e=>e.map(x=>x.textContent)')
                rec('Live page order: On court → Up next → Results → Games & wins', hs == ['ON COURT NOW', 'UP NEXT', 'RESULTS · NEWEST FIRST', 'TODAY · GAMES & WINS'], str(hs))
                rec('On court cards: green court backdrop + lines, header "Court · Points · timer", format heading', pg.evaluate("()=>{const c=document.querySelector('.vc');const ct=c.querySelector('.vct');return !!ct.querySelector('svg rect')&&!!ct.querySelector('.vnet')&&/Court 6.*to 21/.test(c.querySelector('.vch').textContent)&&/\\d\\d:\\d\\d/.test(c.querySelector('.vtm').textContent)&&!!c.querySelector('.vch .fmt')}"))
                fm = pg.eval_on_selector_all('.fh', 'e=>e.map(x=>x.textContent)')
                rec('Format headings (Mixed / Men\'s / Women\'s doubles) on court + up next', all(any(k in f for k in ("Mixed doubles", "Men's doubles", "Women's doubles")) for f in fm) and len(fm) >= 2, str(fm))          # v21: on court shows the format badge in the court header; headings on Up next
                rec('Up next card says "Next free court"', pg.locator('text=Next free court').count() == 2)
                ln = pg.evaluate("()=>[...document.querySelectorAll('.ln')].map(e=>[e.scrollWidth<=e.clientWidth+1,e.getBoundingClientRect().height<34,e.textContent,getComputedStyle(e).fontSize])")
                rec('Results: every result on ONE line on a 390 px phone (text shrinks to fit)', all(x[0] and x[1] for x in ln), str([(x[2][:46], x[3]) for x in ln]))
                rec('Results line format "Court 6 · Kris & Lee (21) vs Kia & Hasir (15)"', any(x[2].startswith('Court 6 · Kris & Lee (21) vs Kia & Hasir (15)') for x in ln), ln[3][2] if len(ln) > 3 else '')
                w = pg.evaluate("()=>{const e=document.querySelector('.ln .w');const c=getComputedStyle(e);return [e.textContent,c.color,c.fontWeight]}")
                rec('Winner team + score bold blue', w[1] == 'rgb(76, 154, 255)' and int(w[2]) >= 700, str(w))
                rec('Send score: big tap target (≥ 48 px), only on finished games without a score (v19: only Saif\'s 2 games)', pg.evaluate("()=>[...document.querySelectorAll('[data-a=open]')].every(b=>b.getBoundingClientRect().height>=48)") and pg.locator('[data-a="open"]').count() == 2)
                shot(pg, 'live_phone_top')
                shot(pg, 'live_phone_full', True)
                # send a score as a player
                k0 = L['results'][0]['k']
                pg.click('[data-a="open"][data-k="%s"]' % k0); pg.wait_for_timeout(200)
                rec('Send score (v19): sender = picked name, no who-picker, no typing', pg.locator('.who').count() == 0 and 'Saif' in pg.inner_text('#sas') and pg.locator('.sh input[type=text]:not([inputmode=numeric])').count() == 0, pg.inner_text('#sas'))
                pg.fill('#insa', '21'); pg.fill('#insb', '25'); pg.click('[data-a="send"]'); pg.wait_for_timeout(300)
                rec('Send score: invalid score refused on the phone (vs game points)', 'Max 21' in pg.inner_text('#er'), pg.inner_text('#er'))
                pg.fill('#insb', '17'); shot(pg, 'live_phone_send')
                pg.click('[data-a="send"]'); pg.wait_for_timeout(1200)
                rec('Send score: locked → "Score sent · waiting for approval"', pg.locator('.pill:has-text("Score sent · waiting for approval")').count() == 1 and pg.locator('[data-a="open"][data-k="%s"]' % k0).count() == 0)
                shot(pg, 'live_phone_sent')
                rec('No page errors on the live page', not errs, '; '.join(errs[:2]))
            else:
                rec('Tablet live page: 3 on-court cards in one row (thirds)', pg.evaluate("()=>{const c=[...document.querySelector('.cg').children].map(e=>e.getBoundingClientRect());return c.length===3&&new Set(c.map(r=>Math.round(r.top))).size===1}"))
                shot(pg, 'live_tablet', True)
            c.close()
        # API rules (v19: sender = claim token of a player of that game)
        LP = json.loads(subprocess.run(['curl', '-s', U + '/api/live'], capture_output=True, text=True).stdout)
        claim = lambda name: post('/api/live/claim', {'k': [x['k'] for x in LP['pick'] if x['name'] == name][0]}).get('t')
        tA, tK, tKia = claim('Annie'), claim('Kris'), claim('Kia')
        ks = [r['k'] for r in L['results']]; u = [r['k'] for r in L['results'] if not r['sc']]; ksc = [r['k'] for r in L['results'] if r['sc']][0]
        rec('API: same game sent again → 409 (one score per game)', code('POST', '/api/live/score', {'k': u[0], 't': tA, 'sa': 21, 'sb': 10}) == 409)
        rec('API: game that already has a score → 409', code('POST', '/api/live/score', {'k': ksc, 't': tA, 'sa': 21, 'sb': 10}) == 409)
        rec('API: unknown / on-court game → 404', code('POST', '/api/live/score', {'k': '123-1', 't': tA, 'sa': 21, 'sb': 10}) == 404)
        rec('API: unfinished score (15–10) / over the cap (30–28) → 400', code('POST', '/api/live/score', {'k': u[1], 't': tA, 'sa': 15, 'sb': 10}) == 400 and code('POST', '/api/live/score', {'k': u[1], 't': tA, 'sa': 30, 'sb': 28}) == 400)
        rec('API: sender must be one of the 4 players (v19: not in game → 403, no name → 401)', code('POST', '/api/live/score', {'k': u[1], 't': tK, 'sa': 21, 'sb': 10}) == 403 and code('POST', '/api/live/score', {'k': u[1], 'who': 1, 'sa': 21, 'sb': 10}) == 401)
        rec('API: 2nd and 3rd unscored games sent', code('POST', '/api/live/score', {'k': u[1], 't': tA, 'sa': 21, 'sb': 12}) == 200 and code('POST', '/api/live/score', {'k': u[2], 't': tKia, 'sa': 18, 'sb': 21}) == 200)
        O = post('/api/login', {'u': 'organizer', 'p': PW['organizer']})['token']
        rec('API: review list – no login 401, organizer 403', code('GET', '/api/subs') == 401 and code('GET', '/api/subs', None, O) == 403 and code('POST', '/api/subs/1', {'st': 'a'}, O) == 403)

        # ---- tablet review ----
        st_url = "localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}))" % U
        c, pg, errs, ext = app_ctx(b, store=st_url, net=U, clock=False)
        pg.evaluate("RB.act.lgother()"); pg.fill('#lgu', 'games'); pg.fill('#lgp', PW['games']); pg.click('[data-a="lgpw"]'); pg.wait_for_timeout(2500)
        if pg.is_visible('[data-a="lgnoface"]'): pg.click('[data-a="lgnoface"]')
        if pg.locator('[data-a="qpno"]').count() and pg.is_visible('[data-a="qpno"]'): pg.click('[data-a="qpno"]'); pg.wait_for_timeout(300)   # v20 quick PIN offer
        pg.evaluate("t=>window.TD=t", today)
        for _ in range(8):                                    # cloud pull can take a few seconds
            pg.evaluate("RB.syncNow(true)"); pg.wait_for_timeout(2500)
            if pg.evaluate("!!(RB.S.games[TD]&&RB.S.games[TD].hist&&RB.S.games[TD].hist.length)"): break
        pg.evaluate("RB.act.tab('games')")
        for _ in range(10):
            pg.evaluate("RB.subsPoll(true)"); pg.wait_for_timeout(700)
            if pg.locator('[data-a="subsopen"]').count(): break
        btn = pg.locator('[data-a="subsopen"]')
        rec('Tablet (game manager): blinking "Scores to review (3)" on Games tab', btn.count() == 1 and 'Scores to review (3)' in btn.inner_text() and pg.evaluate("getComputedStyle(document.querySelector('.rvb')).animationName") == 'rvb', btn.inner_text() if btn.count() else 'missing')
        pg.evaluate("window.scrollTo(0,0)"); shot(pg, 'review_button')
        # tablet scores game 3 itself before reviewing → its own score wins
        pg.evaluate("k=>{const g=RB.G(TD);const h=g.hist.find(x=>RB.hKey(x)===k);h.sa=21;h.sb=19;RB.save()}", u[2])
        pg.click('[data-a="subsopen"]', timeout=5000); pg.wait_for_timeout(400)
        rows = pg.locator('.subr')
        rec('Review list shows sender + time + teams for each score', rows.count() == 3 and 'Sent by' in rows.nth(0).inner_text(), rows.nth(0).inner_text().replace('\n', ' ') if rows.count() else '')
        rec('Tablet score wins: that row offers only Dismiss', 'Already scored on the tablet' in rows.nth(2).inner_text() and rows.nth(2).locator('[data-a="subacc"]').count() == 0)
        shot(pg, 'review_list')
        # edit the 2nd score to an invalid one → accept disabled; then valid
        sid = pg.evaluate("RB.ui.subs[1].id")
        pg.fill('[data-i="sub_sa"][data-x="%d"]' % sid, '22'); pg.wait_for_timeout(900)
        rec('Edit validated vs game points (22–12 to 21 refused)', pg.is_disabled('[data-a="subacc"][data-x="%d"]' % sid))
        pg.fill('[data-i="sub_sa"][data-x="%d"]' % sid, '21'); pg.fill('[data-i="sub_sb"][data-x="%d"]' % sid, '14'); pg.wait_for_timeout(900)
        pg.click('[data-a="subacc"][data-x="%d"]' % sid); pg.wait_for_timeout(1200)
        h2 = pg.evaluate("k=>{const g=RB.G(TD);const h=g.hist.find(x=>RB.hKey(x)===k);return [h.sa,h.sb,(RB.S.audit[0]||{}).m]}", u[1])
        rec('Accept (edited) → saved as normal result + audit log', h2[0] == 21 and h2[1] == 14 and 'Live score accepted' in (h2[2] or ''), str(h2))
        pg.click('[data-a="subsall"]'); pg.wait_for_timeout(1800)
        h1 = pg.evaluate("k=>{const g=RB.G(TD);const h=g.hist.find(x=>RB.hKey(x)===k);return [h.sa,h.sb]}", u[0])
        h3 = pg.evaluate("k=>{const g=RB.G(TD);const h=g.hist.find(x=>RB.hKey(x)===k);return [h.sa,h.sb]}", u[2])
        rec('Accept all → remaining valid score saved, tablet-scored one dismissed', h1 == [21, 17] and h3 == [21, 19] and not pg.evaluate("(RB.ui.subs||[]).length"), '%s %s' % (h1, h3))
        rec('Review button gone when nothing is left', pg.locator('[data-a="subsopen"]').count() == 0)
        pg.wait_for_timeout(3000); pg.evaluate("RB.syncNow(false)"); pg.wait_for_timeout(2500)
        L2 = json.loads(subprocess.run(['curl', '-s', U + '/api/live'], capture_output=True, text=True).stdout)
        rec('After sync the live page shows the accepted scores', [(r['sa'], r['sb']) for r in L2['results']][:4] == [(21, 17), (21, 14), (19, 21), (21, 19)], str([(r['sa'], r['sb']) for r in L2['results']]))
        # reject reopens: send a score for the last unscored game, reject it
        k4 = [r['k'] for r in L2['results'] if r['send']]
        ok4 = bool(k4) and code('POST', '/api/live/score', {'k': k4[0], 't': tK, 'sa': 21, 'sb': 3}) == 200
        for _ in range(10):
            pg.evaluate("RB.subsPoll(true)"); pg.wait_for_timeout(700)
            if pg.locator('[data-a="subsopen"]').count(): break
        pg.click('[data-a="subsopen"]'); pg.wait_for_timeout(300)
        pg.click('[data-a="subrej"]'); pg.wait_for_timeout(1200)
        L3 = json.loads(subprocess.run(['curl', '-s', U + '/api/live'], capture_output=True, text=True).stdout)
        rec('Reject reopens the game on the live page', ok4 and any(r['k'] == k4[0] and r['send'] for r in L3['results']) and 'rejected' in (pg.evaluate("(RB.S.audit[0]||{}).m") or ''))
        aud = post('/api/login', {'u': 'admin', 'p': PW['admin']})['token']
        al = json.loads(subprocess.run(['curl', '-s', U + '/api/audit', '-H', 'Authorization: Bearer ' + aud], capture_output=True, text=True).stdout)['list']
        rec('Worker audit log has the accept / reject entries', sum('Live score' in a['m'] for a in al) >= 4, str(sum('Live score' in a['m'] for a in al)))
        rec('No console errors (tablet review)', not errs, '; '.join(errs[:3]))
        c.close()
    finally:
        srv.terminate()
    b.close()

# contact sheets
def sheet(files, out, th=520, cols=None):
    ims = [(f, Image.open(OUT / (f + '.png')).convert('RGB')) for f in files]
    ims = [(f, im.resize((int(im.width * th / im.height), th))) for f, im in ims]
    cols = cols or len(ims); rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
    W = max(sum(i.width + 16 for _, i in r) for r in rows) + 16; H = len(rows) * (th + 44) + 16
    s = Image.new('RGB', (W, H), (40, 42, 48)); d = ImageDraw.Draw(s)
    try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except Exception: fnt = None
    y = 16
    for r in rows:
        x = 16
        for f, i in r: d.text((x, y), f, fill=(230, 230, 230), font=fnt); s.paste(i, (x, y + 26)); x += i.width + 16
        y += th + 44
    s.save(OUT / out, optimize=True)
if not NOSHOT: sheet(['games_dark', 'games_light'], 'v18_games_light_dark.png', 640)
if not NOSHOT: sheet(['courts_1', 'courts_2', 'courts_3', 'courts_4', 'courts_3_portrait', 'courts_3_phone'], 'v18_court_layouts.png', 520, 4)
if not NOSHOT: sheet(['live_phone_top', 'live_phone_send', 'live_phone_sent'], 'v18_live_phone.png', 900)
if not NOSHOT: sheet(['review_button', 'review_list', 'games_edit_running'], 'v18_review_edit.png', 560)
n = sum(ok for _, ok, _ in R); print('\n%d passed, %d failed' % (n, len(R) - n))
sys.exit(0 if n == len(R) else 1)
