#!/usr/bin/env python3
"""v21 checks. Usage: python3 tests/v21_test.py <copy-of-backup.txt> [shots-dir]
Court graphic (live page + tablet Games), red LIVE dot, "your turn" popup, score corrections, Save with no score.
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
        def phone(w=390, h=844, rm='no-preference'):
            c = b.new_context(viewport={'width': w, 'height': h}, timezone_id='Asia/Dubai', is_mobile=True, has_touch=True, reduced_motion=rm, permissions=['notifications'])
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(U + '/live'); pg.wait_for_timeout(1500); return c, pg, errs
        def pick(pg, name):
            pg.click('#m [data-a="player"]'); pg.wait_for_timeout(200); pg.click('.pk button:has-text("%s")' % name); pg.wait_for_timeout(1500)
        # ---- items 1 + 2: court graphic + red dot (guest) ----
        cg, pg, eg = phone(); pg.click('#m [data-a="guest"]'); pg.wait_for_timeout(1200)
        dot = pg.evaluate("(()=>{const d=document.querySelector('.live.on .dot');if(!d)return null;const s=getComputedStyle(d);return [s.backgroundColor,s.animationName,s.animationDuration]})()")
        rec('Item 2: LIVE dot is red and pulsing (1.2 s loop)', dot and dot[0] == 'rgb(255, 59, 48)' and dot[1] == 'lp' and dot[2] == '1.2s', str(dot))
        geo = pg.evaluate("(()=>{const v=[...document.querySelectorAll('.vc')].map(x=>x.getBoundingClientRect());const u=[...document.querySelectorAll('h2')].find(h=>h.textContent==='UP NEXT');return {n:v.length,top:v[0]&&v[0].top,bot:v[0]&&v[0].bottom,h:v.map(r=>r.height),up:u&&u.getBoundingClientRect().top,ih:innerHeight}})()")
        rec('Item 1: one court graphic per game on court (SVG, names in 4 boxes)', geo['n'] == 1 and pg.locator('.vct > svg').count() == 1 and pg.locator('.vct .vbx').count() == 4, str(geo))
        rec('Item 1: court fits the first screen under the header (phone 390×844)', geo['bot'] <= geo['ih'] + 1 and max(geo['h']) <= geo['ih'], '%.0f–%.0f of %d' % (geo['top'], geo['bot'], geo['ih']))
        rec('Item 1: Up next list below the court (scroll down)', geo['up'] and geo['up'] >= geo['bot'])
        nm = pg.eval_on_selector_all('.vbx span', 'e=>e.map(x=>x.textContent)')
        rec('Item 1: Team A top boxes, Team B bottom boxes', nm == ['Raj kumar', 'Sreeraj', 'Tej', 'Vinoth'], str(nm))
        rec('Item 1: score + timer on the net line', pg.locator('.vnet .vsc').count() == 2 and pg.locator('.vnet .vtm [data-t]').count() == 1 and pg.inner_text('.vnet').replace('\n', ' ').startswith('9'))
        fs = pg.evaluate("Math.min(...[...document.querySelectorAll('.vbx span')].map(x=>parseFloat(getComputedStyle(x).fontSize)))")
        rec('Item 1: names readable (≥ 14 px)', fs >= 14, '%.1f px' % fs)
        shot(pg, 'v21_live_phone.png')
        c2, p2, e2 = phone(360, 640); p2.click('#m [data-a="guest"]'); p2.wait_for_timeout(1000)
        g2 = p2.evaluate("(()=>{const r=document.querySelector('.vc').getBoundingClientRect();return [r.bottom,innerHeight]})()")
        rec('Item 1: small phone 360×640 – court still fits one screen', g2[0] <= g2[1] + 1, str(g2)); c2.close()
        c3, p3, e3 = phone(rm='reduce'); p3.click('#m [data-a="guest"]'); p3.wait_for_timeout(1000)
        rec('Item 2: reduced motion → dot does not pulse', p3.evaluate("getComputedStyle(document.querySelector('.live.on .dot')).animationName") == 'none'); c3.close()
        # ---- item 3: your turn ----
        ca, pa, ea = phone(); pick(pa, 'Saif')
        upc = pa.locator('.cc:has(.pill:has-text("Your game"))')
        rec('Item 3: own Up next game marked "Your game" with 🔔 Alert me', upc.count() == 1 and pa.locator('[data-a="arm"]').count() == 1)
        rec('Item 3 (optional): "You\'re up next" heads-up', 'up next on Court 7' in pa.inner_text('#toast'), pa.inner_text('#toast'))
        pa.click('[data-a="arm"]'); pa.wait_for_timeout(800)
        tu = pa.evaluate("JSON.parse(localStorage.getItem('rb.turn'))")
        rec('Item 3: selecting the game arms the alert (+ keep screen on by default, battery note)', tu.get('sel') and tu.get('wake') is True and 'Alert on' in pa.inner_text('[data-a="arm"]') and 'battery' in pa.inner_text('.anote'), json.dumps(tu))
        rec('Item 3: notification permission asked / service worker registered', pa.evaluate("Notification.permission") == 'granted' and pa.evaluate("navigator.serviceWorker.getRegistration('/live').then(r=>!!r)"))
        rec('Item 3: no popup before the game starts', not pa.is_visible('#turn.on'))
        G['cur'][1] = ['p11', 'p9', 'p12', 'p10']; G['live'][1] = {'run': True, 'start': int(time.time() * 1000), 'sa': 0, 'sb': 0, 'el': 0, 'w': ''}; G['qq'][1] = []
        rec('Organiser starts Saif\'s game on Court 7 (upload)', put(S) == 200)
        pa.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pa.wait_for_timeout(1500)
        tt = pa.inner_text('#turn') if pa.is_visible('#turn.on') else ''
        rec('Item 3: popup on resume (visibilitychange → re-sync)', "your turn" in tt.lower() and 'Saif & Hasir vs Haja & Shahan' in tt and 'Court 7' in tt, tt.replace('\n', ' | '))
        shot(pa, 'v21_your_turn.png')
        pa.click('[data-a="turnok"]'); pa.wait_for_timeout(300)
        rec('Item 3: OK closes it; alert disarmed after the game starts', not pa.is_visible('#turn.on') and not pa.evaluate("JSON.parse(localStorage.getItem('rb.turn')).sel"))
        pa.reload(); pa.wait_for_timeout(1800)
        rec('Item 3: shown only once per game (reload → no popup)', not pa.is_visible('#turn.on'))
        rec('Item 3: own court highlighted on Live', pa.locator('.vc.mine-c').count() == 1 and pa.locator('.vbx span.mine').count() == 1)
        # ---- item 4: corrections ----
        cb, pb, eb = phone(); pick(pb, 'Annie')
        rec('Item 4: player not in the scored game → no Suggest correction', pb.locator('[data-a="fix"]').count() == 0)
        rec('Item 4: player in the scored game → "✎ Suggest correction"', pa.locator('[data-a="fix"]').count() == 1)
        pa.click('[data-a="fix"]'); pa.wait_for_timeout(300)
        sh = pa.inner_text('#m .sh')
        rec('Item 4: same sheet, prefilled with the saved score', 'SUGGEST CORRECTION' in sh and 'saved now: 21 – 15' in sh and pa.input_value('#insa') == '21' and pa.input_value('#insb') == '15')
        pa.click('[data-a="send"]'); pa.wait_for_timeout(300)
        rec('Item 4: unchanged score refused', 'Same as the saved score' in pa.inner_text('#er'))
        pa.fill('#insb', '25'); pa.click('[data-a="send"]'); pa.wait_for_timeout(300)
        rec('Item 4: validated against game points', 'Max 21' in pa.inner_text('#er') or 'Only one side' in pa.inner_text('#er'), pa.inner_text('#er'))
        pa.fill('#insb', '18'); pa.click('[data-a="send"]'); pa.wait_for_timeout(1800)
        rec('Item 4: correction sent → locked "Correction sent · waiting for approval"', 'Correction sent · waiting for approval' in pa.inner_text('#v') and pa.locator('[data-a="fix"]').count() == 0)
        tA = pa.evaluate("JSON.parse(localStorage.getItem('rb.live')).t")
        rec('Item 4: one pending correction per game (API 409)', curl('POST', '/api/live/score', {'k': k_saif, 't': tA, 'sa': 21, 'sb': 10, 'c': 1})[0] == 409)
        rec('Item 4: normal Send score still blocked on a scored game (409)', curl('POST', '/api/live/score', {'k': k_saif, 't': tA, 'sa': 21, 'sb': 10})[0] == 409)
        # ---- tablet ----
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834})
        c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('seeded','1')}" % (json.dumps(json.dumps(S)), U))
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:', U)) else r.abort())
        tg = c.new_page(); te = []
        tg.on('pageerror', lambda e: te.append(str(e))); tg.on('console', lambda m: te.append(m.text) if m.type == 'error' and 'net::ERR' not in m.text and 'Failed to load' not in m.text else None)
        tg.on('dialog', lambda d: d.accept())
        tg.goto(APP); tg.wait_for_timeout(400); tg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); tg.wait_for_timeout(700)
        tg.evaluate("RB.act.lgother()"); tg.fill('#lgu', 'games'); tg.fill('#lgp', PW['games']); tg.click('[data-a="lgpw"]'); tg.wait_for_timeout(2500)
        for sel in ('[data-a="lgnoface"]', '[data-a="qpno"]'):
            if tg.locator(sel).count() and tg.is_visible(sel): tg.click(sel); tg.wait_for_timeout(400)
        tg.evaluate("RB.syncNow(true)"); tg.wait_for_timeout(2500); tg.evaluate("RB.act.tab('games')"); tg.wait_for_timeout(800)
        cols = tg.evaluate("getComputedStyle(document.querySelector('.cgrid')).gridTemplateColumns.split(' ').length")
        vh = tg.evaluate("[...document.querySelectorAll('.vcourt')].map(x=>Math.round(x.getBoundingClientRect().height))")
        rec('Item 1 (tablet): courts side by side, max 2 per row', cols == 2 and len(vh) == 2, '%d cols' % cols)
        rec('Item 1 (tablet): each court graphic capped under the screen height', all(h <= 834 - 280 for h in vh), str(vh))
        rec('Item 1 (tablet): vertical court – 4 player boxes + score on the net', tg.locator('.vcourt .vbox').count() == 8 and tg.locator('.vcourt .vmid .scg').count() == 4)
        tg.evaluate("window.scrollTo(0,document.querySelector('.cgrid').getBoundingClientRect().top+scrollY-70)"); tg.wait_for_timeout(200); shot(tg, 'v21_tablet_games.png')
        for _ in range(10):
            tg.evaluate("RB.subsPoll(true)"); tg.wait_for_timeout(700)
            if tg.locator('[data-a="subsopen"]').count(): break
        tg.click('[data-a="subsopen"]'); tg.wait_for_timeout(400)
        rt = tg.inner_text('.subl')
        rec('Item 4 (tablet): Scores to review shows "Correction", old → new, sender', 'CORRECTION' in rt and 'Saved 21 – 15' in rt and 'sent 21 – 18' in rt and 'Saif' in rt, rt.replace('\n', ' | ')[:200])
        shot(tg, 'v21_tablet_review.png')
        tg.click('[data-a="subacc"]'); tg.wait_for_timeout(1500)
        h0 = tg.evaluate("RB.S.games[Object.keys(RB.S.games).sort().pop()].hist.find(h=>h.ids[0]==='p11'&&h.ids[1]==='p25')")
        rec('Item 4 (tablet): Accept overwrites the result', h0['sa'] == 21 and h0['sb'] == 18, '%s-%s' % (h0['sa'], h0['sb']))
        rec('Item 4 (tablet): audit log old → new', 'correction accepted' in (tg.evaluate("(RB.S.audit[0]||{}).m") or '') and '21–15 → 21–18' in tg.evaluate("RB.S.audit[0].m"), tg.evaluate("RB.S.audit[0].m"))
        tg.evaluate("RB.syncNow(true)"); tg.wait_for_timeout(2500)
        pa.wait_for_timeout(11000)
        rec('Item 4: player sees "Correction accepted" + new score', 'Correction accepted' in pa.inner_text('#v') and '(18)' in pa.inner_text('#v'), '')
        # reject path
        tA = pa.evaluate("JSON.parse(localStorage.getItem('rb.live')).t")
        rec('Item 4: a new correction is allowed after review', curl('POST', '/api/live/score', {'k': k_saif, 't': tA, 'sa': 21, 'sb': 12, 'c': 1})[0] == 200)
        sid = [x for x in curl('GET', '/api/subs', tok=A)[1]['list'] if x['st'] == 'cp'][0]['id']
        tg.evaluate("RB.subsPoll(true)"); tg.wait_for_timeout(1200); tg.click('[data-a="subsopen"]'); tg.wait_for_timeout(500); tg.click('[data-a="subrej"][data-x="%d"]' % sid); tg.wait_for_timeout(1500)
        h0 = tg.evaluate("RB.S.games[Object.keys(RB.S.games).sort().pop()].hist.find(h=>h.ids[0]==='p11'&&h.ids[1]==='p25')")
        pa.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pa.wait_for_timeout(1500)
        rec('Item 4: Reject keeps the score; player sees "Correction rejected"', h0['sb'] == 18 and 'Correction rejected' in pa.inner_text('#v'))
        al = curl('GET', '/api/audit', tok=A)[1].get('list', [])
        rec('Item 4: Worker audit logs correction accept + reject', any('correction accepted' in a['m'] for a in al) and any('correction rejected' in a['m'] for a in al))
        # ---- item 5: Save – score from players ----
        tg.keyboard.press('Escape'); tg.evaluate("RB.act.closesubs&&RB.act.closesubs()"); tg.wait_for_timeout(300)
        rec('Item 5: running court shows "Save · score from players"', tg.locator('[data-a="savenos"]').count() == 2)
        tg.click('[data-a="savenos"][data-x="0"]'); tg.wait_for_timeout(800)
        h1 = tg.evaluate("RB.S.games[Object.keys(RB.S.games).sort().pop()].hist[0]")
        rec('Item 5: game saved as finished with no score (even though 9–7 was on the board)', h1['ids'] == ['p1', 'p4', 'p5', 'p15'] and h1['sa'] == 0 and h1['sb'] == 0 and h1.get('sp') == 1)
        bt = tg.inner_text('.spend.big') if tg.locator('.spend.big').count() else ''
        rec('Item 5: "Score pending" badge with count on Games', 'Score pending (2)' in bt, bt)
        gs = tg.evaluate("[...document.querySelectorAll('.spend')].filter(x=>x.textContent==='Score pending').length")
        rec('Item 5: Game Summary shows "Score pending" rows, no winner', gs == 2)
        wins = tg.evaluate("(()=>{const g=RB.S.games[Object.keys(RB.S.games).sort().pop()];return g.hist.filter(h=>!h.sa&&!h.sb).length})()")
        tg.evaluate("RB.syncNow(true)"); tg.wait_for_timeout(2500)
        c_, j_, _ = curl('POST', '/api/live/claim', {'k': key['Raj kumar']})
        r0 = [r for r in live(j_.get('t'))['results'] if r['a'] == ['Raj kumar', 'Sreeraj']]
        rec('Item 5: Send score appears straight away for its players on Live', r0 and r0[0]['send'] and r0[0]['me'] and not r0[0]['sc'])
        L = live(j_.get('t')); st_ = {s['name']: s for s in L['stats']}
        rec('Item 5: pending games give no wins (Live stats)', st_.get('Raj kumar', {}).get('w') == 0 and st_.get('Raj kumar', {}).get('g') == 1)
        rec('No page errors (phones)', not (eg or ea or eb), '; '.join((eg + ea + eb)[:3]))
        rec('No console errors (tablet)', not te, '; '.join(te[:3]))
        b.close()
finally:
    srv.terminate()
n = sum(ok for _, ok, _ in R); print('\n%d/%d passed' % (n, len(R)))
sys.exit(0 if n == len(R) else 1)
