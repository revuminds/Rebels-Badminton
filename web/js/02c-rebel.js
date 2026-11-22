/* ===== v24 Rebel: the live Update loop =====
   Update keeps the plan and only repairs it, in the priority order Raj set:
   1 regulars get 6 (cap = Settings target) · 2 booked time (long games drop a fill-in game, short games add one back)
   3 rest balancing (on court now / 3 in a row / 3 games quickly → moved later, longest-waiting player in)
   4 fill-ins in the spare slots (never in the first 30 min) · 5 Rebel's notes.
   Games Raj placed or edited are only touched for hard conflicts; a 7th game Raj gave by hand is kept (x.ovr) and not learned from. */
const R_FI_MIN=30,R_WAIT=25*60e3;
const capOK=(d,id)=>isDum(d,id)?Infinity:TGTS();
/* average real game length this session (incl. 1 min changeover); learned length before the first 2 games */
function rbLen(g){const L=g.hist.filter(h=>!h.m&&!h.ot&&h.s>=300&&h.s<=1800).slice(0,8);return L.length>=2?Math.max(6,L.reduce((a,h)=>a+h.s,0)/L.length/60)+1:fullMin(g.d)}
/* when each upcoming game should start (courts free up in turn), and whether it still fits the booked time */
function rbTimes(g,t){const d=g.d,len=rbLen(g)*60e3,C=courtsOf(d),fr=C.map((c,i)=>{if(g.closed[i])return Infinity;const q=g.cur[i],L=g.live[i];
    if(q&&q.every(Boolean)){const st=L&&L.run?L.start:t;return Math.max(t+60e3,st+len)}return t});
  return g.up.map(x=>{let i=x.ac!=null&&!g.closed[x.ac]?x.ac:-1;if(i<0){i=0;fr.forEach((v,j)=>{if(v<fr[i])i=j})}const s=fr[i];fr[i]=s+len;return{s,i,fit:s+len*.6<=courtEnd(d,i)}})}
function rbProj(g){const c=counts(g,true);g.up.forEach(x=>x.q.forEach(id=>{if(id)c[id]=(c[id]||0)+1}));return c}
const rbRound=(g,x)=>{if(!x.n||!g.fp)return null;const f=g.fp.find(o=>o.n===x.n);return f?f.r:null};
/* another game in the same plan round (or the neighbour in Upcoming when there is no plan) already has id */
/* v24: by estimated start time – two games overlap when they start less than ~one game apart; on court now = busy until that court is free */
let RBT=null,RBL=11;
function rbBusy(g,x,id){const k=g.up.indexOf(x);if(!RBT||!RBT[k]){const r=rbRound(g,x);if(r!=null)return g.up.some(o=>o!==x&&rbRound(g,o)===r&&o.q.includes(id));return [k-1,k+1].some(j=>g.up[j]&&g.up[j].q.includes(id))}
  const s=RBT[k].s,w=RBL*60e3*.9;if(g.up.some((o,j)=>j!==k&&RBT[j]&&o.q.includes(id)&&Math.abs(RBT[j].s-s)<w))return true;
  const i=g.cur.findIndex(q=>q&&q.every(Boolean)&&q.includes(id));if(i>=0){const L=g.live[i],e=(L&&L.run?L.start:Date.now())+RBL*60e3;return s<e-w*.3}return false}
function rbSet(g,x,q){x.q=q;if(x.n&&g.fp){const f=g.fp.find(o=>o.n===x.n);if(f)f.q=q.slice()}}
/* players who came off court in the last few minutes after 2 games in a row, or played 3 games in the last 35 min */
function rbTired(g,t){const s=new Set(),oc=onCourt(g);justPlayed(g,t).forEach(id=>{if((g.strk[id]||0)>=2)s.add(id)});
  const rec={};g.hist.forEach(h=>{if(t-(h.at||0)<35*60e3)h.ids.forEach(id=>rec[id]=(rec[id]||0)+1)});
  Object.keys(rec).forEach(id=>{if(rec[id]+(oc.has(id)?1:0)>=3)s.add(id)});oc.forEach(id=>{if((g.strk[id]||0)>=2)s.add(id)});return s}
