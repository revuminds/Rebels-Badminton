/* ===== Games ===== */
function vSBar(g){const d=g.d,ps=playMs(g)/1000,ed=!g.en&&d>=TODAY();
  const cs=courtsOf(d).map((c,i)=>'<span class="cbh">'+esc(c.n)+' <b>'+hrsL(num(c.h))+'</b>'+(ed?'<button data-a="gch" data-x="'+i+'" data-y="-0.5" aria-label="Less time">−</button><button data-a="gch" data-x="'+i+'" data-y="0.5" aria-label="More time">+</button>':'')+'</span>').join('');
  return '<div class="sbar"><label class="ptsl">POINTS <input class="ptsin" type="number" inputmode="numeric" min="1" max="99" value="'+esc(g.pts)+'" data-i="g_pts" aria-label="Session points"'+(VIEW()?' disabled':'')+'></label><span>DEUCE '+(g.deuce?'ON · CAP '+capOf(g):'OFF')+' · '+(g.fp?FULL_MIN+' MIN GAMES':Math.round(gameMin(g))+'+'+num(g.chg)+' MIN')+'</span>'+cs+
   '<span style="margin-left:auto;cursor:pointer;text-decoration:underline dotted" data-a="sedit">'+(g.st?'START '+hm(g.st)+(g.en?' · END '+hm(g.en):'')+' · PLAYED <b style="color:var(--tx)" data-tk="sess">'+fmtH(ps)+'</b> / BOOKED '+hrsL(sessLenH(d))+(g.en&&ps>sessLenH(d)*3600+60?' · <b style="color:var(--ok)">+'+Math.round(ps/60-sessLenH(d)*60)+' MIN EXTRA</b>':''):'Booked '+t12((S.days[d]||{}).time)+' · tap to enter times')+'</span></div>'}

