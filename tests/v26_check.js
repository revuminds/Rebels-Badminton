/* v26: women's games – participant women get the same target, 1W+3M is a normal format, fill-in women never take their games.
   Runs inside the app page (window.RB). Usage: python3 tests/v26_test.py */
(function(){const R=window.RB,out=[];
function mk(spec){const S=R.S;S.players=[];S.dum={};S.savedAt=Date.now()+Math.random();const ids=[];let k=0;
  const add=(nm,sx,lv,dm)=>{const id='v'+(++k);S.players.push({id,name:nm,lv,sx});ids.push(id);if(dm)S.dum[id]=1};
  spec.forEach(a=>add(...a));const d='2026-12-06';S.days={};S.games={};
  S.days[d]={sch:1,time:'10:00',loc:'Test',courts:[{n:'Court 1',h:2},{n:'Court 2',h:2}],on:Object.fromEntries(ids.map(i=>[i,true])),att:{}};return d}
function run(name,spec,chk,tries){for(let t=0;t<(tries||5);t++){const d=mk(spec),g=R.G(d);delete g.fp;R.planFull(g,false);
  const c={},ty={},xd={},mx={},partners={};let bad3=0,dupR=0;const rounds={};
  g.fp.forEach(x=>{if(!x.q.every(Boolean))return;const t=R.gType(x.q);ty[t]=(ty[t]||0)+1;if(x.q.filter(R.isF).length===3)bad3++;
    rounds[x.r]=rounds[x.r]||new Set();x.q.forEach(id=>{if(rounds[x.r].has(id))dupR++;rounds[x.r].add(id);c[id]=(c[id]||0)+1});
    x.q.filter(R.isF).forEach(w=>{if(t==='XD')xd[w]=(xd[w]||0)+1;if(t==='MX')mx[w]=(mx[w]||0)+1;
      const i=x.q.indexOf(w),pt=x.q[i<2?1-i:5-i];(partners[w]=partners[w]||new Set()).add(pt)})});
  const nm=id=>R.S.players.find(p=>p.id===id).name,by=Object.fromEntries(R.S.players.map(p=>[p.name,p.id]));
  const e=chk({c,ty,xd,mx,partners,by,d,bad3,dupR,g});if(bad3)e.push(bad3+' 3W+1M games');if(dupR)e.push(dupR+' player twice in a round');
  const info=R.S.players.map(p=>p.name+(R.isDum(d,p.id)?'*':'')+':'+(c[p.id]||0)).join(' ')+' | '+JSON.stringify(ty)+' | XD '+JSON.stringify(Object.fromEntries(Object.entries(xd).map(([k,v])=>[nm(k),v])));
  if(e.length)return out.push({name,ok:false,msg:e.join('; ')+' (try '+(t+1)+')',info})}
  out.push({name,ok:true,msg:'ok ×'+(tries||5),info:''})}
const L=[1,2,3,2,1,3,2,4,1,2];
/* this week: 10 men + Kia (participant), fill-ins Raj, friend (men) + Annie (woman) → 9 participants? user: 12 = 10M+2W, 3 fill-ins incl. Annie */
const week=[['Kia','f',2]].concat(Array.from({length:8},(_,i)=>['M'+(i+1),'m',L[i]])).concat([['Raj','m',2,1],['Friend','m',2,1],['Annie','f',1,1]]);
run('This week: 8M + Kia participants, 2M + Annie fill-ins',week,({c,by,xd,partners,d})=>{const e=[];
  const part=Object.keys(by).filter(n=>!R.isDum(d,by[n])).map(n=>[n,c[by[n]]||0]);
  part.forEach(([n,v])=>{if(v!==6)e.push(n+' has '+v+' (want 6)')});
  if((c[by.Annie]||0)>(c[by.Kia]||0))e.push('Annie > Kia');
  if((xd[by.Kia]||0)>2)e.push('Kia '+xd[by.Kia]+' XD (max 2)');
  if(partners[by.Kia]&&partners[by.Kia].size<4)e.push('Kia only '+partners[by.Kia].size+' different partners');return e});
run('Lone woman participant (11M + 1W)',[['W1','f',2]].concat(Array.from({length:11},(_,i)=>['M'+(i+1),'m',L[i%10]])),({c,by,ty})=>{const e=[];
  if((c[by.W1]||0)<5)e.push('W1 only '+(c[by.W1]||0)+' games');if(!ty.MX)e.push('no 1W+3M games');return e});
run('2 women participants (10M + 2W)',[['W1','f',2],['W2','f',3]].concat(Array.from({length:10},(_,i)=>['M'+(i+1),'m',L[i]])),({c,by,xd})=>{const e=[];
  ['W1','W2'].forEach(w=>{if((c[by[w]]||0)<5)e.push(w+' only '+(c[by[w]]||0));if((xd[by[w]]||0)>2)e.push(w+' '+xd[by[w]]+' XD')});return e});
run('4 women keep WD + XD (12M + 4W)',[['W1','f',2],['W2','f',3],['W3','f',1],['W4','f',2]].concat(Array.from({length:12},(_,i)=>['M'+(i+1),'m',L[i%10]])),({ty})=>{const e=[];
  if(!ty.WD)e.push('no WD');if(!ty.XD)e.push('no XD');if((ty.MX||0)>2)e.push(ty.MX+' MX games with 4 women');return e});
/* manual 1W+3M passes without the override pop-up; 3W+1M still needs it */
{const q=R.S.players.filter(p=>p.sx==='f').slice(0,1).map(p=>p.id).concat(R.S.players.filter(p=>p.sx==='m').slice(0,3).map(p=>p.id));
 out.push({name:'1W+3M is a legal format (no override)',ok:R.fmtOK(q),msg:R.fmtOK(q)?'ok':'fmtOK false',info:''});
 const w=R.S.players.filter(p=>p.sx==='f').map(p=>p.id);if(w.length>=3){const q3=w.slice(0,3).concat(R.S.players.filter(p=>p.sx==='m').slice(0,1).map(p=>p.id));
 out.push({name:'3W+1M still needs override',ok:!R.fmtOK(q3),msg:!R.fmtOK(q3)?'ok':'3W+1M allowed',info:''})}}
window.__SCHED=out})();