const wMin=(g,id,t)=>Math.max(0,(t-idleFrom(g,id))/60e3);
/* best replacement for slot k of game x: regulars short of their games first (longest waiting), then the fill-in with fewest games */
function rbRep(g,x,k,P,cx){const d=g.d,q=x.q,out=q[k],est=cx.est||(RBT&&RBT[g.up.indexOf(x)]),early=(est?est.s:cx.t)<g.st+R_FI_MIN*60e3+RBL*30e3;
  const c=onIds(d).filter(id=>id!==out&&hasSx(id)&&eligible(d,id)&&!q.includes(id)&&!(cx.near&&(cx.oc.has(id)||cx.tired.has(id)))&&!rbBusy(g,x,id)).map(id=>{
    const fi=isDum(d,id),pj=P[id]||0,nq=q.slice();nq[k]=id;if(!fmtOK(nq))return null;if(!fi&&pj>=TGTS())return null;if(fi&&early)return null;
    return{id,s:(fi?100+pj*5:-(TGTS()-pj)*20)-Math.min(40,wMin(g,id,cx.t))/4+(sxOf(id)===sxOf(out)?0:3)+(cx.avoid&&cx.avoid.has(id)?50:0)}}).filter(Boolean).sort((a,b)=>a.s-b.s);
  return c.length?c[0].id:null}
