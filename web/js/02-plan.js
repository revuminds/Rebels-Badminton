/* ===== games: mixing, planner, live auto-adapt, learning ===== */
const blankLive=()=>({run:false,start:0,sa:0,sb:0,el:0,w:''});
const NUL4=()=>[null,null,null,null];
const running=g=>!!(g&&g.st&&!g.en);
const playMs=(g,now)=>g&&g.st?Math.max(0,((g.en||now||Date.now())-g.st)-(g.gap||0)):0;
/* v17: points per game – session default (g.pts) or the game's own box (x.pts / L.pts) */
const gp=(g,o)=>({pts:+(o&&o.pts)||+g.pts||21,deuce:!!g.deuce});
const capOf=g=>g.deuce&&+g.pts<30?Math.max(+g.pts,Math.min(30,+g.pts+9)):+g.pts;
const winOf=(g,l)=>g.deuce&&+g.pts<30?Math.min(capOf(g),Math.max(+g.pts,l+2)):+g.pts;
/* score check: '' = fine (unfinished timed games allowed), else the reason */
function gameWon(a,b,P){const hi=Math.max(a,b),lo=Math.min(a,b),p=+P.pts;return P.deuce&&p<30?(hi>=p&&hi-lo>=2)||hi>=capOf(P):hi>=p}
function scoreErr(a,b,P){a=+a||0;b=+b||0;const p=+P.pts,c=capOf(P),hi=Math.max(a,b),lo=Math.min(a,b);
  if(hi>c)return 'Max '+c+' in a game to '+p+(P.deuce?' (deuce on)':'');if(hi<p)return '';
  if(!P.deuce||p>=30)return lo>=p?'Only one side can reach '+p:'';
  if(hi===p)return lo>p-2?'At '+(p-1)+'–'+(p-1)+' deuce: win by 2':'';if(hi===c)return lo<c-2?'Above '+p+' the winner leads by exactly 2':'';return hi-lo!==2?'Above '+p+' the winner leads by exactly 2':''}
const REST=8*60e3,TGT=5,TMIN=5;
function G(d){let g=S.games[d];
  if(!g){g=(isDel(d)?{}:S.games[d]={});Object.assign(g,{d,courts:1,round:0,cur:[],live:[],nxt:[],nman:[],hist:[],since:{},btot:{},st:0,en:0,pts:S.def.pts,deuce:S.def.deuce,slot:S.def.slot,chg:S.def.chg,ros:[],last:[],plan:[],log:[],strk:{},pre:[],auto:[]})}
  ['nman','log','pre','auto','plan','last','ros','nxt','cur','live'].forEach(k=>{if(!Array.isArray(g[k]))g[k]=[]});if(!g.strk)g.strk={};
  const n=courtsOf(d).length;g.courts=n;g.bh=sessLenH(d);
  while(g.cur.length<n){g.cur.push(NUL4());g.live.push(blankLive())}
  while(g.nxt.length<n)g.nxt.push(NUL4());
  if(g.cur.length>n&&!g.cur.slice(n).some(q=>q&&q.some(Boolean))){g.cur.length=n;g.live.length=n}
  g.nxt.length=Math.min(g.nxt.length,n);
  /* v12: upcoming pool (g.up) + per-court queues (g.qq, max 3) + admin-closed courts */
  if(!Array.isArray(g.up))g.up=[];if(!Array.isArray(g.qq))g.qq=[];if(!g.closed)g.closed={};
  if(!g.v12&&g.st){g.qq=g.nxt.map(q=>q&&q.some(Boolean)?[{q:q.slice(),m:1}]:[]);g.nxt=g.nxt.map(()=>NUL4());g.v12=1}
  while(g.qq.length<n)g.qq.push([]);
  /* v23: court queues live inside Upcoming (x.ac = assigned court); g.qq is only a copy for the live page (written in save) */
  if(!g.v23){g.up=[].concat(...g.qq.map((L,i)=>(L||[]).map(x=>Object.assign(x,{ac:i,m:1}))),g.up);g.v23=1}
  if(running(g)){const onC=new Set(g.cur.flat().filter(Boolean)),t=Date.now();onIds(d).forEach(id=>{if(eligible(d,id)&&!onC.has(id)&&g.since[id]==null)g.since[id]=t})}
  return g}
const k2=(a,b)=>a<b?a+'|'+b:b+'|'+a;
function counts(g,pending){const c={};g.hist.forEach(h=>h.ids.forEach(id=>c[id]=(c[id]||0)+1));
  if(pending)g.cur.forEach(q=>{if(q&&q.every(Boolean))q.forEach(id=>c[id]=(c[id]||0)+1)});return c}
function effMap(g){const b={};g.hist.slice().reverse().forEach(h=>{const m=Math.abs(h.sa-h.sb);const w=h.sa>h.sb?[h.ids[0],h.ids[1]]:[h.ids[2],h.ids[3]];
  h.ids.forEach(id=>{b[id]=Math.max(0,(b[id]||0)-.25)});if(m>=8&&h.sa!==h.sb)w.forEach(id=>{b[id]=Math.min(1.5,(b[id]||0)+.75)})});
  const e={};S.players.forEach(p=>e[p.id]=p.lv+(b[p.id]||0));return e}
