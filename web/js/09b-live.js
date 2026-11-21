/* ===== v12 live Games: courts stacked, per-court queues (max 3), Upcoming games pool, All players ===== */
/* booked hours are a guide only: after the booked end the court stays fully usable until closed in Courts */
function cpill(d,i,t){const l=courtEnd(d,i)-t;return l>0?{t:Math.ceil(l/60e3)+' min left',c:l<10*60e3?'bad':l<20*60e3?'yel':'ok'}:{t:'+'+Math.max(1,Math.floor(-l/60e3))+' min over · still open',c:'over'}}
/* v13: live status under names in Upcoming / queue cards (instead of Level) */
function cno(d,i){const m=String(cname(d,i)).match(/\d+/);return m?m[0]:String(i+1)}
function pstat(g,id,now){const d=g.d;for(let i=0;i<g.cur.length;i++)if(g.cur[i]&&g.cur[i].includes(id)&&g.cur[i].every(Boolean))return{t:'<i class="gdot"></i>C:'+esc(cno(d,i)),c:'ston'};
  if(!arrived(d,id))return{t:'Not here',c:'stno'};if(leftAt(d,id))return{t:'Left '+hm(leftAt(d,id)),c:'stno'};
  const m=g.since[id]!=null&&running(g)?Math.floor((now-g.since[id])/60e3):0;return{t:'Idle '+m+' min',c:m>15?'stid red':'stid'}}