function vGames(){const d=curDate();if(!d)return noSess('GAMES');const t=TODAY(),g=G(d),D=day(d),on=onIds(d),plan=d>t,past=d<t,run=running(g),ended=!!g.en,now=Date.now();
  if(!past&&!g.st)ensurePlan(g);if(run)autoNext(g,'fill',null);
  const title=past?'SESSION <span>'+esc(dlab(d).toUpperCase())+'</span>':plan?'PLAN <span>'+esc(dlab(d).toUpperCase())+'</span>':ended?'SESSION <span>ENDED</span>':run?'GAMES <span>LIVE</span>':'READY TO <span>PLAY</span>';
  const pb='<button class="ol" style="border-color:var(--y);color:var(--y)" data-a="ckopen">Players · '+on.filter(id=>arrived(d,id)).length+'/'+on.length+'</button>';
  const ctl=past?'':run?(g.fp?'<button class="ol sm2" data-a="fpre">↻ Re-plan remaining games</button>':'<button class="ol sm2" data-a="reshuffle">↻ Re-pick upcoming</button>')+'<button class="ol" data-a="cts">Courts</button>'+pb+'<button class="ol" style="border-color:var(--bad);color:var(--bad)" data-a="endsess">■ End session</button>':
    ended?'':
    plan?'<button class="btn" disabled>▶ Start session</button>':pb.replace(/Players · \d+\/(\d+)/,'Players · $1')+'<button class="btn sh" data-a="startsess">▶ Start session</button>';
  const onC=new Set(g.cur.flat().filter(Boolean)),inN=new Set(g.nxt.flat().filter(Boolean));
  const benchE=on.filter(id=>!onC.has(id)&&(!run||eligible(d,id)));const pick=benchE.filter(id=>!inN.has(id));
  const quad=(q,i,key,pk,lab)=>{const full=q.every(Boolean);const sa=lvOf(q[0])+lvOf(q[1]),sb=lvOf(q[2])+lvOf(q[3]),df=Math.abs(sa-sb);
    const bal=!full?'FILL ALL 4':'',bc='var(--mu)';
    const slots=q.map((id,k)=>(k===2?'<span class="d" style="color:var(--y);font-size:16px;padding:0 2px">VS</span>':'')+(id?'<span class="slot" style="'+pchip(id)+'"><span style="overflow:hidden;text-overflow:ellipsis">'+esc(nameOf(id))+'</span><button data-a="rmslot" data-x="'+key+'" data-y="'+k+'" aria-label="Remove">×</button></span>':
      '<select class="slotsel" data-c="slot" data-x="'+key+'" data-y="'+k+'" aria-label="Pick a player"><option value="">'+(run?'+ Bench…':'+ Player…')+'</option>'+pk.map(b=>'<option value="'+b+'">'+esc(nameOf(b))+' · '+LVN[lvOf(b)]+'</option>').join('')+'</select>')).join('');
    return '<div class="nm"><div class="sb" style="font-size:12px;font-weight:700;letter-spacing:.1em"><span style="color:var(--mu)">'+lab+(key[0]==='0'&&g.nman[i]?' · <span style="color:var(--y)">PLACED BY YOU</span>':'')+'</span><span style="color:'+bc+'">'+bal+'</span></div><div class="row" style="gap:6px">'+slots+'</div></div>'};
  const courts=run?vLive(g):'';
  let pre='',planV='';
  if(!run&&!ended&&!past&&!g.fp){const rds=[g.nxt,...g.plan],sl=slotOf(g),cnt2={};rds.forEach(rd=>rd.forEach(q=>{if(q.every(Boolean))q.forEach(id=>cnt2[id]=(cnt2[id]||0)+1)}));
    const ng=rds.reduce((a,rd)=>a+rd.filter(q=>q.every(Boolean)).length,0),cap=4*totSlots(g),nC=courtsOf(d).length;
    pre='<section class="pn" style="gap:8px"><div class="sb"><span class="lab">ROUND 1 · '+(plan?'SAVED FOR THIS DATE':'FIRST GAMES ONCE PLAYERS ARRIVE')+'</span><button class="gh" style="height:36px;border-style:solid" data-a="remix">↻ Re-mix</button></div><div class="g2" style="gap:12px">'+g.nxt.map((q,i)=>quad(q,i,'0.'+i,on.filter(id=>!inN.has(id)),esc(cname(d,i).toUpperCase()))).join('')+'</div></section>';
    const og=on.filter(id=>isDum(d,id)),reg=on.filter(id=>!isDum(d,id)),rc=reg.map(id=>cnt2[id]||0),oc=og.map(id=>cnt2[id]||0);
    const rng=a=>{if(!a.length)return '–';const m=Math.min(...a),x=Math.max(...a);return m===x?''+m:m+'–'+x};
    const pmin=Math.ceil(cap/TGT),pmax=Math.floor(cap/TMIN);
    const short=reg.filter(id=>(cnt2[id]||0)<TMIN);
    const tips=[courtsOf(d).map((c,i)=>esc(c.n)+' '+hrsL(num(c.h))+' = '+courtRounds(g,i)+' games').join(' · ')+' → '+totSlots(g)+' game slots = '+cap+' player-slots → '+(pmin===pmax?pl(pmin,'player'):pmin+'–'+pl(pmax,'player'))+' for '+TMIN+'–'+TGT+' games each',
      'Slot '+Math.round(gameMin(g))+' min game'+(learnOn()&&learnG().all?' (learned)':'')+' + '+num(g.chg)+' min changeover = '+Math.round(sl)+' min · '+ng+' games planned',
      'You have '+on.length+' on → '+rng(rc)+' games each',
      on.length<4?'':reg.length>pmax?(reg.length-pmax)+' too many for '+TMIN+'–'+TGT+' games each – add court time':on.length<pmin?'Short by '+pl(pmin-on.length,'player')+' – regulars may get more than '+TGT+' games':'✓ Players fit '+TMIN+'–'+TGT+' games each',
      short.length&&on.length>=4?TMIN+' games not reached for: '+short.map(nameOf).join(', ')+'. Try: more court hours, shorter slot, or fewer players':'',
      on.length>=4&&on.length<nC*6?'Max 2 in a row: '+pl(nC,'court')+' need ≥ '+nC*6+' players to fill every round':'',
      'On the day: only checked-in players get games (Games → Players) · late arrivals get a fair share'].filter(Boolean);
    planV='<section class="pn" style="gap:10px"><div class="sb"><span class="lab">ALL PLANNED GAMES · '+ng+' GAMES · '+rds.length+' ROUNDS</span><span class="lab">TAP × TO SWAP A PLAYER</span></div>'+
     '<div class="g2" style="gap:12px">'+g.plan.map((rd,r)=>{const inR=new Set(rd.flat().filter(Boolean)),pk=on.filter(id=>!inR.has(id));
       return '<div class="prd"><span class="lab" style="color:var(--y)">ROUND '+(r+2)+'</span>'+rd.map((q,i)=>r+1<courtRounds(g,i)?quad(q,i,(r+1)+'.'+i,pk,esc(cname(d,i).toUpperCase())):'').join('')+'</div>'}).join('')+'</div>'+
     '<div class="tipbox"><div class="laby" style="font-size:12px">PLAN TIPS</div>'+tips.map(x=>'<div class="tip"><span>→</span><span>'+esc(x)+'</span></div>').join('')+'</div></section>'}
  const bench='';
  const hist=g.hist,tot=hist.reduce((a,h)=>a+h.s,0),cnt=counts(g,false),nC=Math.max(courtsOf(d).length,...hist.map(h=>h.c));
  const hrow=h=>{const hi=g.hist.indexOf(h),aw=h.sa>h.sb,tie=h.sa===h.sb,A2=tn(h,0),B2=tn(h,1);
    return '<tr class="tap" data-a="gedit" data-x="'+hi+'"><td style="color:var(--mu)">'+hlab(h)+'</td><td style="font-weight:'+(aw?700:400)+';color:'+(aw||tie?'var(--tx)':'var(--mu)')+'">'+esc(A2)+'</td><td class="d" style="text-align:center;font-size:22px">'+h.sa+' – '+h.sb+'</td><td style="font-weight:'+(!aw&&!tie?700:400)+';color:'+(!aw||tie?'var(--tx)':'var(--mu)')+'">'+esc(B2)+'</td><td><span class="win">'+(tie?'Draw':esc(aw?A2:B2))+'</span></td><td style="text-align:right;font-weight:600">'+(h.u?'—':fmt(h.s))+'</td></tr>'};
  let groups='';for(let c=1;c<=nC;c++){const hs=hist.filter(h=>h.c===c);if(!hs.length)continue;const st2=hs.reduce((a,h)=>a+h.s,0);
    groups+='<tr class="grp"><td colspan="6">'+esc(cname(d,c-1).toUpperCase())+' · '+pl(hs.length,'game')+' · avg '+fmt(st2/hs.length)+'</td></tr>'+hs.slice().reverse().map(hrow).join('')}
  const red=id=>{if(!g.st||isDum(d,id))return false;const c=cnt[id]||0,a=att(d,id),tg=target(g,id);if(!a||!a.a)return false;
    if(!c&&(g.en||now)-a.a>20*60e3)return true;if(a.l&&c<tg)return true;if(run&&!a.l){const rem=Math.max(0,sessEnd(d)-now)/60e3;return c+Math.floor(rem/slotOf(g)*2/3)<tg}return false};
  const ppl=[...new Set([...on,...g.ros,...Object.keys(cnt)])].filter(id=>P(id)).sort((a,b)=>(cnt[a]||0)-(cnt[b]||0)||nameOf(a).localeCompare(nameOf(b)));
  const prow=ppl.map(id=>'<tr'+(red(id)?' class="redr"':'')+'><td>'+pwho(id,32,leftAt(d,id)?' · left '+hm(leftAt(d,id)):'')+'</td><td class="d" style="text-align:center;font-size:22px;color:var(--y)">'+(cnt[id]||0)+'</td><td style="text-align:center;font-weight:700" data-tk="tot" data-id="'+id+'"></td></tr>').join('');
  let happ='';if(g.st){const el=on.filter(id=>eligible(d,id)).length,nC2=courtsOf(d).filter((c,i)=>!g.closed[i]).length,remS=Math.max(0,Math.floor((sessEnd(d)-now)/60e3/slotOf(g)))*Math.max(1,nC2)*4;
    const notes=run?[el+' checked in · '+pl(nC2,'court')+' open'+(el?' → ≈ '+Math.floor(remS/Math.max(1,el))+' more games each possible':''),
      ...(el&&el<nC2*4?['Only '+el+' checked in – some courts wait for more players']:[]),
      ...((S.rules||[]).filter(r=>r.on).map(r=>'Learned rule in use: '+r.why))]:[];
    happ='<section class="pn" style="gap:8px"><div class="sb"><span class="lab">WHAT\'S HAPPENING</span><span class="lab">THE APP KEEPS UPCOMING GAMES READY</span></div>'+
     notes.map(x=>'<div class="tip"><span>●</span><span>'+esc(x)+'</span></div>').join('')+
     (g.log.length?g.log.slice(0,14).map(l=>'<div class="tip"><span style="color:var(--mu);min-width:44px">'+hm(l.t)+'</span><span>'+esc(l.m)+'</span></div>').join(''):'<div style="color:var(--mu);font-size:14px">Nothing yet.</div>')+'</section>'}
  return '<div class="sb" style="align-items:flex-end"><div><div class="lab" style="letter-spacing:.18em">DOUBLES · LEVEL-BALANCED · '+esc(dlab(d).toUpperCase())+' · <span style="color:var(--y)">'+esc((D.loc||'').toUpperCase())+'</span></div><h1>'+title+'</h1></div><div class="row">'+ctl+'</div></div>'+
   vSBar(g)+
   (plan?'<div class="warn yel">Planning mode · games planned here wait for '+esc(dlab(d))+'. Start session on match day.</div>':'')+
   (!ended&&!past&&on.length<4?'<div class="warn yel">Only '+pl(on.length,'player')+' on. Turn on at least 4 in Players.</div>':'')+
   (run&&!on.some(id=>arrived(d,id))?'<div class="warn yel" style="justify-content:space-between">Session started · nobody checked in yet. Games begin once players check in.<button class="btn" data-a="ckopen">Check in players</button></div>':'')+
   (noSx(on).length&&!ended&&!past?'<div class="warn yel" style="justify-content:space-between">'+pl(noSx(on).length,'player')+' on without gender – they can’t be scheduled: '+esc(noSx(on).map(nameOf).join(', '))+'<button class="ol sm" data-a="tab" data-x="players">Set in Players</button></div>':'')+
   courts+bench+(g.fp?vFull(g):(!ended&&!past?'<section class="pn" style="gap:8px;flex-direction:row;align-items:center"><div style="flex:1"><div class="lab">FULL SESSION PLAN</div><div style="font-size:14px;color:var(--mu);margin-top:4px">All games for the session up front · '+FULL_MIN+'-min games to 21 · '+fullPer(d).reduce((a,n)=>a+n,0)+' games on '+pl(courtsOf(d).length,'court')+' · print it, enter results later</div></div><button class="btn" data-a="fpplan">📋 Plan full session</button></section>':''))+pre+planV+
   (plan?'':'<section class="pn" style="gap:8px"><div class="sb"><span class="lab">GAME SUMMARY · '+esc(dlab(d).toUpperCase())+' · <span style="color:var(--y)">'+esc((D.loc||'').toUpperCase())+'</span></span><span class="row" style="gap:10px"><span class="lab">'+hist.length+' GAMES · AVG '+(hist.length?fmt(tot/hist.length):'00:00')+'</span><button class="gh" style="height:40px;border-style:solid" data-a="gadd">+ Add game manually</button></span></div>'+
   (hist.length?'<div style="font-size:13px;color:var(--mu)">Tap a game to edit or delete it.</div><table><thead><tr><th>GAME</th><th>TEAM A</th><th style="text-align:center">SCORE</th><th>TEAM B</th><th>WINNER</th><th style="text-align:right">TIME</th></tr></thead><tbody>'+groups+'</tbody></table>':'<div class="empty" style="padding:12px">No games saved yet. Tap A won / B won, then Save – or add games manually.</div>')+'</section>'+
   vGPP(g,ppl))+happ+(!run&&!ended&&!past?'<div class="sb"><span></span><button class="btn" style="min-width:160px" data-a="gsave">Save</button></div>':'')}
