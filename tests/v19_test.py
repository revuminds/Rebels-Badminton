#!/usr/bin/env python3
"""v19 checks (no screenshots). Usage: python3 tests/v19_test.py <copy-of-backup.txt>
Live page Guest / Player (items 1-5), tablet "Live page names" with ✕ (item 6), security. Local Worker (Miniflare) + headless Chrome.
Never touches a device or the real cloud."""
import sys, json, pathlib, subprocess, datetime, re, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text()
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + detail if detail else ''))

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
    S = json.loads(DATA); S['players'][20]['hidePub'] = 1          # Ricky (p21) hidden → Guest, cannot be picked
    src = S['days']['2026-11-22']; on = [k for k, v in src['on'].items() if v]
    S['days'][today] = {'sch': 1, 'time': (dub - datetime.timedelta(minutes=40)).strftime('%H:%M'), 'loc': 'Sportsbay', 'courts': [{'n': 'Court 6', 'h': 2}, {'n': 'Court 7', 'h': 2}], 'on': src['on'], 'att': {k: {'a': int(st)} for k in on}}
    hist = [{'r': 1, 'c': 1, 'ids': ['p11', 'p9', 'p23', 'p22'], 'sa': 0, 'sb': 0, 's': 600, 'at': int(st + 12 * 60e3)},      # Saif's game, no score
            {'r': 1, 'c': 2, 'ids': ['p2', 'p18', 'p24', 'p10'], 'sa': 0, 'sb': 0, 's': 640, 'at': int(st + 13 * 60e3)},     # Annie's game, no score
            {'r': 2, 'c': 1, 'ids': ['p25', 'p12', 'p20', 'p21'], 'sa': 21, 'sb': 15, 's': 690, 'at': int(st + 25 * 60e3)},  # scored
            {'r': 2, 'c': 2, 'ids': ['p11', 'p2', 'p19', 'p15'], 'sa': 0, 'sb': 0, 's': 700, 'at': int(st + 26 * 60e3)}]     # Saif + Annie, no score
    for h in hist: h['a'] = h['ids'][:2]; h['b'] = h['ids'][2:]
    G = {'d': today, 'courts': 2, 'round': 2, 'st': int(st), 'en': 0, 'pts': 21, 'deuce': False, 'slot': 15, 'chg': 1,
         'cur': [['p1', 'p20', 'p12', 'p25'], [None] * 4], 'live': [{'run': True, 'start': now - 5 * 60e3, 'sa': 9, 'sb': 7, 'el': 0, 'w': ''}, {'run': False, 'start': 0, 'sa': 0, 'sb': 0, 'el': 0, 'w': ''}],
         'nxt': [[None] * 4] * 2, 'qq': [[], []], 'up': [], 'hist': hist, 'since': {}, 'btot': {}, 'ros': on, 'last': [None, None], 'plan': [], 'log': [], 'strk': {}, 'pre': [], 'auto': [], 'closed': {}, 'nman': [], 'man': 0, 'curN': [0, 0]}
    S['games'][today] = G
    A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})[1]['token']
    rev = [0]
    def put(SS):
        c, j, t = curl('PUT', '/api/data', {'base': rev[0], 'data': SS}, A); rev[0] = j.get('rev', rev[0]); return c
    rec('Test session uploaded to the local Worker (today %s)' % today, put(S) == 200)
    L = live()
    names = [x['name'] for x in L['pick']]
    exp = sorted({p['name'] for p in S['players'] if p['id'] in set(on) | {'p1'} and not p.get('hidePub')})
    rec('Item 1: pick list = players on / checked in / playing today (A–Z)', names == sorted(names) and set(names) == set(exp), '%d names' % len(names))
    rec('Security: hidden player shown as Guest and not in the pick list', 'Ricky' not in json.dumps(L) and 'Guest' in json.dumps(L))
    rec('Security: pick keys are hashes, no player ids / phones / finance in /api/live', not re.search(r'"p\d+"', json.dumps(L)) and '+971' not in json.dumps(L) and 'fin' not in L and all(re.fullmatch(r'[0-9a-f]{16}', x['k']) for x in L['pick']))
    key = {x['name']: x['k'] for x in L['pick']}

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        def phone():
            c = b.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Asia/Dubai', is_mobile=True, has_touch=True)
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(U + '/live'); pg.wait_for_timeout(1500); return c, pg, errs
        sends = lambda pg: pg.locator('[data-a="open"]').count()
        # ---- 1. Guest ----
        cg, pg, eg = phone()
        rec('Item 1: first visit asks Guest or Player', pg.locator('.gp [data-a="guest"]').count() == 1 and pg.locator('.gp [data-a="player"]').count() == 1)
        pg.click('.gp [data-a="guest"]'); pg.wait_for_timeout(1000)
        hs = pg.eval_on_selector_all('h2', 'e=>e.map(x=>x.textContent)')
        rec('Guest: view only – on court, results, games & wins shown, no Send score', 'ON COURT NOW' in hs and 'RESULTS · NEWEST FIRST' in hs and 'TODAY · GAMES & WINS' in hs and sends(pg) == 0 and not pg.is_visible('#m .sh'), str(hs))
        rec('Guest: top line "Watching as guest"', 'Watching as guest' in pg.inner_text('#me'))
        pg.reload(); pg.wait_for_timeout(1500)
        rec('Guest: remembered on reload (not asked again)', not pg.is_visible('#m .sh') and 'Watching as guest' in pg.inner_text('#me'))
        # ---- 2/3. Player A = Saif ----
        ca, pa, ea = phone()
        pa.click('.gp [data-a="player"]'); pa.wait_for_timeout(200)
        pk = pa.eval_on_selector_all('.pk button', 'e=>e.map(x=>x.textContent)')
        rec('Player: shows the checked-in / on names to tap', pk == names, '%d buttons' % len(pk))
        pa.click('.pk button:has-text("Saif")'); pa.wait_for_timeout(1500)
        rec('Item 4: top line "Playing as Saif · Change to guest"', 'Playing as Saif' in pa.inner_text('#me') and pa.locator('#me [data-a="toguest"]').count() == 1, pa.inner_text('#me'))
        rec('Item 3: Send score only on finished unscored games Saif played in (2 of 3)', sends(pa) == 2, str(sends(pa)))
        pa.reload(); pa.wait_for_timeout(1500)
        rec('Item 2: phone remembers the name on reload (no picking again)', not pa.is_visible('#m .sh') and 'Playing as Saif' in pa.inner_text('#me') and sends(pa) == 2)
        # phone B sees Saif greyed out
        cb, pb, eb = phone()
        pb.click('.gp [data-a="player"]'); pb.wait_for_timeout(200)
        rec('Item 2: picked name greyed out (disabled) for everyone else', pb.is_disabled('.pk button:has-text("Saif")') and not pb.is_disabled('.pk button:has-text("Annie")'))
        c409 = curl('POST', '/api/live/claim', {'k': key['Saif']})
        rec('Item 2: API refuses the same name twice (409)', c409[0] == 409, c409[2])
        pb.click('.pk button:has-text("Annie")'); pb.wait_for_timeout(1500)
        rec('Phone B plays as Annie: Send score on her 2 unscored games', 'Playing as Annie' in pb.inner_text('#me') and sends(pb) == 2)
        # send from A without choosing who
        k_saif = live()['results']
        k1 = [r['k'] for r in k_saif if r['court'] == 'Court 6' and not r['sc']][0]       # Saif's first game (Court 6, r1)
        pa.click('[data-a="open"][data-k="%s"]' % k1); pa.wait_for_timeout(200)
        rec('Item 3: send sheet has no who-picker, says "Sending as Saif"', pa.locator('.who').count() == 0 and 'Sending as Saif' in pa.inner_text('#sas'))
        pa.fill('#insa', '21'); pa.fill('#insb', '25'); pa.click('[data-a="send"]'); pa.wait_for_timeout(300)
        rec('Validation vs points still on (21–25 refused)', 'Max 21' in pa.inner_text('#er'), pa.inner_text('#er'))
        pa.fill('#insb', '16'); pa.click('[data-a="send"]'); pa.wait_for_timeout(1500)
        rec('Score sent → locked "waiting for approval"', pa.locator('.pill:has-text("Score sent · waiting for approval")').count() == 1 and pa.locator('[data-a="open"][data-k="%s"]' % k1).count() == 0)
        GM = curl('POST', '/api/login', {'u': 'games', 'p': PW['games']})[1]['token']
        subs = curl('GET', '/api/subs', tok=GM)[1].get('list', [])
        rec('Sender stored = picked name (Saif), who = his place in the game', len(subs) == 1 and subs[0]['byn'] == 'Saif' and subs[0]['who'] == 0, str(subs))
        tA = pa.evaluate("JSON.parse(localStorage.getItem('rb.live')).t"); tB = pb.evaluate("JSON.parse(localStorage.getItem('rb.live')).t")
        k2 = [r['k'] for r in live()['results'] if r['court'] == 'Court 7' and r['a'][0] == 'Annie'][0]   # Annie's game, Saif not in it
        rec('API: score without a picked name → 401', curl('POST', '/api/live/score', {'k': k2, 'sa': 21, 'sb': 10})[0] == 401 and curl('POST', '/api/live/score', {'k': k2, 't': 'bogus', 'sa': 21, 'sb': 10})[0] == 401)
        rec('API: player not in that game → 403 (Saif on Annie\'s game)', curl('POST', '/api/live/score', {'k': k2, 't': tA, 'sa': 21, 'sb': 10})[0] == 403)
        rec('API: one score per game still (409 on the sent game)', curl('POST', '/api/live/score', {'k': k1, 't': tA, 'sa': 21, 'sb': 10})[0] == 409)
        rec('API: /api/live with a claim marks only that player\'s games (me)', [r['me'] for r in live(tA)['results']] == [r['ids'].count('p11') > 0 for r in sorted(hist, key=lambda h: -h['at'])])
        # ---- 4. Change to guest frees the name ----
        pa.click('#me [data-a="toguest"]'); pa.wait_for_timeout(1500)
        rec('Item 4: Change to guest → guest, no Send buttons', 'Watching as guest' in pa.inner_text('#me') and sends(pa) == 0)
        rec('Item 4: switching to guest frees the name (old token dead, name pickable)', not [x for x in live()['pick'] if x['name'] == 'Saif'][0]['taken'] and curl('POST', '/api/live/score', {'k': k1, 't': tA, 'sa': 21, 'sb': 10})[0] in (401, 409) and live(tA).get('claimGone'))
        pa.click('#me [data-a="choose"]'); pa.wait_for_timeout(200); pa.click('.pk button:has-text("Saif")'); pa.wait_for_timeout(1500)
        rec('Guest can pick a name again later ("I\'m playing")', 'Playing as Saif' in pa.inner_text('#me'))
        tA = pa.evaluate("JSON.parse(localStorage.getItem('rb.live')).t")

        # ---- 6. Tablet: Live page names + ✕ ----
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834})
        c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('seeded','1')}" % (json.dumps(DATA), U))
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:', U)) else r.abort())
        tg = c.new_page(); te = []
        tg.on('pageerror', lambda e: te.append(str(e))); tg.on('console', lambda m: te.append(m.text) if m.type == 'error' and 'net::ERR' not in m.text and 'Failed to load' not in m.text else None)
        tg.on('dialog', lambda d: d.accept())
        tg.goto(APP); tg.wait_for_timeout(400); tg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); tg.wait_for_timeout(700)
        tg.evaluate("RB.act.lgother()"); tg.fill('#lgu', 'games'); tg.fill('#lgp', PW['games']); tg.click('[data-a="lgpw"]'); tg.wait_for_timeout(2500)
        if tg.is_visible('[data-a="lgnoface"]'): tg.click('[data-a="lgnoface"]')
        tg.evaluate("RB.syncNow(true)"); tg.wait_for_timeout(2500); tg.evaluate("RB.act.tab('games')")
        for _ in range(10):
            tg.evaluate("RB.subsPoll(true)"); tg.wait_for_timeout(700)
            if tg.locator('[data-a="lclopen"]').count(): break
        btn = tg.locator('[data-a="lclopen"]')
        rec('Item 6: Games tab shows "Live page names (2)" (game manager)', btn.count() == 1 and 'Live page names (2)' in btn.inner_text(), btn.inner_text() if btn.count() else 'missing')
        btn.click(); tg.wait_for_timeout(300)
        rows = tg.eval_on_selector_all('.lclr', 'e=>e.map(x=>x.textContent)')
        rec('Item 6: list shows the picked names with ✕', len(rows) == 2 and 'Annie' in rows[0] and 'Saif' in rows[1] and tg.locator('[data-a="lclfree"]').count() == 2, str(rows))
        tg.click('[data-a="lclfree"][data-x="p2"]'); tg.wait_for_timeout(1200)
        rec('Item 6: ✕ frees the name (list + server)', tg.locator('.lclr').count() == 1 and not [x for x in live()['pick'] if x['name'] == 'Annie'][0]['taken'])
        rec('Item 6: freeing logged to the app audit log', 'Live page name freed: Annie' in (tg.evaluate("(RB.S.audit[0]||{}).m") or ''))
        al = curl('GET', '/api/audit', tok=A)[1].get('list', [])
        rec('Item 6: freeing logged to the Worker audit log (by games)', any(a['m'] == 'Live page name freed: Annie' and a['who'] == 'games' for a in al))
        pb.wait_for_timeout(11000)
        rec('Freed phone is told and asked to pick again', pb.is_visible('#m .sh') and 'Playing as' not in pb.inner_text('#me') and sends(pb) == 0)
        O = curl('POST', '/api/login', {'u': 'organizer', 'p': PW['organizer']})[1]['token']
        rec('Security: names list – no login 401, organizer 403 (list + free)', curl('GET', '/api/claims')[0] == 401 and curl('GET', '/api/claims', tok=O)[0] == 403 and curl('DELETE', '/api/claims/p11', tok=O)[0] == 403)
        rec('No console errors (tablet)', not te, '; '.join(te[:3]))
        tg.close(); c.close()

        # ---- 5. End session resets every name ----
        rec('Before End session: Saif still picked', [x for x in live()['pick'] if x['name'] == 'Saif'][0]['taken'])
        S['games'][today]['en'] = now; rev[0] = curl('GET', '/api/data', tok=A)[1]['rev']; put(S)
        rec('End session → live page off', live()['live'] is False)
        S['games'][today]['en'] = 0; put(S)                       # (test only: reopen to look at the names)
        L5 = live(tA)
        rec('Item 5: End session reset all picked names', L5['live'] and not any(x['taken'] for x in L5['pick']) and L5.get('claimGone'), str([x['name'] for x in L5['pick'] if x['taken']]))
        pa.reload(); pa.wait_for_timeout(1500)
        rec('Item 5: phone asks Guest / Player again after the reset', pa.is_visible('.gp'))
        pa.click('.gp [data-a="player"]'); pa.wait_for_timeout(200); pa.click('.pk button:has-text("Saif")'); pa.wait_for_timeout(1200)
        tA = pa.evaluate("JSON.parse(localStorage.getItem('rb.live')).t")
        S['days'][today]['time'] = (dub - datetime.timedelta(hours=4)).strftime('%H:%M'); S['games'][today]['st'] = int(now - 4 * 3600e3); put(S)   # booked 2 h, + 1 h grace → over
        rec('Live window over → off', live()['live'] is False)
        S['days'][today]['time'] = (dub - datetime.timedelta(minutes=40)).strftime('%H:%M'); S['games'][today]['st'] = int(st); put(S)
        L6 = live(tA)
        rec('Item 5: names reset automatically when the live window ends', L6['live'] and not any(x['taken'] for x in L6['pick']) and L6.get('claimGone'))
        rec('No page errors on the live pages', not (eg or ea or eb), '; '.join((eg + ea + eb)[:3]))
        # claim cap per phone/day
        cs = []
        for n in [x for x in names if x != 'Saif'] * 2:
            c_, j_, _t = curl('POST', '/api/live/claim', {'k': key[n]}); cs.append(c_)
            if j_.get('t'): curl('POST', '/api/live/release', {'t': j_['t']})
            if c_ == 429: break
        rec('Security: name picks capped per phone per day (429)', 429 in cs, str(cs[-4:]))
        rec('Security: unknown / hidden player key → 404', curl('POST', '/api/live/claim', {'k': '0123456789abcdef'})[0] in (404, 429))
        b.close()
finally:
    srv.terminate()
n = sum(ok for _, ok, _ in R); print('\n%d passed, %d failed' % (n, len(R) - n))
sys.exit(0 if n == len(R) else 1)