function rbSnap(g){return JSON.stringify({fp:g.fp||null,up:g.up})}
/* the Update. o.quiet = simulation / check only (no log, no save). Returns {n, ch:[{s,m}]} */
function rebelUpdate(g,o){o=o||{};if(!running(g))return{n:0,ch:[]};const d=g.d,t=Date.now(),ch=[],add=(s,m)=>ch.push({s,m}),before=rbSnap(g);
  if(g.fp)fpSync(g);const oc=onCourt(g),tired=rbTired(g,t),nm=nameOf;
  if(inOT(g,t)){return{n:0,ch:[],ot:1}}
  /* 0. players who left / were turned off / are on court now in a game that is next */
  g.up.forEach((x,k)=>x.q.forEach((id,j)=>{if(id&&(!eligible(d,id)||!onIds(d).includes(id))){const P=rbProj(g),r=rbRep(g,x,j,P,{t,oc,tired,near:k<2});rbSet(g,x,x.q.map((v,i)=>i===j?r:v));add(nm(id)+' left',nm(id)+' is not here → '+(r?nm(r)+' takes the place in '+gl(x):'place in '+gl(x)+' open'))}}));
  /* 1. booked time: games that no longer fit are dropped (fill-in games first); spare time gets a game back */
  let T=rbTimes(g,t);const lenM=rbLen(g);RBL=lenM;RBT=T;
  for(let k=g.up.length-1;k>=0&&T.filter(z=>!z.fit).length;k--){if(T[k].fit)continue;const P=rbProj(g),pick=()=>{let b=-1,bs=1e9;g.up.forEach((x,j)=>{if(x.m&&x.ac!=null)return;
      const s=x.q.reduce((a,id)=>a+(!id?0:isDum(d,id)?0:(P[id]||0)<=TGTS()?10:-2),0)+(T[j].fit?0:-1)+(g.up.length-j)*.01;if(s<bs){bs=s;b=j}});return b};
    const j=pick();if(j<0)break;const x=g.up[j],fi=x.q.filter(id=>id&&isDum(d,id));g.up.splice(j,1);if(x.n&&g.fp)g.fp=g.fp.filter(f=>f.n!==x.n);
    RBT=null;add('Time tight',(lenM>11?'Games run ~'+Math.round(lenM-1)+' min':'Booked time')+' → '+gl(x)+' dropped'+(fi.length?' ('+fi.map(nm).join(', ')+'’s fill-in)':''));T=rbTimes(g,t);RBT=T;k=g.up.length}
  {const C=courtsOf(d);for(let it=0;it<3;it++){T=rbTimes(g,t);const fr=C.map((c,i)=>g.closed[i]?-1:courtEnd(d,i));
    const last=C.map((c,i)=>{let e=t;const q=g.cur[i];if(q&&q.every(Boolean))e=Math.max(t,(g.live[i].start||t)+lenM*60e3);T.forEach(z=>{if(z.i===i)e=Math.max(e,z.s+lenM*60e3)});return e});
    let ci=-1;C.forEach((c,i)=>{if(fr[i]>0&&fr[i]-last[i]>=lenM*60e3*1.05&&(ci<0||fr[i]-last[i]>fr[ci]-last[ci]))ci=i});if(ci<0)break;
    const P=rbProj(g),ex=new Set(),ids=onIds(d).filter(id=>hasSx(id)&&eligible(d,id)),late=last[ci],early=late<g.st+R_FI_MIN*60e3;
    const lastQ=g.up.length?g.up[g.up.length-1].q:[],cand=ids.filter(id=>!lastQ.includes(id)&&(isDum(d,id)?!early:(P[id]||0)<TGTS())).sort((a,b)=>(isDum(d,a)-isDum(d,b))||((P[a]||0)-(P[b]||0))||(wMin(g,b,t)-wMin(g,a,t)));
    const q=pick4(cand,new Set(cand));if(!q)break;const oq=orderQ(q,g);ex.add(1);
    RBT=null;if(g.fp){const n=Math.max(0,...g.fp.map(f=>f.n),...g.hist.map(h=>h.n||0))+1,r=Math.max(0,...g.fp.map(f=>f.r))+1;g.fp.push({n,r,c:ci,q:oq.slice(),a:oq.slice(),m:0});fpSync(g);
      add('Time spare','Games running short → G'+n+' added on '+cname(d,ci)+' ('+oq.map(nm).join(', ')+')')}
    else{g.up.push({q:oq,m:0,a:oq.slice()});add('Time spare','Games running short → one more game added ('+oq.map(nm).join(', ')+')')}}}
  RBT=T=rbTimes(g,t);
  /* 2. cap: a regular heading over the target loses their last auto game place (a 7th game Raj gave by hand stays) */
  for(let it=0;it<20;it++){const P=rbProj(g),ov=onIds(d).find(id=>!isDum(d,id)&&(P[id]||0)>TGTS()&&g.up.some(x=>x.q.includes(id)&&!(x.ovr||[]).includes(id)));if(!ov)break;
    const x=[...g.up].reverse().find(x=>x.q.includes(ov)&&!(x.ovr||[]).includes(ov)),k=x.q.indexOf(ov),ix=g.up.indexOf(x),r=rbRep(g,x,k,P,{t,oc,tired,near:ix<2,est:T[ix]});
    if(!r){x.ovr=(x.ovr||[]).concat(ov);continue}rbSet(g,x,x.q.map((v,i)=>i===k?r:v));add(nm(ov)+' → '+(P[ov]),nm(ov)+' was heading to '+P[ov]+' games → '+nm(r)+' takes the place in '+gl(x))}
  /* 3. short: a regular below the target takes a fill-in's place (latest game first, no clash) */
  for(let it=0;it<20;it++){const P=rbProj(g),sh=onIds(d).filter(id=>hasSx(id)&&eligible(d,id)&&!isDum(d,id)&&(P[id]||0)<TGTS()).sort((a,b)=>(P[a]||0)-(P[b]||0)||wMin(g,b,t)-wMin(g,a,t));let done=0;
    for(const id of sh){for(let ix=g.up.length-1;ix>=0&&!done;ix--){const x=g.up[ix];if(x.q.includes(id)||rbBusy(g,x,id)||(ix<2&&(oc.has(id)||tired.has(id))))continue;
        const k=x.q.findIndex(v=>v&&isDum(d,v)&&fmtOK(x.q.map((w,i)=>i===x.q.indexOf(v)?id:w)));if(k<0)continue;const out=x.q[k];rbSet(g,x,x.q.map((v,i)=>i===k?id:v));done=1;
        add(nm(id)+' short',nm(id)+' was short of '+TGTS()+' → takes '+nm(out)+'’s fill-in place in '+gl(x))}if(done)break}if(!done)break}
  /* 4. fill-ins never in the first 30 min */
  RBT=T=rbTimes(g,t);g.up.forEach((x,ix)=>{if(T[ix].s>=g.st+R_FI_MIN*60e3+lenM*30e3)return;x.q.forEach((id,k)=>{if(!id||!isDum(d,id))return;const P=rbProj(g),r=rbRep(g,x,k,P,{t,oc,tired,near:ix<2,est:T[ix]});
    if(r&&!isDum(d,r)){rbSet(g,x,x.q.map((v,i)=>i===k?r:v));add('Fill-in early',nm(id)+' (fill-in) was due in the first 30 min → '+nm(r)+' plays '+gl(x)+' instead')}})});
  /* still a fill-in game too early → swap it with the first later game that has none */
  RBT=T=rbTimes(g,t);for(let ix=0;ix<g.up.length;ix++){if(T[ix].s>=g.st+R_FI_MIN*60e3+lenM*30e3)break;const x=g.up[ix];if(!x.q.some(id=>id&&isDum(d,id))||x.ac!=null)continue;
    const j=g.up.findIndex((y,m)=>m>ix&&y.ac==null&&!y.q.some(id=>id&&isDum(d,id))&&!(ix<2&&y.q.some(v=>v&&(oc.has(v)||tired.has(v)))));if(j<0)break;const y=g.up[j];g.up[ix]=y;g.up[j]=x;add('Fill-in early',gl(x)+' (with a fill-in) moved after '+gl(y)+' — first 30 min for regulars');RBT=T=rbTimes(g,t)}
  /* 5. rest: the next 2 games – nobody on court now, nobody 3 in a row / 3 games quickly; swap with a later game */
  RBT=rbTimes(g,t);for(let ix=0;ix<Math.min(2,g.up.length);ix++){const x=g.up[ix];x.q.forEach((id,k)=>{if(!id||!(oc.has(id)||tired.has(id)))return;
    const why=oc.has(id)?(tired.has(id)?'3 in a row':'on court now'):'needs a rest';let sw=null;
    for(let j=2;j<g.up.length&&!sw;j++){const y=g.up[j];if(y.q.includes(id)||rbBusy(g,y,id))continue;
      const ex0=RBT&&RBT[ix]&&RBT[ix].s<g.st+R_FI_MIN*60e3+RBL*30e3;y.q.forEach((o2,m)=>{if(sw||!o2||(ex0&&isDum(d,o2))||oc.has(o2)||tired.has(o2)||x.q.includes(o2)||rbBusy(g,x,o2))return;const nx=x.q.map((v,i)=>i===k?o2:v),ny=y.q.map((v,i)=>i===m?id:v);if(fmtOK(nx)&&fmtOK(ny))sw={j,m,o2,nx,ny}})}
    if(sw){rbSet(g,x,sw.nx);rbSet(g,g.up[sw.j],sw.ny);add(nm(id)+' — '+why,nm(id)+' '+why+' → moved '+gl(x)+'→'+gl(g.up[sw.j])+' · '+nm(sw.o2)+' plays '+gl(x))}
    else{const j=g.up.findIndex((y,m)=>m>ix&&!y.q.some(v=>v&&(oc.has(v)||tired.has(v)))&&!(RBT&&RBT[ix]&&RBT[ix].s<g.st+R_FI_MIN*60e3+RBL*30e3&&y.q.some(v=>v&&isDum(d,v))));
      if(j>ix){const y=g.up.splice(j,1)[0];g.up.splice(ix,0,y);add(nm(id)+' — '+why,nm(id)+' '+why+' → '+gl(y)+' moved up, '+gl(x)+' waits');return}
      const P=rbProj(g),r=rbRep(g,x,k,P,{t,oc,tired,near:1});if(r){rbSet(g,x,x.q.map((v,i)=>i===k?r:v));add(nm(id)+' — '+why,nm(id)+' '+why+' → '+nm(r)+' plays '+gl(x))}}})}
  /* 6. waiting: someone sitting 25+ min with no game in the next 2 → swap into the next game with whoever waited least */
  {const near=new Set(g.up.slice(0,2).flatMap(x=>x.q)),W=onIds(d).filter(id=>!isDum(d,id)&&eligible(d,id)&&!oc.has(id)&&!near.has(id)&&!tired.has(id)&&wMin(g,id,t)*60e3>=R_WAIT&&g.up.some(x=>x.q.includes(id))).sort((a,b)=>wMin(g,b,t)-wMin(g,a,t));
    W.slice(0,2).forEach(id=>{for(let ix=0;ix<Math.min(2,g.up.length);ix++){const x=g.up[ix],j=g.up.findIndex((y,k)=>k>=2&&y.q.includes(id));if(j<0)return;const y=g.up[j];if(rbBusy(g,x,id))continue;
      const opt=x.q.map((o2,k)=>({o2,k})).filter(z=>z.o2&&!y.q.includes(z.o2)&&!rbBusy(g,y,z.o2)&&wMin(g,z.o2,t)<wMin(g,id,t)-5&&fmtOK(x.q.map((v,i)=>i===z.k?id:v))&&fmtOK(y.q.map(v=>v===id?z.o2:v))).sort((a,b)=>wMin(g,a.o2,t)-wMin(g,b.o2,t))[0];
      if(!opt)continue;rbSet(g,x,x.q.map((v,i)=>i===opt.k?id:v));rbSet(g,y,y.q.map(v=>v===id?opt.o2:v));add(nm(id)+' waited '+Math.floor(wMin(g,id,t))+' min',nm(id)+' waited '+Math.floor(wMin(g,id,t))+' min → into '+gl(x)+' · '+nm(opt.o2)+' moves to '+gl(y));break}})}
  RBT=null;if(g.fp){g.fp.forEach(f=>{const x=g.up.find(u=>u.n===f.n);if(x)f.q=x.q.slice()});fpSync(g)}
  const changed=rbSnap(g)!==before;if(!o.quiet){if(changed){g.undo={s:before,t};}
    const P=rbProj(g),reg=onIds(d).filter(id=>eligible(d,id)&&!isDum(d,id)),sh=reg.filter(id=>(P[id]||0)<TGTS());
    logIt(g,'⟳ '+hm(t)+' · Update — '+(ch.length?ch.map(c=>c.m).join(' · ')+' · ':'')+(sh.length?'Short of '+TGTS()+': '+sh.map(id=>nm(id)+' '+(P[id]||0)).join(', '):'Everyone still on track for '+TGTS()+' ✓'));g.log[0].rb=1}
  return{n:changed?Math.max(1,ch.length):0,ch}}