function pairMaps(g){const p={},o={},wd={},xd={},wm={};g.hist.forEach(h=>{const[a1,a2,b1,b2]=h.ids;p[k2(a1,a2)]=(p[k2(a1,a2)]||0)+1;p[k2(b1,b2)]=(p[k2(b1,b2)]||0)+1;
  [[a1,b1],[a1,b2],[a2,b1],[a2,b2]].forEach(([x,y])=>o[k2(x,y)]=(o[k2(x,y)]||0)+1);
  const nf=h.ids.filter(isF).length,m=nf===4?wd:nf===2?xd:nf===1?wm:null;if(m)h.ids.forEach(id=>{if(isF(id))m[id]=(m[id]||0)+1})});
  /* v16: women who already waited (owe) may play in a men's doubles game; WD/XD alternation only when ≥4 women are on */
  const owe=new Set(g.owe||[]),t=Date.now();if(running(g))Object.keys(g.since||{}).forEach(id=>{if(isF(id)&&t-g.since[id]>=REST)owe.add(id)});
  return{p,o,wd,xd,wm,owe,alt:g.d?onIds(g.d).filter(isF).length>=4:false}}
/* v16 gender: M/F on every player; no gender = cannot be scheduled. MD = 4 men, WD = 4 women, XD = each team 1M+1W */
const sxOf=id=>{const p=P(id);return p&&p.sx||''};
const isF=id=>sxOf(id)==='f';
const hasSx=id=>!!sxOf(id);
const gType=q=>{const f=q.filter(id=>id&&isF(id)).length;return f===2?'XD':f>=3?'WD':'MD'};
const noSx=ids=>ids.filter(id=>P(id)&&!hasSx(id));
function gCost(o,pr){const f=o.map(isF),nf=f.filter(Boolean).length;if(!nf)return 0;let c=0;
  if(nf===2){if(f[0]===f[1])return 400;if(pr.alt)o.forEach((id,k)=>{if(f[k])c+=((pr.xd[id]||0)-(pr.wd[id]||0))*14})}
  else if(nf===4){if(pr.alt)o.forEach(id=>c+=((pr.wd[id]||0)-(pr.xd[id]||0))*14)}
  else c+=5000; /* v17: 1W+3M / 3W+1M never in auto */
  return c}
/* learned rules make their part of the mixing score count double */
const ruleOn=k=>(S.rules||[]).some(r=>r.k===k&&r.on);
const WT=()=>({bal:ruleOn('bal')?6:3,spr:ruleOn('grp')?4:2,rp:ruleOn('fresh')?8:4,ro:1.5,stack:ruleOn('nostack')?120:60});
/* built-in: two Int+ (or stronger) partners only against equally strong opponents */
function stacked(a1,a2,b1,b2){const s=x=>lvOf(x),A2=s(a1)+s(a2),B2=s(b1)+s(b2);
  return (s(a1)>=3&&s(a2)>=3&&B2<A2-1)||(s(b1)>=3&&s(b2)>=3&&A2<B2-1)}
function groupCost(q,e,pr){const w=WT(),v=q.map(id=>e[id]||0);const spread=Math.max(...v)-Math.min(...v);let best=null;
  for(const s of [[0,1,2,3],[0,2,1,3],[0,3,1,2]]){const[a1,a2,b1,b2]=s.map(k=>q[k]);const d=Math.abs((e[a1]||0)+(e[a2]||0)-(e[b1]||0)-(e[b2]||0));
    const rp=(pr.p[k2(a1,a2)]||0)+(pr.p[k2(b1,b2)]||0);const ro=[[a1,b1],[a1,b2],[a2,b1],[a2,b2]].reduce((t,[x,y])=>t+(pr.o[k2(x,y)]||0),0);
    const c=d*w.bal+rp*w.rp+ro*w.ro+(stacked(a1,a2,b1,b2)?w.stack:0)+gCost([a1,a2,b1,b2],pr);if(!best||c<best.c)best={c,order:[a1,a2,b1,b2]}}
  return{cost:spread*w.spr+best.c,order:best.order}}
const rnd=n=>Math.floor(Math.random()*n);
function mix(ids,g){if(!ids.length)return[];const e=effMap(g),pr=pairMaps(g),gc=q=>groupCost(q,e,pr).cost;
  const s=ids.slice().sort((a,b)=>e[b]-e[a]),W=s.filter(isF),M=s.filter(id=>!isF(id));
  /* v16: several starting layouts (by level · women together = WD · women spread = XD), then swap-improve each; a single swap can't turn XD+XD into WD+MD */
  const starts=[s];if(W.length&&M.length){starts.push(W.concat(M));const xs=[],w=W.slice(),m=M.slice();while(w.length||m.length){if(w.length>=2&&m.length>=2)xs.push(m.shift(),w.shift(),w.shift(),m.shift());else xs.push(...w.splice(0),...m.splice(0))}starts.push(xs)}
  let best=null;starts.forEach(st=>{const gr=[];for(let i=0;i<st.length;i+=4)gr.push(st.slice(i,i+4));const cs=gr.map(gc);
    for(let it=0;it<600&&gr.length>1;it++){const a=rnd(gr.length),b=rnd(gr.length);if(a===b)continue;const i=rnd(4),j=rnd(4);
      const X=gr[a].slice(),Y=gr[b].slice();const t=X[i];X[i]=Y[j];Y[j]=t;const cx=gc(X),cy=gc(Y);
      if(cx+cy<cs[a]+cs[b]-1e-9){gr[a]=X;gr[b]=Y;cs[a]=cx;cs[b]=cy}}
    const tot=cs.reduce((x,y)=>x+y,0);if(!best||tot<best.tot)best={tot,gr}});
  return best.gr.map(q=>groupCost(q,e,pr).order)}
const orderQ=(q,g)=>groupCost(q,effMap(g),pairMaps(g)).order;

/* ---------- fair share: 5 games per 2 h, scaled by time present ---------- */
function presentSec(g,id,t){const d=g.d,st=Math.max(bookStart(d),g.st||0),en=g.en||sessEnd(d),a=att(d,id);
  if(!a||!a.a)return 0;return Math.max(0,Math.min(a.l||en,en)-Math.max(a.a,st))/1000}
