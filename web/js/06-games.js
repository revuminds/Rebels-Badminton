/* ===== Games ===== */
const REOPEN_MS=5*60*1000;
function vSBar(g){const d=g.d,ps=g.st?((g.en||Date.now())-g.st)/1000:0,ed=!g.en&&d>=TODAY();
  const cs=courtsOf(d).map((c,i)=>'<span class="cbh">'+esc(c.n)+' <b>'+hrsL(num(c.h))+'</b>'+(ed?'<button data-a="gch" data-x="'+i+'" data-y="-0.5" aria-label="Less time">−</button><button data-a="gch" data-x="'+i+'" data-y="0.5" aria-label="More time">+</button>':'')+'</span>').join('');
  return '<div class="sbar"><span>'+g.pts+' PTS · DEUCE '+(g.deuce?'ON · CAP '+capOf(g):'OFF')+' · '+(num(g.slot)||15)+'+'+num(g.chg)+' MIN</span>'+cs+
   '<span style="margin-left:auto;cursor:pointer;text-decoration:underline dotted" data-a="sedit">'+(g.st?'START '+hm(g.st)+(g.en?' · END '+hm(g.en):'')+' · PLAYED <b style="color:var(--tx)" data-tk="sess">'+fmtH(ps)+'</b> / BOOKED '+hrsL(sessLenH(d)):'Booked '+t12((S.days[d]||{}).time)+' · tap to enter times')+'</span></div>'}
function cStrip(g,i,t){const end=courtEnd(g.d,i),left=end-t,open=left>0,n=g.hist.filter(h=>h.c===i+1).length,fit=Math.max(0,Math.floor(left/60e3/slotOf(g))-(g.cur[i]&&g.cur[i].every(Boolean)?1:0));
  const lc=left<10*60e3?'var(--bad)':left<20*60e3?'var(--y)':'var(--ok)';
  return '<div class="cstrip'+(open?'':' off')+'"><b>'+esc(cname(g.d,i))+'</b><span>ends '+hm(end)+'</span>'+(open?'<span style="color:'+lc+';font-weight:700" data-tk="left" data-i="'+i+'">'+Math.ceil(left/60e3)+' min left</span>':'<span style="font-weight:700">Booking ended</span>')+'<span>'+pl(n,'game')+' played</span>'+(open?'<span>≈ '+fit+' more fit</span>':'')+'</div>'}