const gl=x=>x.n?'G'+x.n:'the next game';
/* what would Update change right now? (runs on a copy) – drives the blinking button */
let RCk='',RCv=[];
function rebelCheck(g){if(!running(g)||VIEW())return[];const k=S.savedAt+'|'+Math.floor(Date.now()/20e3);if(RCk===k)return RCv;RCk=k;
  const c=JSON.parse(JSON.stringify(g));let r;try{r=rebelUpdate(c,{quiet:1})}catch(e){r={ch:[]}}RCv=[...new Set(r.ch.map(x=>x.s))];
  if(!RCv.length){const t=Date.now(),L=g.cur.map((q,i)=>q&&q.every(Boolean)&&g.live[i].run?(t-g.live[i].start)/60e3:0),m=rbLen(g);L.forEach((v,i)=>{if(v>m+4)RCv.push(cname(g.d,i)+' game '+Math.round(v)+' min')})}
  return RCv}
function rebelUndo(){const g=CG();if(!g||!g.undo)return toast('Nothing to undo');const o=JSON.parse(g.undo.s);g.fp=o.fp||undefined;if(!o.fp)delete g.fp;g.up=o.up;delete g.undo;logIt(g,'⟲ Update undone · plan back as it was');save();render();toast('Undone')}
/* overtime: every open court past its booked end – no auto scheduling */
function inOT(g,t){const C=courtsOf(g.d);return C.some((c,i)=>!g.closed[i])&&C.every((c,i)=>g.closed[i]||courtEnd(g.d,i)<=(t||Date.now()))}
/* v24 (6): learned game length over the last 3 sessions (real timed games, 5–30 min) → plan slot; 10 min until then */
let FMc='',FMv=10;
function fullMin(d){const k=S.savedAt+'';if(FMc===k)return FMv;FMc=k;const ds=Object.keys(S.games).filter(x=>x<(d||TODAY())&&(S.games[x].hist||[]).filter(h=>!h.m&&h.s>=300&&h.s<=1800).length>=5).sort().slice(-3);
  const L=[].concat(...ds.map(x=>S.games[x].hist.filter(h=>!h.m&&!h.ot&&h.s>=300&&h.s<=1800).map(h=>h.s)));FMv=L.length>=8?Math.min(15,Math.max(8,Math.round(L.reduce((a,b)=>a+b,0)/L.length/60+1))):10;return FMv}