function target(g,id){const len=Math.max(1,sessLenH(g.d))*3600,base=TGT*sessLenH(g.d)/2;
  if(!g.st)return Math.round(base);const a=att(g.d,id);if(!a||!a.a)return Math.round(base);
  return Math.max(1,Math.round(base*Math.min(1,presentSec(g,id)/len)))}
const blocked=(g,id,t)=>(g.strk[id]||0)>=2&&!(g.since[id]!=null&&t-g.since[id]>=REST);
const logIt=(g,m)=>{g.log.unshift({t:Date.now(),m});if(g.log.length>60)g.log.length=60};
const onCourt=g=>new Set(g.cur.flat().filter(Boolean));
/* how many upcoming/queued games each player is in */
function inGames(g){const m={};g.up.forEach(x=>x.q.forEach(id=>{if(id)m[id]=(m[id]||0)+1}));return m}
function ctxOf(g){const proj=counts(g,true),inUp={},c={proj,inUp,onC:onCourt(g),prev:new Set()};g.up.forEach(x=>ctxAdd(c,x.q));return c}
function ctxAdd(c,q){q.forEach(id=>{if(id){c.proj[id]=(c.proj[id]||0)+1;c.inUp[id]=(c.inUp[id]||0)+1}});c.prev=new Set(q.filter(Boolean))}
/* suggestion only: best players to fill `need` empty slots next to `keep` (fair share first, dummies last, levels mixed) */
function pickFor(g,keep,need,cx){const d=g.d,t=Date.now(),ex=new Set(keep.filter(Boolean));
  const c=onIds(d).filter(id=>hasSx(id)&&eligible(d,id)&&!ex.has(id)&&!(cx.noC&&cx.onC.has(id))).map(id=>{const tg=Math.max(1,target(g,id)),w=g.since[id]!=null?(t-g.since[id])/60e3:0;
    return{id,s:(cx.proj[id]||0)/tg*10+(isDum(d,id)?100:0)+(cx.inUp[id]||0)*6+(cx.onC.has(id)?3:0)+(cx.prev.has(id)?5:0)+(blocked(g,id,t)?5:0)-Math.min(w,40)/8+Math.random()*.5}}).sort((a,b)=>a.s-b.s);
  if(c.length<need)return null;const top=c.slice(0,need+4),e=effMap(g),pr=pairMaps(g),base=keep.filter(Boolean);let best=null;
  const rec=(st,ch)=>{if(ch.length===need){const q=base.concat(ch.map(x=>x.id)),sc=groupCost(q,e,pr).cost+ch.reduce((a,x)=>a+x.s,0)*1.5;if(!best||sc<best.sc)best={sc,ids:ch.map(x=>x.id)};return}
    for(let k=st;k<top.length;k++)rec(k+1,ch.concat(top[k]))};rec(0,[]);return best?best.ids:null}
/* the app keeps ≥5 upcoming games: 'fill' tops up / refills slots it emptied, 'all' also re-picks every upcoming game the admin has not touched.
   Queued games and anything the admin placed are never changed – except players who left or were turned off. */
/* v14: players who just went on court are taken out of every later game (incl. manual ones) and refilled */
function clearFrom(g,ids,skip){if(g.fp)return [];const s=new Set(ids.filter(Boolean)),hit=new Set();g.up.forEach(x=>{if(x===skip)return;x.q=x.q.map(id=>{if(s.has(id)){hit.add(id);x.rf=1;return null}return id})});return [...hit]}
function autoNext(g,mode,why){if(!running(g))return 0;if(g.fp){fpSync(g);return 0}const d=g.d,on=new Set(onIds(d));let ch=0;const rp=mode==='rp';if(rp)mode='all';
  const oc=onCourt(g),bad0=id=>id&&(!on.has(id)||!!leftAt(d,id));
  /* Re-pick button (rp): also clears on-court, not-checked-in and duplicate players – even in games the admin edited */
  if(rp){const seen=new Set();g.up.forEach(x=>{x.q=x.q.map(id=>{if(!id)return id;if(oc.has(id)||!arrived(d,id)||seen.has(id)){x.rf=1;ch=1;return null}seen.add(id);return id})})}
  const bad=bad0;
  g.up.forEach(x=>{if(x.ac!=null&&g.closed[x.ac]){delete x.ac;ch=1}});
  if(mode==='all'){const n0=g.up.length;g.up=g.up.filter(x=>x.m||x.ac!=null);if(g.up.length!==n0)ch=1}
  const all=g.up.slice();
  all.forEach(x=>{if(x.q.some(bad)){x.q=x.q.map(id=>bad(id)?null:id);x.rf=1;ch=1}else if(!x.m&&x.q.some(v=>!v))x.rf=1});
  g.up=g.up.filter(x=>x.q.some(Boolean)||!x.m);
  const cx=ctxOf(g);
  cx.noC=1;all.forEach(x=>{if(!x.rf)return;delete x.rf;const need=x.q.filter(v=>!v).length;if(!need)return;const ids=pickFor(g,x.q,need,cx);if(!ids)return;
    x.q=x.q.map(v=>v||ids.shift());if(!x.m){x.q=orderQ(x.q,g);x.a=x.q.slice()}ctxAdd(cx,x.q)});cx.noC=0;
  const lu=g.up[g.up.length-1];cx.prev=new Set(lu?lu.q.filter(Boolean):[]);
  for(let k=0;k<12&&g.up.length<5;k++){const ids=pickFor(g,NUL4(),4,cx);if(!ids)break;const q=orderQ(ids,g);g.up.push({q,m:0,a:q.slice()});ctxAdd(cx,q);ch=1}
  if(ch&&why)logIt(g,why);return ch}
