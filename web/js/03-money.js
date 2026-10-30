/* ===== money: Kitty sessions, bulk buys, Rebels partners, QR ===== */
function sessions(){const t=TODAY(),ds=new Set();
  Object.keys(S.days).forEach(d=>{if(d>t||!isSched(d))return;const g=S.games[d];if((g&&(g.st||g.hist.length||(g.ros&&g.ros.length)))||S.fin[d]||onIds(d).length)ds.add(d)});
  Object.keys(S.fin).forEach(d=>{if(d<=t&&!(S.days[d]&&S.days[d].x))ds.add(d)});
  Object.keys(S.games).forEach(d=>{const g=S.games[d];if(d<=t&&(g.st||g.hist.length)&&!(S.days[d]&&S.days[d].x))ds.add(d)});
  return[...ds].sort()}
function finOf(d,create){if(S.fin[d])return S.fin[d];const p=S.def;
  const f={court:p.court||'',cby:S.lastBy||'',fee:p.fee||'',used:0,paid:{},oth:[]};if(create)S.fin[d]=f;return f}
const payOf=(f,id)=>{const v=f.paid[id];return !v?null:v===true?{m:'cash',by:''}:v};
const ENT=t=>(S.ent||[]).filter(e=>e.t===t);
const pkgsFor=d=>ENT('pkg').filter(e=>(e.dates||[]).includes(d));
const pkgShare=d=>pkgsFor(d).reduce((a,e)=>a+num(e.amt)/Math.max(1,e.dates.length),0);
const SPT=()=>Math.max(1,num(S.def.spt)||12);
function shuttlePrice(d){let s=ENT('stock').filter(e=>!d||e.d<=d);if(!s.length)s=ENT('stock');const n=s.reduce((a,e)=>a+num(e.tubes)*SPT(),0);return n?s.reduce((a,e)=>a+num(e.amt),0)/n:0}
function stockLeft(){const st=ENT('stock');if(!st.length)return null;const first=st.map(e=>e.d).sort()[0],bought=st.reduce((a,e)=>a+num(e.tubes)*SPT(),0);
  const used=Object.keys(S.fin).filter(d=>d>=first).reduce((a,d)=>a+num(S.fin[d].used),0);return{left:bought-used,bought,used}}
const tubesTxt=n=>{const k=SPT(),t=Math.floor(Math.max(0,n)/k),r=Math.max(0,n)%k;return pl(t,'tube')+(r?' + '+r:'')};
/* v10: counted for finance = everyone on except dummies (snapshot at End session); manual tick in Finance wins */
function cntd(d,f,id){if(f.cnt&&id in f.cnt)return !!f.cnt[id];const D=S.days[d];return D&&D.dsnap?!D.dsnap.includes(id):!isDum(d,id)}
function calc(d,no){const f=finOf(d,false),g=S.games[d],D=S.days[d]||{};
  const all=[...new Set([...onIds(d),...(g&&g.ros?g.ros:[]),...Object.keys(f.paid).filter(k=>f.paid[k]),...Object.keys(D.att||{}).filter(k=>D.att[k].a)])].filter(id=>P(id)),ids=all.filter(id=>cntd(d,f,id));
  const pk=pkgsFor(d).length>0,COURT=pk?pkgShare(d):num(f.court),FEE=num(f.fee),PER=shuttlePrice(d)||num(f.box)/12;
  const pdn=ids.filter(id=>f.paid[id]).length,shut=num(f.used)*PER,oth=f.oth.reduce((a,o)=>a+num(o.amt),0),inv=COURT+shut+oth,ret=pdn*FEE;
  return{d,no,f,all,ids,pk,COURT,FEE,PER,pdn,pl:ids.length,shut,oth,inv,ret,sav:ret-inv,due:(ids.length-pdn)*FEE,loc:D.loc||'',c:courtsOf(d).length,ch:courtHrs(d),m:d.slice(0,7),
    st:g?g.st:0,en:g?g.en:0,bh:sessLenH(d),ps:g&&g.st?((g.en||Date.now())-g.st)/1000:0,ng:g?g.hist.length:0}}
