#!/usr/bin/env python3
"""v17 automated checks (spec G). Usage: python3 tests/run_all.py <copy-of-real-backup.txt> [--shots out.png]
Never touches a device: the app runs in headless Chrome with a COPY of the backup; sync runs against a local Worker (Miniflare)."""
import sys, json, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(sys.argv[1]).read_text()
APP = 'file://' + str(ROOT / 'dist/RebelsBadminton.html')
R = []
def rec(name, ok, detail=''):
    R.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' · ' + detail if detail else ''))
# fake clock: Sunday 22 Nov 2026, 10:05 Dubai (session day)
CLOCK = """(()=>{const off=Date.parse('2026-11-22T10:05:00+04:00')-Date.now(),D=Date;class FD extends D{constructor(...a){a.length?super(...a):super(D.now()+off)}static now(){return D.now()+off}};window.Date=FD})();"""

def ctx(b, w=1194, h=834, net=None, clock=True, store=None):
    c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': w, 'height': h})
    ext = []
    def route(r):
        u = r.request.url
        if u.startswith(('file:', 'data:', 'blob:')) or (net and u.startswith(net)): return r.continue_()
        ext.append(u); r.abort()
    c.route('**/*', route)
    init = (CLOCK if clock else '') + "if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);%s;sessionStorage.setItem('seeded','1')}" % (json.dumps(DATA), store or '')
    c.add_init_script(init)
    return c, ext

def page(c, login=True):
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'net::ERR' not in m.text else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(APP); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(700)
    if login: local_login(pg)
    return pg, errs

def local_login(pg):
    """offline device: admin unlocks with the password kept on the device"""
    pg.evaluate("()=>{if(!RB.ACC.admin)RB.remember('admin','admin','testpw1','');RB.enterAs('admin','admin')}"); pg.wait_for_timeout(200)

