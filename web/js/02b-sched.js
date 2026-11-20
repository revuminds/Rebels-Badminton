/* ===== v17 scheduler (spec B + E): fair full-session plan =====
   Priority when rules conflict: 1 equal games / rest → 2 level balance → 3 partner variety → 4 opponent variety.
   Formats: MD (4 men) · WD (4 women) · XD (each team 1M+1W). 1W+3M and 3W+1M are never auto-scheduled.
   Fill-in (tick) players: no target; used for gaps and to give participants a cool-down after 2 games in a row. */
const RATE=3;                                              /* target games per player per hour */
const STRONG=()=>S.def.strong==null?3:num(S.def.strong);    /* level index ≥ this = strong (3 = Intermediate +) */
const PWR=()=>S.def.pwr==null?1:num(S.def.pwr);             /* power games per strong player per hour */
const isStrong=id=>lvOf(id)>=STRONG();
const fmtOK=q=>{const f=q.filter(id=>id&&isF(id)).length;return f!==1&&f!==3};
/* rating = level + win-rate from every saved game (shrunk toward 50 %, ±0.75 max) – wins feed team balance */
let RTc=null,RTk='';
function ratings(){const k=S.savedAt+'|'+S.players.length;if(RTc&&RTk===k)return RTc;const w={},n={};
  Object.values(S.games).forEach(g=>(g.hist||[]).forEach(h=>{if(!h.ids||h.sa===h.sb)return;const aw=h.sa>h.sb;h.ids.forEach((id,i)=>{n[id]=(n[id]||0)+1;if((i<2)===aw)w[id]=(w[id]||0)+1})}));
  const r={};S.players.forEach(p=>{r[p.id]=p.lv+(((w[p.id]||0)+2)/((n[p.id]||0)+4)-.5)*1.5});RTc=r;RTk=k;return r}
/* women policy: ≥4 women → each woman gets WD and XD. Men outnumber women → minimal WD (4 women → 1 game, 5–8 → 2 …), rest XD */
function wPolicy(ids){const W=ids.filter(isF).length,M=ids.length-W;return{W,M,wd:W>=4,quota:W>=4&&M>W?Math.ceil(W/4):0}}

/* cost of one group of 4 (best team split); st = running state of the plan */
function gcost2(q,st,h){const nf=q.filter(isF).length;if(nf===1||nf===3)return{c:1e6,o:q};let best=null;
  for(const s of [[0,1,2,3],[0,2,1,3],[0,3,1,2]]){const o=s.map(k=>q[k]);if(nf===2&&isF(o[0])===isF(o[1]))continue;
    const R=st.rt,d=Math.abs(R[o[0]]+R[o[1]]-R[o[2]]-R[o[3]]),pa=st.pp[k2(o[0],o[1])]||0,pb=st.pp[k2(o[2],o[3])]||0;
    const op=[[0,2],[0,3],[1,2],[1,3]].reduce((a,[x,y])=>a+(st.po[k2(o[x],o[y])]||0),0);
    let c=d*40+(pa+pb)*45+(pa*pa+pb*pb)*25+op*6;
    const sA=+isStrong(o[0])+ +isStrong(o[1]),sB=+isStrong(o[2])+ +isStrong(o[3]);
    if(sA+sB===4&&st.power){const ow=o.filter(id=>st.owes(id,h)).length;c+=ow?-120*ow:45}
    else{if(sA===2)c+=60;if(sB===2)c+=60}                     /* mentor games: strong partners a weaker player */
    if(nf===4)o.forEach(w=>{if(st.pol.quota){if(!st.wd[w])c-=55;else c+=st.wdTot>=st.pol.quota?70:20}else c+=((st.wd[w]||0)-(st.xd[w]||0))*25});
    else if(nf===2&&st.pol.wd)o.forEach(w=>{if(!isF(w))return;if(st.pol.quota){if(!st.wd[w]&&st.wdTot<st.pol.quota)c+=25}else c+=((st.xd[w]||0)-(st.wd[w]||0))*25});
    if(!best||c<best.c)best={c,o}}
  return best||{c:1e6,o:q}}