const allCalc=()=>sessions().map((d,i)=>calc(d,i+1));
/* who holds the fees: per organizer, cash / bank */
function holds(list){const h={};list.forEach(s=>s.ids.forEach(id=>{const p=payOf(s.f,id);if(!p)return;const k=p.by||'';h[k]=h[k]||{cash:0,bank:0};h[k][p.m==='bank'?'bank':'cash']+=s.FEE}));return h}
function unpaidList(list){const u={};list.forEach(s=>s.ids.forEach(id=>{if(!s.f.paid[id]){u[id]=u[id]||[];u[id].push(s.d)}}));
  return Object.keys(u).map(id=>({id,ds:u[id].sort().reverse()})).sort((a,b)=>b.ds.length-a.ds.length||nameOf(a.id).localeCompare(nameOf(b.id)))}
function selTips(list){const sum=k=>list.reduce((a,s)=>a+s[k],0),ti=sum('inv'),tp=sum('pl'),tc=list.reduce((a,s)=>a+(s.c||0),0),tsh=sum('shut'),due=sum('due'),tips=[];
  const cur=list[list.length-1],games=sum('ng'),used=list.reduce((a,s)=>a+num(s.f.used),0);
  if(tp)tips.push('Break-even fee is AED '+Math.ceil(ti/tp)+' per player (now AED '+(cur?cur.FEE:0)+').');
  if(tc)tips.push('Courts average '+(tp/tc).toFixed(1)+' players. Aim for 6 per court: book one court fewer on low turnout days.');
  if(ti)tips.push('Shuttles are '+Math.round(tsh/ti*100)+'% of spend'+(games?' · '+(used/games).toFixed(1)+' shuttles per game':'')+'.');
  tips.push(A0(due)+' still unpaid in this selection.'+(due?' Collect before the next session.':''));
  return tips}

/* ---------- v10 court bookings: one row per scheduled session, price + paid by ---------- */
function bkOf(d){const D=S.days[d],g=S.games[d],f=S.fin[d],t=TODAY(),pk=pkgsFor(d).length>0,post=pkgsFor(d).some(e=>e.post&&e.post[d]);
  return{d,loc:D.loc||'',cs:courtsOf(d),ch:courtHrs(d),pk,amt:pk?pkgShare(d):f?num(f.court):0,by:f?f.cby:'',priced:pk||!!(f&&num(f.court)),
    st:g&&g.st?'Played':post?'Postponed':d>=t?'Upcoming':'Not played'}}
function bookings(p){const t=TODAY(),ds=Object.keys(S.days).filter(d=>isSched(d)&&(d>=t||inPer(d,p))).sort().reverse(),m={};
  ds.forEach(d=>{const k=d.slice(0,7);(m[k]=m[k]||[]).push(bkOf(d))});return Object.keys(m).sort().reverse().map(k=>({m:k,rows:m[k]}))}
/* ---------- Rebels: organisers' money ---------- */
function inPer(d,p){if(!p||p.m==='all')return true;return p.m==='month'?d.slice(0,7)===p.v:d.slice(0,4)===p.v}
function rebels(p){const all=allCalc(),list=all.filter(s=>inPer(s.d,p)),E=(S.ent||[]),o={};
  const org=k=>{if(!o[k])o[k]={id:k,courts:0,shut:0,oth:0,cash:0,bank:0,pin:0,pout:0};return o[k]};
  (S.orgs||[]).forEach(org);
  E.forEach(e=>{if(!inPer(e.d,p))return;const a=num(e.amt);
    if(e.t==='pkg')org(e.by||'').courts+=a;else if(e.t==='stock')org(e.by||'').shut+=a;else if(e.t==='oth'||e.t==='top'){const x=org(e.by||'');x.oth+=a;if(e.t==='top')x.cash+=a}
    else if(e.t==='pay'||e.t==='xfer'){org(e.from||'').pout+=a;org(e.to||'').pin+=a}});
  list.forEach(s=>{if(!s.pk&&s.COURT)org(s.f.cby||'').courts+=s.COURT;s.f.oth.forEach(x=>org(x.by||'').oth+=num(x.amt));
    if(!ENT('stock').length&&s.shut)org(s.f.cby||'').shut+=s.shut});
  Object.keys(S.days).forEach(d=>{if(d>TODAY()&&isSched(d)&&inPer(d,p)&&!pkgsFor(d).length&&S.fin[d]&&num(S.fin[d].court))org(S.fin[d].cby||'').courts+=num(S.fin[d].court)});
  const h=holds(list);Object.keys(h).forEach(k=>{org(k).cash+=h[k].cash;org(k).bank+=h[k].bank});
  Object.values(o).forEach(x=>{x.put=x.courts+x.shut+x.oth;x.hold=x.cash+x.bank+x.pin-x.pout;x.pos=x.hold-x.put});
  const spent=Object.values(o).reduce((a,x)=>a+x.put,0),coll=list.reduce((a,s)=>a+s.ret,0),visits=list.reduce((a,s)=>a+s.pl,0),kinv=list.reduce((a,s)=>a+s.inv,0);
  return{o,list,spent,coll,unpaid:list.reduce((a,s)=>a+s.due,0),bal:coll-spent,cph:visits?kinv/visits:0,visits}}
