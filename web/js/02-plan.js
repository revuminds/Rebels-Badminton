/* ===== games: mixing, planner, live auto-adapt, learning ===== */
const blankLive=()=>({run:false,start:0,sa:0,sb:0,el:0,w:''});
const NUL4=()=>[null,null,null,null];
const running=g=>!!(g&&g.st&&!g.en);
const capOf=g=>g.deuce&&+g.pts<30?Math.max(+g.pts,Math.min(30,+g.pts+9)):+g.pts;
const winOf=(g,l)=>g.deuce&&+g.pts<30?Math.min(capOf(g),Math.max(+g.pts,l+2)):+g.pts;
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
  if(running(g)){const onC=new Set(g.cur.flat().filter(Boolean)),t=Date.now();onIds(d).forEach(id=>{if(eligible(d,id)&&!onC.has(id)&&g.since[id]==null)g.since[id]=t})}
  return g}
const k2=(a,b)=>a<b?a+'|'+b:b+'|'+a;
function counts(g,pending){const c={};g.hist.forEach(h=>h.ids.forEach(id=>c[id]=(c[id]||0)+1));
  if(pending)g.cur.forEach(q=>{if(q&&q.every(Boolean))q.forEach(id=>c[id]=(c[id]||0)+1)});return c}
function effMap(g){const b={};g.hist.slice().reverse().forEach(h=>{const m=Math.abs(h.sa-h.sb);const w=h.sa>h.sb?[h.ids[0],h.ids[1]]:[h.ids[2],h.ids[3]];
  h.ids.forEach(id=>{b[id]=Math.max(0,(b[id]||0)-.25)});if(m>=8&&h.sa!==h.sb)w.forEach(id=>{b[id]=Math.min(1.5,(b[id]||0)+.75)})});
  const e={};S.players.forEach(p=>e[p.id]=p.lv+(b[p.id]||0));return e}
function pairMaps(g){const p={},o={};g.hist.forEach(h=>{const[a1,a2,b1,b2]=h.ids;p[k2(a1,a2)]=(p[k2(a1,a2)]||0)+1;p[k2(b1,b2)]=(p[k2(b1,b2)]||0)+1;
  [[a1,b1],[a1,b2],[a2,b1],[a2,b2]].forEach(([x,y])=>o[k2(x,y)]=(o[k2(x,y)]||0)+1)});return{p,o}}
/* learned rules make their part of the mixing score count double */
const ruleOn=k=>(S.rules||[]).some(r=>r.k===k&&r.on);
const WT=()=>({bal:ruleOn('bal')?6:3,spr:ruleOn('grp')?4:2,rp:ruleOn('fresh')?8:4,ro:1.5,stack:ruleOn('nostack')?120:60});
/* built-in: two Int+ (or stronger) partners only against equally strong opponents */
function stacked(a1,a2,b1,b2){const s=x=>lvOf(x),A2=s(a1)+s(a2),B2=s(b1)+s(b2);
  return (s(a1)>=3&&s(a2)>=3&&B2<A2-1)||(s(b1)>=3&&s(b2)>=3&&A2<B2-1)}
function groupCost(q,e,pr){const w=WT(),v=q.map(id=>e[id]||0);const spread=Math.max(...v)-Math.min(...v);let best=null;
  for(const s of [[0,1,2,3],[0,2,1,3],[0,3,1,2]]){const[a1,a2,b1,b2]=s.map(k=>q[k]);const d=Math.abs((e[a1]||0)+(e[a2]||0)-(e[b1]||0)-(e[b2]||0));
    const rp=(pr.p[k2(a1,a2)]||0)+(pr.p[k2(b1,b2)]||0);const ro=[[a1,b1],[a1,b2],[a2,b1],[a2,b2]].reduce((t,[x,y])=>t+(pr.o[k2(x,y)]||0),0);
    const c=d*w.bal+rp*w.rp+ro*w.ro+(stacked(a1,a2,b1,b2)?w.stack:0);if(!best||c<best.c)best={c,order:[a1,a2,b1,b2]}}
  return{cost:spread*w.spr+best.c,order:best.order}}
