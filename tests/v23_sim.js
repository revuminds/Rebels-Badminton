/* v23 stress simulation (runs inside the app page via window.RB). Random sessions: 8–20 players, 1–3 courts, late arrivals,
   leavers, manual edits, court assigns, Start next on free courts and Re-plan at random points. After every (re-)plan it checks:
   - no player twice in one round (unless both games are kept manual/assigned games, which are only flagged)
   - no player who is on court now in the court's next game (rounds B and B+1)
   - no 3 in a row when there are ≥ 6 checked-in players per court (the existing 2-in-a-row cap)
   and on every Start next: the game picked has nobody on court. */
(function(){const R=window.RB,o={runs:0,replans:0,starts:0,sameRound:0,onCourtNext:0,b2b:0,b2bRuns:0,startClash:0,sendFail:0,ex:[]};
  let T=0;const DN=Date.now;Date.now=()=>T;let seed=12345;Math.random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};const rnd=n=>Math.floor(Math.random()*n);
  const toastO=window.alert;
  function check(g,tag){const d=g.d,fp=g.fp||[],dn=R.fpDone(g),cur=R.fpCur(g),oc=R.onCourt(g);o.replans++;o.slots=(o.slots||0)+(g.fp||[]).filter(x=>!x.x&&!R.fpDone(g).has(x.n)&&!R.fpCur(g).has(x.n)).length;o.empty=(o.empty||0)+(g.fp||[]).filter(x=>!x.x&&!R.fpDone(g).has(x.n)&&!x.q.every(Boolean)).length;
    const live=fp.filter(x=>!x.x&&!dn.has(x.n)&&x.q.every(Boolean)),B=Math.min(...live.map(x=>x.r));if(!live.length)return;
    const byR={};live.forEach(x=>(byR[x.r]=byR[x.r]||[]).push(x));
    Object.keys(byR).forEach(r=>{const L=byR[r],seen={};L.forEach(x=>x.q.forEach(id=>{(seen[id]=seen[id]||[]).push(x)}));
      Object.keys(seen).forEach(id=>{const G2=seen[id];if(G2.length>1&&G2.some(x=>!x.m&&!cur.has(x.n))){o.sameRound++;if(o.ex.length<12)o.ex.push(tag+' same round r'+r+' '+id+' in G'+G2.map(x=>x.n).join(',G'))}})});
    live.forEach(x=>{if(cur.has(x.n)||x.m)return;if(x.r<=B+1&&x.q.some(id=>oc.has(id))){o.onCourtNext++;if(o.ex.length<12)o.ex.push(tag+' on-court player in G'+x.n+' r'+x.r+' (B='+B+')')}});
    const fi=R.fullIds(g),W=fi.filter(R.isF).length,part=fi.filter(id=>!R.isDum(d,id)&&!(W<2&&R.isF(id))),nC=(R.S.days[d].courts||[]).filter((c,i)=>!g.closed[i]).length;
    if(part.length>=6*nC){o.b2bRuns++;const rr=Object.keys(byR).map(Number).sort((a,b)=>a-b),jp=R.justPlayed(g);
      part.forEach(id=>{let s=jp.has(id)?(g.strk[id]||1):0,prev=B-1;rr.forEach(r=>{const x=byR[r].find(y=>y.q.includes(id));if(!x){s=0;prev=r;return}s=r===prev+1?s+1:1;prev=r;
        if(s>=3&&!x.m&&!cur.has(x.n)){o.b2b++;if(o.ex.length<12)o.ex.push(tag+' 3-in-a-row '+id+' G'+x.n+' ('+part.length+' players/'+nC+' courts) B='+B+' rounds='+rr.filter(r=>byR[r].some(y=>y.q.includes(id))).join(',')+' jp='+jp.has(id)+' oc='+oc.has(id)+' strk='+g.strk[id]+' m='+(byR[B+1]||[]).concat(byR[B+2]||[]).map(y=>y.n+'r'+y.r+(y.m?'m':'')+(y.ac!=null?'a':'')+':'+y.q.join('/')).join(' '))}})})}}
  function run(n,nC){const S=R.S,d='2026-12-06',t0=Date.parse(d+'T20:00:00+04:00');T=t0;S.games={};S.dum={};
    const all=S.players.map(p=>p.id).sort(()=>Math.random()-.5),pick=all.slice(0,n),late=new Set(pick.slice(n-rnd(4)));
    S.days={};S.days[d]={sch:1,time:'20:00',loc:'Sim',courts:Array.from({length:nC},(_,i)=>({n:'Court '+(i+1),h:2})),on:Object.fromEntries(pick.map(i=>[i,true])),att:{}};
    pick.forEach(id=>{if(!late.has(id))S.days[d].att[id]={a:T}});
    const g=R.G(d);Object.assign(g,{st:T,en:0,since:{},up:[],closed:{},strk:{},hist:[],v23:1});
    if(!R.planFull(g,false))return;check(g,'n'+n+'c'+nC+' start');o.runs++;
    const len={},end=t0+135*60e3;
    for(let step=0;step<200&&T<end;step++){T+=(1+rnd(3))*60e3;const D=S.days[d];
      g.cur.forEach((q,i)=>{if(q&&q.every(Boolean)&&g.live[i].run&&T-g.live[i].start>=(len[i]||10)*60e3){g.live[i].sa=21;g.live[i].sb=rnd(20);R.saveGame(g,i,T)}});
      if(Math.random()<.12){const w=pick.filter(id=>!(D.att[id]&&D.att[id].a));if(w.length)D.att[w[0]]={a:T}}
      if(Math.random()<.04){const oc=R.onCourt(g),c=pick.filter(id=>R.fullIds(g).includes(id)&&!oc.has(id));if(c.length>4*nC+2)D.att[c[rnd(c.length)]].l=T}
      if(Math.random()<.15&&g.up.length){const x=g.up[rnd(Math.min(4,g.up.length))],k=rnd(4),old=x.q[k],f=(g.fp||[]).find(y=>y.n===x.n),r=f?f.r:-1,oc=R.onCourt(g);
        const inR=new Set((g.fp||[]).filter(y=>y.r===r).flatMap(y=>y.q)),c=R.fullIds(g).filter(id=>!x.q.includes(id)&&!oc.has(id)&&!inR.has(id)&&R.isF(id)===R.isF(old));
        if(old&&c.length){x.q[k]=c[rnd(c.length)];x.m=1;R.fpSync(g)}}
      if(Math.random()<.08&&g.up.length){const x=g.up[rnd(g.up.length)],i=rnd(nC);if(!R.clashOf(g,x.q).some(c=>c.i!==i)&&R.qOf(g,i).length<3){x.ac=i;x.m=1;R.fpSync(g)}}
      g.cur.forEach((q,i)=>{if(q&&q.some(Boolean))return;const k=R.nextFor(g,i);if(k<0)return;const x=g.up[k];if(R.clashOf(g,x.q).length){o.startClash++;return}
        if(!x.q.every(Boolean))return;const h0=g.cur[i];R.sendCourt(g,i,x);if(g.cur[i]&&g.cur[i].every(Boolean)&&g.cur[i]!==h0){o.starts++;len[i]=8+rnd(6)}else o.sendFail++});
      if(Math.random()<.2&&R.planFull(g,true))check(g,'n'+n+'c'+nC+' t+'+Math.round((T-t0)/60e3));}
  }
  try{for(let k=0;k<70;k++)run(8+rnd(13),1+rnd(3))}catch(e){o.err=String(e&&e.stack||e)}
  Date.now=DN;window.__SIM=o})();