function learnInfo(){const ds=Object.keys(S.games).filter(x=>(S.games[x].hist||[]).filter(h=>!h.m&&h.s>=300&&h.s<=1800).length>=5).sort().slice(-3);
  const L=[].concat(...ds.map(x=>S.games[x].hist.filter(h=>!h.m&&!h.ot&&h.s>=300&&h.s<=1800).map(h=>h.s)));return{n:ds.length,g:L.length,avg:L.length?L.reduce((a,b)=>a+b,0)/L.length/60:0}}
/* typical overtime per venue (minutes past the booked end, from ended sessions) */
function otInfo(loc){const L=Object.keys(S.games).filter(d=>{const g=S.games[d],D=S.days[d];return g&&g.en&&g.st&&D&&D.loc===loc}).map(d=>{const g=S.games[d],ot=g.hist.filter(h=>h.ot).length;return{ot,m:Math.max(0,(g.en-sessEnd(d))/60e3)}}).filter(x=>x.ot);
  return L.length?{n:L.length,m:Math.round(L.reduce((a,x)=>a+x.m,0)/L.length)}:null}
/* Raj → Rebel: a manual change is acknowledged in Rebel's notes */
function rebelAck(g,x,inId,outId){const d=g.d,P=rbProj(g),n=P[inId]||0,nm=nameOf;let m='Rebel here — Raj, '+nm(inId)+(outId?' in for '+nm(outId):' added')+' in '+gl(x)+'. ';
  if(!isDum(d,inId)&&n>TGTS()){x.ovr=(x.ovr||[]).concat(inId);m+=nm(inId)+' now has '+n+' games — your call, I’ll keep it and won’t learn from it.'}
  else if(outId&&!isDum(d,outId)&&(P[outId]||0)<TGTS())m+=nm(outId)+' is now at '+(P[outId]||0)+' — I’ll find another game at the next Update.';
  else m+='Everyone still on track for '+TGTS()+'.';logIt(g,m);g.log[0].rb=1}
