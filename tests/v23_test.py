#!/usr/bin/env python3
"""v23 checks. Usage: python3 tests/v23_test.py <copy-of-backup.txt> [shots-dir]
1 planner round model (stress simulation + tonight's regression) · 2 court queues inside Upcoming · 3 share popup (2 QR codes)
4 /live read-only for 48 h after End session · 5 plan header per session. Local Worker (Miniflare) + headless Chrome; never a device or the real cloud.
Needs ≥ 13 players with gender in the backup (ids p3–p8 are used as Raghu, Kia, Rohit, Lee, Hasir, Ramsesh – any names work)."""
import sys, json, pathlib, subprocess, datetime, time, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text()
SHOTS = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + str(detail) if detail != '' else ''))
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
live = lambda: curl('GET', '/api/live')[1]
REG = """(()=>{const R=RB,S=R.S,d='2026-12-06',t0=Date.parse(d+'T20:00:00+04:00'),now=t0+40*60e3;const DN=Date.now;Date.now=()=>now;
  const ids=S.players.filter(p=>p.sx).slice(0,13).map(p=>p.id),[Raghu,Kia,Rohit,Lee]=['p3','p4','p5','p6'];S.games={};S.dum={};
  S.days={};S.days[d]={sch:1,time:'20:00',loc:'Test',courts:[{n:'Court 1',h:2},{n:'Court 2',h:2}],on:Object.fromEntries(ids.map(i=>[i,true])),att:Object.fromEntries(ids.map(i=>[i,{a:t0}]))};
  const g=R.G(d);Object.assign(g,{st:t0,en:0,since:{},up:[],closed:{},strk:{},hist:[],v23:1});R.planFull(g,false);
  /* first 4 rounds played as planned, then tonight's state: Court 1 busy with Raghu/Kia/Rohit/Lee, Court 2 free */
  g.fp.filter(x=>x.r<2).forEach((x,k)=>g.hist.unshift({r:k+1,n:x.n,c:x.c+1,ids:x.q.slice(),a:[],b:[],sa:21,sb:15,s:600,at:t0+(x.r+1)*10*60e3}));
  g.cur[0]=[Raghu,Kia,Rohit,Lee];g.curN=[0,0];g.live[0]={run:true,start:now-4*60e3,sa:5,sb:3,el:0,w:''};g.strk={[Raghu]:1,[Kia]:1,[Rohit]:1,[Lee]:1};
  ids.forEach(id=>{if(!g.cur[0].includes(id))g.since[id]=now-6*60e3});
  /* the bad upcoming list seen tonight: G1 with Raghu, G2 with Rohit, Kia, Lee */
  const oc=[Raghu,Kia,Rohit,Lee],rest=ids.filter(id=>!oc.includes(id));R.fpSync(g);
  const out={before:g.up.slice(0,2).map(x=>R.clashOf(g,x.q).length)};let clash=0,next1=0,b2b=0,sr=0;
  for(let k=0;k<25;k++){R.planFull(g,true);const dn=R.fpDone(g),L=g.fp.filter(x=>!x.x&&!dn.has(x.n)&&x.q.every(Boolean)),B=Math.min(...L.map(x=>x.r));
    const byR={};L.forEach(x=>(byR[x.r]=byR[x.r]||[]).push(x));Object.values(byR).forEach(G2=>{const s=new Set();G2.forEach(x=>x.q.forEach(id=>{if(s.has(id))sr++;s.add(id)}))});
    L.forEach(x=>{if(x.r<=B+1&&!x.m&&x.q.some(id=>oc.includes(id)))clash++});
    const n1=R.nextFor(g,1);if(n1<0||R.clashOf(g,g.up[n1].q).length)next1++;
    ids.forEach(id=>{let s=0,p=-9;Object.keys(byR).map(Number).sort((a,b)=>a-b).forEach(r=>{if(byR[r].some(x=>x.q.includes(id))){s=r===p+1?s+1:1;p=r;if(s>=3)b2b++}else{s=0;p=r}})})}
  out.clash=clash;out.next1=next1;out.b2b=b2b;out.sr=sr;out.upFirst=g.up.slice(0,3).map(x=>x.q.filter(id=>oc.includes(id)).length);
  out.header=g.fp.length;Date.now=DN;return out})()"""