def ui_login(pg, u, p):
    pg.evaluate("RB.act.lgother()"); pg.fill('#lgu', u); pg.fill('#lgp', p); pg.click('[data-a="lgpw"]'); pg.wait_for_timeout(2500)
    if pg.is_visible('[data-a="lgnoface"]'): pg.click('[data-a="lgnoface"]')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # ---------- 1. upgrade + data integrity ----------
    c, ext = ctx(b); pg, errs = page(c)
    orig = json.loads(DATA)
    st = pg.evaluate("()=>({v:RB.S.v,fin:JSON.stringify(RB.S.fin),ent:JSON.stringify(RB.S.ent),days:Object.keys(RB.S.days).length,snaps:RB.snapList().map(s=>s.why),tot:RB.allCalc().reduce((a,s)=>[a[0]+s.ret,a[1]+s.inv],[0,0])})")
    rec('Upgrade v4 → v6 on load', st['v'] == 6, 'schema ' + str(orig.get('v')) + ' → ' + str(st['v']))
    rec('Finance data identical after upgrade', st['fin'] == json.dumps(orig['fin'], separators=(',', ':')) and st['ent'] == json.dumps(orig['ent'], separators=(',', ':')), 'totals collected %.2f / spent %.2f' % tuple(st['tot']))
    rec('Safety snapshot taken before upgrade', any('upgrade' in w for w in st['snaps']), ', '.join(st['snaps']))
    # ---------- 2. scripted session ----------
    pg.evaluate("RB.act.tab('players')"); pg.wait_for_timeout(200)
    pg.fill('#pname', 'Zed Tester'); pg.click('#lvb button:nth-child(4)'); pg.click('#sxb button:nth-child(1)'); pg.click('[data-a="add"]'); pg.wait_for_timeout(200)
    zid = pg.evaluate("RB.S.players.find(p=>p.name==='Zed Tester')?.id||''")
    rec('Add player (UI)', bool(zid), zid)
    pg.evaluate("id=>{const p=RB.S.players.find(x=>x.id===id);p.lv=2;RB.save();RB.render()}", zid)
    rec('Edit player level', pg.evaluate("id=>RB.S.players.find(x=>x.id===id).lv", zid) == 2)
    pg.evaluate("RB.act.tab('games')"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const g=RB.G('2026-11-22');delete g.fp;RB.act.fpplan()}"); pg.wait_for_timeout(300)
    s = pg.evaluate("""()=>{const d='2026-11-22',g=RB.G(d),fp=g.fp,rd={};let dup=0,ban=0;fp.forEach(x=>{if(!x.q.every(Boolean))return;if(!RB.fmtOK(x.q))ban++;rd[x.r]=rd[x.r]||new Set();x.q.forEach(id=>{if(rd[x.r].has(id))dup++;rd[x.r].add(id)})});
      const ids=RB.fullIds(g).filter(id=>!RB.isDum(d,id)),c={};fp.forEach(x=>x.q.forEach(id=>{if(id)c[id]=(c[id]||0)+1}));const v=ids.map(id=>c[id]||0);return{n:fp.length,dup,ban,mn:Math.min(...v),mx:Math.max(...v),up:g.up.length}}""")
    rec('Generate schedule before the session (real players, 2 courts)', s['n'] == 24, '%d games' % s['n'])
    rec('Real schedule: no banned formats / duplicates', s['ban'] == 0 and s['dup'] == 0)
    cr = pg.evaluate("""()=>{const g=RB.G('2026-11-22'),m={};g.fp.forEach(x=>x.q.forEach(id=>{if(id){m[id]=m[id]||[0,0];m[id][x.c]++}}));const L=Object.values(m),one=L.filter(v=>v[0]+v[1]>=3&&(!v[0]||!v[1])).length,sp=L.map(v=>Math.abs(v[0]-v[1]));return{one,mx:Math.max(...sp)}}""")
    rec('Court rotation: nobody (3+ games) has every game on one court', cr['one'] == 0, 'max court imbalance %d' % cr['mx'])
    rec('Real schedule: equal games (participants)', s['mx'] - s['mn'] <= 1, '%d–%d each' % (s['mn'], s['mx']))
    # validation layer: duplicate in round blocked; banned format needs confirm (dismissed → unchanged; accepted → logged)
    v = pg.evaluate("""()=>{const g=RB.G('2026-11-22'),x=g.fp.find(o=>!o.q.some(id=>g.cur.flat().includes(id))&&o.r>1),y=g.fp.find(o=>o.r===x.r&&o!==x);
      const ck=RB.checkGame(g,[y.q[0],x.q[1],x.q[2],x.q[3]],{r:x.r,x});return{dupMsg:ck.e.join('|'),n:x.n}}""")
    rec('Validation: same player twice in a round is blocked', 'already plays in this round' in v['dupMsg'], v['dupMsg'])
    pg.remove_listener('dialog', None) if False else None
    ban = pg.evaluate("""()=>{const g=RB.G('2026-11-22');const fw=r=>RB.S.players.find(p=>p.sx==='f'&&RB.S.days['2026-11-22'].on[p.id]&&!g.fp.some(o=>o.r===r&&o.q.includes(p.id)));const x=g.fp.find(o=>o.r>2&&o.q.every(Boolean)&&o.q.filter(RB.isF).length===0&&fw(o.r));const W=x&&fw(x.r);
      if(!x||!W)return{skip:1};const before=x.q.join();window.confirm=()=>false;const el=document.createElement('select');el.dataset.c='slot';el.dataset.x='f.'+x.n;el.dataset.y='0';el.innerHTML='<option value="'+W.id+'">';el.value=W.id;document.body.appendChild(el);
      el.dispatchEvent(new Event('change',{bubbles:true}));const unchanged=x.q.join()===before;window.confirm=()=>true;el.dispatchEvent(new Event('change',{bubbles:true}));el.remove();
      return{unchanged,changed:x.q.join()!==before,audit:(RB.S.audit[0]||{}).m||''}}""")
    rec('Validation: 1W+3M swap refused unless "Override format rule?" confirmed', ban.get('unchanged') and ban.get('changed'), json.dumps(ban))
    rec('Override written to audit log', 'Format override' in ban.get('audit', ''), ban.get('audit', ''))
    pg.evaluate("()=>{RB.act.startsess();}"); pg.wait_for_timeout(200)
    run = pg.evaluate("()=>{const g=RB.G('2026-11-22');return !!(g.st&&!g.en)}")
    rec('Start session', run)
    pg.evaluate("()=>{const d='2026-11-22';Object.keys(RB.S.days[d].on).forEach(id=>RB.act.ckin(id));RB.act.closeck&&RB.act.closeck()}")
    nin = pg.evaluate("()=>Object.keys(RB.S.days['2026-11-22'].att).length")
    rec('Check in players', nin >= 14, str(nin) + ' checked in')
    rec('Session start: planned games feed Upcoming', pg.evaluate("RB.G('2026-11-22').up.length") > 0, str(pg.evaluate("RB.G('2026-11-22').up.length")))
    # play a game: send to court, score to 21, save
    g = pg.evaluate("""()=>{RB.act.cfopen('0');RB.act.cfok();const g=RB.G('2026-11-22');for(let k=0;k<15;k++)RB.act.sc('0','b+');for(let k=0;k<25;k++)RB.act.sc('0','a+');RB.act.sc('0','b+');const L=g.live[0];const r={sa:L.sa,sb:L.sb,on:!!g.cur[0][0]};RB.act.timer('0');const h=g.hist[0];return Object.assign(r,{h:h?h.sa+'-'+h.sb:''})}""")
    rec('Live game: scoring stops at the game\'s points (21)', g['sa'] == 21 and g['sb'] == 15 and g['on'], '%s–%s' % (g['sa'], g['sb']))
    rec('Live game saved to history', g['h'] == '21-15', g['h'])
    sc = pg.evaluate("[RB.scoreErr(25,10,{pts:21,deuce:false}),RB.scoreErr(21,21,{pts:21,deuce:false}),RB.scoreErr(21,20,{pts:21,deuce:true}),RB.scoreErr(30,29,{pts:21,deuce:true}),RB.scoreErr(25,18,{pts:25,deuce:false}),RB.scoreErr(14,12,{pts:21,deuce:false})]")
    rec('Score validation uses each game\'s points', sc[0] and sc[1] and sc[2] and not sc[3] and not sc[4] and not sc[5], json.dumps(sc))
    pp = pg.evaluate("""()=>{const g=RB.G('2026-11-22'),x=g.fp.find(o=>!g.hist.some(h=>h.n===o.n)&&!(g.curN||[]).includes(o.n));const el=document.createElement('input');el.dataset.i='fp_pts';el.dataset.x=x.n;el.value='15';document.body.appendChild(el);el.dispatchEvent(new Event('input',{bubbles:true}));el.remove();return{p:RB.gp(g,x).pts,s:+g.pts}}""")
    rec('Per-game points box (game 15, session 21)', pp['p'] == 15 and pp['s'] == 21)
    # H6 bench status
    bn = pg.evaluate("""()=>{const g=RB.G('2026-11-22'),t=Date.now(),a=RB.benchRows(g,t),b=RB.benchRows(g,t+65000),r=a.find(x=>x.c<0&&!x.fi&&!x.gone&&x.sit>=0),r2=b.find(x=>x.id===r.id);
      const sorted=a.filter(x=>!x.fi).every((x,i,L)=>!i||L[i-1].sit>=x.sit||L[i-1].gone!==x.gone);const onc=a.filter(x=>x.c>=0);
      RB.act.tab('games');const html=document.querySelector('#main').innerHTML;return{grow:r2.sit-r.sit,sorted,onc:onc.every(x=>x.sit===0),panel:/BENCH NOW/.test(html)&&/sitting/.test(html)}}""")
    rec('Bench: timers grow while resting (+65 s)', 64 <= bn['grow'] <= 66, str(bn['grow']))
    rec('Bench: longest-sitting on top; players on court show 0 sitting', bn['sorted'] and bn['onc'])
    rec('Bench panel on Games page ("On bench · sitting N min")', bn['panel'])
    rs = pg.evaluate("""()=>{RB.act.cfopen('1');RB.act.cfok&&RB.act.cfok();const g=RB.G('2026-11-22'),q=g.cur[1];if(!q||!q.every(Boolean))return{skip:1};const R=RB.benchRows(g,Date.now());return{reset:q.every(id=>{const r=R.find(x=>x.id===id);return r&&r.c===1&&r.sit===0})}}""")
    rec('Bench: sitting timer resets when the game starts', rs.get('reset'), json.dumps(rs))
    # H8 points only on Games page
    pg.evaluate("()=>{const el=document.createElement('input');el.dataset.i='g_pts';el.value='25';document.body.appendChild(el);el.dispatchEvent(new Event('input',{bubbles:true}));el.remove()}")
    pg.evaluate("RB.act.tab('settings')"); pg.wait_for_timeout(200)
    rec('Points: no "points to win" chips in Settings; session box sets next session default', pg.locator('[data-a="dpts"]').count() == 0 and pg.evaluate("RB.S.def.pts") == 25 and pg.locator('[data-a="ddeuce"]').count() == 1)
    pg.evaluate("()=>{const el=document.createElement('input');el.dataset.i='g_pts';el.value='21';document.body.appendChild(el);el.dispatchEvent(new Event('input',{bubbles:true}));el.remove()}")
    pg.wait_for_timeout(900)
    pg.evaluate("RB.act.endsess();RB.act.endok()"); pg.wait_for_timeout(200)
    en = pg.evaluate("()=>({en:!!RB.G('2026-11-22').en,sn:RB.snapList()[0].why})")
    rec('End session (+ safety snapshot)', en['en'] and 'End session' in en['sn'], en['sn'])
    hist_n = pg.evaluate("RB.G('2026-11-22').hist.length")
    bt = pg.evaluate("()=>{const g=RB.G('2026-11-22');return RB.benchRows(g).every(r=>Math.abs(r.tot-(g.btot[r.id]||0))<1)&&RB.benchRows(g).some(r=>r.tot>0)}")
    rec('Bench: total bench correct after End session', bt)
    pg.evaluate("RB.act.home()"); pg.wait_for_timeout(200); hm = pg.inner_text('#main')
    rec('Home: no Last session / Finance cards / backup banner', 'LAST SESSION' not in hm and 'FINANCE ·' not in hm and 'No backup exported' not in hm)
    pg.reload(); pg.wait_for_timeout(700)
    rec('Reopen: login asked again (no auto-login)', pg.is_visible('#login') and pg.evaluate("!RB.AUTH.role"))
    local_login(pg)
    rec('Reload: data persists', pg.evaluate("RB.G('2026-11-22').hist.length") == hist_n and pg.evaluate("!!RB.S.players.find(p=>p.name==='Zed Tester')"), '%s/%s games, players %s' % (pg.evaluate("RB.G('2026-11-22').hist.length"), hist_n, pg.evaluate("RB.S.players.length")))
    # old backup import + migration + undo
    imp = pg.evaluate("""t=>{RB.ui.bun=true;window.__imp(t);return{v:RB.S.v,zed:!!RB.S.players.find(p=>p.name==='Zed Tester'),snap:RB.snapList()[0].why,audit:RB.S.audit[0].m,undo:RB.canUndo()}}""", DATA)
    rec('Import old (v4) backup → upgraded to v6', imp['v'] == 6 and not imp['zed'], imp['audit'])
    rec('Snapshot before import + Undo available', 'Before Backup imported' in imp['snap'] and imp['undo'])
    pg.evaluate("RB.undoRestore()")
    rec('Undo last restore brings data back', pg.evaluate("!!RB.S.players.find(p=>p.name==='Zed Tester')"))
    rec('Snapshots capped at 5', pg.evaluate("RB.snapList().length") <= 5, str(pg.evaluate("RB.snapList().length")))
    rec('Export excludes photos (data only)', pg.evaluate("()=>{RB.S.players[0].img='data:image/jpeg;base64,AAAA';const d=RB.dataOnly();return !JSON.stringify(d).includes('data:image')&&!!d.players[0].imgH}"))
    rec('No console errors (scripted session)', not errs, '; '.join(errs[:3]))
    rec('No external network requests (offline app)', not ext, ', '.join(ext[:3]))
    c.close()

    # ---------- 3. sync + logins against a local Worker ----------
    srv = subprocess.Popen(['node', str(ROOT / 'tests/worker_serve.mjs')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    T = json.loads(srv.stdout.readline()); U = T['url']; PW = T['pw']
    try:
        st_url = "localStorage.setItem('rebels.sync',JSON.stringify({url:'%s'}))" % U
        c, ext = ctx(b, net=U, clock=False, store=st_url); pg, errs = page(c, login=False)
        rec('Login required on open (account picker, no auto-login)', pg.is_visible('#login') and pg.evaluate("!RB.AUTH.role"))
        ui_login(pg, 'admin', 'wrong-pw')
        rec('Wrong password refused (tries left shown)', 'left' in pg.inner_text('#login') and pg.evaluate("!RB.AUTH.role"))
        pg.evaluate("RB.act.lgback()"); ui_login(pg, 'admin', PW['admin'])
        rec('Admin logs in (cloud check)', pg.evaluate("RB.AUTH.role") == 'admin' and not pg.is_visible('#login'))
        pg.wait_for_timeout(2500)
        rev = pg.evaluate("RB.SY.rev||0")
        rec('Sync: admin first upload after login', rev >= 1 and pg.evaluate("!RB.SY.dirty"), 'rev %s' % rev)
        rec('Remembered account tile + token kept on device', pg.evaluate("!!(RB.ACC.admin&&RB.ACC.admin.tok)"))
        c.set_offline(True)
        pg.evaluate("()=>{RB.S.players[1].lv=4;RB.save();RB.render()}"); pg.wait_for_timeout(2500)
        stx = pg.evaluate("RB.vStat()")
        rec('Offline: change queued, status "Not synced (offline)"', 'Not synced' in stx and pg.evaluate("!!RB.SY.dirty"))
        pg.evaluate("RB.act.switchacc()"); pg.wait_for_timeout(200)
        rec('Switch account → back to account picker', pg.is_visible('[data-a="lgpick"][data-x="admin"]') and pg.evaluate("!RB.AUTH.role"))
        pg.evaluate("RB.act.lgpick('admin')"); pg.fill('#lgp', PW['admin']); pg.click('[data-a="lgpw"]'); pg.wait_for_timeout(1500)
        rec('Offline unlock of remembered account (local password check)', pg.evaluate("RB.AUTH.role") == 'admin')
        c.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(3000)
        rec('Back online: queued change uploads', pg.evaluate("!RB.SY.dirty") and pg.evaluate("RB.SY.rev") > rev, 'rev %s' % pg.evaluate("RB.SY.rev"))
        # stale device: second tablet still at rev 1 with its own change
        c2, _ = ctx(b, net=U, clock=False, store="localStorage.setItem('rebels.sync',JSON.stringify({url:'%s',rev:1,dirty:1}))" % U); pg2, _e = page(c2, login=False)
        ui_login(pg2, 'admin', PW['admin']); pg2.wait_for_timeout(2500)
        rec('Stale device cannot overwrite newer data ("Behind · pull first")', pg2.evaluate("!!RB.SY.behind") and 'Behind' in pg2.evaluate("RB.vStat()"))
        pg2.evaluate("RB.syncNow(true)"); pg2.wait_for_timeout(2500)
        rec('Pull latest (snapshot of unsynced changes first)', pg2.evaluate("RB.S.players[1].lv") == 4 and any('unsynced' in s for s in pg2.evaluate("RB.snapList().map(s=>s.why)")))
        c2.close()
        # organizer
        c3, _ = ctx(b, net=U, clock=False, store=st_url); pg3, e3 = page(c3, login=False); ui_login(pg3, 'organizer', PW['organizer']); pg3.wait_for_timeout(2500)
        rec('Organizer sees cloud data incl. Finance (read-only)', pg3.evaluate("RB.S.players[1].lv") == 4 and pg3.evaluate("RB.VIEW()") and pg3.evaluate("Object.keys(RB.S.fin).length") > 0)
        pg3.evaluate("RB.act.tab('players')"); pg3.wait_for_timeout(200)
        pg3.evaluate("()=>{const b=document.createElement('button');b.dataset.a='alloff';document.body.appendChild(b);b.click();b.remove()}")
        rec('Organizer: edit actions blocked + edit controls hidden', pg3.evaluate("Object.values(RB.S.days['2026-11-22'].on).filter(Boolean).length") > 0 and not pg3.is_visible('#pname'))
        pg3.evaluate("RB.act.tab('finance')"); pg3.wait_for_timeout(200)
        rec('Organizer: Finance opens without PIN', 'AED' in pg3.inner_text('#main'))
        pg3.evaluate("RB.act.tab('settings')"); pg3.wait_for_timeout(200)
        rec('Organizer: no export / import / restore / passwords in Settings', pg3.locator('[data-a="bexport"],[data-a="bimport"],[data-a="snrest"],[data-a="sysnaps"],[data-a="accset"]').count() == 0)
        c3.close()
        # game manager on the SAME tablet as admin (finance data stays on the device but is never shown or sent)
        pg.evaluate("RB.act.switchacc()"); ui_login(pg, 'games', PW['games']); pg.wait_for_timeout(2500)
        nav = pg.inner_text('#nav')
        rec('Game manager: no Finance / Settings tabs', pg.evaluate("RB.GM()") and 'Finance' not in nav and 'Settings' not in nav, nav.replace('\n', ' '))
        pg.evaluate("RB.act.tab('finance')"); pg.wait_for_timeout(200)
        rec('Game manager: Finance blocked', pg.evaluate("RB.ui.tab") != 'finance' or 'AED' not in pg.inner_text('#main'))
        rec('Game manager: tablet keeps its finance data after pull', pg.evaluate("Object.keys(RB.S.fin).length") > 0)
        r0 = pg.evaluate("RB.SY.rev")
        pg.evaluate("()=>{RB.S.players[3].lv=1;RB.save()}"); pg.wait_for_timeout(2500)
        rec('Game manager edits players → uploaded', pg.evaluate("RB.SY.rev") > r0 and pg.evaluate("!RB.SY.dirty"), pg.evaluate("JSON.stringify([RB.SY.rev,RB.SY.dirty,RB.SY.err,RB.SY.behind,!!RB.SY.token])")+' r0 %s' % r0)
        tg = pg.evaluate("fetch('%s/api/login',{method:'POST',body:JSON.stringify({u:'games',p:'%s'})}).then(r=>r.json()).then(j=>j.token)" % (U, PW['games']))
        st = pg.evaluate("t=>Promise.all(['/api/snapshots','/api/accounts'].map(p=>fetch('%s'+p,{headers:{Authorization:'Bearer '+t}}).then(r=>r.status)))" % U, tg)
        rec('Worker: game manager snapshots / accounts → 403', st == [403, 403], str(st))
        to = pg.evaluate("fetch('%s/api/login',{method:'POST',body:JSON.stringify({u:'organizer',p:'%s'})}).then(r=>r.json()).then(j=>j.token)" % (U, PW['organizer']))
        r = pg.evaluate("t=>fetch('%s/api/data',{method:'PUT',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({base:9,data:{players:[]}})}).then(r=>r.status)" % U, to)
        rec('Worker: organizer write → 403', r == 403)
        lv = pg.evaluate("fetch('%s/api/live').then(r=>r.json())" % U)
        rec('Live link API reachable without login', 'live' in lv)
        c.close()
    finally:
        srv.terminate()
    b.close()

# worker unit tests (Miniflare)
w = subprocess.run(['node', str(ROOT / 'tests/worker_test.mjs'), sys.argv[1]], capture_output=True, text=True)
for line in w.stdout.splitlines():
    if line.startswith(('PASS', 'FAIL')): rec('Worker: ' + line[5:], line.startswith('PASS'))
s = subprocess.run([sys.executable, str(ROOT / 'tests/run_sched.py'), sys.argv[1]], capture_output=True, text=True)
for line in s.stdout.splitlines():
    if line.startswith(('PASS', 'FAIL')): rec('Scheduler: ' + line[5:].split(' | ')[0], line.startswith('PASS'), line.split(' | ')[-1] if ' | ' in line else '')
print('\n%d passed, %d failed' % (sum(1 for r in R if r[1]), sum(1 for r in R if not r[1])))
pathlib.Path('/tmp/v17_results.json').write_text(json.dumps(R))