const gList=(g,t,i)=>t==='u'?g.up:null;
const qOf=(g,i)=>g.up.filter(x=>x.ac===i);

/* ---------- planned games (before Start session): whole booked time, per court ---------- */
/* learned game length: real timed games (5–30 min), per level band; 15 min until 5 real games */
const bandOf=ids=>{const a=ids.reduce((s,id)=>s+lvOf(id),0)/Math.max(1,ids.length);return a<1.5?0:a<2.75?1:2};
let LGc=null,LGk='';
function learnG(){const k=S.savedAt+'';if(LGc&&LGk===k)return LGc;const all=[];
  Object.keys(S.games).sort().forEach(d=>(S.games[d].hist||[]).forEach(h=>{if(!h.m&&h.s>=300&&h.s<=1800&&h.ids&&h.ids.every(Boolean))all.push({at:h.at||0,s:h.s,b:bandOf(h.ids)})}));
  all.sort((x,y)=>y.at-x.at);const av=L=>{L=L.slice(0,40);return L.length>=5?{m:L.reduce((a,x)=>a+x.s,0)/L.length/60,n:L.length}:null};
  LGc={all:av(all),b:[0,1,2].map(b=>av(all.filter(x=>x.b===b))),n:all.length};LGk=k;return LGc}
const learnOn=()=>S.def.learn!==false;
function gameMin(g,ids){const man=num(g&&g.slot)||num(S.def.slot)||15;if(!learnOn())return man;const L=learnG(),b=ids&&ids.every(Boolean)?L.b[bandOf(ids)]:null;return b?b.m:L.all?L.all.m:man}
const slotOf=(g,ids)=>Math.max(5,gameMin(g,ids))+Math.max(0,num(g.chg));
const courtRounds=(g,i)=>Math.floor(num((courtsOf(g.d)[i]||{}).h)*60/slotOf(g));
const planRounds=g=>Math.max(1,...courtsOf(g.d).map((c,i)=>courtRounds(g,i)));
const totSlots=g=>courtsOf(g.d).reduce((a,c,i)=>a+courtRounds(g,i),0);
const planSig=g=>[Math.round(gameMin(g)*2),onIds(g.d).sort().join(','),JSON.stringify(courtsOf(g.d)),g.slot,g.chg,JSON.stringify(S.dum||{}),S.players.map(p=>p.lv+(p.sx||'')).join(''),(S.rules||[]).filter(r=>r.on).map(r=>r.k).join('')].join('/');
/* v16: pick the n players for a round so women pair up (MD / WD / XD). Odd woman out: first she waits with priority (owe);
   if she already waited she plays in a men's doubles game. Prefers bringing in the next woman when that is fair. */
function evenW(sorted,n,owe,cnt,rested){const sel=sorted.slice(0,n),rest=sorted.slice(n);cnt=cnt||{};
  if(sel.filter(isF).length%2===0)return sel;
  const lastM=[...sel].reverse().find(id=>!isF(id)),nextW=rest.find(isF);
  if(lastM&&nextW&&(cnt[nextW]||0)<=(cnt[lastM]||0)){sel[sel.indexOf(lastM)]=nextW;return sel}
  const lastW=[...sel].reverse().find(isF),nextM=rest.find(id=>!isF(id));
  if(lastW&&nextM&&!owe.has(lastW)&&!(rested&&rested.has(lastW))){sel[sel.indexOf(lastW)]=nextM;owe.add(lastW);return sel}
  if(lastW&&nextM){sel[sel.indexOf(lastW)]=nextM;owe.add(lastW)} /* v17: never leave an odd woman (1W+3M banned) */
  return sel}
const tier=(d,id,c)=>isDum(d,id)?3:c>=TGT?2:0;
function buildPlan(g){let best=null;const ids=onIds(g.d).filter(hasSx);for(let k=0;k<80;k++){if(k===40&&best.sc<100)break;const p=planOnce(g,k>=40),cn={};let em=0;
  p.forEach((rd,r)=>rd.forEach((q,i)=>{if(q.every(Boolean))q.forEach(id=>cn[id]=(cn[id]||0)+1);else if(r<courtRounds(g,i))em++}));
  const rc=ids.filter(id=>!isDum(g.d,id)).map(id=>cn[id]||0),oc=ids.filter(id=>isDum(g.d,id)).reduce((a,id)=>a+(cn[id]||0),0),sc=em*100+(rc.length?Math.max(...rc)-Math.min(...rc):0)*3+oc*.2;if(!best||sc<best.sc)best={sc,p};if(!sc)break}
  const keep=g.nxt.map((q,i)=>g.nman[i]?q:null);g.nxt=best.p[0].map((q,i)=>keep[i]||q);g.plan=best.p.slice(1);g.psig=planSig(g)}