const pstw=(g,id,sz,now)=>{const s=pstat(g,id,now);return '<span class="pwho">'+pav(id,sz)+'<span class="pnm"><b>'+esc(nameOf(id))+'</b><small class="pst '+s.c+'" data-tk="pst" data-id="'+id+'">'+s.t+'</small></span></span>'};
function vLive(g){const d=g.d,now=Date.now(),im=inGames(g),pk=ui.pick,C=courtsOf(d);
  const isSel=(t,i,k,s)=>!!(pk&&pk.t===t&&pk.i==i&&pk.k==k&&pk.s==s);
  const slot=(t,i,k,s,id)=>id?'<span class="gn">'+pstw(g,id,30,now)+'<button class="gx" data-a="gx" data-x="'+t+'.'+i+'.'+k+'" data-y="'+s+'" aria-label="Remove '+esc(nameOf(id))+'">×</button></span>':
    '<button class="gadd'+(isSel(t,i,k,s)?' on':'')+'" data-a="gpick" data-x="'+t+'.'+i+'.'+k+'" data-y="'+s+'">'+(isSel(t,i,k,s)?'Pick below ↓':'+ Add player')+'</button>';
  const row=(t,i,k,q)=>'<div class="grow">'+slot(t,i,k,0,q[0])+slot(t,i,k,1,q[1])+'<span class="vs">VS</span>'+slot(t,i,k,2,q[2])+slot(t,i,k,3,q[3])+'</div>';
  const dup=q=>q.some(id=>id&&(im[id]||0)>1);
  const lines='<div class="l1"></div><div class="l2" style="left:36%"></div><div class="l2" style="right:36%"></div><div class="net"></div>';
  const openC=C.map((c,i)=>i).filter(i=>!g.closed[i]);
  const courts=C.map((c,i)=>{const q=g.cur[i]||NUL4(),L=g.live[i]||blankLive(),full=q.every(Boolean),cl=!!g.closed[i],n=g.hist.filter(h=>h.c===i+1).length,Q=qOf(g,i),pi=cpill(d,i,now),nk=full||cl?-1:nextFor(g,i),nx=nk>=0?g.up[nk]:null;
    const secs=L.run?(now-L.start)/1000:(L.el||0);
    const ed=ui.ced===i&&full&&L.run;
    const btn=cl?'':full?'<button class="tbtn'+(L.run?' run':'')+'" data-a="timer" data-x="'+i+'">'+(L.run?'■ Stop &amp; save':(L.sa||L.sb||L.el)?'✓ Save':'▶ Start')+'</button>'+(L.run?(ed?'<button class="tbtn done" data-a="cedx">✓ Done</button>':'<button class="tbtn edt" data-a="ced" data-x="'+i+'" aria-label="Change players on '+esc(c.n)+'">✎ Edit</button>'):'')+(L.run||L.sa||L.sb||L.el?'<button class="tbtn nos" data-a="savenos" data-x="'+i+'" title="Save the game with no score – the 4 players send it from the live page">■ Save · score from players</button>':''):
      '<button class="tbtn" data-a="cfopen" data-x="'+i+'"'+(nx?'':' disabled')+'>▶ Start next</button>';
    const head='<div class="chead'+(cl?' off':'')+'">'+(ui.cne===i?'<input class="cnin" id="cnin" value="'+esc(c.n)+'" data-i="cn" data-x="'+i+'" aria-label="Court name" autocomplete="off">':'<span class="cntx">'+esc(c.n)+'</span><button class="cnp" data-a="cnedit" data-x="'+i+'" aria-label="Rename court">✎</button>')+'<span class="cinfo">Booked till '+hm(courtEnd(d,i))+' · '+pl(n,'game')+' played</span>'+
      (cl?'<span class="cpill shut">Closed '+hm(g.closed[i])+'</span>':'<span class="cpill '+pi.c+'" data-tk="left" data-i="'+i+'">'+pi.t+'</span>')+(full?tyB(q)+'<label class="ptsl">TO <input class="ptsin sm" type="number" inputmode="numeric" min="1" max="99" value="'+gp(g,L).pts+'" data-i="lv_pts" data-x="'+i+'" aria-label="Points for this game"'+(VIEW()?' disabled':'')+'></label>':'')+'<span style="flex:1"></span>'+
      (full?'<span class="tdot'+(L.run?' run':'')+'"></span><span class="d ctm" data-tk="court" data-i="'+i+'">'+fmt(secs)+'</span>':'')+btn+'</div>';
    let body;
    if(full){const cp=k=>'<div class="cpl'+(isSel('c',i,0,k)?' on':'')+'">'+pwho(q[k],36)+(!L.run||ed?'<button class="swp" data-a="cswap" data-x="'+i+'" data-y="'+k+'" aria-label="Swap '+esc(nameOf(q[k]))+'">⇄ Swap</button>':'')+'</div>';
      const sc=(v,side)=>'<div class="scg"><button class="sc" data-a="sc" data-x="'+i+'" data-y="'+side+'-">−</button><span class="scn">'+v+'</span><button class="sc p" data-a="sc" data-x="'+i+'" data-y="'+side+'+">+</button></div>';
      const wb=s=>'<button class="wonb'+(L.w===s?' on':'')+'" data-a="won" data-x="'+i+'" data-y="'+s+'">'+(L.w===s?'✓ ':'')+(s==='a'?'◀ A won':'B won ▶')+'</button>';
      /* v21: vertical court graphic – Team A in the top service boxes, Team B at the bottom, score + winner on the net */
      body=(ed?'<div class="note ok cedn">Change players: tap ⇄ Swap, then a name in All players · timer and score keep running · tap ✓ Done when finished</div>':'')+'<div class="vcourt">'+VCRT+
        [0,1,2,3].map(k=>'<div class="vbox b'+k+'">'+cp(k)+'</div>').join('')+'<div class="vmid">'+sc(L.sa,'a')+'<div class="row" style="gap:6px">'+wb('a')+wb('b')+'</div>'+sc(L.sb,'b')+'</div><span class="vlab ta">TEAM A</span><span class="vlab tb">TEAM B</span></div>'}
    else{const last=g.last[i];body='<div class="vcourt free'+(cl?' shut':'')+'">'+VCRT+'<div class="cwait vwait">'+(last?'<span style="font-size:15px">Last: '+esc(tn(last,0))+' <b>'+(last.sa||last.sb?last.sa+' – '+last.sb:'score pending')+'</b> '+esc(tn(last,1))+'</span>':'')+
      '<span>'+(cl?'Court closed · reopen it with the Courts button':nx?'Court free · ▶ Start next takes '+(nx.n?'G'+nx.n:'Upcoming #'+(nk+1)):g.up.length?'Court free · every upcoming game has a player on court – wait or edit one':'Court free')+'</span></div></div>'}
    /* v23: queue = the games assigned to this court in Upcoming · names only */
    const T2=q=>esc(q.slice(0,2).map(id=>id?nameOf(id):'?').join(' & '))+' <span class="vs">vs</span> '+esc(q.slice(2).map(id=>id?nameOf(id):'?').join(' & '));
    const qb=cl?'':'<div class="qbox" data-drop="c" data-i="'+i+'"><span class="lab">NEXT ON '+esc(String(c.n).toUpperCase())+' · '+Q.length+'/3</span>'+
      (Q.length?Q.map((x,k)=>'<div class="qnm"><span class="qtag'+(k?'':' nx')+'">'+(k?'THEN':'NEXT')+(x.n?' · G'+x.n:'')+'</span><span class="qnt">'+T2(x.q)+'</span></div>').join(''):
       '<div class="qempty">Empty · tap Assign on an upcoming game, or drag one here</div>')+'</div>';
    return '<section class="cblock" data-drop="c" data-i="'+i+'">'+head+body+qb+'</section>'}).join('');
  /* v23: warnings on upcoming games – a player on court now, or twice in the same round of the plan */
  const fpR={};(g.fp||[]).forEach(x=>fpR[x.n]=x.r);const inR={};g.up.forEach(x=>{if(x.n&&fpR[x.n]!=null)x.q.forEach(id=>{if(id){const k=fpR[x.n]+'|'+id;(inR[k]=inR[k]||[]).push(x.n)}})});
  const warn=x=>{const w=clashOf(g,x.q).map(o=>'⚠ '+nameOf(o.id)+' on '+cname(d,o.i));if(x.n&&fpR[x.n]!=null)x.q.forEach(id=>{const L=id&&inR[fpR[x.n]+'|'+id];if(L&&L.length>1)w.push('⚠ '+nameOf(id)+' also in G'+L.filter(n=>n!==x.n).join(', G')+' (same round)')});
    return w.length?'<div class="gwarn">'+esc(w.join(' · '))+'</div>':''};
  const up='<section class="upbox"><div class="uph">UPCOMING GAMES</div><div class="ups">'+pl(g.up.length,'game')+(g.fp?' · from your full session plan':' · auto-picked')+' · × removes a player, then tap a name in All players</div>'+
    (g.up.length?g.up.map((x,k)=>'<div class="gcard'+(dup(x.q)&&!g.fp?' dup':'')+'" data-drop="u" data-k="'+k+'"><span class="hdl" data-drag="u.0.'+k+'" aria-label="Drag">≡</span>'+(x.n?'<span class="qtag">G'+x.n+' · '+esc(cno(d,x.c))+' · '+gType(x.q)+'</span>':'')+row('u',0,k,x.q)+
      '<button class="gcb'+(x.ac!=null?' on':'')+'" style="flex:none" data-a="asg" data-x="'+k+'"'+(openC.length?'':' disabled')+'>'+(x.ac!=null?esc(cname(d,x.ac)):'Assign')+' ▾</button>'+warn(x)+'</div>').join(''):
     '<div class="qempty">Upcoming games appear once 4 players are checked in (Players button).</div>')+'</section>';
  const ids=onIds(d),where=id=>{for(let i=0;i<g.cur.length;i++)if(g.cur[i]&&g.cur[i].includes(id))return 'On '+cname(d,i);for(let i=0;i<g.cur.length;i++){const k=qOf(g,i).findIndex(x=>x.q.includes(id));if(k>=0)return (k?'Then':'Next')+' on '+cname(d,i)}
    const k=g.up.findIndex(x=>x.q.includes(id));return k>=0?'Upcoming #'+(k+1):''};
  const w=id=>g.since[id]!=null?now-g.since[id]:-1,rk=id=>!arrived(d,id)?2:leftAt(d,id)?3:0;
  const L=ids.slice().sort((a,b)=>rk(a)-rk(b)||w(b)-w(a)||nameOf(a).localeCompare(nameOf(b)));
  const card=id=>{const r=rk(id),wh=r?'':where(id),st=r===2?'Not here yet':r===3?'Left '+hm(leftAt(d,id)):(wh||'Free')+((im[id]||0)>1?' · in '+im[id]+' games':'');
    return '<button class="apc'+(r?' gr':wh?'':' free')+'" data-a="apick" data-x="'+id+'">'+pav(id,42)+'<span class="pnm" style="flex:1"><b>'+esc(nameOf(id))+'</b><small>Level: '+LVS[lvOf(id)]+'</small><em>'+esc(st)+' · Games: '+((RING||{})[id]||0)+'</em></span>'+(r?'':'<span class="aw" data-tk="bench" data-id="'+id+'"></span>')+'</button>'};
  const allp='<section class="pn" id="allp" style="gap:10px"><div class="sb"><span class="lab">WAITING · ALL PLAYERS</span><span class="laby" style="font-size:12px">'+(pk?(pk.t==='c'?'Tap a name to swap onto '+esc(cname(d,pk.i)):'Tap a name to fill the slot')+' · <button class="lnk" data-a="pickx">Cancel</button>':'Tap × on a player, then a name here')+'</span></div>'+
    (L.length?'<div class="apg">'+L.map(card).join('')+'</div>':'<div class="empty" style="padding:12px">No players on.</div>')+'</section>';
  const nc=C.length;
  return '<div class="cgrid" data-n="'+Math.min(nc,3)+'" style="--cols:'+Math.min(nc,2)+'">'+courts+'</div>'+up+allp}