try:
    now = int(time.time() * 1000); dub = datetime.datetime.fromtimestamp(now / 1000 + 4 * 3600, datetime.UTC).replace(tzinfo=None)
    today = dub.strftime('%Y-%m-%d'); yday = (dub - datetime.timedelta(days=1)).strftime('%Y-%m-%d'); tom = (dub + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    S0 = json.loads(DATA); ids = [p['id'] for p in S0['players'] if p.get('sx')][:13]
    A = curl('POST', '/api/login', {'u': 'admin', 'p': PW['admin']})[1]['token']; rev = [0]
    def put(SS):
        c, j, t = curl('PUT', '/api/data', {'base': rev[0], 'data': SS}, A); rev[0] = j.get('rev', rev[0]); return c
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---- item 1: simulation + regression (offline app page) ----
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834})
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:')) else r.abort())
        c.add_init_script("localStorage.setItem('rebels.v1',%s)" % json.dumps(DATA))
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto(APP); pg.wait_for_timeout(500)
        rg = pg.evaluate(REG)
        rec('Item 1 regression: 25× Re-plan with Court 1 busy (Raghu/Kia/Rohit/Lee) → no on-court player in any court\'s next game', rg['clash'] == 0, rg['clash'])
        rec('Item 1 regression: Start next on Court 2 always finds a game with nobody on court', rg['next1'] == 0, rg['next1'])
        rec('Item 1 regression: no player twice in one round', rg['sr'] == 0, rg['sr'])
        rec('Item 1 regression: no 3 in a row (13 players, 2 courts)', rg['b2b'] == 0, rg['b2b'])
        pg.add_script_tag(path=str(ROOT / 'tests/v23_sim.js')); sim = pg.evaluate('window.__SIM')
        info = '%d sessions · %d re-plans · %d Start next' % (sim['runs'], sim['replans'], sim['starts'])
        rec('Item 1 stress: simulation ran (8–20 players, 1–3 courts, late arrivals, leavers, edits, assigns, random Re-plan) · ' + info, sim['runs'] >= 60 and sim['replans'] > 500 and not sim.get('err'), sim.get('err', ''))
        rec('Item 1 stress: zero same-round clashes', sim['sameRound'] == 0, sim['ex'][:3])
        rec('Item 1 stress: zero on-court players in the next round', sim['onCourtNext'] == 0, sim['ex'][:3])
        rec('Item 1 stress: zero 3-in-a-row beyond the cap (≥ 6 players per court) · %d checks' % sim['b2bRuns'], sim['b2b'] == 0, sim['ex'][:3])
        rec('Item 1 stress: Start next never picked a game with a player on court', sim['startClash'] == 0 and sim['sendFail'] == 0, (sim['startClash'], sim['sendFail']))
        rec('Item 1: no page errors (simulation)', not errs, errs[:2]); c.close()

        # ---- item 4: /live after End session ----
        S = json.loads(DATA)
        S['days'][yday] = {'sch': 1, 'time': '20:00', 'loc': 'Sportsbay', 'courts': [{'n': 'Court 1', 'h': 2}], 'on': {}, 'att': {k: {'a': now - 26 * 3600e3, 'e': now - 24 * 3600e3} for k in ids[:4]}}
        h0 = {'r': 1, 'n': 1, 'c': 1, 'ids': ids[:4], 'a': [], 'b': [], 'sa': 21, 'sb': 17, 's': 600, 'at': int(now - 25 * 3600e3)}
        S['games'][yday] = {'d': yday, 'courts': 1, 'st': int(now - 27 * 3600e3), 'en': int(now - 24 * 3600e3), 'hist': [h0, dict(h0, n=2, sa=0, sb=0, at=int(now - 24.5 * 3600e3))], 'cur': [[None] * 4], 'live': [{}], 'up': [], 'qq': [[]], 'fp': [{'n': 1, 'r': 0, 'c': 0, 'q': ids[:4]}, {'n': 2, 'r': 1, 'c': 0, 'q': ids[:4]}], 'pts': 21}
        rec('Item 4: data uploaded (yesterday ended 24 h ago)', put(S) == 200)
        L = live()
        rec('Item 4: /live stays on after End session · read only', L.get('live') and L.get('ended') and L.get('date') == yday, {k: L.get(k) for k in ('live', 'ended', 'date')})
        rec('Item 4: results + schedule shown, nothing on court / up next, no names to pick', len(L.get('results', [])) == 2 and len(L.get('sched', [])) == 2 and not L.get('now') and not L.get('next') and not L.get('pick'))
        rec('Item 4: no score sending / corrections (flags off)', not any(r['send'] or r['fix'] for r in L['results']))
        k0 = L['results'][0]['k']
        rec('Item 4: API refuses score and name pick after End session (409)', curl('POST', '/api/live/score', {'k': k0, 't': 'x', 'sa': 21, 'sb': 3})[0] == 409 and curl('POST', '/api/live/claim', {'k': 'x'})[0] == 409)
        ph = b.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Asia/Dubai', is_mobile=True, has_touch=True); pp = ph.new_page(); pe = []; pp.on('pageerror', lambda e: pe.append(str(e)))
        pp.goto(U + '/live'); pp.wait_for_timeout(1500); txt = pp.inner_text('body')
        rec('Item 4: live page shows "Session ended" banner, no Guest/Player picker, no Send score', 'Session ended' in txt and 'ENDED' in txt and not pp.locator('#m [data-a="player"]').count() and 'Send score' not in txt, txt[:120].replace('\n', ' '))
        shot(pp, 'v23_live_ended.png')
        S['games'][yday]['en'] = int(now - 49 * 3600e3); put(S)
        rec('Item 4: off after 48 h', live().get('live') is False)
        S['games'][yday]['en'] = int(now - 2 * 3600e3)
        S['days'][today] = {'sch': 1, 'time': (dub + datetime.timedelta(minutes=20)).strftime('%H:%M'), 'loc': 'Sportsbay', 'courts': [{'n': 'Court 6', 'h': 2}, {'n': 'Court 7', 'h': 2}], 'on': {k: True for k in ids}, 'att': {}}
        put(S); L = live()
        rec('Item 4: next session\'s 30-min window opens → switches to the new session', L.get('live') and not L.get('ended') and L.get('date') == today, {k: L.get(k) for k in ('ended', 'date')})
        rec('Item 4: no page errors (live)', not pe, pe[:2]); ph.close()

        # ---- items 2, 3, 5: tablet ----
        st = now - 40 * 60e3; S['days'][today]['time'] = (dub - datetime.timedelta(minutes=40)).strftime('%H:%M')
        S['days'][today]['att'] = {k: {'a': int(st)} for k in ids}
        oc = ['p3', 'p4', 'p5', 'p6']
        S['games'][today] = {'d': today, 'courts': 2, 'round': 1, 'st': int(st), 'en': 0, 'pts': 21, 'deuce': False, 'slot': 15, 'chg': 1, 'cur': [oc, [None] * 4],
            'live': [{'run': True, 'start': now - 4 * 60e3, 'sa': 5, 'sb': 3, 'el': 0, 'w': ''}, {'run': False, 'start': 0, 'sa': 0, 'sb': 0, 'el': 0, 'w': ''}],
            'nxt': [[None] * 4] * 2, 'qq': [[], []], 'up': [], 'hist': [], 'since': {}, 'btot': {}, 'ros': ids, 'last': [None, None], 'plan': [], 'log': [], 'strk': {}, 'pre': [], 'auto': [], 'closed': {}, 'nman': [], 'man': 1, 'curN': [0, 0], 'v12': 1}
        put(S)
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': 1194, 'height': 834})
        c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}));sessionStorage.setItem('seeded','1')}" % (json.dumps(json.dumps(S)), U))
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:', U)) else r.abort())
        tg = c.new_page(); te = []
        tg.on('pageerror', lambda e: te.append(str(e))); tg.on('dialog', lambda d: d.accept())
        tg.goto(APP); tg.wait_for_timeout(400); tg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); tg.wait_for_timeout(700)
        tg.evaluate("RB.act.lgother()"); tg.fill('#lgu', 'admin'); tg.fill('#lgp', PW['admin']); tg.click('[data-a="lgpw"]'); tg.wait_for_timeout(2500)
        for sel in ('[data-a="lgnoface"]', '[data-a="qpno"]'):
            if tg.locator(sel).count() and tg.is_visible(sel): tg.click(sel); tg.wait_for_timeout(400)
        tg.evaluate("RB.act.tab('games')"); tg.wait_for_timeout(600)
        tg.evaluate("RB.act.fpplan()"); tg.wait_for_timeout(600)
        g = lambda js: tg.evaluate("(()=>{const g=RB.G(RB.TODAY());" + js + "})()")
        hd = tg.inner_text('section.pn:has-text("FULL SESSION PLAN")')
        m = re.search(r'(\d+) players · about ([\d.]+) games each this session \(target (\d+)\) · min (\d+) · max (\d+)', hd)
        rec('Item 5: plan header per session ("13 players · about X games each this session (target 6) · min · max")', m and m.group(1) == '13' and m.group(3) == '6', m.group(0) if m else hd[:160])
        rec('Item 5: about = 2 courts × 12 games × 4 / 13 players', m and abs(float(m.group(2)) - 96 / 13) < .06, m.group(2) if m else '')
        rec('Item 1 (tablet): first upcoming games have nobody from Court 1', g("return g.up.slice(0,2).every(x=>!RB.clashOf(g,x.q).length)"))
        rec('Item 1 (tablet): Court 2 text names the game Start next takes', 'Start next takes G' in tg.inner_text('.cblock >> nth=1'))
        # an edited game with an on-court player → ⚠ warning, Assign to the other court blocked
        g("g.up[2].q[0]='p3';g.up[2].m=1;RB.save();RB.render()"); tg.wait_for_timeout(300)
        nm = g("return RB.S.players.find(p=>p.id==='p3').name")
        w = tg.inner_text('.upbox .gcard >> nth=2')
        rec('Item 1: upcoming game with an on-court player shows "⚠ <name> on Court 1"', ('⚠ %s on Court 6' % nm) in w, w.replace('\n', ' ')[-80:])
        tg.click('.upbox .gcard >> nth=2 >> [data-a="asg"]'); tg.wait_for_timeout(300)
        rec('Item 1: Assign to the clashing court (Court 7) is disabled, Court 6 allowed', tg.is_disabled('.asgr[data-x="1"]') and not tg.is_disabled('.asgr[data-x="0"]'))
        tg.click('.asgr[data-x="1"]', force=True); tg.wait_for_timeout(200); tg.evaluate("RB.act.asgx()")
        rec('Item 1: assignGame also refuses it', g("RB.assignGame(g,g.up[2],1);return g.up[2].ac==null"))
        rec('Item 1: Start next on Court 7 skips that game', g("const k=RB.nextFor(g,1);return k>=0&&k!==2&&!RB.clashOf(g,g.up[k].q).length"))
        # ---- item 2: assign keeps the game in Upcoming ----
        n_up = g("return g.up.length")
        tg.click('.upbox .gcard >> nth=0 >> [data-a="asg"]'); tg.wait_for_timeout(300); tg.click('.asgr[data-x="1"]'); tg.wait_for_timeout(400)
        b0 = tg.inner_text('.upbox .gcard >> nth=0 >> [data-a="asg"]')
        rec('Item 2: assigned game stays in Upcoming (same list, same place)', g("return g.up.length") == n_up and g("return g.up[0].ac") == 1)
        rec('Item 2: its Assign button now shows the court ("Court 7")', 'Court 7' in b0, b0)
        q = tg.inner_text('.cblock >> nth=1 >> .qbox')
        rec('Item 2: "Next on Court 7" lists the names only (no ×, Idle, C: labels)', 'NEXT' in q and '×' not in q and 'Idle' not in q and 'C:' not in q and tg.locator('.cblock >> nth=1 >> .qbox .qnm').count() == 1, q.replace('\n', ' ')[:140])
        fs = tg.evaluate("parseFloat(getComputedStyle(document.querySelector('.qnt')).fontSize)"); ov = tg.evaluate("(e=>e.scrollWidth<=e.clientWidth+1)(document.querySelector('.qnt'))")
        rec('Item 2: queue names readable (≥ 15 px, not cut off)', fs >= 15 and ov, fs)
        rec('Item 2: no Move button anywhere', tg.locator('[data-a="mv"]').count() == 0 and 'Move ▾' not in tg.inner_text('body'))
        rec('Item 2: drag handles ☰ still there for reordering', tg.locator('.upbox [data-drag]').count() == n_up)
        g("const x=g.up[0];g.up.splice(0,1);g.up.splice(2,0,x);RB.save();RB.render()"); tg.wait_for_timeout(200)
        rec('Item 2: reorder kept (assigned game moved to #3 stays there after save)', g("return g.up[2].ac===1"))
        shot(tg, 'v23_tablet_games.png')
        tg.click('.upbox .gcard >> nth=2 >> [data-a="asg"]'); tg.wait_for_timeout(300)
        rec('Item 2: dropdown can unassign', tg.locator('[data-a="asgu"]').count() == 1); tg.click('[data-a="asgu"]'); tg.wait_for_timeout(300)
        rec('Item 2: unassigned → button back to "Assign", still in Upcoming', g("return g.up[2].ac==null") and 'Assign' in tg.inner_text('.upbox .gcard >> nth=2 >> [data-a="asg"]'))
        x1 = g("const k=g.up.findIndex((x,i)=>i>0&&!RB.clashOf(g,x.q).length);g.up[k].ac=1;RB.save();RB.render();return g.up[k].n"); tg.wait_for_timeout(200)
        tg.click('.cblock >> nth=1 >> [data-a="cfopen"]'); tg.wait_for_timeout(300); tg.click('[data-a="cfok"]'); tg.wait_for_timeout(500)
        rec('Item 2: game leaves Upcoming only when it starts (Start next took the assigned game)', g("return (g.curN||[])[1]") == x1 and g("return !g.up.some(x=>x.n===%d)" % x1))
        rec('Item 2: /live "next" still reads the court queue (qq mirror)', g("return Array.isArray(g.qq)&&g.qq.length===2"))
        # ---- item 3: share popup ----
        tg.evaluate("RB.act.liveshare()"); tg.wait_for_timeout(300)
        s1 = tg.inner_html('.lvqr'); t1 = tg.inner_text('#modal')
        rec('Item 3: no WhatsApp button', tg.locator('[data-a="livewa"]').count() == 0 and not re.search(r'^WhatsApp$', t1, re.M))
        rec('Item 3: two QR codes with ◀ ▶ and 2 dots', tg.locator('.lvdot').count() == 2 and tg.locator('[data-a="lvq"][aria-label="Next QR"]').count() == 1)
        tg.click('[aria-label="Next QR"]'); tg.wait_for_timeout(200); s2 = tg.inner_html('.lvqr')
        rec('Item 3: ▶ shows the WhatsApp QR (different code)', s1 != s2 and 'WhatsApp' in tg.inner_text('#modal'))
        box = tg.locator('.lvqr').bounding_box(); tg.mouse.move(box['x'] + 200, box['y'] + 100); tg.mouse.down(); tg.mouse.move(box['x'] + 40, box['y'] + 100); tg.mouse.up(); tg.wait_for_timeout(200)
        rec('Item 3: swipe switches back to the first QR', tg.inner_html('.lvqr') == s1)
        wa = tg.evaluate("RB.waLive(RB.liveUrl())")
        exp = "https://wa.me/?text=" + __import__('urllib.parse').parse.quote("Rebels, here's our live link 🏸 Open it, tap *Participant* and select your name. Check it out guys!\n" + tg.evaluate("RB.liveUrl()"), safe="-_.!~*'()")
        rec('Item 3: WhatsApp QR = wa.me/?text=<message + link> (exact text)', wa == exp, wa[:90])
        rec('Item 3: popup text mentions 48 h after End session', '48 h' in t1)
        shot(tg, 'v23_share.png'); tg.evaluate("RB.act.closelvs()")
        # ---- item 5: setting ----
        tg.evaluate("RB.act.dtgt(5)"); tg.wait_for_timeout(200); tg.evaluate("RB.act.tab('games')"); tg.wait_for_timeout(300)
        rec('Item 5: target setting per session changes the header (target 5)', '(target 5)' in tg.inner_text('section.pn:has-text("FULL SESSION PLAN")'))
        rec('Item 5: games-per-player table target per session', 'TARGET 5/SESSION' in tg.inner_text('body'))
        tg.evaluate("RB.act.dtgt(6)")
        rec('No page errors (tablet)', not te, te[:3])
        b.close()
finally:
    srv.terminate()
n = sum(1 for r in R if r[1]); print('\n%d/%d passed' % (n, len(R)))
sys.exit(0 if n == len(R) else 1)
