#!/usr/bin/env python3
"""v25 checks. Usage: python3 tests/v25_test.py <copy-of-backup.txt> [shots-dir]
Sidebar/logo/header/footer on every screen (light + dark) · court text colours · Update blink only when it changes something (no loop,
every tap logged) · progress checkpoints maths (2×2 h → 1 h, 1×3 h → 1 h 30, 2 h + 1 h → 45 min) + reports · Rebel character
(walk / run / turn / idle / blink / chat / Update / Decline) · add court mid-session + Finance · ahead-of-time options · ⋯ More closes
· quick PIN asked at every login until set. Headless Chrome, offline, a COPY of the backup – never a device."""
import sys, json, pathlib, re, time
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
# adjustable fake clock: window.__off ms ahead of real time, Sunday 22 Nov 2026 10:00 Dubai
CLOCK = """(()=>{const base=Date.parse('2026-11-22T10:00:00+04:00')-Date.now(),D=Date;window.__off=0;class FD extends D{constructor(...a){a.length?super(...a):super(D.now()+base+window.__off)}static now(){return D.now()+base+window.__off}};window.Date=FD;
  const P=performance.now.bind(performance);window.__poff=0;performance.now=()=>P()+window.__poff})();"""
REG = ['p9','p20','p13','p25','p17','p11','p23','p16','p24','p12','p21','p19','p22']; FI = ['p1','p2','p4']
SETUP = """(o)=>{const R=RB,S=R.S,d=R.TODAY(),now=Date.now(),t0=now-o.min*60e3,reg=o.reg||%s,fi=o.fi||%s,all=reg.concat(fi);
  S.dum=Object.fromEntries(fi.map(i=>[i,1]));S.days[d]={sch:1,time:new Date(t0+4*3600e3).toISOString().slice(11,16),loc:'Sportsbay',courts:o.courts||[{n:'Court 1',h:2},{n:'Court 2',h:2}],on:Object.fromEntries(all.map(i=>[i,true])),att:Object.fromEntries(all.map(i=>[i,{a:t0}]))};
  delete S.games[d];delete S.fin[d];const g=R.G(d);Object.assign(g,{st:t0,en:0,since:{},up:[],closed:{},strk:{},hist:[],v23:1});const DN=Date.now;Date.now=()=>t0;R.planFull(g,false);Date.now=DN;
  R.ui.cur=d;R.save();R.render();return {up:g.up.length,fp:(g.fp||[]).length}}""" % (json.dumps(REG), json.dumps(FI))
START2 = "()=>{const R=RB,g=R.G(R.TODAY());R.act.tab('games');R.act.cfopen('0');R.act.cfok();R.act.cfopen('1');R.act.cfok();return g.cur.map(q=>q.join())}"
# play the next game on court i for m minutes (finish + score)
PLAY = """(o)=>{const R=RB,g=R.G(R.TODAY()),i=o.i;R.act.cfopen(String(i));R.act.cfok();g.live[i].start=Date.now()-o.m*60e3;g.live[i].sa=21;g.live[i].sb=15;R.act.timer(String(i));return g.hist.length}"""

def newctx(b, light=False, w=1194, h=834):
    c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': w, 'height': h})
    c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:')) else r.abort())
    c.add_init_script(CLOCK + "if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('rebels.v1',%s);%ssessionStorage.setItem('seeded','1')}" % (json.dumps(DATA), "localStorage.setItem('rebels.theme','light');" if light else ''))
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') and 'rebel' in m.text else None); pg.on('dialog', lambda d: d.accept())
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(700)
    return c, pg, errs