function vGames(){const d=curDate();if(!d)return noSess('GAMES');const t=TODAY(),g=G(d),D=day(d),on=onIds(d),plan=d>t,past=d<t,run=running(g),ended=!!g.en,now=Date.now();
  if(!past&&!g.st)ensurePlan(g);if(run)autoNext(g,'fill',null);
  const title=past?'SESSION <span>'+esc(dlab(d).toUpperCase())+'</span>':plan?'PLAN <span>'+esc(dlab(d).toUpperCase())+'</span>':ended?'SESSION <span>ENDED</span>':run?'GAMES <span>LIVE</span>':'READY TO <span>PLAY</span>';
  const ctl=past?'':run?'<button class="ol sm2" data-a="reshuffle">↻ Re-shuffle Up Next</button><button class="ol" style="border-color:var(--bad);color:var(--bad)" data-a="endsess">■ End session</button>':
    ended?(d===t?(now-g.en<REOPEN_MS?'<button class="ol" data-a="reopen">Reopen session</button>':'<button class="ol" disabled style="opacity:.35">Reopen session</button>'):''):
    plan?'<button class="btn" disabled>▶ Start session</button>':'<button class="btn sh" data-a="startsess">▶ Start session</button>';
  const onC=new Set(g.cur.flat().filter(Boolean)),inN=new Set(g.nxt.flat().filter(Boolean));
  const benchE=on.filter(id=>!onC.has(id)&&(!run||eligible(d,id)));const pick=benchE.filter(id=>!inN.has(id));
  const quad=(q,i,key,pk,lab)=>{const full=q.every(Boolean);const sa=lvOf(q[0])+lvOf(q[1]),sb=lvOf(q[2])+lvOf(q[3]),df=Math.abs(sa-sb);
    const bal=!full?'FILL ALL 4':df<=1?'● BALANCED':(sa>sb?'TEAM A':'TEAM B')+' STRONGER',bc=!full?'var(--mu)':df<=1?'var(--ok)':'var(--y)';
    const slots=q.map((id,k)=>(k===2?'<span class="d" style="color:var(--y);font-size:16px;padding:0 2px">VS</span>':'')+(id?'<span class="slot" style="'+pchip(id)+'"><span style="overflow:hidden;text-overflow:ellipsis">'+esc(nameOf(id))+'</span><button data-a="rmslot" data-x="'+key+'" data-y="'+k+'" aria-label="Remove">×</button></span>':
      '<select class="slotsel" data-c="slot" data-x="'+key+'" data-y="'+k+'" aria-label="Pick a player"><option value="">'+(run?'+ Bench…':'+ Player…')+'</option>'+pk.map(b=>'<option value="'+b+'">'+esc(nameOf(b))+' · '+LVN[lvOf(b)]+'</option>').join('')+'</select>')).join('');
    return '<div class="nm"><div class="sb" style="font-size:12px;font-weight:700;letter-spacing:.1em"><span style="color:var(--mu)">'+lab+(key[0]==='0'&&g.nman[i]?' · <span style="color:var(--y)">PLACED BY YOU</span>':'')+'</span><span style="color:'+bc+'">'+bal+'</span></div><div class="row" style="gap:6px">'+slots+'</div></div>'};
  let courts='';
  if(run)courts=g.cur.map((q,i)=>{const L=g.live[i]||blankLive(),full=q&&q.every(Boolean),open=courtOpen(g,i,now),nq=g.nxt[i]||NUL4(),nf=nq.every(Boolean);
    const lines='<div class="l1"></div><div class="l2" style="left:36%"></div><div class="l2" style="right:36%"></div><div class="net"></div>';
    let body,tb;
    if(!full){const last=g.last[i],wait=nq.filter(Boolean).filter(id=>onC.has(id));
      body='<div class="court big'+(open?'':' shut')+'">'+lines+'<div class="cwait" style="flex-direction:column;gap:12px">'+(last?'<span style="font-size:15px">Last: '+esc(tn(last,0))+' <b>'+last.sa+' – '+last.sb+'</b> '+esc(tn(last,1))+'</span>':'')+
        (!open?'<span>Booking ended · no more games on this court</span>':nf&&!wait.length?'<button class="btn" data-a="send" data-x="'+i+'">Send Up Next on court ▶</button>':'<span>Court free · Up Next fills as players are free</span>')+'</div></div>';tb=''}
    else{const ch=id=>'<div class="pchip" style="'+pchip(id)+'">'+esc(nameOf(id))+'</div>';
      const sc=(s,side)=>'<div class="row" style="gap:6px"><button class="sc" data-a="sc" data-x="'+i+'" data-y="'+side+'-">−</button><span class="scn">'+s+'</span><button class="sc p" data-a="sc" data-x="'+i+'" data-y="'+side+'+">+</button></div>';
      const wb=s=>'<button class="wonb'+(L.w===s?' on':'')+'" data-a="won" data-x="'+i+'" data-y="'+s+'">'+(s==='a'?'◀ A won':'B won ▶')+'</button>';
      const secs=L.run?(now-L.start)/1000:(L.el||0);
      body='<div class="court big">'+lines+'<div class="side">'+ch(q[0])+ch(q[1])+sc(L.sa,'a')+'</div><div class="side r">'+ch(q[2])+ch(q[3])+sc(L.sb,'b')+'</div></div>';
      tb='<div class="tbar"><span class="tdot'+(L.run?' run':'')+'"></span><span class="d" style="font-size:30px;min-width:76px" data-tk="court" data-i="'+i+'">'+fmt(secs)+'</span><span style="flex:1"></span>'+wb('a')+wb('b')+
       '<button class="tbtn'+(L.run?' run':'')+'" data-a="timer" data-x="'+i+'">'+(L.run?'■ Stop &amp; save':(L.sa||L.sb)?'✓ Save':'▶ Start')+'</button></div>'}
    return '<section class="cblock">'+cStrip(g,i,now)+body+tb+(open?quad(nq,i,'0.'+i,pick,'UP NEXT · '+esc(cname(d,i).toUpperCase())):'')+'</section>'}).join('');
  let pre='',planV='';
  if(!run&&!ended&&!past){const rds=[g.nxt,...g.plan],sl=slotOf(g),cnt2={};rds.forEach(rd=>rd.forEach(q=>{if(q.every(Boolean))q.forEach(id=>cnt2[id]=(cnt2[id]||0)+1)}));
    const ng=rds.reduce((a,rd)=>a+rd.filter(q=>q.every(Boolean)).length,0),cap=4*totSlots(g),nC=courtsOf(d).length;
    pre='<section class="pn" style="gap:8px"><div class="sb"><span class="lab">ROUND 1 · '+(plan?'SAVED FOR THIS DATE':'FIRST GAMES ONCE PLAYERS ARRIVE')+'</span><button class="gh" style="height:36px;border-style:solid" data-a="remix">↻ Re-mix</button></div><div class="g2" style="gap:12px">'+g.nxt.map((q,i)=>quad(q,i,'0.'+i,on.filter(id=>!inN.has(id)),esc(cname(d,i).toUpperCase()))).join('')+'</div></section>';
    const og=on.filter(isOrg),reg=on.filter(id=>!isOrg(id)),rc=reg.map(id=>cnt2[id]||0),oc=og.map(id=>cnt2[id]||0);
    const rng=a=>{if(!a.length)return '–';const m=Math.min(...a),x=Math.max(...a);return m===x?''+m:m+'–'+x};
    const pmin=Math.ceil(cap/TGT),pmax=Math.floor(cap/TMIN);
    const short=reg.filter(id=>(cnt2[id]||0)<TMIN);
    const tips=[courtsOf(d).map((c,i)=>esc(c.n)+' '+hrsL(num(c.h))+' = '+courtRounds(g,i)+' games').join(' · ')+' → '+totSlots(g)+' game slots = '+cap+' player-slots → '+(pmin===pmax?pl(pmin,'player'):pmin+'–'+pl(pmax,'player'))+' for '+TMIN+'–'+TGT+' games each',
      'Slot '+(num(g.slot)||15)+' min game + '+num(g.chg)+' min changeover = '+sl+' min · '+ng+' games planned',
      'You have '+on.length+' on'+(og.length?' ('+reg.length+' regular + '+pl(og.length,'organizer')+')':'')+' → regulars '+rng(rc)+' games'+(og.length?' · organizers '+rng(oc):''),
      on.length<4?'':reg.length>pmax?(reg.length-pmax)+' too many for '+TMIN+'–'+TGT+' games each – add court time':on.length<pmin?'Short by '+pl(pmin-on.length,'player')+' – regulars may get more than '+TGT+' games':'✓ Players fit '+TMIN+'–'+TGT+' games each',
      short.length&&on.length>=4?TMIN+' games not reached for: '+short.map(nameOf).join(', ')+'. Try: more court hours, shorter slot, or fewer players':'',
      on.length>=4&&on.length<nC*6?'Max 2 in a row: '+pl(nC,'court')+' need ≥ '+nC*6+' players to fill every round':'',
      'On the day: only players marked Arrived get games · late arrivals get a fair share for the time they are here'].filter(Boolean);
    planV='<section class="pn" style="gap:10px"><div class="sb"><span class="lab">ALL PLANNED GAMES · '+ng+' GAMES · '+rds.length+' ROUNDS</span><span class="lab">TAP × TO SWAP A PLAYER</span></div>'+
     '<div class="g2" style="gap:12px">'+g.plan.map((rd,r)=>{const inR=new Set(rd.flat().filter(Boolean)),pk=on.filter(id=>!inR.has(id)),m=(r+1)*sl;
       return '<div class="prd"><span class="lab" style="color:var(--y)">ROUND '+(r+2)+' · +'+Math.floor(m/60)+':'+z(m%60)+'</span>'+rd.map((q,i)=>r+1<courtRounds(g,i)?quad(q,i,(r+1)+'.'+i,pk,esc(cname(d,i).toUpperCase())):'').join('')+'</div>'}).join('')+'</div>'+
     '<div class="tipbox"><div class="laby" style="font-size:12px">PLAN TIPS</div>'+tips.map(x=>'<div class="tip"><span>→</span><span>'+esc(x)+'</span></div>').join('')+'</div></section>'}
  let bench='';if(run){const w=id=>g.since[id]!=null?now-g.since[id]:0,E=benchE.slice().sort((a,b)=>w(b)-w(a)),nh=on.filter(id=>!arrived(d,id)),lf=on.filter(id=>leftAt(d,id));
    bench='<div class="row" style="flex-wrap:wrap;gap:8px;padding:0 4px"><span class="lab" style="margin-right:4px">ON THE BENCH</span>'+(E.length?E.map(id=>'<button class="bch" data-a="pmod" data-x="'+id+'" data-tk="bench" data-id="'+id+'"><span>'+esc(nameOf(id))+'</span><small></small></button>').join(''):'<span style="color:var(--mu)">Nobody waiting</span>')+
     nh.map(id=>'<button class="bch gr" data-a="pmod" data-x="'+id+'"><span>'+esc(nameOf(id))+'</span><small>Not here yet</small></button>').join('')+lf.map(id=>'<button class="bch gr" data-a="pmod" data-x="'+id+'"><span>'+esc(nameOf(id))+'</span><small>Left '+hm(leftAt(d,id))+'</small></button>').join('')+'</div>'}
  const hist=g.hist,tot=hist.reduce((a,h)=>a+h.s,0),cnt=counts(g,false),nC=Math.max(courtsOf(d).length,...hist.map(h=>h.c));
  const hrow=h=>{const hi=g.hist.indexOf(h),aw=h.sa>h.sb,tie=h.sa===h.sb,A2=tn(h,0),B2=tn(h,1);
    return '<tr class="tap" data-a="gedit" data-x="'+hi+'"><td style="color:var(--mu)">'+hlab(h)+'</td><td style="font-weight:'+(aw?700:400)+';color:'+(aw||tie?'var(--tx)':'var(--mu)')+'">'+esc(A2)+'</td><td class="d" style="text-align:center;font-size:22px">'+h.sa+' – '+h.sb+'</td><td style="font-weight:'+(!aw&&!tie?700:400)+';color:'+(!aw||tie?'var(--tx)':'var(--mu)')+'">'+esc(B2)+'</td><td><span class="win">'+(tie?'Draw':esc(aw?A2:B2))+'</span></td><td style="text-align:right;font-weight:600">'+fmt(h.s)+'</td></tr>'};
  let groups='';for(let c=1;c<=nC;c++){const hs=hist.filter(h=>h.c===c);if(!hs.length)continue;const st2=hs.reduce((a,h)=>a+h.s,0);
    groups+='<tr class="grp"><td colspan="6">'+esc(cname(d,c-1).toUpperCase())+' · '+pl(hs.length,'game')+' · avg '+fmt(st2/hs.length)+'</td></tr>'+hs.slice().reverse().map(hrow).join('')}
  const red=id=>{if(!g.st)return false;const c=cnt[id]||0,a=att(d,id),tg=target(g,id);if(!a||!a.a)return false;
    if(!c&&(g.en||now)-a.a>20*60e3)return true;if(a.l&&c<tg)return true;if(run&&!a.l){const rem=Math.max(0,sessEnd(d)-now)/60e3;return c+Math.floor(rem/slotOf(g)*2/3)<tg}return false};
  const ppl=[...new Set([...on,...g.ros,...Object.keys(cnt)])].filter(id=>P(id)).sort((a,b)=>(cnt[a]||0)-(cnt[b]||0)||nameOf(a).localeCompare(nameOf(b)));
  const prow=ppl.map(id=>'<tr'+(red(id)?' class="redr"':'')+'><td><span class="pchip" style="'+pchip(id)+';padding:4px 12px;font-size:14px;display:inline-block;background:var(--bg)">'+esc(nameOf(id))+'</span>'+(leftAt(d,id)?' <small style="color:var(--mu)">left '+hm(leftAt(d,id))+'</small>':'')+'</td><td class="d" style="text-align:center;font-size:22px;color:var(--y)">'+(cnt[id]||0)+'</td><td style="text-align:center;font-weight:700" data-tk="tot" data-id="'+id+'"></td></tr>').join('');
  let happ='';if(g.st){const el=on.filter(id=>eligible(d,id)).length,nC2=courtsOf(d).filter((c,i)=>courtOpen(g,i,now)).length,remS=Math.max(0,Math.floor((sessEnd(d)-now)/60e3/slotOf(g)))*Math.max(1,nC2)*4;
    const notes=run?[el+' checked in · '+pl(nC2,'court')+' open'+(el?' → ≈ '+Math.floor(remS/Math.max(1,el))+' more games each possible':''),
      ...(el&&el<nC2*4?['Only '+el+' checked in – some courts wait for more players']:[]),
      ...((S.rules||[]).filter(r=>r.on).map(r=>'Learned rule in use: '+r.why))]:[];
    happ='<section class="pn" style="gap:8px"><div class="sb"><span class="lab">WHAT\'S HAPPENING</span><span class="lab">THE APP ADAPTS UP NEXT BY ITSELF</span></div>'+
     notes.map(x=>'<div class="tip"><span>●</span><span>'+esc(x)+'</span></div>').join('')+
     (g.log.length?g.log.slice(0,14).map(l=>'<div class="tip"><span style="color:var(--mu);min-width:44px">'+hm(l.t)+'</span><span>'+esc(l.m)+'</span></div>').join(''):'<div style="color:var(--mu);font-size:14px">Nothing yet.</div>')+'</section>'}
  return '<div class="sb" style="align-items:flex-end"><div><div class="lab" style="letter-spacing:.18em">DOUBLES · LEVEL-BALANCED · '+esc(dlab(d).toUpperCase())+' · <span style="color:var(--y)">'+esc((D.loc||'').toUpperCase())+'</span></div><h1>'+title+'</h1></div><div class="row">'+ctl+'</div></div>'+
   vSBar(g)+
   (plan?'<div class="warn yel">Planning mode · games planned here wait for '+esc(dlab(d))+'. Start session on match day.</div>':'')+
   (!ended&&!past&&on.length<4?'<div class="warn yel">Only '+pl(on.length,'player')+' on. Turn on at least 4 in Players.</div>':'')+
   (run&&!on.some(id=>arrived(d,id))?'<div class="warn yel">Nobody checked in yet · mark players Arrived in the Players tab.</div>':'')+
   courts+bench+pre+planV+
   (plan?'':'<section class="pn" style="gap:8px"><div class="sb"><span class="lab">GAME SUMMARY · '+esc(dlab(d).toUpperCase())+' · <span style="color:var(--y)">'+esc((D.loc||'').toUpperCase())+'</span></span><span class="row" style="gap:10px"><span class="lab">'+hist.length+' GAMES · AVG '+(hist.length?fmt(tot/hist.length):'00:00')+'</span><button class="gh" style="height:40px;border-style:solid" data-a="gadd">+ Add game manually</button></span></div>'+
   (hist.length?'<div style="font-size:13px;color:var(--mu)">Tap a game to edit or delete it.</div><table><thead><tr><th>GAME</th><th>TEAM A</th><th style="text-align:center">SCORE</th><th>TEAM B</th><th>WINNER</th><th style="text-align:right">TIME</th></tr></thead><tbody>'+groups+'</tbody></table>':'<div class="empty" style="padding:12px">No games saved yet. Tap A won / B won, then Save – or add games manually.</div>')+'</section>'+
   '<section class="pn" style="gap:8px"><div class="sb"><span class="lab">GAMES PLAYED</span><span class="lab">FEWEST FIRST · RED = BEHIND FAIR SHARE</span></div>'+
   (ppl.length?'<table style="width:640px;max-width:100%"><thead><tr><th style="text-align:center">NAME</th><th style="text-align:center">GAMES</th><th style="text-align:center">TOTAL BENCH TIME</th></tr></thead><tbody>'+prow+'</tbody></table>':'<div class="empty" style="padding:12px">No players yet.</div>')+'</section>')+happ}