/* automatic + manual entries, newest first */
function entries(p){const out=[];allCalc().filter(s=>inPer(s.d,p)).forEach(s=>{
    if(!s.pk&&s.COURT)out.push({d:s.d,k:'put',lab:'Court · '+dlab(s.d)+' · '+s.loc,who:s.f.cby,amt:s.COURT,auto:1});
    s.f.oth.forEach(x=>out.push({d:s.d,k:'put',lab:(x.lab||'Other')+' · '+dlab(s.d),who:x.by,amt:num(x.amt),auto:1}));
    const h=holds([s]);Object.keys(h).forEach(k=>{if(h[k].cash)out.push({d:s.d,k:'coll',lab:'Fees · '+dlab(s.d)+' · cash',who:k,amt:h[k].cash,auto:1});if(h[k].bank)out.push({d:s.d,k:'coll',lab:'Fees · '+dlab(s.d)+' · bank',who:k,amt:h[k].bank,auto:1})})});
  Object.keys(S.days).forEach(d=>{if(d>TODAY()&&isSched(d)&&inPer(d,p)&&!pkgsFor(d).length&&S.fin[d]&&num(S.fin[d].court))out.push({d,k:'put',lab:'Court booking · '+dlab(d)+' · '+(S.days[d].loc||''),who:S.fin[d].cby,amt:num(S.fin[d].court),auto:1})});
  (S.ent||[]).forEach(e=>{if(!inPer(e.d,p))return;const L={pkg:'Court package · '+(e.loc||'')+' · '+(e.dates||[]).length+' sessions',stock:'Shuttle stock · '+num(e.tubes)+' tubes',oth:'Other · '+(e.note||''),top:'Top-up'+(e.note?' · '+e.note:''),
    pay:'Payback '+nameOf(e.from)+' → '+nameOf(e.to),xfer:'Transfer '+nameOf(e.from)+' → '+nameOf(e.to)}[e.t];
    out.push({d:e.d,k:e.t==='pay'||e.t==='xfer'?'pb':'put',lab:L,who:e.t==='pay'||e.t==='xfer'?'':e.by,amt:num(e.amt),id:e.id})});
  return out.sort((a,b)=>b.d<a.d?-1:b.d>a.d?1:0)}
/* last 3 months pace → next 3 months */
function forecast(){const t=TODAY(),from=addD(t,-91),L=allCalc().filter(s=>s.d>=from),R=rebels({m:'all'});
  const coll=L.reduce((a,s)=>a+s.ret,0)/3,spend=L.reduce((a,s)=>a+s.inv,0)/3,gain=coll-spend,used=L.reduce((a,s)=>a+num(s.f.used),0),perS=L.length?used/L.length:0,spm=L.length/3;
  const neg=Object.values(R.o).filter(x=>x.id&&x.pos<-1).sort((a,b)=>a.pos-b.pos)[0],sl=stockLeft();let back='',runout='';
  if(neg)back=gain>0?nameOf(neg.id)+' is paid back in ≈ '+Math.ceil(-neg.pos/gain)+' month'+(Math.ceil(-neg.pos/gain)>1?'s':'')+' (AED '+Math.round(-neg.pos)+' out of pocket)':nameOf(neg.id)+' is AED '+Math.round(-neg.pos)+' out of pocket – not paid back at this pace';
  if(sl&&perS){const ss=sl.left/perS,mo=spm?ss/spm:0;runout='Shuttles last ≈ '+Math.floor(ss)+' sessions'+(mo?' (≈ '+(mo<1?Math.round(mo*4)+' weeks':mo.toFixed(1)+' months')+')':'')+(sl.left<4*SPT()?' · re-order now':' · re-order when under 4 tubes')}
  return{coll:coll*3,spend:spend*3,gain:gain*3,back,runout,n:L.length,spm,L}}