/* split the selected players into groups of 4 (several start layouts, then swap-improve) */
function groupBest(sel,st,h){const n=sel.length/4;if(!n)return[];const rt=st.rt,byR=sel.slice().sort((a,b)=>rt[b]-rt[a]),W=byR.filter(isF),M=byR.filter(id=>!isF(id));
  const starts=[sel.slice(),byR];const sp=[];for(let k=0;k<n;k++)for(let j=0;j<4;j++)sp.push(byR[j*n+k]);starts.push(sp);
  if(W.length&&M.length){starts.push(W.concat(M));const xs=[],w=W.slice(),m=M.slice();while(w.length||m.length){if(w.length>=2&&m.length>=2)xs.push(m.shift(),w.shift(),w.shift(),m.shift());else xs.push(...w.splice(0),...m.splice(0))}starts.push(xs)}
  let best=null;const gc=q=>gcost2(q,st,h).c;
  starts.forEach(s=>{const gr=[];for(let i=0;i<s.length;i+=4)gr.push(s.slice(i,i+4));const cs=gr.map(gc);
    for(let it=0;it<(gr.length>1?500:0);it++){const a=rnd(gr.length),b=rnd(gr.length);if(a===b)continue;const i=rnd(4),j=rnd(4);
      const X=gr[a].slice(),Y=gr[b].slice(),t=X[i];X[i]=Y[j];Y[j]=t;const cx=gc(X),cy=gc(Y);if(cx+cy<cs[a]+cs[b]-1e-9){gr[a]=X;gr[b]=Y;cs[a]=cx;cs[b]=cy}}
    const tot=cs.reduce((x,y)=>x+y,0);if(!best||tot<best.tot)best={tot,gr}});
  return best.gr.map(q=>gcost2(q,st,h).o)}
/* odd number of women in a round can't make legal formats: swap the last woman for the next man, or bring in the next woman */
function evenSel(pool,n){let k=n;while(k>0){const sel=pool.slice(0,k*4),rest=pool.slice(k*4);if(sel.filter(isF).length%2===0)return sel;
    const iW=rest.findIndex(isF),iM=rest.findIndex(id=>!isF(id)),lW=sel.map(isF).lastIndexOf(true),lM=sel.map(isF).lastIndexOf(false);
    /* prefer dropping the lower-priority player (later in the list) and bringing in the earliest one */
    const optA=lW>=0&&iM>=0?lW*2-iM:-1e9,optB=lM>=0&&iW>=0?lM*2-iW:-1e9;
    if(optA>-1e9||optB>-1e9){if(optA>=optB)sel[lW]=rest[iM];else sel[lM]=rest[iW];return sel}k--}
  return[]}
/* strong players who can form a legal power game: 4 men · 2W+2M · 4 women */
function powerSet(part){const sm=part.filter(id=>isStrong(id)&&!isF(id)),sw=part.filter(id=>isStrong(id)&&isF(id)),ok=new Set();
  if(sm.length>=4||(sm.length>=2&&sw.length>=2))sm.forEach(id=>ok.add(id));if(sw.length>=4||(sw.length>=2&&sm.length>=2))sw.forEach(id=>ok.add(id));return ok}
function planCtx(g,ids){const d=g.d,Wall=ids.filter(isF).length,part=ids.filter(id=>!isDum(d,id)&&!(Wall<2&&isF(id))),R=Math.max(1,...fullPer(d)),H=Math.max(1,Math.round(R*FULL_MIN/60)),pwOK=PWR()>0?powerSet(part):new Set();
  return{rt:ratings(),pol:wPolicy(part),Wall,part,dum:new Set(ids.filter(id=>isDum(d,id))),pwOK,power:pwOK.size>=4,H,R}}
/* best legal 4 from an ordered list, counting how many of `want` it contains */
function pick4(L,want){const M=L.filter(id=>!isF(id)),W=L.filter(isF),c=[];if(M.length>=4)c.push(M.slice(0,4));if(W.length>=2&&M.length>=2)c.push(W.slice(0,2).concat(M.slice(0,2)));if(W.length>=4)c.push(W.slice(0,4));
  let b=null;c.forEach(q=>{const k=q.filter(id=>want.has(id)).length;if(!b||k>b.k)b={k,q}});return b&&b.k?b.q:null}