const rnd=n=>Math.floor(Math.random()*n);
function mix(ids,g){if(!ids.length)return[];const e=effMap(g),pr=pairMaps(g);
  const s=ids.slice().sort((a,b)=>e[b]-e[a]);const gr=[];for(let i=0;i<s.length;i+=4)gr.push(s.slice(i,i+4));
  const gc=q=>groupCost(q,e,pr).cost;const cs=gr.map(gc);
  for(let it=0;it<600&&gr.length>1;it++){const a=rnd(gr.length),b=rnd(gr.length);if(a===b)continue;const i=rnd(4),j=rnd(4);
    const X=gr[a].slice(),Y=gr[b].slice();const t=X[i];X[i]=Y[j];Y[j]=t;const cx=gc(X),cy=gc(Y);
    if(cx+cy<cs[a]+cs[b]-1e-9){gr[a]=X;gr[b]=Y;cs[a]=cx;cs[b]=cy}}
  return gr.map(q=>groupCost(q,e,pr).order)}
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
function inGames(g){const m={};const f=x=>x.q.forEach(id=>{if(id)m[id]=(m[id]||0)+1});g.up.forEach(f);g.qq.forEach(L=>L.forEach(f));return m}
function ctxOf(g){const proj=counts(g,true),inUp={},c={proj,inUp,onC:onCourt(g),prev:new Set()};g.qq.forEach(L=>L.forEach(x=>ctxAdd(c,x.q)));g.up.forEach(x=>ctxAdd(c,x.q));return c}
function ctxAdd(c,q){q.forEach(id=>{if(id){c.proj[id]=(c.proj[id]||0)+1;c.inUp[id]=(c.inUp[id]||0)+1}});c.prev=new Set(q.filter(Boolean))}
/* suggestion only: best players to fill `need` empty slots next to `keep` (fair share first, dummies last, levels mixed) */
function pickFor(g,keep,need,cx){const d=g.d,t=Date.now(),ex=new Set(keep.filter(Boolean));
  const c=onIds(d).filter(id=>eligible(d,id)&&!ex.has(id)).map(id=>{const tg=Math.max(1,target(g,id)),w=g.since[id]!=null?(t-g.since[id])/60e3:0;
    return{id,s:(cx.proj[id]||0)/tg*10+(isDum(d,id)?100:0)+(cx.inUp[id]||0)*6+(cx.onC.has(id)?3:0)+(cx.prev.has(id)?5:0)+(blocked(g,id,t)?5:0)-Math.min(w,40)/8+Math.random()*.5}}).sort((a,b)=>a.s-b.s);
  if(c.length<need)return null;const top=c.slice(0,need+4),e=effMap(g),pr=pairMaps(g),base=keep.filter(Boolean);let best=null;
  const rec=(st,ch)=>{if(ch.length===need){const q=base.concat(ch.map(x=>x.id)),sc=groupCost(q,e,pr).cost+ch.reduce((a,x)=>a+x.s,0)*1.5;if(!best||sc<best.sc)best={sc,ids:ch.map(x=>x.id)};return}
    for(let k=st;k<top.length;k++)rec(k+1,ch.concat(top[k]))};rec(0,[]);return best?best.ids:null}
/* the app keeps ≥5 upcoming games: 'fill' tops up / refills slots it emptied, 'all' also re-picks every upcoming game the admin has not touched.
   Queued games and anything the admin placed are never changed – except players who left or were turned off. */
function autoNext(g,mode,why){if(!running(g))return 0;const d=g.d,on=new Set(onIds(d));let ch=0;
  const bad=id=>id&&(!on.has(id)||!!leftAt(d,id));
  g.qq.forEach((L,i)=>{if(g.closed[i]&&L.length){g.up.unshift(...L);g.qq[i]=[];ch=1}});
  if(mode==='all'){const n0=g.up.length;g.up=g.up.filter(x=>x.m);if(g.up.length!==n0)ch=1}
  const all=[...g.qq.flat(),...g.up];
  all.forEach(x=>{if(x.q.some(bad)){x.q=x.q.map(id=>bad(id)?null:id);x.rf=1;ch=1}else if(!x.m&&x.q.some(v=>!v))x.rf=1});
  g.up=g.up.filter(x=>x.q.some(Boolean)||!x.m);
  const cx=ctxOf(g);
  all.forEach(x=>{if(!x.rf)return;delete x.rf;const need=x.q.filter(v=>!v).length;if(!need)return;const ids=pickFor(g,x.q,need,cx);if(!ids)return;
    x.q=x.q.map(v=>v||ids.shift());if(!x.m){x.q=orderQ(x.q,g);x.a=x.q.slice()}ctxAdd(cx,x.q)});
  const lu=g.up[g.up.length-1];cx.prev=new Set(lu?lu.q.filter(Boolean):[]);
  for(let k=0;k<12&&g.up.length<5;k++){const ids=pickFor(g,NUL4(),4,cx);if(!ids)break;const q=orderQ(ids,g);g.up.push({q,m:0,a:q.slice()});ctxAdd(cx,q);ch=1}
  if(ch&&why)logIt(g,why);return ch}