function planOnce(g,soft){const ids=onIds(g.d).filter(hasSx),R=planRounds(g),fake={d:g.d,hist:[],owe:[]},c={},st={},lr={},rounds=[],nC=courtsOf(g.d).length,owe=new Set();
  for(let r=0;r<R;r++){const av=[];for(let i=0;i<nC;i++)if(r<courtRounds(g,i)||(r===0&&!courtRounds(g,i)))av.push(i);
    const pool=ids.filter(id=>!(lr[id]===r-1&&st[id]>=2)).map(id=>{const k=c[id]||0;return{id,c:k,o:tier(g.d,id,k),s:lr[id]===r-1?st[id]:0,x:Math.random()}}).sort((a,b)=>a.o-b.o||(a.c+a.s*.75)-(b.c+b.s*.75)||a.x-b.x).map(x=>x.id);
    const n=Math.min(av.length,Math.floor(pool.length/4));const rsd=new Set(r?ids.filter(id=>lr[id]!==r-1):[]),sel=n?evenW(pool,n*4,owe,c,rsd):[];fake.owe=[];const gr=n?mix(sel,fake):[];gr.forEach(q=>{fake.hist.unshift({ids:q,sa:0,sb:0});q.forEach(id=>{owe.delete(id);st[id]=lr[id]===r-1?(st[id]||0)+1:1;c[id]=(c[id]||0)+1;lr[id]=r})});
    const rd=[];for(let i=0;i<nC;i++)rd.push(NUL4());av.forEach((i,k)=>{if(gr[k])rd[i]=gr[k]});rounds.push(rd)}
  return rounds}
function ensurePlan(g){if(g.st)return;if(g.psig!==planSig(g))return buildPlan(g);const on=new Set(onIds(g.d));g.plan=g.plan.map(rd=>rd.map(q=>q.map(id=>id&&on.has(id)?id:null)))}
const qref=(g,x)=>{if(String(x)[0]==='f'){const it=(g.fp||[]).find(o=>o.n==String(x).slice(2));if(!it)return NUL4();it.m=1;return it.q}const a=String(x).split('.').map(Number);return a[0]?g.plan[a[0]-1][a[1]]:g.nxt[a[1]]};

/* ---------- bench time ---------- */
function benchOn(g,id,t){if(!running(g)||!eligible(g.d,id))return;if(g.since[id]==null)g.since[id]=t}
function benchOff(g,id,t){if(g.since[id]!=null){g.btot[id]=(g.btot[id]||0)+Math.max(0,t-g.since[id])/1000;delete g.since[id]}}
function benchSec(g,id,t){if(g.man&&!running(g)&&g.st&&g.en&&!Object.keys(g.btot).length){const pl2=g.hist.filter(h=>h.ids.includes(id)).reduce((a,h)=>a+h.s,0);return Math.max(0,playMs(g)/1000-pl2)}
  return(g.btot[id]||0)+(running(g)&&g.since[id]!=null?((t||Date.now())-g.since[id])/1000:0)}
const tn=(h,k)=>{const n=h.ids.slice(k*2,k*2+2).map(nameOf);return n.every(x=>x!=='?')?n.join(' & '):((k?h.b:h.a)||[]).join(' & ')};
const hlab=h=>(h.n?'Game '+h.n:h.m?'Manual':'#'+(h.r||'–'))+(h.s!=null&&h.at&&!h.u?' · '+hm(h.at-h.s*1000):'');

/* ---------- court flow ---------- */
function saveGame(g,i,t){t=t||Date.now();const q=g.cur[i],L=g.live[i];const s=Math.max(0,L.run?(t-L.start)/1000:(L.el||0));
  const n=g.hist.filter(h=>h.c===i+1&&!h.m).length+1;
  const h={r:n,c:i+1,ids:q.slice(),a:[nameOf(q[0]),nameOf(q[1])],b:[nameOf(q[2]),nameOf(q[3])],sa:L.sa,sb:L.sb,s:Math.round(s),at:t};if((L.start||t)>=courtEnd(g.d,i)-60e3)h.ot=1;if(L.pts&&+L.pts!==+g.pts)h.pts=+L.pts;
  if(g.curN&&g.curN[i]){h.n=g.curN[i];g.curN[i]=0}
  g.hist.unshift(h);g.last[i]=h;g.cur[i]=NUL4();g.live[i]=blankLive();q.forEach(id=>benchOn(g,id,t));
  autoNext(g,'fill',null)}
/* send a game (from a court queue or Upcoming) on court; the timer starts. Manual choice always wins (not-checked-in players are checked in). */
function sendCourt(g,i,x){const t=Date.now(),q=x.q,d=g.d;if(!running(g))return;if(!q.every(Boolean)||new Set(q).size<4)return toast('Pick 4 different players');
  const bi=g.cur.findIndex((c,j)=>j!==i&&c&&c.some(id=>q.includes(id)));if(bi>=0){const b=q.find(id=>g.cur[bi].includes(id));return toast(nameOf(b)+' is still on '+cname(d,bi))}
  if(g.cur[i]&&g.cur[i].some(Boolean))return toast(cname(d,i)+' still has a game – Stop & save first');
  const ns=noSx(q);if(ns.length)return toast('Set gender for '+ns.map(nameOf).join(', ')+' first (Players)');
  if(!fmtGate(q,'on '+cname(d,i)))return;
  const D=day(d);D.att=D.att||{};q.forEach(id=>{const a=D.att[id];if(!a||!a.a){D.att[id]={a:t};logIt(g,nameOf(id)+' checked in (sent on court)')}else if(a.l)a.l=0});
  {const k=g.up.indexOf(x);if(k>=0)g.up.splice(k,1)}
  const cl=clearFrom(g,q,x);if(cl.length)logIt(g,cl.map(nameOf).join(', ')+' now on '+cname(d,i)+' → replaced in their later games');
  q.forEach(id=>{const w=g.since[id]!=null?t-g.since[id]:Infinity;g.strk[id]=w<REST?(g.strk[id]||0)+1:1;benchOff(g,id,t)});
  g.curN=g.curN||[];g.curN[i]=x.n||0;
  g.cur[i]=q.slice();const fx=x.n&&g.fp?g.fp.find(o=>o.n===x.n):null;g.live[i]=Object.assign(blankLive(),{run:true,start:t},fx&&fx.pts?{pts:fx.pts}:{});g.round++;autoNext(g,'fill',null);save();render()}