const hourOf=(r,H)=>Math.min(H-1,Math.floor(r*FULL_MIN/60));
function schedOnce(g,ids,slots,keep,P0,att){const c={},last={},strk={},pp={},po={},wd={},xd={},pw={},out=[];let em=0,b2=0,b3=0,gsum=0;
  const st={rt:P0.rt,pp,po,wd,xd,pol:P0.pol,wdTot:0,power:P0.power,owes:(id,h)=>P0.power&&P0.pwOK.has(id)&&(pw[id+'|'+h]||0)<PWR()};
  const pairs=q=>{pp[k2(q[0],q[1])]=(pp[k2(q[0],q[1])]||0)+1;pp[k2(q[2],q[3])]=(pp[k2(q[2],q[3])]||0)+1;[[0,2],[0,3],[1,2],[1,3]].forEach(([x,y])=>po[k2(q[x],q[y])]=(po[k2(q[x],q[y])]||0)+1);
    const nf=q.filter(isF).length;if(nf===4){q.forEach(w=>wd[w]=(wd[w]||0)+1);st.wdTot++}else if(nf===2)q.filter(isF).forEach(w=>xd[w]=(xd[w]||0)+1)};
  g.hist.forEach(h=>{if(!h.n&&h.ids&&h.ids.every(Boolean)){h.ids.forEach(id=>c[id]=(c[id]||0)+1);pairs(h.ids)}});
  const play=(q,r)=>{const full=q.every(Boolean);q.forEach(id=>{if(!id)return;c[id]=(c[id]||0)+1;strk[id]=last[id]===r-1?(strk[id]||0)+1:1;last[id]=r;
      if(!P0.dum.has(id)){if(strk[id]===2)b2++;else if(strk[id]>=3)b3++}});
    if(full){pairs(q);if(P0.power&&q.every(isStrong)){const h=hourOf(r,P0.H);q.forEach(id=>pw[id+'|'+h]=(pw[id+'|'+h]||0)+1)}}};
  const R=slots.length?slots[slots.length-1].r+1:0;
  for(let r=0;r<R;r++){const rs=slots.filter(s=>s.r===r),busy=new Set();
    rs.forEach(s=>{const k=keep[s.n];if(!k)return;out.push(k);k.q.forEach(id=>id&&busy.add(id));play(k.q,r)});
    const free=rs.filter(s=>!keep[s.n]);if(!free.length)continue;const h=hourOf(r,P0.H);
    const key=id=>{const dm=P0.dum.has(id),s=last[id]===r-1?strk[id]:0,rest=last[id]==null?99:r-1-last[id];
      return{id,s,t:dm?(s===0?2:s===1?2.5:s===2?2.8:3.25+(s-3)*.5):s===0?0:s===1?1:3+(s-2)*.5,rest,c:c[id]||0,o:att%2&&st.owes(id,h)?0:1,x:Math.random()}};
    const ks=ids.filter(id=>!busy.has(id)&&!(P0.Wall<2&&isF(id))).map(key).sort((a,b)=>a.t-b.t||(a.c-.6*Math.min(a.rest,4))-(b.c-.6*Math.min(b.rest,4))||a.c-b.c||a.o-b.o||a.x-b.x);
    let pool=ks.map(x=>x.id);const fresh=ks.filter(x=>x.t<=1).map(x=>x.id),mode=att%4;let F=null;
    /* some attempts pull a power game (strong players who still owe one this hour) or a WD game (women still without WD) to the front */
    let he=r;while(he+1<R&&hourOf(he+1,P0.H)===h)he++;const urg=he-r<2;
    if((mode===1||mode===3||urg)&&P0.power){const ow=new Set(fresh.filter(id=>st.owes(id,h)));if(ow.size>=(urg?1:2))F=pick4([...fresh.filter(id=>ow.has(id)),...fresh.filter(id=>P0.pwOK.has(id)&&!ow.has(id))],ow)}
    if(!F&&(mode===2||mode===3)&&P0.pol.wd&&(!P0.pol.quota||st.wdTot<P0.pol.quota)){const rs0=new Set(ks.filter(x=>x.t===0).map(x=>x.id)),fw=fresh.filter(isF),nd=new Set(fw.filter(w=>!wd[w]&&rs0.has(w)));if(nd.size&&fw.length>=4)F=fw.filter(w=>nd.has(w)).concat(fw.filter(w=>!nd.has(w))).slice(0,4)}
    if(F&&free.length)pool=F.concat(pool.filter(id=>!F.includes(id)));
    const n=Math.min(free.length,Math.floor(pool.length/4)),sel=evenSel(pool,n),ng=sel.length/4;em+=free.length-ng;
    const gr=groupBest(sel,st,h);
    gr.forEach((q,k)=>{const s=free[k];gsum+=gcost2(q,st,h).c;out.push({n:s.n,r:s.r,c:s.c,q:q.slice(),a:q.slice(),m:0});play(q,r)})}
  /* score the whole plan */
  const reg=P0.part.map(id=>c[id]||0),spread=reg.length?Math.max(...reg)-Math.min(...reg):0;let pd=0,wdf=0;
  if(P0.power)P0.part.filter(isStrong).forEach(id=>{for(let h=0;h<P0.H;h++)pd+=Math.max(0,PWR()-(pw[id+'|'+h]||0))});
  if(P0.pol.wd)P0.part.filter(isF).forEach(w=>{wdf+=(wd[w]?0:1)+(xd[w]||P0.pol.M<2?0:1)});
  if(P0.pol.quota)wdf+=Math.max(0,st.wdTot-P0.pol.quota)*.4;
  return{out:out.sort((a,b)=>a.n-b.n),sc:spread*1000+em*500+b3*200+b2*12+pd*400+wdf*1200+gsum*.05,st:{c,wd,xd,pw,b2,b3,spread,pd,wdf,wdTot:st.wdTot}}}