const gList=(g,t,i)=>t==='u'?g.up:g.qq[i];

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
const planSig=g=>[Math.round(gameMin(g)*2),onIds(g.d).sort().join(','),JSON.stringify(courtsOf(g.d)),g.slot,g.chg,JSON.stringify(S.dum||{}),S.players.map(p=>p.lv).join(''),(S.rules||[]).filter(r=>r.on).map(r=>r.k).join('')].join('/');
const tier=(d,id,c)=>isDum(d,id)?3:c>=TGT?2:0;
function buildPlan(g){let best=null;const ids=onIds(g.d);for(let k=0;k<80;k++){if(k===40&&best.sc<100)break;const p=planOnce(g,k>=40),cn={};let em=0;
  p.forEach((rd,r)=>rd.forEach((q,i)=>{if(q.every(Boolean))q.forEach(id=>cn[id]=(cn[id]||0)+1);else if(r<courtRounds(g,i))em++}));
  const rc=ids.filter(id=>!isDum(g.d,id)).map(id=>cn[id]||0),oc=ids.filter(id=>isDum(g.d,id)).reduce((a,id)=>a+(cn[id]||0),0),sc=em*100+(rc.length?Math.max(...rc)-Math.min(...rc):0)*3+oc*.2;if(!best||sc<best.sc)best={sc,p};if(!sc)break}
  const keep=g.nxt.map((q,i)=>g.nman[i]?q:null);g.nxt=best.p[0].map((q,i)=>keep[i]||q);g.plan=best.p.slice(1);g.psig=planSig(g)}
function planOnce(g,soft){const ids=onIds(g.d),R=planRounds(g),fake={d:g.d,hist:[]},c={},st={},lr={},rounds=[],nC=courtsOf(g.d).length;
  for(let r=0;r<R;r++){const av=[];for(let i=0;i<nC;i++)if(r<courtRounds(g,i)||(r===0&&!courtRounds(g,i)))av.push(i);
    const pool=ids.filter(id=>!(lr[id]===r-1&&st[id]>=2)).map(id=>{const k=c[id]||0;return{id,c:k,o:tier(g.d,id,k),s:lr[id]===r-1?st[id]:0,x:Math.random()}}).sort((a,b)=>a.o-b.o||(a.c+a.s*.75)-(b.c+b.s*.75)||a.x-b.x).map(x=>x.id);
    const n=Math.min(av.length,Math.floor(pool.length/4));const gr=n?mix(pool.slice(0,n*4),fake):[];gr.forEach(q=>{fake.hist.unshift({ids:q,sa:0,sb:0});q.forEach(id=>{st[id]=lr[id]===r-1?(st[id]||0)+1:1;c[id]=(c[id]||0)+1;lr[id]=r})});
    const rd=[];for(let i=0;i<nC;i++)rd.push(NUL4());av.forEach((i,k)=>{if(gr[k])rd[i]=gr[k]});rounds.push(rd)}
  return rounds}
function ensurePlan(g){if(g.st)return;if(g.psig!==planSig(g))return buildPlan(g);const on=new Set(onIds(g.d));g.plan=g.plan.map(rd=>rd.map(q=>q.map(id=>id&&on.has(id)?id:null)))}
const qref=(g,x)=>{const a=String(x).split('.').map(Number);return a[0]?g.plan[a[0]-1][a[1]]:g.nxt[a[1]]};

/* ---------- bench time ---------- */
function benchOn(g,id,t){if(!running(g)||!eligible(g.d,id))return;if(g.since[id]==null)g.since[id]=t}
function benchOff(g,id,t){if(g.since[id]!=null){g.btot[id]=(g.btot[id]||0)+Math.max(0,t-g.since[id])/1000;delete g.since[id]}}
function benchSec(g,id,t){if(g.man&&!running(g)&&g.st&&g.en&&!Object.keys(g.btot).length){const pl2=g.hist.filter(h=>h.ids.includes(id)).reduce((a,h)=>a+h.s,0);return Math.max(0,(g.en-g.st)/1000-pl2)}
  return(g.btot[id]||0)+(running(g)&&g.since[id]!=null?((t||Date.now())-g.since[id])/1000:0)}