function startSession(){const d=curDate(),g=G(d);if(d!==TODAY())return toast('Only today’s session can be started');if(g.st&&!g.en)return;if(onIds(d).length<4)return toast('Turn on at least 4 players first');
  const now=Date.now();if(g.st&&g.en){g.gap=(g.gap||0)+Math.max(0,now-g.en);g.en=0;const A=day(d).att||{};Object.keys(A).forEach(id=>delete A[id].e);
    g.nxt=g.nxt.map(()=>NUL4());g.since={};g.up=[];g.qq=courtsOf(d).map(()=>[]);g.closed={};g.cur=g.cur.map(()=>NUL4());g.live=g.live.map(blankLive);
    logIt(g,'Session continued · earlier games and payments kept');save();render();return}
  ['pts','deuce','slot','chg'].forEach(k=>g[k]=S.def[k]);
  g.st=now;g.en=0;day(d).att={};g.nxt=g.nxt.map(()=>NUL4());g.nman=[];g.since={};g.up=[];g.qq=courtsOf(d).map(()=>[]);g.closed={};g.v12=1;
  logIt(g,'Session started · check players in with the Players button – only checked-in players are auto-picked');save();render()}
function endSession(g,t){g.cur.forEach((q,i)=>{const L=g.live[i];if(q&&q.every(Boolean)&&L&&(L.run||L.el||L.sa||L.sb))saveGame(g,i,t)});
  Object.keys(g.since).forEach(id=>benchOff(g,id,t));
  const D=S.days[g.d];g.ros=[...new Set([...(g.ros||[]),...(D?Object.keys(D.on).filter(k=>D.on[k]):[]),...g.hist.flatMap(h=>h.ids)])];
  if(D&&D.att)Object.keys(D.att).forEach(id=>{const a=D.att[id];if(a.a&&!a.l)a.e=t});
  if(D)D.dsnap=Object.keys(S.dum||{}).filter(k=>S.dum[k]);
  g.cur=g.cur.map(()=>NUL4());g.live=g.live.map(blankLive);g.up=[];g.qq=g.qq.map(()=>[]);g.curN=[];g.en=t;if(D)D.on={}}

/* ---------- learning from admin overrides ---------- */
const RULES={bal:'Keep the two teams level (admin re-balanced teams)',grp:'Keep the 4 players close in level',fresh:'Avoid repeating the same partners',
  nostack:"Don't stack two Int+ partners vs weaker opponents",wait:'Longest-waiting players go first'};
function feats(q,g){const pr=pairMaps(g),L=q.map(lvOf);return{d:Math.abs(L[0]+L[1]-L[2]-L[3]),s:Math.max(...L)-Math.min(...L),
  rp:(pr.p[k2(q[0],q[1])]||0)+(pr.p[k2(q[2],q[3])]||0),st:stacked(q[0],q[1],q[2],q[3])?1:0}}
function recordOverride(g,x){const a=x.a,m=x.q;if(!a||!a.every(Boolean)||!m.every(Boolean)||a.join()===m.join())return;
  const fa=feats(a,g),fm=feats(m,g),ks=[],t=Date.now();
  if(fm.d<fa.d)ks.push('bal');if(fm.s<fa.s)ks.push('grp');if(fm.rp<fa.rp)ks.push('fresh');if(fm.st<fa.st)ks.push('nostack');
  const w=id=>g.since[id]!=null?t-g.since[id]:0,ins=m.filter(x=>!a.includes(x)),out=a.filter(x=>!m.includes(x));
  if(ins.length&&out.length&&Math.min(...ins.map(w))>Math.max(...out.map(w)))ks.push('wait');
  S.ovr=S.ovr||[];S.ovr.push({d:g.d,t,k:ks,lv:m.map(lvOf),alv:a.map(lvOf)});if(S.ovr.length>300)S.ovr.splice(0,S.ovr.length-300);x.a=m.slice();
  ks.forEach(k=>{if((S.rules||[]).some(r=>r.k===k))return;const seen=S.ovr.filter(o=>o.k.includes(k)),ds=new Set(seen.map(o=>o.d));
    if(seen.length>=3&&ds.size>=2){S.rules.push({k,why:RULES[k],n:seen.length,at:TODAY(),on:true,nw:true});S.newRules=1;logIt(g,'Learned a rule from your changes: '+RULES[k]+' – applied automatically (Settings → Learned rules)')}});
  (S.rules||[]).forEach(r=>{if(ks.includes(r.k))r.n=S.ovr.filter(o=>o.k.includes(r.k)).length})}

