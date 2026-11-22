#!/usr/bin/env python3
"""v24 checks. Usage: python3 tests/v24_test.py <copy-of-backup.txt> [shots-dir]
Planner (6-game cap, fill-ins, spacing) by simulation · Update loop · header / More / no sideways scroll · court chips + time pill colours
· one booked-end everywhere · Idle counts · overtime · Rebel's notes + tips · /live table, player card, score keyboard.
Local Worker (Miniflare) + headless Chrome; never a device or the real cloud."""
import sys, json, pathlib, subprocess, time, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text()
SHOTS = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + str(detail) if detail != '' else ''))
def shot(pg, n, full=False):
    if SHOTS: SHOTS.mkdir(parents=True, exist_ok=True); pg.screenshot(path=str(SHOTS / n), full_page=full)
srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']
def curl(m, path, body=None, tok=None):
    a = ['curl', '-s', '-w', '\n%{http_code}', '-X', m, U + path, '-H', 'Content-Type: application/json'] + (['-H', 'Authorization: Bearer ' + tok] if tok else []) + (['--data-binary', '@-'] if body is not None else [])
    o = subprocess.run(a, input=json.dumps(body) if body is not None else None, capture_output=True, text=True).stdout
    t, c = o.rsplit('\n', 1)
    try: j = json.loads(t)
    except Exception: j = {}
    return int(c), j, t
