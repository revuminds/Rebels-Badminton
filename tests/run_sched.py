import sys,json,pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
data=pathlib.Path(sys.argv[1]).read_text() if len(sys.argv)>1 else '{}'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    c=b.new_context(timezone_id='Asia/Dubai',viewport={'width':1194,'height':834})
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('file:','data:','blob:')) else r.abort())
    c.add_init_script("localStorage.setItem('rebels.v1',%s)"%json.dumps(data))
    pg=c.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto('file://'+str(ROOT/'dist/RebelsBadminton.html'))
    pg.wait_for_timeout(500)
    # real data: plan the upcoming session
    real=pg.evaluate("""()=>{const R=RB,d='2026-11-22',g=R.G(d);delete g.fp;R.planFull(g,false);const c={};g.fp.forEach(x=>x.q.forEach(id=>{if(id)c[id]=(c[id]||0)+1}));
      return {games:g.fp.filter(x=>x.q.every(Boolean)).length,banned:g.fp.filter(x=>!R.fmtOK(x.q)).length,per:Object.entries(c).map(([k,v])=>R.S.players.find(p=>p.id===k).name+(R.isDum(d,k)?'*':'')+':'+v).join(' '),types:g.fp.map(x=>R.gType(x.q)).join('')}}""")
    print('REAL 2026-11-22:',real)
    pg.add_script_tag(path=str(ROOT/'tests/sched_check.js'))
    for r in pg.evaluate('window.__SCHED'): print('PASS' if r['ok'] else 'FAIL',r['name'],'|',r['msg'],'|',r.get('info',''))
    print('console errors:',errs[:5])
    b.close()