/* ---------- v16: full session plan (10-min games, numbered), print, enter results ---------- */
let FULL_MIN=10;let LASTPLAN=null;
const fullPer=d=>courtsOf(d).map(c=>Math.floor(num(c.h)*60/FULL_MIN));
function fullSlots(d){const per=fullPer(d),R=Math.max(0,...per),a=[];for(let r=0;r<R;r++)per.forEach((n,i)=>{if(r<n)a.push({r,c:i,n:a.length+1})});return a}
/* players for the plan: checked-in (session running) or turned on (before Start); gender set */
function fullIds(g){const d=g.d;return onIds(d).filter(id=>hasSx(id)&&(running(g)?eligible(d,id):!leftAt(d,id)))}
const fpDone=g=>new Set(g.hist.filter(h=>h.n).map(h=>h.n));
const fpCur=g=>new Set((g.curN||[]).filter(Boolean));
const fpStarted=g=>!!(g.hist.length||g.cur.some(q=>q&&q.every(Boolean)));
/* live: Upcoming = the planned games not yet queued / on court / done (in game order). Edits in Upcoming / queues are kept in the plan. */
function fpSync(g){if(!g.fp)return;const by={};g.fp.forEach(x=>by[x.n]=x);
  g.up.forEach(x=>{const f=x.n&&by[x.n];if(!f)return;if(x.q.join()!==f.q.join()){f.q=x.q.slice();f.m=1}if(x.ac!=null)f.ac=x.ac;else delete f.ac});
  const cur=fpCur(g),dn=fpDone(g),ok=x=>!x.x&&!dn.has(x.n)&&!cur.has(x.n)&&x.q.some(Boolean);
  /* v23: your order in Upcoming (☰ drag) is kept; games new to Upcoming go in by game number */
  const ord=[...new Set(g.up.filter(x=>x.n&&by[x.n]&&ok(by[x.n])).map(x=>x.n))],have=new Set(ord);
  g.fp.forEach(x=>{if(!ok(x)||have.has(x.n))return;const k=ord.findIndex(m=>m>x.n);if(k<0)ord.push(x.n);else ord.splice(k,0,x.n)});
  g.up=ord.map(n=>{const x=by[n],o={q:x.q.slice(),m:1,n,c:x.c};if(x.ac!=null&&!g.closed[x.ac])o.ac=x.ac;return o})}
/* keep: games already played, on court, queued, or edited by you (if all their players are still here) – the rest is re-planned */
function planFull(g,re){FULL_MIN=fullMin(g.d);if(running(g))return planLive(g,re);const d=g.d,ids=fullIds(g),slots=fullSlots(d);if(ids.length<4)return toast(running(g)?'Check in at least 4 players (with gender set) first':'Turn on at least 4 players (with gender set) first'),0;
  const keep={};if(re&&g.fp){const dn=fpDone(g),cur=fpCur(g),inQ=new Set(g.up.filter(x=>x.n&&x.ac!=null).map(x=>x.n)),ok=new Set(ids);
    g.fp.forEach(x=>{if(dn.has(x.n))keep[x.n]=Object.assign({},x,{dn:1});else if(cur.has(x.n)||inQ.has(x.n)||x.x)keep[x.n]=x;else if(x.m&&x.q.every(id=>id&&ok.has(id)))keep[x.n]=x})}
  const P0=planCtx(g,ids);let best=null;for(let k=0;k<48;k++){const p=schedOnce(g,ids,slots,keep,P0,k);if(!best||p.sc<best.sc)best=p;if(best.sc<1)break}LASTPLAN=best;
  g.fp=best.out.map(x=>{const y=Object.assign({},x);delete y.dn;return y});rotCourts(g,keep);g.fpAt=Date.now();if(running(g)){g.up=[];fpSync(g)}return 1}

/* v17 H7 (soft rule, lowest priority): after a round's games are chosen, put them on courts so each player's games spread over the courts.
   Who plays, partners and rest never change; kept / manual games never move; only courts used in that round (= still booked). */
const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms(a.slice(0,i).concat(a.slice(i+1))).map(p=>[x].concat(p)));
function rotCourts(g,keep){keep=keep||{};const R={},cc={};g.fp.forEach(x=>(R[x.r]=R[x.r]||[]).push(x));
  Object.keys(R).map(Number).sort((a,b)=>a-b).forEach(r=>{const L=R[r],mov=L.filter(x=>!keep[x.n]&&!x.m&&x.q.some(Boolean));
    if(mov.length>1&&mov.length<7){const cs=mov.map(x=>x.c),ns=mov.map(x=>x.n).sort((a,b)=>a-b),cost=pm=>mov.reduce((a,x,i)=>a+x.q.reduce((b,id)=>b+(id&&cc[id]?(cc[id][pm[i]]||0)*(cc[id][pm[i]]||0):0),0),0);
      let best=null;perms(cs).forEach(pm=>{const c=cost(pm);if(!best||c<best.c-1e-9)best={c,pm}});mov.forEach((x,i)=>x.c=best.pm[i]);
      mov.slice().sort((a,b)=>a.c-b.c).forEach((x,i)=>x.n=ns[i])}
    L.forEach(x=>x.q.forEach(id=>{if(id){cc[id]=cc[id]||{};cc[id][x.c]=(cc[id][x.c]||0)+1}}))});
  g.fp.sort((a,b)=>a.n-b.n)}

/* ---------- v23: live (re-)plan on a round model ----------
   Round 0 = the games on court now. Each court's remaining games follow in order: a busy court's next game is round 1,
   a free court's next game starts now (round 0). Hard: nobody twice in a round, nobody on court now in round 1.
   Soft (existing cap): max 2 in a row – only broken when a round can't be filled otherwise (fewer than 6 players per court).
   Kept as they are: played, on court, not played, assigned (court queue) and edited games. */