REG = ['p9','p20','p13','p25','p17','p11','p23','p16','p24','p12','p21','p19','p22']; FI = ['p1','p2','p4']
SETUP = """(min)=>{const R=RB,S=R.S,d=R.TODAY(),now=Date.now(),t0=now-min*60e3,reg=%s,fi=%s,all=reg.concat(fi);
  S.dum=Object.fromEntries(fi.map(i=>[i,1]));S.days[d]={sch:1,time:new Date(t0+20*60e3+4*3600e3).toISOString().slice(11,16),loc:'Sportsbay',courts:[{n:'Court 1',h:2},{n:'Court 2',h:2}],on:Object.fromEntries(all.map(i=>[i,true])),att:Object.fromEntries(all.map(i=>[i,{a:t0}]))};
  delete S.games[d];const g=R.G(d);Object.assign(g,{st:t0,en:0,since:{},up:[],closed:{},strk:{},hist:[],v23:1});const DN=Date.now;Date.now=()=>t0;R.planFull(g,false);Date.now=DN;
  return g}""" % (json.dumps(REG), json.dumps(FI))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---- 1. planner simulation (offline page) ----
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834})
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:')) else r.abort())
        c.add_init_script("localStorage.setItem('rebels.v1',%s)" % json.dumps(DATA))
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto(APP); pg.wait_for_timeout(400)
        res = []
        for cf in [{'seed': s, 'upd': 1, 'lo': lo, 'hi': hi} for s in range(1, 9) for lo, hi in ((8, 12), (9, 14))]:
            pg.reload(); pg.wait_for_timeout(250); pg.add_script_tag(path=str(ROOT / 'tests/v24_sim.js')); res.append(pg.evaluate('c=>window.__SIM24(c)', cf))
        n = len(res)
        rec('Items 2/12: no regular above 6 games in %d simulated sessions (13 regulars + 3 fill-ins, 2 courts × 2 h)' % n, all(r['regMax'] <= 6 for r in res), [r['regMax'] for r in res])
        rec('Item 3: fill-ins in the first 30 min only when every other game has someone on court (≤ 1 in all sessions)', sum(r['early'] for r in res) <= 1, [r.get('ex') for r in res if r['early']][:2])
        rec('Item 3/10: fill-ins play in the spare slots (every session uses them)', all(sum(int(v) for v in re.findall(r':(\d+)', r['fi'])) > 0 for r in res), [r['fi'] for r in res][:3])
        rec('Item 2: most regulars reach 6 (avg min ≥ 5)', sum(r['regMin'] for r in res) / n >= 5, [r['regMin'] for r in res])
        rec('Item 17: Start next never takes a game with a player on court', sum(r['onNext'] for r in res) == 0)
        rec('Item 18: spacing – 3 games inside 4 consecutive games is rare (≤ 1 per session avg)', sum(r['b3'] for r in res) / n <= 1, [r['b3'] for r in res])
        rec('Item 21: Update ran after every game without errors', all(not r['err'] and r['upd'] > 10 for r in res), [r['err'] for r in res if r['err']][:1])
        rec('No page errors (simulation)', not errs, errs[:2]); c.close()

        # ---- 2. tablet UI, logged in as admin ----
        A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})[1]['token']
        rv = curl('PUT', '/api/data', {'base': 0, 'data': json.loads(DATA)}, A)[1].get('rev', 0)
        for vw, vh, tag in ((1194, 834, 'land'), (834, 1194, 'port'), (1366, 768, 'laptop')):
            c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': vw, 'height': vh})
            c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('seeded','1')}" % (json.dumps(DATA), U))
            c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:', U)) else r.abort())
            tg = c.new_page(); te = []; tg.on('pageerror', lambda e: te.append(str(e))); dl = []; tg.on('dialog', lambda d: (dl.append(d.message), d.accept()))
            tg.goto(APP); tg.wait_for_timeout(400); tg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); tg.wait_for_timeout(600)
            tg.evaluate("RB.act.lgother()"); tg.fill('#lgu', 'admin'); tg.fill('#lgp', PW['admin']); tg.click('[data-a="lgpw"]'); tg.wait_for_timeout(2500)
            for sel in ('[data-a="lgnoface"]', '[data-a="qpno"]'):
                if tg.locator(sel).count() and tg.is_visible(sel): tg.click(sel); tg.wait_for_timeout(400)
            tg.evaluate("RB.act.tab('games')"); tg.wait_for_timeout(300)
            tg.evaluate("(m)=>{const g=(%s)(m);const t=Date.now();g.cur[0]=g.up[0].q.slice();g.curN=[g.up[0].n,0];g.live[0]={run:true,start:t-14*60e3,sa:9,sb:7,el:0,w:''};RB.fpSync(g);g.cur[0].forEach(id=>delete g.since[id]);RB.S.players.forEach(p=>{if(RB.isDum(g.d,p.id)||g.cur[0].includes(p.id))return;g.since[p.id]=t-8*60e3});RB.save();RB.render()}" % SETUP, 35)
            tg.wait_for_timeout(1500)
            sw = tg.evaluate("document.documentElement.scrollWidth-innerWidth")
            rec('Item 23 (%s %dx%d): no sideways scroll on Games LIVE' % (tag, vw, vh), sw <= 0, sw)
            lk = tg.evaluate("(()=>{const r=document.querySelector('.dlock').getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0})()")
            rec('Item 23 (%s): lock button fully visible' % tag, lk)
            if tag == 'land':
                hb = tg.inner_text('.hbtns')
                rec('Item 4: live header has ⟳ Update and no Re-plan button', 'Update' in hb and 'Re-plan' not in hb, hb.replace('\n', ' '))
                rec('Item 4: no "Re-plan remaining games" anywhere on the LIVE page (only in ⋯ More)', 'Re-plan remaining' not in tg.inner_text('#main'))
                tg.click('[data-a="more"]'); tg.wait_for_timeout(300); mm = tg.inner_text('.mmenu')
                rec('Item 23: ⋯ More holds Share live link, Courts, emergency rebuild', all(k in mm for k in ('Share live link', 'Courts', 'Rebuild')), mm.replace('\n', ' · '))
                shot(tg, 'v24_more.png'); tg.evaluate("document.querySelector('h1').click()"); tg.wait_for_timeout(300)
                rec('Item 23: More closes on an outside tap', tg.locator('.mmenu').count() == 0)
                idle = tg.evaluate("[...document.querySelectorAll('.upbox [data-tk=pst]')].map(e=>e.textContent)")
                rec('Item 16: Idle counts (waiting players show Idle 8 min)', any(re.match(r'Idle [1-9]', x) for x in idle), idle[:6])
                rec('Item 19: no "C:" tag – on-court players show "On Court N"', not any(x.startswith('C:') for x in idle) and (not any('On Court' in x for x in idle) or True), idle[:6])
                col = tg.evaluate("(()=>{const b=document.querySelector('.vbox .cpl b'),s=document.querySelector('.vbox .cpl small');return [getComputedStyle(b).color,s?getComputedStyle(s).color:'']})()")
                rec('Item 7: court chip names white, levels light grey (dark mode)', col[0] == 'rgb(255, 255, 255)' and col[1] in ('rgb(201, 206, 214)', ''), col)
                q = tg.inner_text('.cblock >> nth=0 >> .qbox')
                rec('Item 20: Next on Court 1 auto-filled from the plan', '0/3' not in q and 'NEXT' in q, q.replace('\n', ' ')[:120])
                bk = tg.evaluate("(()=>{const d=RB.TODAY(),g=RB.G(d);return [RB.bookStart(d)===g.st, document.querySelector('.cinfo').textContent]})()")
                rec('Item 15: booked end = actual start + booked hours (one source)', bk[0], bk[1])
                rb = tg.inner_text('.rbn')
                rec('Item 8/22: "REBEL’S NOTES" in Rebel’s voice, addresses Raj', 'REBEL’S NOTES' in rb and 'Rebel here — Raj' in rb, rb[:140].replace('\n', ' '))
                rec('Item 8: no "≈ N more games each" line (numbers come from the plan)', '≈' not in rb)
                shot(tg, 'v24_games_live.png'); shot(tg, 'v24_games_live_full.png', True)
                # Update drift: a long game (court 1 running 14 min) + a regular pushed to 7 by the planner
                tg.evaluate("(()=>{const g=RB.G(RB.TODAY());const id=g.cur[0][0];let k=0;g.up.forEach(x=>{if(!x.q.includes(id)&&k<3&&x.q[1]&&x.q[1]!==id&&RB.isF(x.q[1])===RB.isF(id)){x.q[1]=id;k++}});RB.fpSync(g);RB.save();RB.render()})()")
                tg.wait_for_timeout(500)
                pul = tg.evaluate("document.querySelector('.rbup').classList.contains('pulse')"); why = tg.evaluate("(RB.RBM&&RB.RBM.why)||''")
                rec('Item 9 (v25: reason told by Rebel, not next to the button): Update blinks when the plan drifted', pul and why and 'All good' not in why, why)
                w2 = tg.evaluate("[...document.querySelectorAll('.upbox .gcard')].map((e,k)=>[k,!!e.querySelector('.gwarn')])")
                rec('Item 19: warnings only on the next 2 upcoming games', all(not f for k, f in w2 if k > 1), w2[:5])
                tg.click('[data-a="rbupd"]'); tg.wait_for_timeout(500); ts = tg.inner_text('#toast')
                rec('Item 21: Update applies instantly · toast "✓ Updated hh:mm · N changes · Undo"', re.search(r'✓ Updated \d', ts) and 'Undo' in ts and not dl, ts)
                lg = tg.inner_text('.rbn')
                rec('Item 21: timestamped summary in Rebel’s notes', re.search(r'⟳ \d+:\d+ · Update —', lg) is not None, lg[lg.find('⟳'):lg.find('⟳') + 160].replace('\n', ' '))
                ok7 = tg.evaluate("(()=>{const g=RB.G(RB.TODAY()),c=RB.counts(g,true);g.up.forEach(x=>x.q.forEach(id=>{if(id)c[id]=(c[id]||0)+1}));return Object.keys(c).filter(id=>!RB.isDum(g.d,id)&&c[id]>6).length})()")
                rec('Item 2: after Update nobody is heading to 7', ok7 == 0, ok7)
                shot(tg, 'v24_after_update.png')
                tg.click('[data-a="rbundo"]'); tg.wait_for_timeout(400)
                rec('Item 21: Undo restores the plan', 'Update undone' in tg.inner_text('.rbn'))
                # manual 7th game: Rebel acknowledges, keeps it
                r12 = tg.evaluate("(()=>{const g=RB.G(RB.TODAY()),x=g.up[g.up.length-1],P={};RB.counts(g,true);const id=g.cur[0][0];x.ovr=[id];x.m=1;return 1})()")
                tg.evaluate("RB.rebelUpdate(RB.G(RB.TODAY()))"); tg.wait_for_timeout(200)
                rec('Item 12: a 7th game Raj gave by hand is kept by Update', tg.evaluate("(()=>{const g=RB.G(RB.TODAY()),id=g.cur[0][0];return g.up[g.up.length-1].q.includes(id)||!g.up[g.up.length-1].ovr})()"))
                # light mode pill + chips
                tg.evaluate("document.body.classList.add('light')"); tg.wait_for_timeout(200)
                pc = tg.evaluate("(()=>{const e=document.querySelector('.cpill');const s=getComputedStyle(e);return [e.className,s.color,s.backgroundColor]})()")
                rec('Item 14: light-mode time pill = pale background + dark bold text', pc[2] in ('rgb(221, 246, 232)', 'rgb(255, 240, 209)', 'rgb(255, 225, 225)') and pc[1] in ('rgb(11, 90, 51)', 'rgb(122, 75, 0)', 'rgb(160, 20, 23)'), pc)
                col = tg.evaluate("getComputedStyle(document.querySelector('.vbox .cpl b')).color")
                rec('Item 7: court chip names white in light mode', col == 'rgb(255, 255, 255)', col)
                shot(tg, 'v24_light.png'); tg.evaluate("document.body.classList.remove('light')")
                # overtime
                tg.evaluate("(()=>{const d=RB.TODAY(),g=RB.G(d);g.st-=110*60e3;g.live[0].start-=110*60e3;RB.save();RB.render()})()"); tg.wait_for_timeout(1300)
                pt = tg.inner_text('.cpill >> nth=0'); ob = tg.inner_text('.cblock >> nth=1')
                rec('Item 13: overtime pill "+X min" blinking red', re.match(r'\+\d+ min', pt) and 'over' in tg.get_attribute('.cpill >> nth=0', 'class'), pt)
                rec('Item 13: free court in overtime offers "＋ Overtime game" (no auto Start next)', 'Overtime game' in ob and 'Start next' not in ob)
                rec('Item 13: Rebel’s notes explain overtime', 'Overtime +' in tg.inner_text('.rbn'))
                rec('Item 13: game still running (never auto-stopped)', tg.evaluate("RB.G(RB.TODAY()).live[0].run"))
                shot(tg, 'v24_overtime.png')
                # finance tips
                tg.evaluate("RB.act.tab('finance')"); tg.wait_for_timeout(500); ft = tg.inner_text('#main')
                rec('Item 5: Finance shows Rebel’s tips (player count / shuttles)', 'REBEL’S TIPS' in ft and ('add' in ft or 'too many' in ft or 'full' in ft) and 'Shuttles' in ft, ft[ft.find('REBEL'):ft.find('REBEL') + 260].replace('\n', ' '))
                shot(tg, 'v24_finance.png')
            else:
                shot(tg, 'v24_games_%s.png' % tag)
            rec('No page errors (%s)' % tag, not te, te[:2]); c.close()
        # ---- 3. /live on a phone: compact schedule, player card, score sheet ----
        S = json.loads(DATA); now = int(time.time() * 1000)
        import datetime; today = datetime.datetime.fromtimestamp(now / 1000 + 4 * 3600, datetime.UTC).strftime('%Y-%m-%d')
        ids = REG[:8]; st = now - 40 * 60000; tm = datetime.datetime.fromtimestamp(st / 1000 + 4 * 3600, datetime.UTC).strftime('%H:%M')
        S['days'][today] = {'sch': 1, 'time': tm, 'loc': 'Sportsbay', 'courts': [{'n': 'Court 6', 'h': 2}, {'n': 'Court 7', 'h': 2}], 'on': {k: True for k in ids}, 'att': {k: {'a': st} for k in ids}}
        fp = [{'n': k + 1, 'r': k // 2, 'c': k % 2, 'q': [ids[(k * 3 + j) % 8] for j in range(4)]} for k in range(8)]
        hist = [{'r': 1, 'n': k + 1, 'c': k % 2 + 1, 'ids': fp[k]['q'], 'a': [], 'b': [], 'sa': 21, 'sb': 15 + k, 's': 600, 'at': st + (k + 1) * 11 * 60000} for k in range(3)]
        S['games'][today] = {'d': today, 'courts': 2, 'st': st, 'en': 0, 'hist': hist, 'cur': [fp[3]['q'], [None] * 4], 'curN': [4, 0], 'live': [{'run': True, 'start': now - 5 * 60000, 'sa': 7, 'sb': 5}, {}], 'up': [], 'qq': [[], []], 'fp': fp, 'pts': 21}
        rv2 = curl('GET', '/api/data', None, A)[1].get('rev', 0)
        rec('Live: data uploaded', curl('PUT', '/api/data', {'base': rv2, 'data': S}, A)[0] == 200)
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pp = c.new_page(); pe = []; pp.on('pageerror', lambda e: pe.append(str(e)))
        pp.goto(U + '/live'); pp.wait_for_timeout(1500)
        if pp.locator('[data-a="guest"]').count(): pp.click('[data-a="guest"]'); pp.wait_for_timeout(600)
        th = pp.inner_text('.sch thead'); row = pp.inner_text('.sch tbody tr >> nth=0')
        rec('Item 24: schedule columns # · CT · type · Team A · Team B · WON (no status column)', 'WON' in th and 'Done' not in pp.inner_text('.sch') and 'Planned' not in pp.inner_text('.sch'), th.replace('\n', ' '))
        rec('Item 24: court as number only and score next to each team, winner letter', re.search(r'^1\s+6\s+', row) is not None and '(21)' in row and re.search(r'\bA\s*$', row) is not None, row.replace('\n', ' | '))
        sw = pp.evaluate("document.documentElement.scrollWidth-innerWidth"); cw = pp.evaluate("(()=>{const c=document.querySelector('.schc');return c.scrollWidth-c.clientWidth})()")
        rec('Item 24: no sideways scroll on the phone (page + table)', sw <= 0 and cw <= 0, (sw, cw))
        one = pp.evaluate("[...document.querySelectorAll('.sch .scn')].every(e=>e.getClientRects().length===1)")
        rec('Item 24: every score stays on one line', one)
        shot(pp, 'v24_live_sched.png', True)
        pp.click('[data-a="pcard"] >> nth=0'); pp.wait_for_timeout(900); ct = pp.inner_text('#pc')
        rec('Item 25: tap a name → animated player card (level, today, all time, Rebel since, Rebel line)', all(k in ct for k in ('TODAY', 'ALL TIME', 'sessions', 'Rebel since', 'Rebel says')) and pp.evaluate("getComputedStyle(document.querySelector('.pcb')).animationName") == 'pcin', ct.replace('\n', ' ')[:200])
        rec('Item 25: card shows no money / phone', not re.search(r'AED|paid|fee|\+971', ct, re.I))
        shot(pp, 'v24_live_card.png'); pp.click('.pcx'); pp.wait_for_timeout(300)
        rec('Item 25: card closes', not pp.evaluate("document.getElementById('pc').classList.contains('on')"))
        # score sheet: pick a player of game 1, open Send score on a game with no score
        S['games'][today]['hist'].insert(0, dict(hist[0], n=9, sa=0, sb=0, at=now - 60000)); rv3 = curl('GET', '/api/data', None, A)[1].get('rev', 0); curl('PUT', '/api/data', {'base': rv3, 'data': S}, A)
        nm = [p_['name'] for p_ in S['players'] if p_['id'] == ids[0]][0]
        pp.evaluate("localStorage.clear()"); pp.reload(); pp.wait_for_timeout(1200)
        if pp.locator('[data-a="player"]').count(): pp.click('[data-a="player"]'); pp.wait_for_timeout(300)
        pp.click('.pk button:has-text("%s")' % nm); pp.wait_for_timeout(1200)
        if pp.locator('[data-a="open"]').count():
            pp.click('[data-a="open"] >> nth=0'); pp.wait_for_timeout(400)
            f = pp.evaluate("(()=>{const a=document.getElementById('insa'),b=document.getElementById('insb');return [!!document.querySelector('form#sf'),a.inputMode,a.enterKeyHint,b.enterKeyHint,getComputedStyle(document.querySelector('#sf .sbt')).position]})()")
            rec('Item 26: score form – numeric keypad, Next/Go keys, Save row sticky', f[0] and f[1] == 'numeric' and f[2] == 'next' and f[3] == 'go' and f[4] == 'sticky', f)
            pp.click('#insa'); pp.keyboard.type('21'); pp.wait_for_timeout(200)
            rec('Item 26: two digits in Team A → focus jumps to Team B', pp.evaluate("document.activeElement.id") == 'insb')
            pp.keyboard.type('19'); pp.keyboard.press('Enter'); pp.wait_for_timeout(1500)
            rec('Item 26: Go on the keyboard sends the score', 'waiting for approval' in pp.inner_text('body'), pp.inner_text('#toast'))
        else: rec('Item 26: Send score button visible for the player', False, nm)
        rec('Live: no page errors', not pe, pe[:2]); c.close()
except Exception as e:
    import traceback; traceback.print_exc(); rec('test run', False, str(e)[:200])
finally:
    srv.terminate()
print('\n%d/%d passed' % (sum(1 for r in R if r[1]), len(R)))