/* ---------- v24 Rebel's notes (Games tab): numbers come from the same projection Update uses ---------- */
function rebelNotes(g,now){const d=g.d,N=[],P=rbProj(g),el=onIds(d).filter(id=>eligible(d,id)),reg=el.filter(id=>!isDum(d,id)),fi=el.filter(id=>isDum(d,id)),nC=courtsOf(d).filter((c,i)=>!g.closed[i]).length,nm=nameOf,cap=TGTS();
  N.push(['mu','Rebel here — Raj, '+el.length+' checked in · '+pl(nC,'court')+' open · games about '+Math.round(rbLen(g)-1)+' min'+(g.hist.filter(h=>!h.m&&h.s>=300).length>=2?' today':' (learned)')]);
  if(inOT(g,now)){const m=Math.max(...courtsOf(d).map((c,i)=>g.closed[i]?0:(now-courtEnd(d,i))/60e3)),oi=otInfo((S.days[d]||{}).loc);
    N.push(['w','Overtime +'+Math.max(1,Math.floor(m))+' min — I won’t schedule now. Add games by hand (▶ Start next → ＋ Overtime game); I’ll record them'+(oi?' · here you usually run +'+oi.m+' min':'')]);return N}
  const sh=reg.filter(id=>(P[id]||0)<cap),ov=reg.filter(id=>(P[id]||0)>cap);
  N.push(sh.length?['w','Short of '+cap+': '+sh.map(id=>nm(id)+' '+(P[id]||0)).join(', ')+(g.up.length?' — tap Update and I’ll find them games':' — no time left for more')]:reg.length?['ok','Everyone on track for '+cap+' games ✓']:['mu','No regulars checked in yet']);
  if(ov.length)N.push(['mu',ov.map(id=>nm(id)+' '+(P[id]||0)).join(', ')+' — over '+cap+' by your choice, I’ll leave it']);
  const T=rbTimes(g,now),nf=T.filter(z=>!z.fit).length;if(nf)N.push(['w','Time tight: '+pl(nf,'game')+' won’t fit the booked time — Update drops fill-in games first']);
  if(g.st&&now-g.st>60*60e3){const st=fi.filter(id=>!(P[id]||0));if(st.length)N.push(['w','Fill-ins with no game yet: '+st.map(nm).join(', ')+' — Update adds one if time allows'])}
  else if(g.st&&now-g.st<30*60e3&&fi.length)N.push(['mu','First 30 min are for the regulars — fill-ins ('+fi.map(nm).join(', ')+') come in after']);
  (S.rules||[]).filter(r=>r.on).forEach(r=>N.push(['mu','Learned from you: '+r.why]));return N}