const tn=(h,k)=>{const n=h.ids.slice(k*2,k*2+2).map(nameOf);return n.every(x=>x!=='?')?n.join(' & '):((k?h.b:h.a)||[]).join(' & ')};
const hlab=h=>(h.m?'Manual':'#'+(h.r||'–'))+(h.s!=null&&h.at?' · '+hm(h.at-h.s*1000):'');

/* ---------- court flow ---------- */
function saveGame(g,i,t){t=t||Date.now();const q=g.cur[i],L=g.live[i];const s=Math.max(0,L.run?(t-L.start)/1000:(L.el||0));
  const n=g.hist.filter(h=>h.c===i+1&&!h.m).length+1;
  const h={r:n,c:i+1,ids:q.slice(),a:[nameOf(q[0]),nameOf(q[1])],b:[nameOf(q[2]),nameOf(q[3])],sa:L.sa,sb:L.sb,s:Math.round(s),at:t};
  g.hist.unshift(h);g.last[i]=h;g.cur[i]=NUL4();g.live[i]=blankLive();q.forEach(id=>benchOn(g,id,t));
  autoNext(g,'fill',null)}
/* send a game (from a court queue or Upcoming) on court; the timer starts. Manual choice always wins (not-checked-in players are checked in). */
function sendCourt(g,i,x){const t=Date.now(),q=x.q,d=g.d;if(!running(g))return;if(!q.every(Boolean)||new Set(q).size<4)return toast('Pick 4 different players');
  const bi=g.cur.findIndex((c,j)=>j!==i&&c&&c.some(id=>q.includes(id)));if(bi>=0){const b=q.find(id=>g.cur[bi].includes(id));return toast(nameOf(b)+' is still on '+cname(d,bi))}
  if(g.cur[i]&&g.cur[i].some(Boolean))return toast(cname(d,i)+' still has a game – Stop & save first');
  const D=day(d);D.att=D.att||{};q.forEach(id=>{const a=D.att[id];if(!a||!a.a){D.att[id]={a:t};logIt(g,nameOf(id)+' checked in (sent on court)')}else if(a.l)a.l=0});
  [g.up,...g.qq].forEach(L=>{const k=L.indexOf(x);if(k>=0)L.splice(k,1)});
  q.forEach(id=>{const w=g.since[id]!=null?t-g.since[id]:Infinity;g.strk[id]=w<REST?(g.strk[id]||0)+1:1;benchOff(g,id,t)});
  g.cur[i]=q.slice();g.live[i]=Object.assign(blankLive(),{run:true,start:t});g.round++;autoNext(g,'fill',null);save();render()}
function startSession(){const d=curDate(),g=G(d);if(d!==TODAY())return toast('Only today’s session can be started');if(g.st)return;if(onIds(d).length<4)return toast('Turn on at least 4 players first');
  ['pts','deuce','slot','chg'].forEach(k=>g[k]=S.def[k]);
  g.st=Date.now();g.en=0;day(d).att={};g.nxt=g.nxt.map(()=>NUL4());g.nman=[];g.since={};g.up=[];g.qq=courtsOf(d).map(()=>[]);g.closed={};g.v12=1;
  logIt(g,'Session started · check players in with the Players button – only checked-in players are auto-picked');save();render()}
function endSession(g,t){g.cur.forEach((q,i)=>{const L=g.live[i];if(q&&q.every(Boolean)&&L&&(L.run||L.el||L.sa||L.sb))saveGame(g,i,t)});
  Object.keys(g.since).forEach(id=>benchOff(g,id,t));
  const D=S.days[g.d];g.ros=[...new Set([...(g.ros||[]),...(D?Object.keys(D.on).filter(k=>D.on[k]):[]),...g.hist.flatMap(h=>h.ids)])];
  if(D&&D.att)Object.keys(D.att).forEach(id=>{const a=D.att[id];if(a.a&&!a.l)a.e=t});
  if(D)D.dsnap=Object.keys(S.dum||{}).filter(k=>S.dum[k]);
  g.cur=g.cur.map(()=>NUL4());g.live=g.live.map(blankLive);g.up=[];g.qq=g.qq.map(()=>[]);g.en=t;if(D)D.on={}}

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