/* achievable games per hour for participants (target 3/hr → max 8 players per court) */
function rateInfo(g){const d=g.d,ids=fullIds(g),part=ids.filter(id=>!isDum(d,id)),nC=courtsOf(d).length,hrs=Math.max(.5,sessLenH(d));
  const slots=fullPer(d).reduce((a,n)=>a+n,0)*4,rate=part.length?Math.min(60/FULL_MIN,slots/part.length/hrs):0;
  return{part:part.length,nC,rate,over:part.length>nC*8,tgt:Math.round(RATE*hrs)}}

/* ---------- validation layer: every game before it is queued / sent / changed by hand ---------- */
function checkGame(g,q,o){o=o||{};const d=g.d,e=[],ids=q.filter(Boolean);
  if(ids.length<4)e.push('Fill all 4 players');else if(new Set(ids).size<4)e.push('The same player is in this game twice');
  const ns=noSx(ids);if(ns.length)e.push('Set gender for '+ns.map(nameOf).join(', ')+' first (Players)');
  if(o.r!=null&&g.fp){const dup=ids.filter(id=>g.fp.some(x=>x!==o.x&&x.r===o.r&&!x.x&&x.q.includes(id)));if(dup.length)e.push(dup.map(nameOf).join(', ')+' already plays in this round')}
  if(o.court!=null){const oc=ids.filter(id=>g.cur.some((c,j)=>j!==o.court&&c&&c.includes(id)));if(oc.length)e.push(oc.map(nameOf).join(', ')+' is still on court')}
  if(o.live&&running(g)){const lf=ids.filter(id=>leftAt(d,id));if(lf.length)e.push(lf.map(nameOf).join(', ')+' has left')}
  return{e,fmt:ids.length===4&&!fmtOK(ids)}}
/* banned format chosen by hand: ask once, log it */
function fmtGate(q,where){if(fmtOK(q))return true;const f=q.filter(isF).length,t=f===1?'1 woman + 3 men':'3 women + 1 man';
  if(!confirm('Override format rule?\n\n'+t+' is not allowed in automatic games. Use it anyway for this game?'))return false;
  audit('Format override ('+(f===1?'1W+3M':'3W+1M')+') '+where+': '+q.map(nameOf).join(', '));return true}
function audit(m){S.audit=S.audit||[];S.audit.unshift({t:Date.now(),m,by:whoAmI()});if(S.audit.length>300)S.audit.length=300}