let lastAuto=0;
function tick(){const now=Date.now();
  if(ui.scr==='home'){const el=document.querySelector('[data-tk="sess"]'),g=S.games[TODAY()];if(el&&g&&g.st)el.textContent=fmtH(((g.en||now)-g.st)/1000);return}
  if(ui.scr!=='app'||ui.tab!=='games')return;const g=S.games[curDate()];if(!g)return;const run=running(g);
  if(g.en&&now-g.en>=REOPEN_MS&&document.querySelector('[data-a="reopen"]'))return render();
  if(run&&now-lastAuto>30e3){lastAuto=now;const cl=g.cur.some((q,i)=>!courtOpen(g,i,now)&&g.nxt[i].some(Boolean));if(autoNext(g,'fill',cl?'A court booking ended · its Up Next was cleared':null)){save();return render()}}
  document.querySelectorAll('[data-tk]').forEach(el=>{const k=el.dataset.tk;
    if(k==='court'){const L=g.live[+el.dataset.i];if(L&&L.run)el.textContent=fmt((now-L.start)/1000)}
    else if(k==='bench'){const s=run&&g.since[el.dataset.id]!=null?(now-g.since[el.dataset.id])/1000:0;el.lastChild.textContent=fmt(s);el.classList.toggle('red',s>900)}
    else if(k==='sess'){if(g.st)el.textContent=fmtH(((g.en||now)-g.st)/1000)}
    else if(k==='left'){const l=courtEnd(g.d,+el.dataset.i)-now;el.textContent=Math.max(0,Math.ceil(l/60e3))+' min left';el.style.color=l<10*60e3?'var(--bad)':l<20*60e3?'var(--y)':'var(--ok)'}
    else if(k==='tot'){const id=el.dataset.id;const s=benchSec(g,id,now);el.textContent=fmtL(s);el.style.color=s>1800?'var(--bad)':'var(--tx)'}})}