def login(pg):
    pg.evaluate("()=>{RB.remember('admin','admin','pw12345','');RB.enterAs('admin','admin')}"); pg.wait_for_timeout(250)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ===== 1/3/8/9: every screen, light + dark: header, sidebar, footer, logo, court text =====
    for light in (False, True):
        T = 'light' if light else 'dark'
        c, pg, errs = newctx(b, light); login(pg); pg.evaluate(SETUP, {'min': 25}); pg.evaluate(START2)
        pg.evaluate("()=>{const g=RB.G(RB.TODAY());g.live[0].sa=9;g.live[0].sb=7;RB.render()}")
        bad = []
        for name, js in [('home', "RB.act.tab('home')"), ('players', "RB.act.tab('players')"), ('games', "RB.act.tab('games')"), ('finance', "RB.act.tab('finance')"), ('settings', "RB.act.tab('settings')"),
                         ('schedule', "RB.act.pback()"), ('history', "RB.act.home();RB.act.hist&&RB.act.hist()")]:
            pg.evaluate(js); pg.wait_for_timeout(350); pg.evaluate("window.scrollTo(0,400)"); pg.wait_for_timeout(120)
            g = pg.evaluate("""()=>{const r=e=>e?e.getBoundingClientRect():null,st=r(document.querySelector('#stat')),ft=r(document.querySelector('#foot')),nv=document.querySelector('#nav'),n=nv&&nv.offsetParent!==null&&nv.innerHTML?r(nv):null,cs=e=>getComputedStyle(e).backgroundColor;
              const lg=[...document.querySelectorAll('#nav .logo')].filter(e=>getComputedStyle(e).display!=='none');
              return{st:st&&Math.round(st.top),stb:st&&Math.round(st.bottom),ft:ft&&Math.round(ft.bottom),ftt:ft&&Math.round(ft.top),fh:ft&&Math.round(ft.height),nt:n&&Math.round(n.top),nb:n&&Math.round(n.bottom),
                same:n?cs(nv)===cs(document.querySelector('#stat')):true,logo:lg.map(e=>e.className),clk:(document.querySelector('.stmid')||{}).textContent||'',
                foot:(document.querySelector('#foot .fslo')||{}).textContent||'',hs:document.documentElement.scrollWidth>innerWidth+1,mainOY:getComputedStyle(document.querySelector('#main')).overflowY}}""")
            ok = g['st'] == 0 and g['ft'] == 834 and 36 <= g['fh'] <= 44 and g['same'] and re.match(r'^\d{1,2}:\d\d [AP]M · 22 Nov$', g['clk']) and 'One Community' in g['foot'] and not g['hs'] and g['mainOY'] not in ('auto', 'scroll')
            if g['nt'] is not None: ok = ok and g['nt'] == g['stb'] and g['nb'] == g['ftt'] and g['logo'] == ['logo ' + ('lgL' if light else 'lgD')]
            if not ok: bad.append((name, g))
            shot(pg, 'screen_%s_%s.png' % (name, T))
        rec('1/8/9 %s: header frozen at top with clock, sidebar header→footer in the top-bar colour, footer frozen at bottom, %s logo, no sideways scroll, no scroll box (stray line) – 7 screens' % (T, 'dark-ink' if light else 'light-ink'), not bad, bad[:2])
        pg.evaluate("RB.act.tab('games')"); pg.wait_for_timeout(300); pg.evaluate("window.scrollTo(0,0)")
        col = pg.evaluate("()=>[...document.querySelectorAll('.vcourt .scn')].map(e=>getComputedStyle(e).color)")
        won = pg.evaluate("()=>[...document.querySelectorAll('.vcourt .wonb')].map(e=>getComputedStyle(e).backgroundColor+'/'+getComputedStyle(e).color)")
        lv = pg.evaluate("()=>[...document.querySelectorAll('.vcourt .cpl .pnm small')].map(e=>getComputedStyle(e).color)")
        rec('3 %s: score numbers white, A won / B won white buttons + dark text, levels light grey' % T, col and all(x == 'rgb(255, 255, 255)' for x in col) and all(w.startswith('rgb(255, 255, 255)/rgb(20, 22, 26)') for w in won) and all(x == 'rgb(201, 206, 214)' for x in lv), [col, won[:1], lv[:1]])
        shot(pg, 'games_court_%s.png' % T)
        rec('No page errors (%s screens)' % T, not errs, errs[:2]); c.close()

    # ===== 5: checkpoint maths =====
    c, pg, errs = newctx(b); login(pg)
    cps = {}
    for lab, courts in (('2×2 h', [{'n': 'Court 1', 'h': 2}, {'n': 'Court 2', 'h': 2}]), ('1×3 h', [{'n': 'Court 1', 'h': 3}]), ('2 h + 1 h', [{'n': 'Court 1', 'h': 2}, {'n': 'Court 2', 'h': 1}])):
        pg.evaluate(SETUP, {'min': 1, 'courts': courts})
        cps[lab] = pg.evaluate("()=>{const g=RB.G(RB.TODAY()),c=RB.cpTimes(g);return{half:Math.round((c.half-g.st)/60e3),late:Math.round((c.late-g.st)/60e3)}}")
    rec('5: halfway = half of total court-time → 2×2 h 60 min · 1×3 h 90 min · 2 h + 1 h 45 min; last check 15 min before the last court ends',
        cps['2×2 h'] == {'half': 60, 'late': 105} and cps['1×3 h'] == {'half': 90, 'late': 165} and cps['2 h + 1 h'] == {'half': 45, 'late': 105}, cps)
    pg.evaluate(SETUP, {'min': 1, 'courts': [{'n': 'Court 1', 'h': 1}, {'n': 'Court 2', 'h': 1}]})
    sc = pg.evaluate("()=>{const g=RB.G(RB.TODAY());return RB.cpTargets(g)}")
    rec('5: 6 can’t fit (13 regulars, 2 × 1 h) → targets scale to half of what is possible', sc['scaled'] and sc['fin'] < 6 and sc['half'] == sc['fin'] // 2, {k: sc[k] for k in ('fin', 'half', 'slots')})
    # halfway report: 2 courts × 2 h, 60 min in, real games recorded
    pg.evaluate(SETUP, {'min': 0})
    rep = pg.evaluate("""()=>{const R=RB,d=R.TODAY(),g=R.G(d),reg=%s,t=Date.now();window.__off+=61*60e3;const now=Date.now();
      /* give each regular 3 games, Lee (p16) + Haja (p12) 2, Rohit (p25) 4 */
      const n={};reg.forEach(id=>n[id]=3);n.p16=2;n.p12=2;n.p25=4;const pool=[];reg.forEach(id=>{for(let k=0;k<n[id];k++)pool.push(id)});
      g.up=[];delete g.fp;let k=0;while(pool.length>=4){const q=[];for(const id of [...new Set(pool)]){if(q.length<4&&!q.includes(id)){q.push(id);pool.splice(pool.indexOf(id),1)}}if(q.length<4)break;
        g.hist.unshift({r:k,c:1,ids:q,a:[],b:[],sa:21,sb:10,s:600,at:now-(60-k*3)*60e3,m:q.includes('p25')&&k===0?1:0});k++}
      while(pool.length){const id=pool.pop();g.hist.unshift({r:k,c:2,ids:[id,'p1','p2','p4'],a:[],b:[],sa:21,sb:5,s:600,at:now-5*60e3});k++}
      const c=counts=R.counts(g,false);const r=R.cpReport(g,'half',now);return{text:r.text,behind:r.behind.map(o=>o.id+':'+o.n),ahead:r.ahead.map(o=>o.id+':'+o.n+':'+o.sit+':'+o.left),fi:r.fi.length,tg:r.tg}}""" % json.dumps(REG))
    rec('5: halfway report – Behind (red) Lee 2/3, Haja 2/3 · Ahead (amber) Rohit 4/3 with games left + sit-out estimate · everyone else on track · fill-ins on a separate info line',
        rep['tg'] == 3 and set(rep['behind']) >= {'p16:2', 'p12:2'} and any(a.startswith('p25:4') for a in rep['ahead']) and 'Behind: Lee 2/3' in rep['text'] and 'Ahead: Rohit 4/3' in rep['text'] and 'Fill-ins' in rep['text'] and 'sits out ~' in rep['text'], rep['text'][:400])
    m = pg.evaluate("()=>{RB.rbThink(true);const m=RB.RBM;return{key:m.key,lvl:m.lvl,title:m.title,foot:document.querySelector('#foot .fst').textContent}}")
    rec('5/9: Rebel brings the halfway report as a message (footer red “Rebel wants to talk to you”)', m['key'].startswith('cp:half') or m['key'].startswith('upd'), m)
    late = pg.evaluate("""()=>{const R=RB,g=R.G(R.TODAY());window.__off+=46*60e3;g.up=[];const r=R.cpReport(g,'late',Date.now());return{wont:r.wont.map(o=>o.id+':'+o.n+'/'+o.need),urgent:r.urgent,text:r.text}}""")
    rec('5: 15 min before the end – “Won’t reach 6: … – ask the venue for N–M min extra” and it is urgent', late['urgent'] and late['wont'] and 'Won’t reach 6' in late['text'] and 'min extra' in late['text'], late['text'][:300])
    rec('No page errors (checkpoints)', not errs, errs[:2]); c.close()

    # ===== 4: Update blinks only when it can change something (no loop) + every tap logged =====
    c, pg, errs = newctx(b); login(pg)
    # all regulars capped, no fill-ins, lots of spare court time → nothing Update can do
    pg.evaluate(SETUP, {'min': 20, 'reg': REG[:8], 'fi': [], 'courts': [{'n': 'Court 1', 'h': 3}, {'n': 'Court 2', 'h': 3}]})
    pg.evaluate(START2)
    lp = pg.evaluate("""()=>{const R=RB,g=R.G(R.TODAY()),out=[],Q=()=>g.up.map(x=>x.q.join()).join('|');for(let k=0;k<4;k++){const w=R.rebelCheck(g).slice(),b0=Q();R.act.rbupd();out.push({w,changed:Q()!==b0,blink:R.rbBlink()})}
      const P={};g.up.forEach(x=>x.q.forEach(id=>P[id]=(P[id]||0)+1));R.rbThink(true);return{out,spare:R.rbSpare(g),rbh:g.rbh.slice(0,4).map(e=>e.m),lvl:R.RBM.lvl,foot:R.RBM.foot}}""")
    rec('4: all at the 6-cap with spare time → no blink, Update changes nothing (no loop, 4 taps)', all(not o['w'] and not o['changed'] and not o['blink'] for o in lp['out']), lp['out'])
    rec('4: each tap logged in Rebel’s history: “Update tapped · no changes”', sum('Update tapped · no changes' in m for m in lp['rbh']) >= 3, lp['rbh'][:2])
    rec('4/9: unfillable spare time = calm good news (amber footer), not “wants to talk”', lp['lvl'] == 'good' and lp['spare'] >= 8, [lp['lvl'], lp['foot'], lp['spare']])
    pg.evaluate("RB.act.tab('games')"); pg.wait_for_timeout(1300)
    ub = pg.evaluate("()=>{const b=document.querySelector('[data-tk=\"rbup\"]');return{pulse:b.classList.contains('pulse'),why:!!document.querySelector('.rbwhy')&&getComputedStyle(document.querySelector('.rbwhy')).display!=='none'}}")
    rec('4: Update button calm, no reason text next to it', not ub['pulse'] and not ub['why'], ub)
    # normal session: a real change → blinks; tap → one history line per change; then calm
    pg.evaluate(SETUP, {'min': 2}); pg.evaluate(START2)
    ch = pg.evaluate("""()=>{const R=RB,g=R.G(R.TODAY());const lv=g.up[0].q.find(id=>id&&!R.isDum(R.TODAY(),id));R.S.days[R.TODAY()].att[lv].l=Date.now();R.save();const w=R.rebelCheck(g).slice(),bl=R.rbBlink(),n0=(g.rbh||[]).length;R.act.rbupd();const after=R.rebelCheck(g).slice();
      return{w,bl,lines:(g.rbh||[]).slice(0,(g.rbh||[]).length-n0).map(e=>e.m),after,blink2:R.rbBlink()}}""")
    rec('4: when Update can change something it blinks; the tap logs each change (“Update · …”) and the blink stops', ch['bl'] and ch['lines'] and all(l.startswith('Update · ') for l in ch['lines']) and not ch['after'] and not ch['blink2'], ch)
    rec('No page errors (Update)', not errs, errs[:2]); c.close()

    # ===== 7: add court mid-session → Finance + Update fills it without rebuilding the rest; ⋯ More closes =====
    c, pg, errs = newctx(b); login(pg); pg.evaluate(SETUP, {'min': 15}); pg.evaluate(START2); pg.evaluate("RB.act.rbupd()")
    pg.evaluate("RB.act.tab('games')"); pg.wait_for_timeout(300)
    pg.click('[data-a="more"]'); pg.wait_for_timeout(200); pg.click('.mmenu [data-a="cts"]'); pg.wait_for_timeout(300)
    mm = pg.evaluate("()=>({menu:!!document.querySelector('.mmenu'),pop:!!document.querySelector('#modal .cted'),add:!!document.querySelector('#modal [data-a=\"cta\"]')})")
    rec('7: ⋯ More closes when Courts is picked; Courts pop-up has ＋ Add court', not mm['menu'] and mm['pop'] and mm['add'], mm)
    pg.click('#modal [data-a="cta"]'); pg.wait_for_timeout(200)
    pg.fill('[data-i="cta_c"]', '80'); pg.click('#modal [data-a="ctah"][data-x="0.5"]'); pg.click('#modal [data-a="ctah"][data-x="-0.5"]')
    shot(pg, 'courts_add_form.png')
    before = pg.evaluate("()=>{const d=RB.TODAY(),g=RB.G(d),f=RB.S.fin[d];return{court:f?f.court:RB.S.def.court,up:g.up.map(x=>x.q.join()),fp:(g.fp||[]).length}}")
    pg.click('#modal [data-a="ctaok"]'); pg.wait_for_timeout(1300)
    shot(pg, 'courts_added.png')
    ac = pg.evaluate("""()=>{const R=RB,d=R.TODAY(),g=R.G(d),D=R.S.days[d],c=D.courts[2],f=R.S.fin[d];R.rbThink(true);
      return{n:D.courts.length,c,now:Date.now(),end:R.courtEnd(d,2),fin:f.court,xc:f.xc,arr:[g.cur.length,g.live.length],msg:R.RBM.title,upd:!!R.RBM.upd,card:!!document.querySelector('.cblock')&&document.querySelectorAll('.vcourt').length}}""")
    rec('7: ＋ Add court mid-session – name, 1 h default, cost; start = now; card appears; cost goes INTO Finance', ac['n'] == 3 and abs(ac['c']['s'] - ac['now']) < 5000 and abs(ac['end'] - ac['c']['s'] - 3600e3) < 1000 and float(ac['fin']) == float(before['court'] or 0) + 80 and ac['xc'] and ac['arr'] == [3, 3] and ac['card'] == 3, {k: ac[k] for k in ('fin', 'xc', 'arr', 'card')})
    rec('7: Rebel: “Court 3 added for 1 h – I can fit N more games” and Update is offered', ac['upd'] and 'Court 3 added for 1 h' in (ac['msg'] or '') and 'more game' in ac['msg'], ac['msg'])
    af = pg.evaluate("""()=>{const R=RB,d=R.TODAY(),g=R.G(d),old=g.up.map(x=>x.n);R.act.rbupd();const T=R.rbTimes(g,Date.now());
      return{onNew:T.filter(z=>z.i===2).length,kept:old.filter(n=>g.up.some(x=>x.n===n)).length,old:old.length,up:g.up.length,blink:R.rbBlink()}}""")
    rec('7: Update fills the new court without rebuilding the rest (existing games kept)', af['onNew'] >= 3 and af['kept'] >= af['old'] - 1 and af['up'] > af['old'], af)
    # players ✎ and Back to Schedule open the same editor
    pg.evaluate("RB.act.closects();RB.act.tab('players')"); pg.wait_for_timeout(250)
    pg.click('[data-a="ptedit"]'); pg.wait_for_timeout(250)
    pe = pg.evaluate("()=>({cted:!!document.querySelector('#modal .cted'),start:!!document.querySelector('#modal [data-a=\"sedit\"]'),rows:document.querySelectorAll('#modal .ctr').length})")
    shot(pg, 'players_edit_courts.png')
    pg.evaluate("RB.act.closects()"); pg.click('[data-a="pback"]'); pg.wait_for_timeout(300)
    sb = pg.evaluate("()=>({scr:RB.ui.scr,cted:!!document.querySelector('.scr .cted'),time:!!document.querySelector('[data-c=\"sctime\"]'),back:!!document.querySelector('[data-a=\"scback\"]')})")
    shot(pg, 'players_back_to_schedule.png')
    pg.click('[data-a="scback"]'); pg.wait_for_timeout(250)
    rec('2: ✎ on the TODAY line opens time + courts editor; ← Back to Schedule opens session setup pre-filled with the SAME courts editor; back returns to Players',
        pe['cted'] and pe['start'] and pe['rows'] >= 4 and sb['scr'] == 'sched' and sb['cted'] and sb['time'] and pg.evaluate("RB.ui.tab") == 'players', [pe, sb])
    rec('No page errors (courts)', not errs, errs[:2]); c.close()

    # ===== 6: the Rebel character on the tablet (landscape + portrait), light + dark =====
    for (w, h, tag, light) in ((1194, 834, 'land', False), (834, 1194, 'port', True)):
        c, pg, errs = newctx(b, light, w, h); login(pg); pg.evaluate(SETUP, {'min': 2}); pg.evaluate(START2); pg.evaluate("RB.act.tab('games')")
        pg.evaluate("()=>{const R=RB,g=R.G(R.TODAY());const lv=g.up[0].q.find(id=>id&&!R.isDum(R.TODAY(),id));R.S.days[R.TODAY()].att[lv].l=Date.now();R.save();}")
        pg.wait_for_timeout(1500)
        st = pg.evaluate("()=>({ph:RB.RC.ph,a:RB.RC.a,vis:!document.querySelector('#rebel').hidden,lvl:RB.RBM.lvl})")
        shot(pg, 'rebel_%s_1_walk.png' % tag)
        pg.wait_for_timeout(9000)
        st2 = pg.evaluate("""()=>{const r=document.querySelector('#rebel .rbwrap').getBoundingClientRect(),f=document.querySelector('#foot').getBoundingClientRect(),D=RB.RC;
          return{ph:D.ph,a:D.a,bub:document.querySelector('.rbbub').textContent,on:document.querySelector('.rbbub').classList.contains('on'),right:Math.round(innerWidth-r.right),h:Math.round(r.height),feet:Math.round(r.bottom-f.top)}}""")
        shot(pg, 'rebel_%s_2_stand.png' % tag)
        # blink: force the next blink now and catch a closed frame
        pg.evaluate("()=>{RB.RC.blinkAt=0}"); pg.wait_for_timeout(60)
        bl = pg.evaluate("()=>document.querySelector('#rebel .rbeyes').innerHTML.length")
        shot(pg, 'rebel_%s_3_blink.png' % tag)
        pg.wait_for_timeout(400)
        pg.click('#rebel .rbwrap', force=True); pg.wait_for_timeout(300)
        ch = pg.evaluate("()=>({vis:!document.querySelector('#rbchat').hidden,btn:[...document.querySelectorAll('#rbchat .rbbtns button')].map(b=>b.textContent),txt:document.querySelector('#rbchat').textContent.slice(0,160)})")
        shot(pg, 'rebel_%s_4_chat.png' % tag)
        rec('6 %s: walks in (side view), stops at the right end on the footer edge, turns ¾ → front, bubble “Raj, got a minute?”, 120 px' % tag,
            st['lvl'] in ('talk', 'urgent') and st2['ph'] == 'idle' and st2['a'] in ('idle', 'wave') and st2['on'] and 'got a minute' in st2['bub'] and 0 <= st2['right'] <= 40 and abs(st2['feet']) <= 14 and 115 <= st2['h'] * 0.9 <= 140, [st, st2])
        rec('6 %s: eyes blink (code-drawn over the idle frame)' % tag, bl > 50, bl)
        rec('6 %s: tap → chat box with full message + [Update] [Decline]' % tag, ch['vis'] and ch['btn'][:2] == ['Update', 'Decline'], ch)
        if tag == 'land':
            pg.click('#rbchat [data-a="rbgo"]'); pg.wait_for_timeout(250)
            th = pg.evaluate("()=>({a:RB.RC.a,bub:document.querySelector('.rbbub').textContent,chat:!document.querySelector('#rbchat').hidden,rbh:RB.G(RB.TODAY()).rbh.slice(0,3).map(e=>e.m)})")
            shot(pg, 'rebel_land_5_thanks.png')
            pg.wait_for_timeout(2300); ex = pg.evaluate("()=>({ph:RB.RC.ph,a:RB.RC.a})"); shot(pg, 'rebel_land_6_runoff.png')
            pg.wait_for_timeout(4000); gone = pg.evaluate("()=>({ph:RB.RC.ph,hidden:document.querySelector('#rebel').hidden,lvl:RB.RBM.lvl,foot:document.querySelector('#foot .fst').textContent})")
            rec('6: Update in the chat = same as the top button → “Thanks Raj! 👍” (thumbs-up) → runs off right; logged', th['a'] == 'thumbs' and 'Thanks Raj' in th['bub'] and not th['chat'] and any(m.startswith('Update') for m in th['rbh']) and ex['a'] in ('run', 'idle', 'turn') and ex['ph'] in ('turnaway', 'out', 'off'), [th, ex])
            rec('6/9: nothing to say → no Rebel on screen, footer green “All good, Raj – we’re on track”', gone['hidden'] and gone['lvl'] == 'ok' and 'All good' in gone['foot'], gone)
            # Decline path + urgent run-in
            pg.evaluate("()=>{const R=RB,g=R.G(R.TODAY());const lv=g.up[0].q.find(id=>id&&!R.isDum(R.TODAY(),id));R.S.days[R.TODAY()].att[lv].l=Date.now();R.save();}"); pg.wait_for_timeout(1500)
            ur = pg.evaluate("()=>({lvl:RB.RBM.lvl,a:RB.RC.a,ph:RB.RC.ph})")
            shot(pg, 'rebel_land_7_enter2.png')
            pg.wait_for_timeout(9000)
            pg.click('#rebel .rbwrap', force=True); pg.wait_for_timeout(250); pg.click('#rbchat [data-a="rbno"]'); pg.wait_for_timeout(250)
            dc = pg.evaluate("()=>({bub:document.querySelector('.rbbub').textContent,rbh:RB.G(RB.TODAY()).rbh.slice(0,3).map(e=>e.m).join(' | '),lvl:RB.RBM.lvl,ph:RB.RC.ph})")
            shot(pg, 'rebel_land_8_noted.png')
            rec('6: Decline → “Okay, noted” (logged) and walks off; the same suggestion is not repeated', 'Okay, noted' in dc['bub'] and 'Okay, noted' in dc['rbh'], dc)
            for _ in range(20):
                if pg.evaluate("document.querySelector('#rebel').hidden"): break
                pg.wait_for_timeout(500)
            # urgent: overtime → runs in
            pg.evaluate("()=>{window.__off+=130*60e3}")
            for _ in range(30):
                ru = pg.evaluate("()=>({lvl:RB.RBM.lvl,a:RB.RC.a,ph:RB.RC.ph,foot:document.querySelector('#foot .fst').className})")
                if ru['ph'] == 'in': break
                pg.wait_for_timeout(200)
            shot(pg, 'rebel_land_9_urgent_run.png'); pg.wait_for_timeout(4500)
            ur2 = pg.evaluate("()=>({ph:RB.RC.ph,bounce:document.querySelector('#rebel .rbwrap').classList.contains('bounce'),bub:document.querySelector('.rbbub').textContent})")
            shot(pg, 'rebel_land_10_urgent_wait.png')
            rec('6: urgent (overtime) → RUNS in, waits and bounces/waves; footer red blinking', ru['lvl'] == 'urgent' and ru['a'] == 'run' and 'urgent' in ru['foot'] and ur2['ph'] == 'idle' and ur2['bounce'], [ru, ur2])
            # 💬 history
            pg.click('#foot [data-a="rbhist"]'); pg.wait_for_timeout(300)
            hs = pg.evaluate("()=>[...document.querySelectorAll('#modal .rbhr')].map(e=>e.textContent).slice(0,8)")
            shot(pg, 'rebel_history.png')
            rec('6/4: 💬 at the right of the footer opens Rebel’s message history (times, Update logs, reports)', len(hs) >= 4 and any('Update' in h for h in hs) and all(re.match(r'^\d\d:\d\d', h) for h in hs), hs[:4])
            pg.evaluate("RB.act.rbhx()")
            # size setting
            pg.evaluate("RB.act.rbsz('L')"); pg.wait_for_timeout(300)
            hL = pg.evaluate("()=>Math.round(document.querySelector('#rebel .rbwrap').getBoundingClientRect().height*0.9)")
            pg.evaluate("RB.act.rbsz('S')"); pg.wait_for_timeout(300)
            hS = pg.evaluate("()=>Math.round(document.querySelector('#rebel .rbwrap').getBoundingClientRect().height*0.9)")
            pg.evaluate("RB.act.rbsz('M')")
            rec('6: Settings → Rebel size S/M/L (90 / 120 / 160 px)', abs(hL - 160) <= 3 and abs(hS - 90) <= 3, [hS, hL])
        rec('No page errors (Rebel %s)' % tag, not errs, errs[:2]); c.close()

    # ===== 9: ahead of time → good news + options; organizer game = manual extra =====
    c, pg, errs = newctx(b); login(pg)
    pg.evaluate("()=>{RB.S.orgs=['p1','p4']}")
    pg.evaluate(SETUP, {'min': 20, 'reg': REG[:10], 'fi': FI, 'courts': [{'n': 'Court 1', 'h': 3}, {'n': 'Court 2', 'h': 3}]}); pg.evaluate(START2)
    for _ in range(3): pg.evaluate("RB.act.rbupd()")
    ah = pg.evaluate("()=>{RB.rbThink(true);const m=RB.RBM;return{lvl:m.lvl,foot:m.foot,opts:(m.opts||[]).map(o=>o.lab),title:m.title}}")
    pg.evaluate("RB.act.tab('games')")
    for _ in range(40):
        pg.wait_for_timeout(500)
        if pg.evaluate("RB.RC.ph") == 'idle': break
    pg.click('#rebel .rbwrap', force=True); pg.wait_for_timeout(300)
    shot(pg, 'rebel_ahead_chat.png')
    rec('9: ahead of time → amber good news + options [Extra game for X & Y] [Organizers’ game at end] [… in middle] [Ignore]', ah['lvl'] == 'good' and any(o.startswith('Extra game for') for o in ah['opts']) and 'Organizers’ game at the end' in ah['opts'] and 'Organizers’ game in the middle' in ah['opts'], ah)
    bx = pg.evaluate("""()=>{const R=RB,g=R.G(R.TODAY()),m=R.RBM,i=m.opts.findIndex(o=>o.k==='om'),n0=g.up.length;R.act.rbx(String(i));const x=g.up.find(o=>o.bx);
      const k=g.up.indexOf(x);R.act.rbupd();const y=g.up.find(o=>o.bx);return{n0,n1:g.up.length,k,still:!!y&&y.q.join()===x.q.join(),ovr:y&&y.ovr&&y.ovr.length,blink:R.rbBlink()}}""")
    rec('9: Organizers’ game in the middle added as a manual extra (kept by Update, no 6-cap changes)', bx['k'] == 2 and bx['still'] and bx['ovr'] == 4, bx)
    rec('No page errors (ahead)', not errs, errs[:2]); c.close()

    # ===== 11: quick PIN asked at every login until set =====
    c, pg, errs = newctx(b)
    steps = pg.evaluate("""async()=>{const R=RB,out=[];R.remember('games','games','gmpass1','');R.lockApp();
      for(let k=0;k<2;k++){await R.lgPassword('games','gmpass1');out.push(R.ui.lg&&R.ui.lg.step);R.act.qpno();out.push(R.AUTH?1:0);R.lockApp()}
      await R.lgPassword('games','gmpass1');out.push(R.ui.lg&&R.ui.lg.step);['1','2','3','4','1','2','3','4'].forEach(k=>R.act.qpk(k));out.push(!!R.ACC.games.qp);R.lockApp();
      await R.lgPassword('games','gmpass1');out.push(R.ui.lg?R.ui.lg.step:'in');return{out,qpin:R.S.qpin}}""")
    shot(pg, 'pin_prompt.png')
    rec('11: game manager without a PIN is asked at EVERY login (“Not now” = this login only); once set → no more asking', steps['out'][0] == 'qpnew' and steps['out'][2] == 'qpnew' and steps['out'][4] == 'qpnew' and steps['out'][5] is True and steps['out'][6] == 'in' and 'games' in (steps['qpin'] or {}), steps)
    pg.evaluate("()=>{RB.remember('admin','admin','pw12345','');RB.enterAs('admin','admin');RB.act.tab('settings');RB.ui.sopen='accountpasswords';RB.render()}"); pg.wait_for_timeout(300)
    ps = pg.evaluate("()=>[...document.querySelectorAll('.erow')].map(e=>e.textContent).filter(t=>/PIN/.test(t))")
    shot(pg, 'settings_pin_status.png', True)
    rec('11: Settings → Account & passwords shows who has no PIN yet', any('No PIN yet' in t for t in ps) and any('Game manager' in t and 'PIN set' in t for t in ps), ps)
    rec('No page errors (PIN)', not errs, errs[:2]); c.close()
    b.close()

n = sum(1 for r in R if r[1]); print('\n%d/%d passed' % (n, len(R)))
sys.exit(0 if n == len(R) else 1)