let lastAuto=0;
function tick(){const now=Date.now();{const c=document.querySelector('[data-tk="sclk"]'),g0=S.games[TODAY()];if(c&&g0&&g0.st)c.textContent=fmtH(playMs(g0,now)/1000)}
  if(ui.scr==='home'){const el=document.querySelector('[data-tk="sess"]'),g=S.games[TODAY()];if(el&&g&&g.st)el.textContent=fmtH(playMs(g,now)/1000);return}
  if(ui.scr!=='app'||ui.tab!=='games')return;const g=S.games[curDate()];if(!g)return;const run=running(g);
  document.querySelectorAll('[data-tk]').forEach(el=>{const k=el.dataset.tk;
    if(k==='court'){const L=g.live[+el.dataset.i];if(L&&L.run)el.textContent=fmt((now-L.start)/1000)}
    else if(k==='bench'){const s=run&&g.since[el.dataset.id]!=null?(now-g.since[el.dataset.id])/1000:0;el.textContent=s?fmt(s):'';el.classList.toggle('red',s>900)}
    else if(k==='pst'){const p2=pstat(g,el.dataset.id,now);if(el.innerHTML!==p2.t)el.innerHTML=p2.t;el.className='pst '+p2.c}
    else if(k==='sess'){if(g.st)el.textContent=fmtH(playMs(g,now)/1000)}
    else if(k==='left'){const p2=cpill(g.d,+el.dataset.i,now);el.textContent=p2.t;el.className='cpill '+p2.c}
    else if(k==='tot'){const id=el.dataset.id;const s=benchSec(g,id,now);el.textContent=fmtL(s);el.style.color=s>1800?'var(--bad)':'var(--tx)'}})}