/* ---------- manual game / session times ---------- */
function vGE(){const e=ui.ge,g=G(e.d),used=new Set(e.ids.filter(Boolean));
  const opts=k=>'<option value="">Player…</option>'+[...new Set([...active().map(p=>p.id),...e.ids.filter(Boolean)])].filter(id=>P(id)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).filter(id=>id===e.ids[k]||!used.has(id)).map(id=>'<option value="'+id+'"'+(id===e.ids[k]?' selected':'')+'>'+esc(nameOf(id))+' · '+LVN[lvOf(id)]+'</option>').join('');
  const ps=k=>'<select class="gei" data-c="ge_p" data-y="'+k+'">'+opts(k)+'</select>';
  const lb=(l,h)=>'<label class="fl">'+l+h+'</label>';
  const en=e.st&&num(e.du)?hm(tms(e.d,e.st)+num(e.du)*60000):'';
  const wb=x=>'<button class="wonb'+(e.w===x?' on':'')+'" data-a="gewon" data-x="'+x+'">'+(x==='a'?'◀ A won':'B won ▶')+'</button>';
  return '<div class="modal" data-a="closege"><div class="pn" data-a="noop" style="gap:14px"><div class="sb"><div class="laby">'+(e.i<0?'ADD GAME MANUALLY':'EDIT GAME')+' · '+esc(dlab(e.d).toUpperCase())+'</div><button class="ib" data-a="closege">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+lb('TEAM A',ps(0)+ps(1))+lb('TEAM B',ps(2)+ps(3))+'</div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end">'+lb('Score A','<input class="gei" type="number" inputmode="numeric" min="0" value="'+e.sa+'" data-i="ge_sa" id="ge_sa">')+lb('Score B','<input class="gei" type="number" inputmode="numeric" min="0" value="'+e.sb+'" data-i="ge_sb" id="ge_sb">')+'<div class="row" style="gap:6px">'+wb('a')+wb('b')+'</div></div>'+
   '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'+lb('Court','<select class="gei" data-c="ge_c">'+Array.from({length:Math.max(g.courts,e.c)},(_,k)=>'<option value="'+(k+1)+'"'+(e.c==k+1?' selected':'')+'>'+esc(cname(e.d,k))+'</option>').join('')+'</select>')+
   lb('Start time','<input class="gei" type="time" value="'+e.st+'" data-i="ge_st">')+lb('Duration (min)','<input class="gei" type="number" inputmode="numeric" min="1" value="'+e.du+'" data-i="ge_du" id="ge_du">')+lb('End time','<input class="gei" type="time" value="'+en+'" data-i="ge_en" id="ge_en">')+'</div>'+
   '<div class="sb">'+(e.i<0?'<span></span>':'<button class="ol" style="color:var(--bad);border-color:var(--bad)" data-a="gedel">Delete game</button>')+'<button class="btn" data-a="gesave">Save game</button></div></div></div>'}