const JUST=5*60e3;
function justPlayed(g,t){t=t||Date.now();const oc=onCourt(g),s=new Set();Object.keys(g.since||{}).forEach(id=>{if(!oc.has(id)&&t-g.since[id]<JUST&&g.hist.some(h=>h.ids&&h.ids.includes(id)&&t-(h.at||0)<JUST))s.add(id)});return s}
function planLive(g,re){const d=g.d,ids=fullIds(g),C=courtsOf(d),t=Date.now();if(ids.length<4)return toast('Check in at least 4 players (with gender set) first'),0;
  const fp=g.fp||[],dn=fpDone(g),cur=fpCur(g),ok=new Set(ids),open=C.map((c,i)=>!g.closed[i]),busyC=C.map((c,i)=>!!(g.cur[i]&&g.cur[i].every(Boolean)));
  if(!open.some(Boolean))return toast('All courts are closed'),0;
  const fixed=fp.filter(x=>dn.has(x.n)||cur.has(x.n)||x.x),pos=C.map(()=>[]),used=new Set(),kc=k=>{if(k!=null&&open[k])return k;let b=-1;open.forEach((o,i)=>{if(o&&(b<0||pos[i].length<pos[b].length))b=i});return b};
  /* 1. games assigned to a court (its queue, in Upcoming order) */
  g.up.forEach(x=>{if(x.ac==null||!open[x.ac]||!x.q.some(Boolean))return;const f=x.n?fp.find(o=>o.n===x.n):null;if(f)used.add(f.n);pos[x.ac].push({k:{q:x.q.slice(),m:1,ac:x.ac,pts:f&&f.pts},n0:x.n||1e9})});
  /* 2. the rest of the plan (edited games kept), or – no plan yet – the session's remaining slots */
  let nums;
  if(re&&g.fp){const rest=fp.filter(x=>!fixed.includes(x)&&!used.has(x.n)).sort((a,b)=>a.n-b.n);nums=rest.map(x=>x.n).concat([...used]).sort((a,b)=>a-b);
    rest.forEach(x=>{const c=kc(x.c);if(c<0)return;const keep=x.m&&x.q.every(id=>id&&ok.has(id));pos[c].push({k:keep?{q:x.q.slice(),m:1,pts:x.pts}:null,n0:x.n})})}
  else{const man=g.up.filter(x=>x.ac==null&&x.m&&x.q.every(id=>id&&ok.has(id)));man.forEach(x=>{const c=kc(null);if(c>=0)pos[c].push({k:{q:x.q.slice(),m:1},n0:0})});
    const sl=fullSlots(d),n=Math.max(0,sl.length-g.hist.length-busyC.filter(Boolean).length-pos.flat().length);
    sl.slice(sl.length-n).forEach(s=>{const c=kc(s.c);if(c>=0)pos[c].push({k:null,n0:s.n})});nums=sl.slice(sl.length-pos.flat().length).map(s=>s.n)}
  /* 3. rounds: a court's p-th remaining game is round p (+1 when the court is busy) */
  const slots=[],keep={};let tn=0;pos.forEach((L,i)=>{L.sort((a,b)=>(a.k&&a.k.ac!=null?0:1)-(b.k&&b.k.ac!=null?0:1)||a.n0-b.n0);L.forEach((p,k)=>{const s={n:++tn,r:k+(busyC[i]?1:0),c:i};slots.push(s);if(p.k)keep[s.n]=Object.assign(p.k,{n:s.n,r:s.r,c:i})})});
  slots.sort((a,b)=>a.r-b.r||a.c-b.c);
  const oc=onCourt(g),jp=justPlayed(g,t),strk={};ids.forEach(id=>{if(oc.has(id)||jp.has(id))strk[id]=Math.max(1,g.strk[id]||1)});
  const P1=ids.filter(id=>!isDum(d,id)),W1=P1.filter(isF).length,nP=P1.filter(id=>W1>=2||!isF(id)).length;
  /* ≥ 6 players per open court: the 2-in-a-row cap is hard (a slot waits rather than a 3rd game in a row) */
  const pre={cur:g.cur.filter(q=>q&&q.every(Boolean)),onC:oc,jp,strk,hard:nP>=6*open.filter(Boolean).length};
  const P0=planCtx(g,ids);let best=null;for(let k=0;k<48;k++){const p=schedOnce(g,ids,slots,keep,P0,k,pre);if(!best||p.sc<best.sc)best=p;if(best.sc<1)break}LASTPLAN=best;
  /* 4. numbers: the free game numbers, in round order; on-court games become round B, the next rounds follow */
  const B=fixed.filter(x=>!cur.has(x.n)).reduce((a,x)=>Math.max(a,x.r+1),0),out=best.out.slice().sort((a,b)=>a.r-b.r||a.c-b.c);
  nums=nums.slice(0,out.length);let mx=Math.max(0,...fp.map(x=>x.n),...nums);while(nums.length<out.length)nums.push(++mx);nums.sort((a,b)=>a-b);
  const nw=out.map((x,k)=>{const y={n:nums[k],r:B+x.r,c:x.c,q:x.q.slice(),a:(x.a||x.q).slice(),m:x.m?1:0};if(x.pts)y.pts=x.pts;if(x.ac!=null)y.ac=x.ac;return y});
  g.fp=fixed.map(x=>cur.has(x.n)?Object.assign({},x,{r:B}):x).concat(nw).sort((a,b)=>a.n-b.n);g.fpAt=t;g.up=[];fpSync(g);return 1}
/* players of q who are on a court now: [{id,i}] */
function clashOf(g,q){const r=[];(q||[]).forEach(id=>{if(!id)return;const i=g.cur.findIndex(c=>c&&c.every(Boolean)&&c.includes(id));if(i>=0)r.push({id,i})});return r}
/* ▶ Start next on free court i: games assigned to it first (your order), then unassigned ones in Upcoming order.
   Never a game with a player on court; a game without players who just came off wins over one with them. -1 = none. */
function nextFor(g,i){const jp=justPlayed(g);let b=null;g.up.forEach((x,k)=>{if(x.ac!=null&&x.ac!==i)return;if(clashOf(g,x.q).length)return;
    const sc=(x.ac===i?0:4)+(x.q.every(Boolean)?0:2)+(x.q.some(id=>id&&jp.has(id))?1:0)+(g.st&&Date.now()<g.st+30*60e3&&x.q.some(id=>id&&isDum(g.d,id))?3:0)+(x.ac==null&&x.c===i?0:.5);if(!b||sc<b.sc)b={sc,k}});return b?b.k:-1}