function betterPlan(){const F=forecast(),L=F.L,acts=[];if(!L.length)return{acts,tot:0};const fee=L[L.length-1].FEE||0,vis=L.reduce((a,s)=>a+s.pl,0)/3;
  if(fee)acts.push(['Raise the fee '+fee+' → '+(fee+3),Math.round(vis*3)]);
  const ones=L.filter(s=>s.c===1&&s.pl<6);if(ones.length&&fee)acts.push(['Fill 1-court sessions to 6+ players',Math.round(ones.reduce((a,s)=>a+(6-s.pl)*fee,0)/3)]);
  const cm=L.reduce((a,s)=>a+s.COURT,0)/3;if(cm)acts.push(['Ask the venue for a monthly court package (≈10% off)',Math.round(cm*.1)]);
  const due=allCalc().reduce((a,s)=>a+s.due,0);if(due)acts.push(['Collect '+A0(due)+' unpaid fees before the next session (one-off)',0]);
  const g=L.reduce((a,s)=>a+s.ng,0),u=L.reduce((a,s)=>a+num(s.f.used),0),pr=shuttlePrice(TODAY())||L[L.length-1].PER;
  if(g&&u/g>1.3&&pr)acts.push(['Watch shuttles per game ('+(u/g).toFixed(1)+' → 1.2)',Math.round((u/g-1.2)*g/3*pr)]);
  const R=rebels({m:'all'}),hi=Object.values(R.o).filter(x=>x.id&&x.pos>1).sort((a,b)=>b.pos-a.pos)[0],lo=Object.values(R.o).filter(x=>x.id&&x.pos<-1).sort((a,b)=>a.pos-b.pos)[0];
  if(hi&&lo)acts.push([nameOf(hi.id)+' hands AED '+Math.round(Math.min(hi.pos,-lo.pos))+' cash to '+nameOf(lo.id)+' to even out',0]);
  return{acts,tot:acts.reduce((a,x)=>a+x[1],0)}}

