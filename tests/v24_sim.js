/* v24 session simulation (inside the app page via window.RB). Real-ish Sunday: regulars + organizer fill-ins, 2 courts × 2 h,
   game lengths 8–14 min, Start next on every free court, optional Rebel Update after every game. Reports games per player,
   fill-ins in the first 30 min, on-court players picked for the next game, 3-in-a-row, gaps between a player's games. */
window.__SIM24=function(cfg){const R=window.RB;cfg=cfg||{};const DN=Date.now;let T=0;Date.now=()=>T;let seed=cfg.seed||7;const MR=Math.random;
  Math.random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const S=R.S,d=R.TODAY(),t0=Date.parse(d+'T10:00:00+04:00');T=t0;
  const reg=cfg.reg||['p9','p20','p13','p25','p17','p11','p23','p16','p24','p12','p21','p19','p22'],fi=cfg.fi||['p1','p2','p4'];const all=reg.concat(fi);
  S.games={};S.dum=Object.fromEntries(fi.map(i=>[i,1]));S.days={};S.days[d]={sch:1,time:'10:00',loc:'Sportsbay',courts:[{n:'Court 1',h:2},{n:'Court 2',h:2}],on:Object.fromEntries(all.map(i=>[i,true])),att:Object.fromEntries(all.map(i=>[i,{a:t0}]))};
  const g=R.G(d);Object.assign(g,{st:t0,en:0,since:{},up:[],closed:{},strk:{},hist:[],v23:1});R.planFull(g,false);
  const o={early:0,onNext:0,b3:0,upd:0,changes:0,err:''},endAt=[0,0],end=t0+2*3600e3;let guard=0;
  try{while(guard++<400){
    for(let i=0;i<2;i++){if(g.cur[i].every(Boolean))continue;if(T>=end-4*60e3)continue;const k=R.nextFor(g,i);if(k<0)continue;const x=g.up[k];
      if(x.q.some(id=>R.onCourt(g).has(id)))o.onNext++;if(T<t0+30*60e3&&x.q.some(id=>fi.includes(id))){o.early++;o.ex=(o.ex||[]).concat(Math.round((T-t0)/60e3)+'m:'+x.q.map(id=>R.S.players.find(p=>p.id===id).name).join('/'))}R.sendCourt(g,i,x);endAt[i]=T+rnd(cfg.lo||8,cfg.hi||14)*60e3}
    const busy=[0,1].filter(i=>g.cur[i].every(Boolean));if(!busy.length){if(T>=end-4*60e3)break;T+=60e3;continue}
    const i=busy.sort((a,b)=>endAt[a]-endAt[b])[0];T=endAt[i];g.live[i].sa=21;g.live[i].sb=rnd(10,19);R.saveGame(g,i,T);
    if(cfg.upd&&R.rebelUpdate){const r=R.rebelUpdate(g,{quiet:1});o.upd++;o.changes+=r&&r.n||0}}
  }catch(e){o.err=String(e&&e.stack||e).slice(0,400)}
  const cnt={},seq={};g.hist.slice().reverse().forEach((h,k)=>h.ids.forEach(id=>{cnt[id]=(cnt[id]||0)+1;(seq[id]=seq[id]||[]).push(k)}));
  all.forEach(id=>{const s=seq[id]||[];for(let k=2;k<s.length;k++)if(s[k]-s[k-2]<=3)o.b3++});
  o.games=g.hist.length;o.reg=reg.map(id=>R.S.players.find(p=>p.id===id).name+':'+(cnt[id]||0)).join(' ');o.fi=fi.map(id=>R.S.players.find(p=>p.id===id).name+':'+(cnt[id]||0)).join(' ');
  o.regMax=Math.max(...reg.map(id=>cnt[id]||0));o.regMin=Math.min(...reg.map(id=>cnt[id]||0));o.fiMin=Math.min(...fi.map(id=>cnt[id]||0));
  o.gaps=all.map(id=>{const s=seq[id]||[];let m=99;for(let k=1;k<s.length;k++)m=Math.min(m,s[k]-s[k-1]);return m}).filter(m=>m<2).length;
  Date.now=DN;Math.random=MR;return o};
