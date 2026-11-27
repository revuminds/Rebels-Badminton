/* Rule assertions on generated schedules (runs inside the app page; uses window.RB hooks) */
(function(){const R=window.RB,out=[];
function mkS(spec){/* spec: {m:[lv...], f:[lv...], dum:{m:n,f:n}, courts:[h,h]} */
  const S=R.S,ids=[];S.players=[];let k=0;const add=(sx,lv,dm)=>{const id='t'+(++k);S.players.push({id,name:(sx==='f'?'W':'M')+k,lv,sx});ids.push(id);if(dm)S.dum[id]=1};
  S.dum={};spec.m.forEach(lv=>add('m',lv));spec.f.forEach(lv=>add('f',lv));(spec.dm||[]).forEach(lv=>add('m',lv,1));(spec.df||[]).forEach(lv=>add('f',lv,1));
  const d='2026-12-06';S.days={};S.games={};S.days[d]={sch:1,time:'10:00',loc:'Test',courts:spec.courts.map((h,i)=>({n:'Court '+(i+1),h})),on:Object.fromEntries(ids.map(i=>[i,true])),att:{}};
  return d}
function check(name,d,expect){const S=R.S,g=R.G(d);if(!R.planFull(g,false))return out.push({name,ok:false,msg:'planFull failed'});
  const fp=g.fp,ids=R.fullIds(g),Wall=ids.filter(R.isF).length,part=ids.filter(id=>!R.isDum(d,id)),c={},wd={},xd={},pp={},pw={},errs=[],rounds={};let banned=0,dupR=0,maxStr=0,str3=0;
  fp.forEach(x=>{if(!x.q.every(Boolean))return;const f=x.q.filter(R.isF).length;if(f===3)banned++;
    rounds[x.r]=rounds[x.r]||new Set();x.q.forEach(id=>{if(rounds[x.r].has(id))dupR++;rounds[x.r].add(id);c[id]=(c[id]||0)+1});
    if(f===4)x.q.forEach(w=>wd[w]=(wd[w]||0)+1);if(f===2)x.q.filter(R.isF).forEach(w=>xd[w]=(xd[w]||0)+1);
    [[0,1],[2,3]].forEach(([a,b])=>{const k=[x.q[a],x.q[b]].sort().join();pp[k]=(pp[k]||0)+1});
    if(x.q.every(R.isStrong)){const h=Math.min(Math.max(1,Math.round((Math.max(...fp.map(y=>y.r))+1)*10/60))-1,Math.floor(x.r*10/60));x.q.forEach(id=>pw[id+'|'+h]=(pw[id+'|'+h]||0)+1)}});
  const R0=Math.max(...fp.map(x=>x.r))+1;part.forEach(id=>{let s=0;for(let r=0;r<R0;r++){if(rounds[r]&&rounds[r].has(id)){s++;maxStr=Math.max(maxStr,s);if(s===3)str3++}else s=0}});
  const pc=part.map(id=>c[id]||0),mn=Math.min(...pc),mx=Math.max(...pc),rep=Object.values(pp).filter(v=>v>1).reduce((a,v)=>a+v-1,0);
  const W=part.filter(R.isF),M=part.filter(id=>!R.isF(id)),wdG=fp.filter(x=>x.q.every(Boolean)&&x.q.filter(R.isF).length===4).length;
  if(banned)errs.push(banned+' banned-format games');if(dupR)errs.push(dupR+' duplicate player in round');
  if(mx-mn>1)errs.push('games spread '+mn+'–'+mx);
  if(expect.games&&(mn<expect.games[0]||mx>expect.games[1]))errs.push('games '+mn+'–'+mx+' outside '+expect.games.join('–'));
  if(W.length>=4&&M.length){W.forEach(w=>{if(!wd[w])errs.push(S.players.find(p=>p.id===w).name+' no WD');if(!xd[w])errs.push(S.players.find(p=>p.id===w).name+' no XD')})}
  if(W.length>=4&&M.length>W.length&&wdG!==Math.ceil(W.length/4))errs.push('WD games '+wdG+' (want '+Math.ceil(W.length/4)+')');
  const strong=[...R.powerSet(part)];let pdef=0;if(strong.length>=4){const H=Math.max(1,Math.round(R0*10/60));strong.forEach(id=>{for(let h=0;h<H;h++)if(!(pw[id+'|'+h]>=1))pdef++})}
  if(pdef)errs.push(pdef+' missing power games (strong×hour)');
  if(expect.noStr3&&str3)errs.push(str3+' participant 3-in-a-row');if(expect.maxStr&&maxStr>expect.maxStr)errs.push('max streak '+maxStr);
  if(expect.rep!=null&&rep>expect.rep)errs.push(rep+' repeat partners');
  const fillG=ids.filter(id=>R.isDum(d,id)).map(id=>c[id]||0);
  out.push({name,ok:!errs.length,msg:errs.join('; ')||'ok',info:'games '+mn+'–'+mx+' · games '+fp.filter(x=>x.q.every(Boolean)).length+' · WD '+wdG+' · repeatPartners '+rep+' · maxStreak '+maxStr+' · fill-in games '+fillG.join('/')+' · rate '+R.rateInfo(g).rate.toFixed(2)+'/h'})}
const rng=(n,lv)=>Array.from({length:n},(_,i)=>Array.isArray(lv)?lv[i%lv.length]:lv);
const L=[0,1,2,3,4,2,1,3];
[['16 players 14M+2W, 2 courts 2h',{m:rng(14,L),f:rng(2,[1,2]),courts:[2,2]},{games:[5,6]}],
 ['16 players 8M+8W',{m:rng(8,L),f:rng(8,L),courts:[2,2]},{games:[5,6]}],
 ['16 players 11M+5W',{m:rng(11,L),f:rng(5,L),courts:[2,2]},{games:[5,6]}],
 ['16 players 12M+4W',{m:rng(12,L),f:rng(4,L),courts:[2,2]},{games:[5,6]}],
 ['8 players 1 court + 2 fill-ins',{m:rng(6,L),f:rng(2,[1,3]),dm:[1],df:[1],courts:[2]},{games:[5,6],noStr3:true}],
 ['8 players on 2 courts + 3 fill-ins',{m:rng(8,L),f:[],dm:[1,2,1],courts:[2,2]},{maxStr:4}],
 ['24 players 2 courts (over capacity)',{m:rng(18,L),f:rng(6,L),courts:[2,2]},{}],
 ['1W+11M (lone woman)',{m:rng(11,L),f:[2],courts:[2,2]},{}],
 ['12 players 3 courts 1.5h',{m:rng(9,L),f:rng(3,L),courts:[1.5,1.5,1.5]},{}]].forEach(([n,s,e])=>{const d=mkS(s);check(n,d,e)});
window.__SCHED=out})();