/* ---------- QR code (byte mode, ECC L, versions 1–15), offline ---------- */
const QR=(function(){const EC=[0,[7,1,19],[10,1,34],[15,1,55],[20,1,80],[26,1,108],[18,2,68],[20,2,78],[24,2,97],[30,2,116],[18,2,68,2,69],[20,4,81],[24,2,92,2,93],[26,4,107],[30,3,115,1,116],[22,5,87,1,88]];
  const AL=[0,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70]];
  const EXP=new Array(512),LOG=new Array(256);let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=285}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
  const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
  function rs(data,n){let g=[1];for(let i=0;i<n;i++){const ng=new Array(g.length+1).fill(0);g.forEach((c,j)=>{ng[j]^=c;ng[j+1]^=mul(c,EXP[i])});g=ng}
    const r=new Array(n).fill(0);data.forEach(b=>{const f=b^r[0];r.shift();r.push(0);if(f)for(let j=0;j<n;j++)r[j]^=mul(g[j+1],f)});return r}
  function make(text){const bytes=[...unescape(encodeURIComponent(text))].map(c=>c.charCodeAt(0));let v=1,cap;
    for(;v<=15;v++){const e=EC[v];cap=e[1]*e[2]+(e[3]||0)*(e[4]||0);if((4+(v<10?8:16)+bytes.length*8)<=cap*8)break}if(v>15)return null;
    const e=EC[v],bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push(val>>i&1)};put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
    put(0,Math.min(4,cap*8-bits.length));while(bits.length%8)bits.push(0);const dw=[];for(let i=0;i<bits.length;i+=8)dw.push(parseInt(bits.slice(i,i+8).join(''),2));
    for(let p=0;dw.length<cap;p++)dw.push(p%2?17:236);
    const blocks=[];let k=0;for(let i=0;i<e[1];i++){blocks.push(dw.slice(k,k+e[2]));k+=e[2]}for(let i=0;i<(e[3]||0);i++){blocks.push(dw.slice(k,k+e[4]));k+=e[4]}
    const ecb=blocks.map(b=>rs(b,e[0])),out=[],mx=Math.max(...blocks.map(b=>b.length));
    for(let i=0;i<mx;i++)blocks.forEach(b=>{if(i<b.length)out.push(b[i])});for(let i=0;i<e[0];i++)ecb.forEach(b=>out.push(b[i]));
    const N=17+4*v,M=[...Array(N)].map(()=>new Array(N).fill(null));const set=(r,c,b)=>{M[r][c]=b?1:0};
    const finder=(r,c)=>{for(let i=-1;i<=7;i++)for(let j=-1;j<=7;j++){const rr=r+i,cc=c+j;if(rr<0||cc<0||rr>=N||cc>=N)continue;
      set(rr,cc,i>=0&&i<=6&&j>=0&&j<=6&&(i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4)))}};
    finder(0,0);finder(0,N-7);finder(N-7,0);for(let i=8;i<N-8;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
    const al=AL[v],na=al.length;al.forEach((r,ai)=>al.forEach((c,aj)=>{if((ai===0&&aj===0)||(ai===0&&aj===na-1)||(ai===na-1&&aj===0))return;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)set(r+i,c+j,Math.max(Math.abs(i),Math.abs(j))!==1)}));
    set(N-8,8,1);const res=[];for(let i=0;i<9;i++){res.push([8,i],[i,8])}for(let i=0;i<8;i++){res.push([8,N-1-i],[N-1-i,8])}res.forEach(([r,c])=>{if(M[r][c]===null)M[r][c]=0});
    if(v>=7)for(let i=0;i<6;i++)for(let j=0;j<3;j++){M[i][N-11+j]=0;M[N-11+j][i]=0}
    const fn=M.map(r=>r.map(c=>c!==null));let bi=0;const ab=[];out.forEach(b=>{for(let i=7;i>=0;i--)ab.push(b>>i&1)});
    for(let c=N-1,up=true;c>0;c-=2){if(c===6)c--;for(let k2=0;k2<N;k2++){const r=up?N-1-k2:k2;for(let j=0;j<2;j++){const cc=c-j;if(fn[r][cc])continue;let b=bi<ab.length?ab[bi]:0;bi++;if((r+cc)%2===0)b^=1;M[r][cc]=b}}up=!up}
    const bch=(d,g,n)=>{let r=d<<n;const gl=Math.floor(Math.log2(g));for(let i=Math.floor(Math.log2(r));i>=gl;i--)if(r>>i&1)r^=g<<(i-gl);return d<<n|r};
    const fmt=bch(1<<3|0,0x537,10)^0x5412;
    for(let i=0;i<15;i++){const b=fmt>>i&1;
      if(i<6)M[i][8]=b;else if(i===6)M[7][8]=b;else if(i===7)M[8][8]=b;else if(i===8)M[8][7]=b;else M[8][14-i]=b;
      if(i<8)M[8][N-1-i]=b;else M[N-15+i][8]=b}
    M[N-8][8]=1;
    if(v>=7){const vb=bch(v,0x1F25,12);for(let i=0;i<18;i++){const b=vb>>i&1,r=Math.floor(i/3),c=N-11+i%3;M[r][c]=b;M[c][r]=b}}
    return M}
  function svg(text,px){const M=make(text);if(!M)return '';const N=M.length,q=4,s=N+q*2;let p='';
    M.forEach((r,i)=>r.forEach((b,j)=>{if(b)p+='M'+(j+q)+' '+(i+q)+'h1v1h-1z'}));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+px+'" height="'+px+'" viewBox="0 0 '+s+' '+s+'" shape-rendering="crispEdges"><rect width="'+s+'" height="'+s+'" fill="#fff"/><path d="'+p+'" fill="#000"/></svg>'}
  return{make,svg}})();
function waLink(id,ds){const p=P(id),ph=(p&&p.ph||'').replace(/[^0-9]/g,'');
  const msg='Hi '+(p?p.name.split(' ')[0]:'')+', a friendly reminder from Rebels Badminton: your fee for '+(ds.length>1?'the sessions on ':'the session on ')+ds.map(dshort).join(', ')+' is still pending. Thank you!';
  return 'https://wa.me/'+(ph||'')+'?text='+encodeURIComponent(msg)}