/* ---------- Players pop-up: check in / left / dummy ---------- */
function vCk(){const d=curDate(),g=S.games[d],run=running(g),ids=onIds(d),st=id=>{const a=att(d,id);return !a||!a.a?0:a.l?2:1};
  const L=ids.slice().sort((a,b)=>st(a)-st(b)||nameOf(a).localeCompare(nameOf(b))),nIn=ids.filter(id=>st(id)===1).length,nNo=ids.filter(id=>!st(id)).length,nD=ids.filter(id=>isDum(d,id)).length;
  const row=id=>{const a=att(d,id),s=st(id),dm=isDum(d,id);
    const stat=!run?'':s===0?'<button class="btn ckb" data-a="ckin" data-x="'+id+'">Check in</button>':
      s===1?'<button class="att in" style="margin:0;height:44px" data-a="attedit" data-x="'+id+'">In '+hm(a.a)+'</button><button class="ol sm" data-a="ckout" data-x="'+id+'">Left</button>':
      '<button class="att left" style="margin:0;height:44px" data-a="attedit" data-x="'+id+'">Left '+hm(a.l)+'</button><button class="ol sm" data-a="ckback" data-x="'+id+'">Back</button>';
    return '<div class="ckr'+(s===2?' gone':'')+'"><span style="flex:1;min-width:0">'+pwho(id,34)+'</span>'+stat+
      '<button class="dbx'+(dm?' on':'')+'" data-a="ckdum" data-x="'+id+'" aria-label="Tick">'+(dm?'✓':'')+'</button></div>'};
  return '<div class="modal tall" data-a="closeck"><div class="pn" data-a="noop" style="gap:14px;width:min(1040px,95vw)"><div class="sb"><div><div class="laby">PLAYERS · '+esc(dlab(d).toUpperCase())+'</div><div style="font-size:14px;color:var(--mu);margin-top:4px">'+(run?nIn+' checked in · '+nNo+' not here yet':'Check-in opens after Start session')+'</div></div><button class="ib" data-a="closeck" aria-label="Close">×</button></div>'+
   
   (L.length?'<div class="ckg">'+L.map(row).join('')+'</div>':'<div class="empty">No players on. Turn players on in the Players tab.</div>')+
   '<div class="sb"><button class="ol" data-a="ckplayers">Add / remove players</button><button class="btn" data-a="closeck">Done</button></div></div></div>'}