function vSE(){const e=ui.se,g=G(e.d),run=running(g);const lb=(l,h)=>'<label class="fl">'+l+h+'</label>';
  return '<div class="modal" data-a="closese"><div class="pn" data-a="noop" style="gap:14px;width:min(520px,92vw)"><div class="sb"><div class="laby">SESSION TIMES · '+esc(dlab(e.d).toUpperCase())+'</div><button class="ib" data-a="closese">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+lb('Start','<input class="gei" type="time" value="'+e.st+'" data-i="se_st">')+(run?lb('End','<div class="gei" style="display:flex;align-items:center;color:var(--mu)">Running</div>'):lb('End','<input class="gei" type="time" value="'+e.en+'" data-i="se_en">'))+'</div>'+
   '<div style="font-size:14px;color:var(--mu)">Used for played vs booked hours'+(run?'.':' and bench time of manually entered games.')+'</div><div class="sb"><span></span><button class="btn" data-a="sesave">Save times</button></div></div></div>'}
function geSave(){const e=ui.ge,g=G(e.d);if(e.ids.some(x=>!x)||new Set(e.ids).size<4)return toast('Pick 4 different players');
  const st=tms(e.d,e.st),du=num(e.du);if(!st||du<=0)return toast('Enter start time and duration');const sa=Math.max(0,Math.round(num(e.sa))),sb=Math.max(0,Math.round(num(e.sb)));
  const o=e.i>=0?g.hist[e.i]:null;const h={r:o?o.r:0,c:+e.c||1,ids:e.ids.slice(),a:[nameOf(e.ids[0]),nameOf(e.ids[1])],b:[nameOf(e.ids[2]),nameOf(e.ids[3])],sa,sb,s:Math.round(du*60),at:st+du*60000,m:o?o.m:1};
  if(o)g.hist[e.i]=h;else g.hist.push(h);g.hist.sort((x,y)=>y.at-x.at);g.man=1;g.ros=[...new Set([...(g.ros||[]),...e.ids])];
  if(!g.st){g.st=Math.min(...g.hist.map(x=>x.at-x.s*1000));g.en=Math.max(...g.hist.map(x=>x.at))}
  else if(!running(g)&&g.en&&h.at>g.en)g.en=h.at;
  if(!isSched(e.d)){const D=day(e.d);D.sch=1}
  ui.ge=null;save();render();toast('Game saved')}