function rebelEnd(g){const d=g.d,cnt=counts(g,false),ids=Object.keys(cnt),reg=ids.filter(id=>!isDum(d,id)),fi=ids.filter(id=>isDum(d,id)),N=[];if(!g.hist.length)return N;
  const rc=reg.map(id=>cnt[id]);N.push(['mu','Rebel here — Raj, '+pl(g.hist.length,'game')+' played · regulars '+(rc.length?Math.min(...rc)+'–'+Math.max(...rc):'–')+' games'+(fi.length?' · fill-ins '+fi.map(id=>nameOf(id)+' '+cnt[id]).join(', '):'')]);
  const ot=g.hist.filter(h=>h.ot).length;if(ot)N.push(['mu',pl(ot,'overtime game')+' recorded']);return N.concat(rebelTips(d).map(m=>['mu',m]))}
/* ---------- v24 (5) suggestions: player count and shuttles – Games end sheet + Finance ---------- */
function rebelTips(d){const T=[];if(!d||!S.days[d])return T;const g=S.games[d]||{},cnt={};(g.hist||[]).forEach(h=>h.ids.forEach(id=>cnt[id]=(cnt[id]||0)+1));
  const att=Object.keys((S.days[d]||{}).att||{}).concat(Object.keys(cnt)),ppl=[...new Set(att)].filter(id=>P(id)),org=ppl.filter(id=>isDum(d,id)),reg=ppl.length-org.length;
  const len=fullMin(d),games=courtsOf(d).reduce((a,c)=>a+Math.floor(num(c.h)*60/len),0),spare=games*4-reg*TGTS()-org.length;
  if(reg){const k=Math.floor(spare/TGTS());T.push(k>0?'Raj, even with all '+pl(org.length,'organizer')+' getting 1 game, you can add '+pl(k,'player')+' ('+games+' games of ~'+len+' min fit) — more profit.':
    k<0?'Raj, '+pl(-k,'player')+' too many for '+TGTS()+' games each in the booked time — add court time or cap the list.':'Raj, the list is full: '+reg+' regulars × '+TGTS()+' games fill the courts.')}
  const F=S.fin||{},u=x=>num((F[x]||{}).used),pp=x=>{const G=S.games[x];return G?new Set((G.hist||[]).flatMap(h=>h.ids)).size:0};
  {const d0=d;d=u(d)?d:Object.keys(F).filter(x=>x<=d0&&u(x)&&pp(x)).sort().pop();}
  if(d&&u(d)){const g=S.games[d]||{},prev=Object.keys(F).filter(x=>x<d&&u(x)&&pp(x)).sort().pop(),gN=(g.hist||[]).length||1,me=u(d)/gN;
    if(prev){const pg=(S.games[prev].hist||[]).length||1,pv=u(prev)/pg,a=pp(prev)+' players used '+pl(u(prev),'shuttle'),b=pp(d)+' used '+u(d);
      const lb=dlab(d);T.push(me>pv*1.35?'Shuttles ('+lb+'): last session '+a+', this time '+b+' ('+me.toFixed(2)+' vs '+pv.toFixed(2)+' per game) — check quality/brand.':me<pv*.75?'Shuttles ('+lb+'): '+b+' this time vs '+a+' last session — better per game ✓':'Shuttles ('+lb+'): '+me.toFixed(2)+' per game, about the same as last session ('+pv.toFixed(2)+').')}
    else T.push('Shuttles: '+pl(u(d),'shuttle')+' for '+pl(gN,'game')+' — I’ll compare from next session.')}
  return T}
function rebelTipsBox(){const ss=typeof sessions==='function'?sessions():[],d=(ui.ks&&ui.ks.s)||ss[ss.length-1];const L=rebelTips(d);if(!L.length)return '';
  return '<div class="tipbox rbtips"><div class="laby" style="font-size:12px">REBEL’S TIPS · '+esc(dlab(d).toUpperCase())+'</div>'+L.map(x=>'<div class="tip"><span>→</span><span>'+esc(x)+'</span></div>').join('')+'</div>'}
function toastU(m){const t=$('#toast');t.innerHTML=esc(m)+' · <button class="tundo" data-a="rbundo">Undo</button>';t.style.display='block';t.style.pointerEvents='auto';clearTimeout(tT);tT=setTimeout(()=>{t.style.display='none'},6000)}