/* ---------- check the 4 players before they go on court ---------- */

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
   lb('Start time (optional)','<input class="gei" type="time" value="'+e.st+'" data-i="ge_st">')+lb('Duration (min)','<input class="gei" type="number" inputmode="numeric" min="1" value="'+e.du+'" data-i="ge_du" id="ge_du">')+lb('End time','<input class="gei" type="time" value="'+en+'" data-i="ge_en" id="ge_en">')+'</div>'+
   '<div class="sb">'+(e.i<0?'<span></span>':'<button class="ol" style="color:var(--bad);border-color:var(--bad)" data-a="gedel">Delete game</button>')+'<button class="btn" data-a="gesave">Save game</button></div></div></div>'}
function vSE(){const e=ui.se,g=G(e.d),run=running(g);const lb=(l,h)=>'<label class="fl">'+l+h+'</label>';
  return '<div class="modal" data-a="closese"><div class="pn" data-a="noop" style="gap:14px;width:min(520px,92vw)"><div class="sb"><div class="laby">SESSION TIMES · '+esc(dlab(e.d).toUpperCase())+'</div><button class="ib" data-a="closese">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+lb('Start','<input class="gei" type="time" value="'+e.st+'" data-i="se_st">')+(run?lb('End','<div class="gei" style="display:flex;align-items:center;color:var(--mu)">Running</div>'):lb('End','<input class="gei" type="time" value="'+e.en+'" data-i="se_en">'))+'</div>'+
   '<div style="font-size:14px;color:var(--mu)">Used for played vs booked hours'+(run?'.':' and bench time of manually entered games.')+'</div><div class="sb"><span></span><button class="btn" data-a="sesave">Save times</button></div></div></div>'}
function geSave(){const e=ui.ge,g=G(e.d);if(e.ids.some(x=>!x)||new Set(e.ids).size<4)return toast('Pick 4 different players');
  const un=!e.st,st=tms(e.d,e.st),du=num(e.du);if(!un&&du<=0)return toast('Enter the duration (or clear the start time)');const sa=Math.max(0,Math.round(num(e.sa))),sb=Math.max(0,Math.round(num(e.sb)));
  const o=e.i>=0?g.hist[e.i]:null,se=scoreErr(sa,sb,gp(g,o));if(se)return toast(se);const h={r:o?o.r:0,c:+e.c||1,ids:e.ids.slice(),a:[nameOf(e.ids[0]),nameOf(e.ids[1])],b:[nameOf(e.ids[2]),nameOf(e.ids[3])],sa,sb,s:un?0:Math.round(du*60),at:un?(o?o.at:(g.st||bookStart(e.d))+(g.hist.length+1)*60000):st+du*60000,m:o?o.m:1};
  if(un)h.u=1;if(o&&o.n)h.n=o.n;if(o&&o.pts)h.pts=o.pts;
  if(o)g.hist[e.i]=h;else g.hist.push(h);g.hist.sort((x,y)=>y.at-x.at);g.man=1;g.ros=[...new Set([...(g.ros||[]),...e.ids])];
  if(!g.st){g.st=Math.min(...g.hist.map(x=>x.at-x.s*1000));g.en=Math.max(...g.hist.map(x=>x.at))}
  else if(!running(g)&&g.en&&h.at>g.en)g.en=h.at;
  if(!isSched(e.d)){const D=day(e.d);D.sch=1}
  ui.ge=null;save();render();toast('Game saved')}
/* End session confirm (v14) – once ended, the session lives in Previous sessions */
function vEnd(){const g=CG();
  return '<div class="modal" data-a="closeend"><div class="pn" data-a="noop" style="gap:16px;width:min(520px,92vw)"><div class="sb"><div class="laby">END SESSION?</div><button class="ib" data-a="closeend" aria-label="Close">×</button></div>'+
   '<div style="font-size:16px;line-height:1.5">All timers stop, scored games are saved and every player is turned off. The session then moves to <b>Previous sessions</b>.</div>'+
   '<div style="display:flex;gap:12px;justify-content:flex-end"><button class="ol" style="height:52px;padding:0 24px" data-a="closeend">Cancel</button><button class="btn" style="height:52px;padding:0 24px;background:var(--bad);color:#fff" data-a="endok">■ End session</button></div></div></div>'}