/* v21: court drawing (same look as the live page): blue surround, green court, white lines, black net. Stretched to fit – never taller than the screen. */
const VCRT='<svg class="vsvg" viewBox="0 0 700 1440" preserveAspectRatio="none" aria-hidden="true"><rect width="700" height="1440" fill="#2D6FA8"/><rect x="45" y="50" width="610" height="1340" fill="#2E8B57"/>'+
 '<g fill="none" stroke="#fff" stroke-width="3"><rect x="45" y="50" width="610" height="1340" vector-effect="non-scaling-stroke"/><path vector-effect="non-scaling-stroke" d="M91 50V1390M609 50V1390M45 126H655M45 1314H655M45 522H655M45 918H655M350 50V522M350 918V1390"/></g>'+
 '<path d="M20 720H680" stroke="#111" stroke-width="5" vector-effect="non-scaling-stroke"/><path d="M20 712V728M680 712V728" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"/></svg>';

/* ---------- check the 4 players before the game starts ---------- */
function cfGame(g){const c=ui.cf;if(!c)return null;return g.up[c.k]||null}
function vCf(){const g=CG(),d=g.d,i=ui.cf.i,x=cfGame(g);if(!x)return '';const q=x.q;
  const pool=onIds(d).filter(id=>!leftAt(d,id)||q.includes(id));
  const sel=k=>{const cur=q[k];return '<div class="row" style="gap:8px">'+(cur?pav(cur,38):'')+'<select class="gei cfs" data-c="cfslot" data-y="'+k+'"><option value="">Player…</option>'+[...new Set([cur,...pool].filter(Boolean))].filter(id=>id===cur||!q.includes(id)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(id=>'<option value="'+id+'"'+(id===cur?' selected':'')+'>'+esc(nameOf(id))+' · Level: '+LVS[lvOf(id)]+(arrived(d,id)?'':' · not checked in')+'</option>').join('')+'</select></div>'};
  const full=q.every(Boolean)&&new Set(q).size===4,busy=q.filter(id=>id&&g.cur.some((c,j)=>j!==i&&c&&c.includes(id))),nh=q.filter(id=>id&&!eligible(d,id));
  const team=(l,a,b)=>'<div style="background:var(--bg);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0"><div class="lab">'+l+'</div>'+sel(a)+sel(b)+'</div>';
  const msg=busy.length?'<b style="color:var(--bad)">'+esc(busy.map(nameOf).join(', '))+' still on court – swap or wait</b>':nh.length?'<span style="color:var(--y)">'+esc(nh.map(nameOf).join(', '))+' will be checked in now</span>':!full?'<span style="color:var(--mu)">Fill all 4</span>':'<span></span>';
  return '<div class="modal" data-a="closecf"><div class="pn" data-a="noop" style="gap:16px"><div class="sb"><div class="laby">SEND TO '+esc(cname(d,i).toUpperCase())+' · CHECK THE 4 PLAYERS</div><button class="ib" data-a="closecf">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center">'+team('TEAM A',0,1)+'<span class="d" style="color:var(--y);font-size:28px">VS</span>'+team('TEAM B',2,3)+'</div>'+
   '<div class="sb">'+msg+'<span style="font-size:13px;color:var(--mu)">Swap anyone here · your choice always wins</span></div>'+
   '<div class="sb"><button class="ol" data-a="closecf">Cancel</button><button class="btn sh" data-a="cfok"'+(full&&!busy.length?'':' disabled')+'>✓ Confirm · start game ▶</button></div></div></div>'}

/* ---------- Courts pop-up: the only place a court is closed (reopen within 10 min) ---------- */
const CLOSE_MS=10*60e3;
function vAsg(){const g=CG(),d=g.d,k=ui.asg-1;if(!g||!g.up[k]){ui.asg=0;return ''}const x=g.up[k],cl=clashOf(g,x.q);
  return '<div class="modal" data-a="asgx"><div class="pn" data-a="noop" style="gap:12px;width:min(520px,92vw)"><div class="sb"><div class="laby">ASSIGN TO COURT</div><button class="ib" data-a="asgx" aria-label="Close">×</button></div>'+
   courtsOf(d).map((c,i)=>{if(g.closed[i])return '';const n=qOf(g,i).filter(o=>o!==x).length,me=x.ac===i,bad=cl.filter(o=>o.i!==i),f=!me&&(n>=3||bad.length);
     return '<button class="ckr asgr" style="padding:10px 14px;text-align:left;width:100%'+(f?';opacity:.45':'')+(me?';border-color:var(--y)':'')+'" data-a="asgc" data-x="'+i+'"'+(f?' disabled':'')+'><span style="flex:1;font-weight:700;font-size:17px">'+(me?'✓ ':'')+esc(c.n)+' <small style="color:'+(bad.length?'var(--bad)':'var(--mu)')+';font-weight:500">'+(bad.length?'⚠ '+esc(bad.map(o=>nameOf(o.id)+' on '+cname(d,o.i)).join(', ')):'Booked till '+hm(courtEnd(d,i))+' · queue '+n+'/3'+(n>=3?' · full':''))+'</small></span></button>'}).join('')+
   (x.ac!=null?'<button class="ol" data-a="asgu">Unassign · back to Upcoming only</button>':'')+'</div></div>'}
function vCts(){const g=CG(),d=g.d,now=Date.now();
  return '<div class="modal" data-a="closects"><div class="pn" data-a="noop" style="gap:12px;width:min(620px,92vw)"><div class="sb"><div class="laby">COURTS</div><button class="ib" data-a="closects">×</button></div>'+
   courtsOf(d).map((c,i)=>{const cl=g.closed[i],pi=cpill(d,i,now);return '<div class="ckr" style="padding:10px 14px"><span style="flex:1;font-weight:700;font-size:17px">'+esc(c.n)+' <small style="color:var(--mu);font-weight:500">'+(cl?'Closed at '+hm(cl):'Open · '+pi.t)+'</small></span>'+
     (!cl?'<button class="ol sm" style="color:var(--bad);border-color:var(--bad)" data-a="ctclose" data-x="'+i+'">Close court</button>':now-cl<CLOSE_MS?'<button class="btn sm" data-a="ctopen" data-x="'+i+'">Reopen</button>':'<span style="color:var(--mu)">Closed</span>')+'</div>'}).join('')+
   '<div style="font-size:13px;color:var(--mu)">Booked hours are a guide only – courts stay open after the booked time until you close them here. Extra time does not change Finance.</div></div></div>'}

/* ---------- live game actions ---------- */
const gRef=(g,x)=>{const a=String(x).split('.');const L=gList(g,a[0],+a[1]);return L?L[+a[2]]:null};
function pickScroll(){ui.pickY=window.scrollY;render();const el=$('#allp');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}
function pickName(id){const g=CG(),pk=ui.pick,d=g.d,t=Date.now();ui.pick=null;
  if(pk.t==='c'){const q=g.cur[pk.i];if(!q||!q[pk.s])return render();const old=q[pk.s];if(old===id)return render();
    const bi=g.cur.findIndex((c,j)=>c&&c.includes(id));if(bi>=0){render();return toast(nameOf(id)+' is on '+cname(d,bi))}
    const nq=q.slice();nq[pk.s]=id;if(!fmtGate(nq,'swap on '+cname(d,pk.i)))return render();
    q[pk.s]=id;benchOn(g,old,t);benchOff(g,id,t);const D=day(d);D.att=D.att||{};const a=D.att[id];if(!a||!a.a)D.att[id]={a:t};else if(a.l)a.l=0;
    logIt(g,'Swap on '+cname(d,pk.i)+': '+nameOf(old)+' → '+nameOf(id));if(clearFrom(g,[id]).length)logIt(g,nameOf(id)+' now on '+cname(d,pk.i)+' → replaced in later games');autoNext(g,'fill',null)}
  else{const x=gRef(g,pk.t+'.'+pk.i+'.'+pk.k);if(!x)return render();if(x.q.includes(id)){render();return toast(nameOf(id)+' is already in this game')}
    const nq=x.q.slice();nq[pk.s]=id;if(nq.every(Boolean)&&!fmtGate(nq,'upcoming game'))return render();
    x.q[pk.s]=id;x.m=1;if(x.q.every(Boolean)&&x.a)recordOverride(g,x)}
  save();render();window.scrollTo(0,ui.pickY||0)}
/* v23: assign a game to a court (it stays in Upcoming); blocked when one of its players is on another court */
function assignGame(g,x,i){if(!x)return;if(g.closed[i])return toast(cname(g.d,i)+' is closed');const bad=clashOf(g,x.q).filter(o=>o.i!==i);
  if(bad.length)return toast(bad.map(o=>nameOf(o.id)).join(', ')+' is on '+cname(g.d,bad[0].i)+' – can’t assign to '+cname(g.d,i));
  if(x.ac!==i&&qOf(g,i).length>=3)return toast(cname(g.d,i)+' queue is full (3)');x.ac=i;x.m=1;save();render()}
/* ☰ drag reorders Upcoming; dropping on a court assigns the game there */
function moveGame(g,src,t,i,k){const a=String(src).split('.'),sk=+a[2],x=g.up[sk];if(!x)return;if(t==='q')return assignGame(g,x,i);
  g.up.splice(sk,1);if(k<0||k>g.up.length)k=g.up.length;else if(sk<k)k--;g.up.splice(k,0,x);save();render()}
Object.assign(act,{
 cts:()=>{ui.cts=1;render()},closects:()=>{ui.cts=0;render()},
 ctclose:x=>{const g=CG(),i=+x;if(g.cur[i]&&g.cur[i].some(Boolean))return toast('Stop & save the game on '+cname(g.d,i)+' first');
   if(!confirm('Close '+cname(g.d,i)+'? Its queued games go back to Upcoming. You can reopen it for 10 minutes.'))return;g.closed[i]=Date.now();autoNext(g,'fill',cname(g.d,i)+' closed');save();render()},
 ctopen:x=>{const g=CG();delete g.closed[+x];logIt(g,cname(g.d,+x)+' reopened');save();render()},
 gpick:(x,y)=>{const a=String(x).split('.'),p={t:a[0],i:+a[1],k:+a[2],s:+y},o=ui.pick;if(o&&o.t===p.t&&o.i===p.i&&o.k===p.k&&o.s===p.s){ui.pick=null;return render()}ui.pick=p;pickScroll()},
 cswap:(x,y)=>{ui.pick={t:'c',i:+x,k:0,s:+y};pickScroll()},
 /* v18: running game – players change only via ✎ Edit (same checks as Swap); timer and score are kept */
 ced:x=>{ui.ced=+x;ui.pick=null;render()},cedx:()=>{ui.ced=null;ui.pick=null;render()},
 pickx:()=>{ui.pick=null;render();window.scrollTo(0,ui.pickY||0)},
 gx:(x,y)=>{const g=CG(),r=gRef(g,x);if(!r)return;r.q[+y]=null;r.m=1;const a=String(x).split('.');if(!r.q.some(Boolean)){const L=gList(g,a[0],+a[1]);L.splice(L.indexOf(r),1);if(r.n&&g.fp){const f=g.fp.find(o=>o.n===r.n);if(f){f.q=NUL4();f.x=1}}ui.pick=null;autoNext(g,'fill',null)}save();render()},
 apick:x=>{if(ui.pick)return pickName(x);act.pmod(x)},
 asg:x=>{ui.asg=+x+1;render()},asgx:()=>{ui.asg=0;render()},asgc:x=>{const g=CG(),k=ui.asg-1;ui.asg=0;const o=g.up[k];if(o&&o.ac===+x)return render();assignGame(g,o,+x)},
 asgu:()=>{const g=CG(),o=g.up[ui.asg-1];ui.asg=0;if(o)delete o.ac;save();render()},
 cfopen:x=>{const g=CG(),i=+x;if(g.cur[i]&&g.cur[i].some(Boolean))return toast(cname(g.d,i)+' still has a game');
   const k=nextFor(g,i);if(k<0)return toast(g.up.length?'Every upcoming game has a player on court – wait or edit one':'No game waiting – add one in Upcoming');ui.cf={i,t:'u',k};render()},
 closecf:()=>{ui.cf=null;render()},
 cfok:()=>{const g=CG(),c=ui.cf,x=cfGame(g);ui.cf=null;if(x)sendCourt(g,c.i,x);else render()},
 /* Stop always saves the game, even with no score – winner/score can be added later in Game Summary */
 /* v21: close the game now, no score – it shows as "Score pending" and the 4 players send the real score from the live page */
 savenos:x=>{const g=CG(),i=+x,L=g.live[i];if(!L||!(g.cur[i]||[]).every(Boolean))return;if(ui.ced===i){ui.ced=null;ui.pick=null}const t=Date.now();L.sa=0;L.sb=0;L.w='';
   saveGame(g,i,t);const h=g.hist[0];if(h&&h.at===t){h.sp=1;logIt(g,cname(g.d,i)+': game saved with no score · score pending from players')}save();render();toast('Saved · score pending – the 4 players can send it from the live page')},
 timer:x=>{const g=CG(),i=+x,L=g.live[i];if(!L)return;if(ui.ced===i){ui.ced=null;ui.pick=null}if(!L.run&&!L.sa&&!L.sb&&!L.el){g.live[i]=Object.assign({},L,{run:true,start:Date.now()});save();return render()}
   saveGame(g,i);save();render();toast(L.sa||L.sb?'Game saved':'Game saved · tap it in Game Summary to add the score')}
});
/* drag ≡ to reorder; drop on a court to queue it there */
let DR=null;
document.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-drag]');if(!h)return;const card=h.closest('.gcard');if(!card)return;e.preventDefault();
  const r=card.getBoundingClientRect(),gh=card.cloneNode(true);gh.classList.add('ghost');Object.assign(gh.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px'});document.body.appendChild(gh);
  card.style.opacity='.35';DR={src:h.dataset.drag,gh,card,dx:e.clientX-r.left,dy:e.clientY-r.top};try{h.setPointerCapture(e.pointerId)}catch(err){}});
document.addEventListener('pointermove',e=>{if(!DR)return;DR.gh.style.left=(e.clientX-DR.dx)+'px';DR.gh.style.top=(e.clientY-DR.dy)+'px';
  if(e.clientY<70)window.scrollBy(0,-14);else if(e.clientY>innerHeight-70)window.scrollBy(0,14)});
function dragEnd(e,drop){if(!DR)return;const D=DR;DR=null;D.gh.remove();D.card.style.opacity='';if(!drop)return;
  const el=document.elementFromPoint(e.clientX,e.clientY),t=el&&el.closest('[data-drop]');if(!t)return;
  const k=t.dataset.k!=null?+t.dataset.k:-1,ty=t.dataset.drop==='c'?'q':t.dataset.drop,i=+(t.dataset.i||0);
  if(ty+'.'+(ty==='u'?0:i)+'.'+k===D.src)return;moveGame(CG(),D.src,ty,i,k)}
document.addEventListener('pointerup',e=>dragEnd(e,true));document.addEventListener('pointercancel',e=>dragEnd(e,false));