/* ---------- v16 full session plan view ---------- */
const TYL={MD:"Men's doubles",WD:"Women's doubles",XD:'Mixed doubles'};
function vFull(g){const d=g.d,run=running(g),ended=!!g.en,dn=fpDone(g),cur=fpCur(g),ed=!run&&!ended&&d>=TODAY(),ids=onIds(d).filter(hasSx);
  const hb=n=>g.hist.find(h=>h.n===n),cnt={};g.fp.forEach(x=>{if(!x.x&&x.q.every(Boolean))x.q.forEach(id=>cnt[id]=(cnt[id]||0)+1)});
  const pc=fullIds(g).map(id=>cnt[id]||0),rng=pc.length?(Math.min(...pc)===Math.max(...pc)?Math.min(...pc):Math.min(...pc)+'–'+Math.max(...pc)):'–';
  const ty={MD:0,WD:0,XD:0};g.fp.forEach(x=>{if(!x.x&&x.q.every(Boolean))ty[gType(x.q)]++});
  const slot=(x,k)=>{const id=x.q[k];if(id)return '<span class="slot" style="'+pchip(id)+'"><span style="overflow:hidden;text-overflow:ellipsis">'+esc(nameOf(id))+' <small style="color:var(--mu)">'+(isF(id)?'F':'M')+'</small></span>'+(ed?'<button data-a="rmslot" data-x="f.'+x.n+'" data-y="'+k+'" aria-label="Remove">×</button>':'')+'</span>';
    if(!ed)return '<span class="slot" style="color:var(--mu)">–</span>';const busy=new Set(g.fp.filter(o=>o.r===x.r).flatMap(o=>o.q).filter(Boolean));
    return '<select class="slotsel" data-c="slot" data-x="f.'+x.n+'" data-y="'+k+'" aria-label="Pick a player"><option value="">+ Player…</option>'+ids.filter(b=>!busy.has(b)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(b=>'<option value="'+b+'">'+esc(nameOf(b))+' · '+(isF(b)?'F':'M')+' · '+LVS[lvOf(b)]+'</option>').join('')+'</select>'};
  const st=x=>{const h=hb(x.n);return h?'<span class="badge ok">'+h.sa+' – '+h.sb+'</span>':cur.has(x.n)?'<span class="badge">On court</span>':x.x?'<span class="badge" style="background:var(--bg);color:var(--mu)">Not played</span>':''};
  const open=ed||ui.fpo;
  const pin=x=>{const h=hb(x.n),v=h?(h.pts||g.pts):gp(g,x).pts;return (ed||run)&&!h&&!cur.has(x.n)&&!VIEW()?'<input class="ptsin sm" type="number" inputmode="numeric" min="1" max="99" value="'+v+'" data-i="fp_pts" data-x="'+x.n+'" aria-label="Points for game '+x.n+'">':'<span style="color:var(--mu)">'+v+'</span>'};
  const rows=g.fp.map(x=>'<tr'+(hb(x.n)||x.x?' style="opacity:.6"':'')+'><td class="d" style="font-size:22px;color:var(--y)">'+x.n+'</td><td>'+esc(cname(d,x.c))+'</td><td>'+tyB(x.q)+(x.q.every(Boolean)&&!fmtOK(x.q)?' <span class="badge" title="Format override">OVR</span>':'')+'</td><td>'+pin(x)+'</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">'+slot(x,0)+slot(x,1)+'</div></td><td class="d" style="color:var(--y);text-align:center">VS</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">'+slot(x,2)+slot(x,3)+'</div></td><td>'+st(x)+'</td></tr>').join('');
  const btns=(!ended?'<button class="ol sm" data-a="fpre">↻ Re-plan remaining games</button>':'')+(!fpStarted(g)?'<button class="btn sm" data-a="fpprint">🖨 Print schedule</button>':'')+'<button class="ol sm" style="border-color:var(--y);color:var(--y)" data-a="eropen" data-x="'+d+'">✎ Enter results</button>'+(!g.hist.some(h=>h.n)?'<button class="ol sm" style="color:var(--bad);border-color:var(--bad)" data-a="fpclear">Clear plan</button>':'');
  return '<section class="pn" style="gap:10px"><div class="sb" style="flex-wrap:wrap;gap:10px"><span class="lab">FULL SESSION PLAN · '+g.fp.filter(x=>!x.x).length+' GAMES · '+rng+' EACH · MD '+ty.MD+' · WD '+ty.WD+' · XD '+ty.XD+(dn.size?' · '+dn.size+' PLAYED':'')+'</span><span class="row" style="gap:8px;flex-wrap:wrap">'+btns+'</span></div>'+
   fpNotes(g)+(ed?'<div style="font-size:13px;color:var(--mu)">'+FULL_MIN+' min per game. Tap × to swap a player (checked: same round, gender, format), then print once. The printed schedule is fixed: for no-shows, swap in whoever is available.</div>':run?'<div style="font-size:13px;color:var(--mu)">The games below feed Upcoming in order. Played, on-court, queued and edited games are kept when you re-plan.</div>':'')+
   (open?'<div style="overflow-x:auto"><table><thead><tr><th>GAME</th><th>COURT</th><th>TYPE</th><th>PTS</th><th>TEAM A</th><th></th><th>TEAM B</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(ed?'':'<button class="lnk" data-a="fpo">Hide games ▴</button>'):'<button class="lnk" style="align-self:flex-start" data-a="fpo">Show all '+g.fp.length+' planned games ▾</button>')+'</section>'}
function vFullPrint(g){const d=g.d,D=S.days[d]||{},n=new Set(g.fp.flatMap(x=>x.q).filter(Boolean)).size,tm=a=>a.filter(Boolean).map(nameOf).map(esc).join(' &amp; ');
  return '<h1>Rebels Badminton – game schedule</h1><div class="m">'+dlab(d)+' '+d.slice(0,4)+' · '+esc(D.loc||'')+' · '+courtSum(d)+' · '+t12(D.time)+' · '+n+' players</div>'+
   '<div class="lg">MD = men’s doubles · WD = women’s doubles · XD = mixed doubles</div>'+
   '<table><thead><tr><th>GAME NO.</th><th>COURT</th><th>TYPE</th><th>TEAM A</th><th style="text-align:center">SCORE</th><th>TEAM B</th><th>✓</th></tr></thead><tbody>'+
   g.fp.filter(x=>!x.x&&x.q.some(Boolean)).map(x=>'<tr><td class="no">'+x.n+'</td><td>'+esc(cname(d,x.c))+'</td><td>'+gType(x.q)+'</td><td>'+tm(x.q.slice(0,2))+'</td><td style="text-align:center;white-space:nowrap"><span class="bx"></span> – <span class="bx"></span></td><td>'+tm(x.q.slice(2))+'</td><td><span class="bx" style="width:6mm"></span></td></tr>').join('')+'</tbody></table>'}
/* enter results after the session: Game 1, 2, 3 … as printed */
function erInit(d){const g=G(d),r={};(g.fp||[]).forEach(x=>{const h=g.hist.find(o=>o.n===x.n);r[x.n]=h?{sa:h.sa,sb:h.sb,p:'y'}:{sa:'',sb:'',p:x.x?'n':''}});ui.er={d,r};render()}
function vER(){const e=ui.er,g=G(e.d),d=e.d;if(!g.fp)return '';const tm=a=>esc(a.filter(Boolean).map(nameOf).join(' & ')||'–');
  const row=x=>{const r=e.r[x.n]||{};const pb=(v,l)=>'<button class="'+(r.p===v?'btn':'ol')+' sm" style="min-width:0;padding:0 10px'+(v==='n'&&r.p==='n'?';background:var(--bad);color:#fff':'')+'" data-a="erp" data-x="'+x.n+'" data-y="'+v+'">'+l+'</button>';
    return '<tr><td class="d" style="font-size:22px;color:var(--y)">'+x.n+'</td><td style="font-size:13px;color:var(--mu)">'+esc(cname(d,x.c))+' · '+gType(x.q)+' · to '+gp(g,x).pts+'</td><td>'+tm(x.q.slice(0,2))+'</td><td style="white-space:nowrap"><input class="gei" style="width:64px;height:44px;text-align:center" type="number" inputmode="numeric" min="0" value="'+esc(r.sa)+'" data-i="er_sa" data-x="'+x.n+'"> – <input class="gei" style="width:64px;height:44px;text-align:center" type="number" inputmode="numeric" min="0" value="'+esc(r.sb)+'" data-i="er_sb" data-x="'+x.n+'"></td><td>'+tm(x.q.slice(2))+'</td><td style="white-space:nowrap">'+pb('y','✓ Played')+' '+pb('n','✗ Not played')+'</td></tr>'};
  return '<div class="modal tall" data-a="closeer"><div class="pn" data-a="noop" style="gap:14px;width:min(1100px,96vw)"><div class="sb"><div><div class="laby">ENTER RESULTS · '+esc(dlab(d).toUpperCase())+'</div><div style="font-size:14px;color:var(--mu);margin-top:4px">Same numbers as the printed schedule. Type the score – a typed score counts as played. Untimed games are fine.</div></div><button class="ib" data-a="closeer" aria-label="Close">×</button></div>'+
   '<div style="overflow:auto;max-height:62vh"><table><thead><tr><th>GAME</th><th></th><th>TEAM A</th><th>SCORE</th><th>TEAM B</th><th>PLAYED?</th></tr></thead><tbody>'+g.fp.map(row).join('')+'</tbody></table></div>'+
   '<div class="sb"><button class="ol" data-a="closeer">Cancel</button><button class="btn" data-a="ersave">Save results</button></div></div></div>'}
function erSave(){const e=ui.er,d=e.d,g=G(e.d),base=g.st||bookStart(d),bad=[];let n=0;
  g.fp.forEach(x=>{const r=e.r[x.n]||{},has=(r.sa!==''&&r.sa!=null)||(r.sb!==''&&r.sb!=null),p=r.p||(has?'y':''),hi=g.hist.findIndex(h=>h.n===x.n);
    if(p==='n'){x.x=1;if(hi>=0&&g.hist[hi].u)g.hist.splice(hi,1);return}if(p!=='y')return;
    if(!x.q.every(Boolean)||new Set(x.q).size<4){bad.push(x.n);return}x.x=0;n++;
    const sa=Math.max(0,Math.round(num(r.sa))),sb=Math.max(0,Math.round(num(r.sb))),se=scoreErr(sa,sb,gp(g,x));if(se){bad.push(x.n+' ('+se+')');n--;return}
    if(hi>=0)Object.assign(g.hist[hi],{sa,sb});else g.hist.push(Object.assign({r:x.n,n:x.n,c:x.c+1,ids:x.q.slice(),a:[nameOf(x.q[0]),nameOf(x.q[1])],b:[nameOf(x.q[2]),nameOf(x.q[3])],sa,sb,s:0,u:1,m:1,at:base+(x.r+1)*FULL_MIN*60e3},x.pts?{pts:x.pts}:{}))});
  g.hist.sort((a,b)=>b.at-a.at);g.ros=[...new Set([...(g.ros||[]),...g.hist.flatMap(h=>h.ids)])];
  if(!g.st){g.st=base;g.en=Math.max(sessEnd(d),...g.hist.map(h=>h.at))}if(!isSched(d))day(d).sch=1;
  ui.er=null;save();render();toast(pl(n,'game')+' saved'+(bad.length?' · game '+bad.join(', ')+' skipped – fill all 4 players / fix the score':''))}

/* ---------- v17 Games page: format badge, plan notes, games-per-player table ---------- */
const tyB=q=>{const t=gType(q);return '<span class="fmt f'+t+'">'+t+'</span>'};
function fpNotes(g){const d=g.d,ri=rateInfo(g),ids=fullIds(g),W=ids.filter(isF),L=[];
  if(ri.over)L.push(['amb',ri.part+' players on '+pl(ri.nC,'court')+' (target needs ≤ '+ri.nC*8+') → about '+ri.rate.toFixed(1)+' games per hour each instead of '+RATE+'. Games are still shared fairly.']);
  else if(ri.part)L.push(['ok',ri.part+' players · about '+Math.min(ri.rate,6).toFixed(1)+' games per hour each (target '+RATE+')']);
  if(W.length===1)L.push(['amb','Only 1 woman on – mixed games need 2 women, so '+nameOf(W[0])+' can only play via a manual swap (format override).']);
  const P0=planCtx(g,ids);if(P0.power)L.push(['ok','Power games: '+P0.pwOK.size+' strong players · each gets '+PWR()+' per hour; their other games are mentor games']);
  else if(ids.filter(isStrong).length)L.push(['mu','Fewer than 4 strong players who can form a legal game → mentor games only']);
  const dm=ids.filter(id=>isDum(d,id));if(dm.length)L.push(['mu','Fill-ins ('+dm.map(nameOf).join(', ')+'): used only for gaps and to rest players after 2 games in a row']);
  return L.map(([c,m])=>'<div class="note '+c+'">'+esc(m)+'</div>').join('')}
function vGPP(g,ppl){const d=g.d,run=running(g),hrs=Math.max(.5,sessLenH(d)),now=Date.now(),cnt=counts(g,false),win={},dn=fpDone(g),cur=fpCur(g),pln={},rr={};
  g.hist.forEach(h=>{if(h.sa===h.sb)return;(h.sa>h.sb?h.ids.slice(0,2):h.ids.slice(2)).forEach(id=>win[id]=(win[id]||0)+1)});
  let R=0;if(g.fp){R=Math.max(0,...g.fp.map(x=>x.r+1));g.fp.forEach(x=>{if(x.x)return;x.q.forEach(id=>{if(!id)return;(rr[id]=rr[id]||new Set()).add(x.r);if(!dn.has(x.n))pln[id]=(pln[id]||0)+1})})}
  const frac=run&&g.st?Math.min(1,playMs(g,now)/(hrs*3600e3)):g.en?1:0;
  const rows=ppl.map(id=>{const fi=isDum(d,id),pres=g.st&&att(d,id)?Math.min(1,presentSec(g,id)/(hrs*3600)||1):1,tg=fi?0:Math.max(1,Math.round(RATE*hrs*pres)),pc=cnt[id]||0,pn=pln[id]||0;
    const st=fi?'gr':frac?(pc>=Math.floor(tg*frac+1e-9)?'ok':'amb'):(pc+pn>=tg?'ok':'amb'),rs=g.fp?R-(rr[id]?rr[id].size:0):'–';
    return '<tr class="gpp '+st+'"><td>'+pwho(id,30)+'</td><td><span class="sxt'+(isF(id)?' f':'')+'">'+(isF(id)?'F':'M')+'</span></td><td class="n">'+pc+'</td><td class="n">'+pn+'</td><td class="n">'+(win[id]||0)+'</td><td class="n">'+rs+'</td><td class="n">'+(fi?'fill-in':tg)+'</td><td><span class="dot '+st+'"></span></td></tr>'}).join('');
  const open=ui.gpo!==0;
  return '<section class="pn" style="gap:8px"><button class="mhead" data-a="gpo"><span class="lab">GAMES PER PLAYER · TARGET '+RATE+'/HOUR · GREEN ON TARGET · AMBER BEHIND</span><span>'+(open?'▴':'▾')+'</span></button>'+
   (open?(ppl.length?'<div style="overflow-x:auto"><table class="gppt"><thead><tr><th>PLAYER</th><th>M/F</th><th class="n">PLAYED</th><th class="n">PLANNED</th><th class="n">WINS</th><th class="n">RESTED ROUNDS</th><th class="n">TARGET</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty" style="padding:12px">No players yet.</div>'):'')+'</section>'}
