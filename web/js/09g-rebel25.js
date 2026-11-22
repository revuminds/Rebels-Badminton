/* ===== v25 Rebel: ONE brain for the footer status, the walking Rebel, the Update blink and Rebel's message history =====
   rbThink() decides Rebel's current message (RBM) after every game end, every 5 min, at the progress checkpoints and when the plan,
   courts or check-ins change. Everything that shows Rebel reads RBM: footer line, the character, the Update button blink.
   Rebel only suggests – nothing changes without Raj's tap. */
const RBSZ={S:90,M:120,L:160};
const rbSzK=()=>{try{return localStorage.getItem('rebels.rbsz')||'M'}catch(e){return 'M'}};
const rbSize=()=>RBSZ[rbSzK()]||120;
const rbG=()=>{const g=S.games[TODAY()];return g&&running(g)?g:null};
const rbCanAct=()=>!!AUTH.role&&!VIEW();
/* ---------- history (💬): times, Update logs, progress reports, tips ---------- */
function rbH(g,m,k,t){if(!g)return;g.rbh=g.rbh||[];g.rbh.unshift({t:t||Date.now(),m,k:k||'info'});if(g.rbh.length>150)g.rbh.length=150}
/* ---------- (5) progress checkpoints – regulars only ---------- */
function rbCourts(g){const d=g.d;return courtsOf(d).map((c,i)=>({i,s:courtStart(d,i),e:courtEnd(d,i),h:num(c.h)})).filter(c=>c.h>0)}
/* halfway = the clock time when half of the TOTAL booked court-time is used (2×2 h → 1 h · 1×3 h → 1 h 30 · 2 h + 1 h → 45 min) */
function cpTimes(g){const C=rbCourts(g);if(!C.length)return null;const tot=C.reduce((a,c)=>a+(c.e-c.s),0),used=t=>C.reduce((a,c)=>a+Math.max(0,Math.min(t,c.e)-c.s),0);
  let lo=Math.min(...C.map(c=>c.s)),hi=Math.max(...C.map(c=>c.e));const end=hi;for(let k=0;k<60;k++){const m=(lo+hi)/2;if(used(m)<tot/2)lo=m;else hi=m}
  return{half:Math.round(hi),late:end-15*60e3,end,tot}}
/* targets: 3 at halfway, 6 at the end (Settings target) – scaled to half of what is possible when 6 can't fit */
function cpTargets(g){const d=g.d,len=rbLen(g),reg=onIds(d).filter(id=>eligible(d,id)&&!isDum(d,id)),C=rbCourts(g),T=TGTS();
  const slots=C.reduce((a,c)=>a+Math.floor((c.e-c.s)/60e3/len),0),poss=reg.length?Math.min(T,Math.floor(slots*4/reg.length)):T;
  return{fin:poss,half:poss>=T?T/2:Math.floor(poss/2),scaled:poss<T,slots,reg,len}}
function rbGamesOf(g,id){const d=g.d,L=[];g.hist.slice().reverse().forEach(h=>{if(h.ids.includes(id))L.push({t:'done',l:(h.n?'G'+h.n+' · ':'')+cname(d,h.c-1)+' · '+hm(h.at)+' · '+h.sa+'–'+h.sb+(h.m?' (manual)':'')})});
  g.cur.forEach((q,i)=>{if(q&&q.every(Boolean)&&q.includes(id))L.push({t:'now',l:'On '+cname(d,i)+' now'})});
  const T=rbTimes(g,Date.now());g.up.forEach((x,k)=>{if(x.q.includes(id))L.push({t:'up',l:gl(x)+' · ~'+hm(T[k]?T[k].s:Date.now())+(T[k]&&!T[k].fit?' (may not fit)':'')})});return L}
/* the report: who is behind / ahead / on track for this checkpoint */
function cpReport(g,which,now){const d=g.d,TG=cpTargets(g),tg=which==='half'?TG.half:TG.fin,cnt=counts(g,false),oc=onCourt(g),nm=nameOf,fi=onIds(d).filter(id=>eligible(d,id)&&isDum(d,id));
  const T=rbTimes(g,now),fit={};g.up.forEach((x,k)=>{if(T[k]&&T[k].fit)x.q.forEach(id=>{if(id)fit[id]=(fit[id]||0)+1})});
  const nC=Math.max(1,courtsOf(d).filter((c,i)=>!g.closed[i]).length),cyc=TG.len*Math.max(4,TG.reg.length)/(4*nC);
  const man=id=>g.hist.some(h=>h.ids.includes(id)&&(h.m||h.bx||(h.n&&g.fp&&(g.fp.find(f=>f.n===h.n)||{}).m)));
  const R={which,tg,fin:TG.fin,scaled:TG.scaled,behind:[],ahead:[],ok:[],wont:[],fi:fi.map(id=>({id,n:(cnt[id]||0)+(oc.has(id)?1:0)}))};
  TG.reg.forEach(id=>{const n=(cnt[id]||0)+(oc.has(id)?1:0),pj=n+(fit[id]||0);
    if(which==='late'){if(pj<TG.fin)R.wont.push({id,n:pj,need:TG.fin});else if(n>TG.fin)R.ahead.push({id,n,man:man(id)});else R.ok.push(id);return}
    if(n<tg)R.behind.push({id,n});else if(n>tg)R.ahead.push({id,n,man:man(id),left:Math.max(0,TG.fin-n),sit:Math.max(5,Math.round((n-tg)*cyc/5)*5)});else R.ok.push(id)});
  const chip=(o,c,txt)=>({id:o.id,c,txt});
  const L=[];if(R.scaled)L.push({k:'note',t:TGTS()+' games each won’t fit the booked time (about '+TG.fin+' per regular) – targets now '+TG.half+' at halfway, '+TG.fin+' at the end.'});
  if(which==='half'){if(R.behind.length)L.push({k:'Behind',c:R.behind.map(o=>chip(o,'r',nm(o.id)+' '+o.n+'/'+tg)),t:'push them next.'});
    if(R.ahead.length)L.push({k:'Ahead',c:R.ahead.map(o=>chip(o,'a',nm(o.id)+' '+o.n+'/'+tg+(o.man?' (manual swap)':''))),t:R.ahead.map(o=>nm(o.id)+': '+o.left+' left, sits out ~'+o.sit+' min').join(' · ')});
    if(R.ok.length)L.push({k:R.behind.length||R.ahead.length?'On track':'All',c:R.ok.map(id=>chip({id},'g',nm(id))),t:R.behind.length||R.ahead.length?'everyone else on track.':'everyone on track for '+tg+' ✓'})}
  else{const miss=R.wont.reduce((a,o)=>a+(o.need-o.n),0),ex=Math.max(1,Math.ceil(miss/4/nC))*TG.len;
    if(R.wont.length)L.push({k:'Won’t reach '+TG.fin,c:R.wont.map(o=>chip(o,'r',nm(o.id)+' '+o.n+'/'+o.need)),t:'ask the venue for '+Math.round(ex/5)*5+'–'+(Math.round(ex/5)*5+5)+' min extra.'});
    if(R.ahead.length)L.push({k:'Ahead',c:R.ahead.map(o=>chip(o,'a',nm(o.id)+' '+o.n+'/'+TG.fin+(o.man?' (manual)':''))),t:''});
    if(R.ok.length)L.push({k:R.wont.length?'On track':'All',c:R.ok.map(id=>chip({id},'g',nm(id))),t:R.wont.length?'everyone else gets '+TG.fin+'.':'everyone reaches '+TG.fin+' ✓'})}
  if(fi.length)L.push({k:'info',t:'Fill-ins (not counted – they sit out the first 30 min by design): '+R.fi.map(o=>nm(o.id)+' '+o.n).join(', ')});
  R.lines=L;R.urgent=which==='late'&&R.wont.length>0;
  R.text=L.map(x=>x.k==='note'||x.k==='info'?x.t:x.k+': '+(x.c||[]).map(c=>c.txt).join(', ')+(x.t?' – '+x.t:'')).join(' ');return R}
/* ---------- ahead of time: options (nothing happens without Raj's tap) ---------- */
function rbAheadOpts(g){const d=g.d,P=rbProj(g),oc=onCourt(g),next=new Set((g.up[0]||{q:[]}).q),el=onIds(d).filter(id=>eligible(d,id)&&hasSx(id)),O=[];
  const free=el.filter(id=>!oc.has(id)),tryQ=(must,pool)=>{pool=pool.filter(id=>!must.includes(id));for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++){const q=must.concat([pool[a],pool[b]]).slice(0,4);if(q.length===4&&fmtOK(q))return orderQ(q,g)}return null};
  const reg=el.filter(id=>!isDum(d,id)).sort((a,b)=>(P[a]||0)-(P[b]||0)||wMin(g,b,Date.now())-wMin(g,a,Date.now()));
  for(let a=0;a<Math.min(reg.length,6)&&O.length<1;a++)for(let b=a+1;b<Math.min(reg.length,6)&&O.length<1;b++){const two=[reg[a],reg[b]];
    const pool=el.filter(id=>!two.includes(id)).sort((x,y)=>(isDum(d,y)-isDum(d,x))||((P[x]||0)-(P[y]||0)));const q=tryQ(two,pool);if(q)O.push({k:'xg',lab:'Extra game for '+nameOf(two[0])+' & '+nameOf(two[1]),q,pos:-1})}
  const org=el.filter(id=>isOrg(id)),fill=el.filter(id=>!isOrg(id)&&isDum(d,id)),rest=el.filter(id=>!isOrg(id)&&!isDum(d,id)).sort((a,b)=>(P[a]||0)-(P[b]||0));
  if(org.length){const base=org.slice(0,4),pool=fill.concat(rest);const q=base.length>=4&&fmtOK(base)?orderQ(base,g):tryQ(base.slice(0,2),org.slice(2).concat(pool))||(base.length<=2?null:tryQ(base.slice(0,2),pool));
    if(q){O.push({k:'oe',lab:'Organizers’ game at the end',q,pos:-1});O.push({k:'om',lab:'Organizers’ game in the middle',q,pos:Math.min(2,g.up.length)})}}
  return O}
function rbAddBonus(g,o){const q=o.q.slice(),lab=o.k==='xg'?'extra':'organizers',t=Date.now();let x;
  if(g.fp){const n=Math.max(0,...g.fp.map(f=>f.n),...g.hist.map(h=>h.n||0))+1,r=Math.max(0,...g.fp.map(f=>f.r))+1;g.fp.push({n,r,c:0,q:q.slice(),a:q.slice(),m:1,bx:lab,ovr:q.slice()});x={q:q.slice(),m:1,n,bx:lab,ovr:q.slice()}}
  else x={q:q.slice(),m:1,bx:lab,ovr:q.slice()};
  const pos=o.pos<0?g.up.length:o.pos;g.up.splice(pos,0,x);if(g.fp)fpSync(g);
  const m=o.lab+' added ('+q.slice(0,2).map(nameOf).join(' & ')+' vs '+q.slice(2).map(nameOf).join(' & ')+') – a manual extra, no 6-game warnings';logIt(g,'Rebel: '+m);rbH(g,m,'upd',t)}
/* ---------- the brain ---------- */
let RBM=null,RBSIG='',RBT0=0;
function rbFootOK(){const t=TODAY(),D=S.days[t],g=S.games[t];if(g&&running(g))return 'Rebel: All good, Raj – we’re on track';
  if(isSched(t)&&!(g&&g.en))return 'Rebel: Today '+t12(D.time)+(D.loc?' · '+D.loc:'')+' – ready when you are, Raj';if(g&&g.en)return 'Rebel: Session done, Raj – see you next time';return 'Rebel: All good, Raj'}
function rbCompose(g,now){const d=g.d,dis=g.rbd||{},nm=nameOf;
  if(inOT(g,now)){const k='ot';if(!dis[k]){const m=Math.max(1,Math.floor(Math.max(...courtsOf(d).map((c,i)=>g.closed[i]?0:(now-courtEnd(d,i))/60e3))));
      return{key:k,lvl:'urgent',title:'Overtime +'+m+' min',body:'Raj, the booked time is over. I won’t schedule now – add games by hand (＋ Overtime game) and close the courts when you’re done. I’ll record them as overtime.',acts:[['Got it','rbok']]}}
    return null}
  const why=rebelCheck(g),r=RCr,ch=r?r.ch:[];
  /* (4)/(6) Update can change something */
  if(why.length&&r){const sig='upd:'+rbSnap(RCc).length+':'+why.join('|');if(!dis[sig]){const urg=why.some(s=>/3 in a row/.test(s)),add=g.rbAdd;
    return{key:sig,lvl:urg?'urgent':'talk',upd:1,title:add?add.n+' added for '+hrsL(add.h)+' – I can fit '+pl(add.N,'more game')+'.':urg?'Raj, this one can’t wait':'Raj, I’d like to change the plan',
      body:(add?'Tap Update and I’ll fill '+add.n+' without touching the rest. ':'')+'Here’s what Update will do:',list:ch.map(c=>c.m),why:'Why: '+why.join(' · '),acts:[['Update','rbgo',null,'btn'],['Decline','rbno']]}}}
  /* (5) checkpoints */
  const cp=cpTimes(g);if(cp){for(const w of ['late','half']){const at=w==='half'?cp.half:cp.late;if(now<at||now>cp.end)continue;const k='cp:'+w+':'+Math.round(at/60e3);if(dis[k])continue;
      const R=cpReport(g,w,now);return{key:k,lvl:R.urgent?'urgent':'talk',rep:R,title:w==='half'?'Halfway check · target '+R.tg+' games each':'15 min to go · target '+R.fin+' games each',acts:[['Got it','rbok']]}}}
  /* (9) ahead of time: spare time nobody needs → good news + options */
  const sp=rbSpare(RCc||g,now),len=rbLen(g);if(sp>=Math.max(8,len)&&now-g.st>15*60e3&&(!cp||now<cp.late)){const k='good:'+g.hist.length;if(!dis[k]){
      const L=g.hist.filter(h=>!h.m&&h.s>=180).slice(0,4).map(h=>Math.round(h.s/60)),gt=L.length>=2?L.length+' games done in '+Math.min(...L)+'–'+Math.max(...L)+' min – we’re ahead':'We’re ~'+sp+' min ahead';
      return{key:k,lvl:'good',foot:gt,title:'~'+sp+' min ahead, Raj 🎉',body:'Everyone already has their games planned, so this time is spare. Want to use it?',opts:rbAheadOpts(g),acts:[['Ignore','rbno']]}}}
  return null}
function rbThink(force){const now=Date.now(),g=rbG(),cp=g&&cpTimes(g);
  const sig=g?[g.d,g.hist.length,rbSnap(g),JSON.stringify(courtsOf(g.d)),JSON.stringify(g.closed||{}),JSON.stringify((S.days[g.d]||{}).att||{}).length,Object.keys((S.days[g.d]||{}).on||{}).join(),JSON.stringify(g.rbd||{}),Math.floor(now/300e3),
    cp?(now>=cp.late)+''+(now>=cp.half):'',inOT(g,now),g.cur.map(q=>(q||[]).join()).join('|'),TGTS(),AUTH.role].join('#'):'none|'+TODAY()+'|'+AUTH.role+'|'+Math.floor(now/300e3);
  if(!force&&sig===RBSIG)return RBM;RBSIG=sig;const old=RBM;
  let m=null;if(g){try{m=rbCompose(g,now)}catch(e){m=null}}
  RBM=m||{key:'ok',lvl:'ok',foot:rbFootOK()};if(!RBM.foot)RBM.foot=RBM.lvl==='good'?'We’re ahead':'Rebel wants to talk to you';
  if(g&&m&&(!old||old.key!==m.key)){rbH(g,(m.lvl==='urgent'?'⚠ ':'')+m.title+(m.rep?' — '+m.rep.text:m.list&&m.list.length?' — '+m.list.join(' · '):''),m.rep?'rep':m.lvl==='good'?'good':m.lvl==='urgent'?'warn':'info');try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
  return RBM}
const rbBlink=()=>{rbThink();return !!(RBM&&RBM.upd)};
/* ---------- (9) footer ---------- */
function vFoot(){const m=RBM||{lvl:'ok',foot:rbFootOK()},g=rbG()||S.games[curDate()],n=g&&g.rbh?g.rbh.length:0,c=m.lvl==='urgent'||m.lvl==='talk'?m.lvl:m.lvl==='good'?'good':'ok';
  return '<span class="fst '+c+'" data-tk2="fst"><i></i><span>'+esc(c==='talk'||c==='urgent'?'Rebel wants to talk to you':m.foot)+'</span></span><span class="fslo">REBELS <b>BADMINTON</b> · One Community</span>'+
   '<button class="fmsg" data-a="rbhist" aria-label="Rebel’s messages">💬'+(n&&ui.rbSeen!==n?'<i></i>':'')+'</button>'}
function footRender(){const f=$('#foot');if(!f)return;const on=!!AUTH.role&&!ui.lg;f.hidden=!on;if(!on)return;const h=vFoot();if(f.innerHTML!==h)f.innerHTML=h}
/* ---------- (8) header clock: "12:36 PM · 22 Nov" ---------- */
const clk12=()=>{const x=new Date(),h=x.getHours();return (h%12||12)+':'+z(x.getMinutes())+' '+(h<12?'AM':'PM')+' · '+x.getDate()+' '+MN[x.getMonth()]};
setInterval(()=>{const e=document.querySelector('.stmid');if(e){const v=clk12();if(e.textContent!==v)e.textContent=v}},5000);

/* ======================= (6) the Rebel character ======================= */
const SPR=window.RB_SPR||{anims:{}};
const RC={ph:'off',x:-999,tx:0,a:'idle',f:0,ft:0,t0:0,hold:0,mode:'',bub:'',blinkAt:0,blink:-1,waveAt:0,wave:0,raf:0,lt:0,el:null,next:''};
const rbA=n=>SPR.anims[n]||SPR.anims.idle||null;
const rbHasSpr=()=>!!rbA('idle');
function rbDims(){const c=SPR.cell||[300,360],k=rbSize()/(c[1]*0.9);return{k,w:c[0]*k,h:c[1]*k,base:(SPR.base||352)*k}}
function rbEl(){let el=$('#rebel');if(!el)return null;if(!RC.el||!el.firstChild){el.innerHTML='<div class="rbwrap" data-a="rbtap"><div class="rbspr"></div><svg class="rbeyes" viewBox="0 0 '+((SPR.cell||[300])[0])+' '+((SPR.cell||[0,360])[1])+'" aria-hidden="true"></svg></div><div class="rbbub" data-a="rbtap"></div>';RC.el=el}return el}
function rbFrame(name,f){const el=rbEl(),A=rbA(name);if(!el||!A)return;const s=el.querySelector('.rbspr');f=Math.max(0,Math.min(A.n-1,f|0));
  const u=name+f;if(s.dataset.u!==u){s.style.backgroundImage='url('+A.f[f]+')';s.style.backgroundSize='100% 100%';s.dataset.u=u}RC.a=name;RC.f=f;rbEyes()}
/* preload every frame once so the walk never flickers */
(()=>{try{Object.values(SPR.anims).forEach(A=>(A.f||[]).forEach(u=>{const i=new Image();i.src=u}))}catch(e){}})();
/* blink drawn in code over the idle frame (eyes from idle/anim.json) */
function rbEyes(){const el=RC.el;if(!el)return;const sv=el.querySelector('.rbeyes'),A=rbA('idle'),E=(A&&A.eyes)||[];if(!sv)return;
  const lvl=RC.a==='idle'&&RC.blink>=0?[0.55,1,1,0.55][RC.blink]||0:0;if(!lvl||!E.length){if(sv.innerHTML)sv.innerHTML='';return}
  const lid=A.lid||'#E3A882',lash=A.lash||'#5A2E1C';
  sv.innerHTML=E.map((e,i)=>{const [x,y,rx,ry]=e,h=2*ry*lvl,top=y-ry;return '<clipPath id="rbe'+i+'"><ellipse cx="'+x+'" cy="'+y+'" rx="'+(rx+.6)+'" ry="'+(ry+.6)+'"/></clipPath><rect x="'+(x-rx-1)+'" y="'+(top-1)+'" width="'+(2*rx+2)+'" height="'+(h+1)+'" fill="'+lid+'" clip-path="url(#rbe'+i+')"/>'+
    '<path d="M'+(x-rx)+' '+(top+h)+' Q'+x+' '+(top+h+(lvl>=1?3:1.5))+' '+(x+rx)+' '+(top+h)+'" stroke="'+lash+'" stroke-width="1.8" fill="none" stroke-linecap="round"/>'}).join('')}
function rbPlace(){const el=rbEl();if(!el)return;const D=rbDims(),f=$('#foot'),ft=f&&!f.hidden?f.getBoundingClientRect().top:innerHeight;
  el.style.width=D.w+'px';el.style.height=D.h+'px';el.style.bottom=(innerHeight-ft-(D.h-D.base)+1)+'px';
  const w=el.querySelector('.rbwrap');w.style.width=D.w+'px';w.style.height=D.h+'px';el.style.transform='translateX('+RC.x+'px)';RC.tx=Math.max(8,innerWidth-D.w-22)}
function rbBubble(t){const el=rbEl();if(!el)return;const b=el.querySelector('.rbbub');if(t){b.textContent=t;b.classList.add('on')}else b.classList.remove('on');RC.bub=t||''}
function rbWrapCls(){const w=RC.el&&RC.el.querySelector('.rbwrap');if(!w)return;w.classList.toggle('breathe',RC.ph==='idle'&&RC.mode!=='urgent');w.classList.toggle('bounce',RC.ph==='idle'&&RC.mode==='urgent'&&!ui.rbc)}
const rbWant=()=>{const m=RBM;return !!(m&&rbCanAct()&&!ui.lg&&(m.lvl==='talk'||m.lvl==='urgent'||m.lvl==='good'))};
function rbEnter(){const el=rbEl();if(!el)return;el.hidden=false;RC.mode=RBM.lvl;RC.key=RBM.key;const D=rbDims();RC.x=-D.w-10;rbPlace();RC.ph='in';RC.t0=performance.now();RC.x0=RC.x;RC.a=rbA('run')&&RBM.lvl==='urgent'?'run':'walk';RC.ft=0;RC.f=0;rbBubble('');rbFrame(RC.a,0);rbLoop()}
function rbLeave(kind){RC.ph='turnaway';RC.t0=performance.now();RC.exit=kind==='thanks'?'run':'walk';rbBubble('');rbLoop()}
/* Update / Decline reactions: "Thanks Raj! 👍" (thumbs-up) → runs off · "Okay, noted" → walks off */
function rbReact(kind){const el=$('#rebel');ui.rbc=0;chatRender();if(!el||el.hidden||RC.ph==='off'){RC.next='';return}
  if(RC.ph==='in'&&RC.x<innerWidth/3){RC.ph='off';el.hidden=true;RC.wait=Date.now()+1500;return}/* still far away – just slip off */
  RC.ph='react';RC.t0=performance.now();RC.hold=kind==='thanks'?1700:1300;RC.exit=kind==='thanks'?'run':'walk';rbFrame(kind==='thanks'&&rbA('thumbs')?'thumbs':'idle',0);rbBubble(kind==='thanks'?'Thanks Raj! 👍':kind==='same'?'All good – nothing to change':'Okay, noted');rbWrapCls();rbLoop()}
/* frame loop: a ~30 fps timer (keeps going in WebViews that pause animation frames), only while Rebel is on screen */
function rbLoop(){if(RC.raf)return;RC.lt=performance.now();const step=()=>{RC.raf=0;RC.beat=Date.now();const now=performance.now(),dt=Math.min(80,now-RC.lt);RC.lt=now;let go=false;try{go=rbStep(now,dt)}catch(e){console.warn('rebel',e);go=false}if(go)RC.raf=setTimeout(step,33)};RC.raf=setTimeout(step,16)}
function rbStep(now,dt){const el=RC.el;if(!el||el.hidden)return false;const D=rbDims(),sp=(RC.a==='run'?3.6:1.6)*rbSize();
  const adv=(name)=>{const A=rbA(name);if(!A)return;RC.ft+=dt;const per=1000/(A.fps||8);while(RC.ft>=per){RC.ft-=per;RC.f=A.loop===false?Math.min(A.n-1,RC.f+1):(RC.f+1)%A.n}rbFrame(name,RC.f)};
  if(RC.ph==='in'){RC.x=Math.min(RC.tx,RC.x0+sp*(now-RC.t0)/1000);el.style.transform='translateX('+RC.x+'px)';adv(RC.a);
    if(RC.x>=RC.tx){RC.ph='turn';RC.t0=now;RC.f=0;RC.ft=0}return true}
  if(RC.ph==='turn'){const A=rbA('turn');const k=A?Math.floor((now-RC.t0)/(1000/(A.fps||8))):9;if(A&&k<A.n){rbFrame('turn',k);return true}
    RC.ph='idle';RC.t0=now;RC.blinkAt=now+800+Math.random()*1500;RC.waveAt=now+(RC.mode==='urgent'?1200:6000+Math.random()*5000);
    if(RC.mode==='good'&&rbA('cheer')){RC.wave=now+1700;rbFrame('cheer',0)}else rbFrame('idle',0);rbBubble(RC.mode==='urgent'?'Raj! Got a minute? 👋':RC.mode==='good'?'Good news, Raj!':'Raj, got a minute?');rbWrapCls();return true}
  if(RC.ph==='idle'){/* breathing (CSS) · blink every 3–6 s · occasional wave (urgent: often) */
    if(RC.wave&&now>=RC.wave){RC.wave=0;rbFrame('idle',0)}
    if(!RC.wave&&now>=RC.waveAt&&!ui.rbc){const w=rbA('wave');if(w){rbFrame('wave',0);RC.wave=now+(RC.mode==='urgent'?900:1400)}RC.waveAt=now+(RC.mode==='urgent'?3200+Math.random()*1500:11000+Math.random()*8000)}
    if(RC.a==='idle'){if(RC.blink>=0){const k=Math.floor((now-RC.bt)/45);if(k>3){RC.blink=-1;RC.blinkAt=now+3000+Math.random()*3000}else RC.blink=k;rbEyes()}
      else if(now>=RC.blinkAt){RC.blink=0;RC.bt=now;rbEyes()}}
    rbWrapCls();return true}
  if(RC.ph==='react'){if(now-RC.t0<RC.hold)return true;rbBubble('');RC.ph='turnaway';RC.t0=now;return true}
  if(RC.ph==='turnaway'){const A=rbA('turn');const k=A?Math.floor((now-RC.t0)/(1000/(A.fps||8))):9;rbWrapCls();if(A&&k<A.n){rbFrame('turn',A.n-1-k);return true}
    RC.ph='out';RC.t0=now;RC.x0=RC.x;RC.a=RC.exit==='run'&&rbA('run')?'run':'walk';RC.f=0;RC.ft=0;return true}
  if(RC.ph==='out'){RC.x=RC.x0+sp*(now-RC.t0)/1000;el.style.transform='translateX('+RC.x+'px)';adv(RC.a);if(RC.x>innerWidth+20){RC.ph='off';el.hidden=true;RC.key='';rbSync();return false}return true}
  return false}
/* keep the character in step with RBM (called every second) */
function rbSync(){if(!rbHasSpr())return;const el=rbEl();if(!el)return;const want=rbWant();
  /* watchdog: an animation phase whose frame loop stopped is restarted */
  if(RC.ph!=='off'&&(!RC.raf||Date.now()-(RC.beat||0)>1500)){RC.raf=0;rbLoop()}
  if(RC.ph==='off'){if(want){RC.yw=(RC.yw||0)+1;if(RC.wait&&Date.now()<RC.wait||RC.yw<2)return;RC.yw=0;rbEnter()}else RC.yw=0;return}
  if(RC.ph==='idle'){if(!want){RC.nw=(RC.nw||0)+1;if(RC.nw<3)return;RC.nw=0;rbLeave('walk');ui.rbc=0;chatRender();return}RC.nw=0;if(RBM.key!==RC.key){RC.key=RBM.key;RC.mode=RBM.lvl;rbBubble(RC.mode==='urgent'?'Raj! Got a minute? 👋':RC.mode==='good'?'Good news, Raj!':'Raj, got a minute?');if(ui.rbc)chatRender()}rbPlace();rbWrapCls()}
  if(RC.ph==='out'||RC.ph==='react')RC.wait=Date.now()+1500}
addEventListener('resize',()=>{if(RC.el&&RC.ph!=='off'){rbPlace();if(RC.ph==='idle'){RC.x=RC.tx;RC.el.style.transform='translateX('+RC.x+'px)'}}chatRender()});
/* ---------- chat box (bottom-right, above Rebel) ---------- */
function vChat(){const m=RBM;if(!m||!rbWant())return '';const R=m.rep;
  const line=x=>x.k==='note'?'<div class="rbwhy2">'+esc(x.t)+'</div>':x.k==='info'?'<div class="rbwhy2">ℹ '+esc(x.t)+'</div>':
    '<div class="rbline"><span>'+esc(x.k)+':</span>'+(x.c||[]).map(c=>'<button class="rbn2 '+c.c+'" data-a="rbpl" data-x="'+c.id+'">'+esc(c.txt)+'</button>').join('')+(x.t?'<span>– '+esc(x.t)+'</span>':'')+'</div>'+
    ((x.c||[]).some(c=>c.id===ui.rbpl)?'<div class="rbgl">'+(rbGamesOf(rbG(),ui.rbpl).map(o=>'<span>'+(o.t==='done'?'✓ ':o.t==='now'?'● ':'→ ')+esc(o.l)+'</span>').join('')||'<span>No games yet</span>')+'</div>':'');
  return '<div class="rbch"><b>'+esc(m.title||'Rebel')+'</b><small>'+hm(Date.now())+'</small><button class="ib" style="width:36px;height:36px;min-height:0;font-size:18px" data-a="rbclose" aria-label="Close">×</button></div>'+
   (m.body?'<div class="rbmsg">'+esc(m.body)+'</div>':'')+(m.list&&m.list.length?'<div class="rbgl">'+m.list.map(x=>'<span>• '+esc(x)+'</span>').join('')+'</div>':'')+(m.why?'<div class="rbwhy2">'+esc(m.why)+'</div>':'')+
   (R?R.lines.map(line).join(''):'')+(m.opts&&m.opts.length?'<div class="rbopts">'+m.opts.map((o,i)=>'<button class="ol" data-a="rbx" data-x="'+i+'">'+esc(o.lab)+'</button>').join('')+'</div>':m.opts?'<div class="rbwhy2">No extra game fits the players here right now.</div>':'')+
   '<div class="rbbtns">'+(m.acts||[]).map(a=>'<button class="'+(a[3]||'ol')+'" data-a="'+a[1]+'">'+esc(a[0])+'</button>').join('')+'</div>'}
function chatRender(){const c=$('#rbchat');if(!c)return;const h=ui.rbc?vChat():'';if(!h){c.hidden=true;c.innerHTML='';return}c.hidden=false;if(c.innerHTML!==h)c.innerHTML=h;
  const D=rbDims(),f=$('#foot'),ft=f&&!f.hidden?f.getBoundingClientRect().top:innerHeight;c.style.bottom=(innerHeight-ft+D.h*.92+12)+'px'}
/* ---------- 💬 message history ---------- */
function vRbHist(){const g=rbG()||S.games[curDate()]||S.games[TODAY()],L=(g&&g.rbh)||[],N=g&&g.st?(running(g)?rebelNotes(g,Date.now()):g.en?rebelEnd(g):[]):[];
  return '<div class="modal" data-a="rbhx"><div class="pn" data-a="noop" style="gap:12px;width:min(720px,94vw)"><div class="sb"><div><div class="laby">REBEL · MESSAGES'+(g?' · '+esc(dlab(g.d).toUpperCase()):'')+'</div><div style="font-size:13px;color:var(--mu);margin-top:4px">Times, every Update tap, progress reports and tips – newest first.</div></div><button class="ib" data-a="rbhx" aria-label="Close">×</button></div>'+
   (N.length?'<div class="tipbox">'+N.map(([c,x])=>'<div class="tip"><span>'+(c==='w'?'⚠':c==='ok'?'✓':'●')+'</span><span>'+esc(x)+'</span></div>').join('')+'</div>':'')+
   '<div class="rbhl">'+(L.length?L.map(e=>'<div class="rbhr k-'+e.k+'"><span>'+hm(e.t)+'</span><span>'+esc(e.m)+'</span></div>').join(''):'<div class="empty" style="padding:12px">No messages yet – Rebel writes here during a session.</div>')+'</div></div></div>'}
/* ---------- (7) shared courts editor: Courts pop-up, ✎ on Players, Edit session while running – one set of rules ---------- */
const CLOSE_MS2=10*60e3;
function courtRate(d){const v=num(S.def.crate);if(v)return v;const f=S.fin[d],base=courtsOf(d).filter(c=>!c.add);const h=base.reduce((a,c)=>a+num(c.h),0);
  if(f&&num(f.court)&&h)return Math.round((num(f.court)-(f.xc||[]).reduce((a,x)=>a+num(x.cost),0))/h);const dc=num(S.def.court);return dc&&h?Math.round(dc/h):0}
function setCourtH(d,i,h){const D=day(d),c=D.courts[i];if(!c)return;const old=num(c.h);h=Math.max(.5,Math.min(8,h));if(h===old)return;c.h=h;
  if(c.add&&num(c.cost)){const nc=Math.round(num(c.cost)/old*h);xcMoney(d,c,nc-num(c.cost));c.cost=nc}
  const g=G(d);if(running(g))autoNext(g,'fill',c.n+' now '+hrsL(c.h)+' (ends '+hm(courtEnd(d,i))+') · remaining games re-planned');else g.psig=''}
function xcMoney(d,c,delta){if(!delta)return;const f=finOf(d,true);if(pkgsFor(d).length){let o=f.oth.find(x=>x.xc===c.t);if(!o){o={lab:c.n+' added',amt:0,xc:c.t};f.oth.push(o)}o.amt=String(num(o.amt)+delta);o.lab=c.n+' added · '+hrsL(num(c.h))}
  else f.court=String(Math.round((num(f.court)+delta)*100)/100);const x=(f.xc=f.xc||[]).find(o=>o.t===c.t);if(x){x.cost=num(x.cost)+delta;x.h=num(c.h)}else f.xc.push({n:c.n,h:num(c.h),cost:delta,t:c.t})}
function addCourt(d,o){const D=day(d),g=G(d),t=Date.now(),run=running(g),n=(o.n||'').trim()||'Court '+(D.courts.length+1),h=Math.max(.5,Math.min(8,num(o.h)||1)),cost=Math.max(0,num(o.cost));
  const c={n,h,add:1,t,cost};if(run)c.s=t;D.courts.push(c);G(d);xcMoney(d,c,cost);
  if(run){const N=Math.floor(h*60/rbLen(g));g.rbAdd={n,h,N,t};logIt(g,n+' added for '+hrsL(h)+(cost?' · AED '+cost+' into Finance':'')+' · tap Update to fill it');rbH(g,n+' added for '+hrsL(h)+' (start now, ends '+hm(courtEnd(d,D.courts.length-1))+')'+(cost?' · AED '+cost+' added to Finance':''),'upd')}
  audit(n+' added to '+dlab(d)+' · '+hrsL(h)+(cost?' · AED '+cost:''));save()}
function vCourtEd(d,from){const g=G(d),now=Date.now(),run=running(g),ed=!VIEW()&&!(g&&g.en),C=courtsOf(d),A=ui.cta;
  const row=(c,i)=>{const cl=g.closed[i],pi=cpill(d,i,now);return '<div class="ctr"><span class="ctn">'+esc(c.n)+'<small>'+(c.add?'Added '+(c.s?hm(c.s):'')+' · ':'')+hm(courtStart(d,i))+'–'+hm(courtEnd(d,i))+(c.add&&num(c.cost)?' · AED '+num(c.cost):'')+' · '+(cl?'closed at '+hm(cl):run?pi.t:'booked')+'</small></span>'+
    (ed&&!cl?'<span class="cbh">'+hrsL(num(c.h))+'<button data-a="cth" data-x="'+i+'" data-y="-0.5" aria-label="Less time">−</button><button data-a="cth" data-x="'+i+'" data-y="0.5" aria-label="More time">+</button></span>':'')+
    (run&&ed?(!cl?'<button class="ol sm" style="color:var(--bad);border-color:var(--bad)" data-a="ctclose" data-x="'+i+'">Close court</button>':now-cl<CLOSE_MS2?'<button class="btn sm" data-a="ctopen" data-x="'+i+'">Reopen</button>':'<span style="color:var(--mu)">Closed</span>'):'')+'</div>'};
  const add=!ed?'':A?'<div class="ctadd"><b>＋ Add court'+(run?' · starts now':'')+'</b><div class="row"><label class="fl" style="flex:1;min-width:160px">Name / number<input class="gei" value="'+esc(A.n)+'" data-i="cta_n"></label>'+
     '<div class="fl">Booked hours<div class="cbh" style="height:48px">'+hrsL(num(A.h))+'<button data-a="ctah" data-x="-0.5">−</button><button data-a="ctah" data-x="0.5">+</button></div></div>'+
     '<label class="fl" style="width:150px">Court cost (AED)<input class="gei" type="number" inputmode="decimal" min="0" value="'+esc(A.cost)+'" data-i="cta_c"></label></div>'+
     '<div class="sb"><span style="font-size:13px;color:var(--mu)">Default = Settings rate '+(courtRate(d)?'AED '+courtRate(d)+' per court-hour':'(not set – Settings → Session defaults)')+'</span><span class="row"><button class="gh" data-a="ctax">Cancel</button><button class="btn sm" data-a="ctaok">Add court</button></span></div></div>':
     '<button class="gh" style="border-color:var(--ok);color:var(--ok)" data-a="cta">＋ Add court</button>';
  return '<div class="cted">'+(from==='players'&&g.st?'<div class="ctr"><span class="ctn">Session<small>Started '+hm(g.st)+(g.en?' · ended '+hm(g.en):'')+' · booked end follows the actual start</small></span>'+(ed?'<button class="ol sm" data-a="sedit">✎ Start / end time</button>':'')+'</div>':'')+C.map(row).join('')+add+
   '<div style="font-size:13px;color:var(--mu)">Overtime (playing on after the booked time) doesn’t change Finance – courts stay open until you close them here. An added court is a real booking: its cost goes into Finance.</div></div>'}
Object.assign(act,{
 rbtap:()=>{if(RC.ph!=='idle')return;ui.rbc=ui.rbc?0:1;rbWrapCls();chatRender()},rbclose:()=>{ui.rbc=0;ui.rbpl='';chatRender();rbWrapCls()},
 rbpl:x=>{ui.rbpl=ui.rbpl===x?'':x;chatRender()},
 rbgo:()=>{ui.rbc=0;ui.rbpl='';chatRender();if(ui.scr!=='app'||ui.tab!=='games'){ui.cur=TODAY()}act.rbupd()},
 rbno:()=>{const g=rbG(),m=RBM;if(g&&m){g.rbd=g.rbd||{};g.rbd[m.key]=Date.now();rbH(g,'Declined: '+(m.title||'')+' — Okay, noted','info');save()}rbReact('noted');rbThink(true);footRender();render()},
 rbok:()=>{const g=rbG(),m=RBM;if(g&&m){g.rbd=g.rbd||{};g.rbd[m.key]=Date.now();save()}ui.rbc=0;chatRender();rbThink(true);rbSync();footRender()},
 rbx:x=>{const g=rbG(),m=RBM;if(!g||!m||!m.opts)return;const o=m.opts[+x];if(!o)return;rbAddBonus(g,o);g.rbd=g.rbd||{};g.rbd[m.key]=Date.now();save();ui.rbc=0;rbReact('thanks');rbThink(true);render();toast(o.lab+' added to Upcoming')},
 rbhist:()=>{const g=rbG()||S.games[curDate()];ui.rbh=1;ui.rbSeen=g&&g.rbh?g.rbh.length:0;render()},rbhx:()=>{ui.rbh=0;render()},
 /* v25.2: Cancel on Schedule / Edit session = discard changes, back to where it was opened from */
 sccancel:()=>{const s=ui.sc;ui.sc=null;ui.scNew=0;if(s&&s.ret==='players')return go('app','players');if(s&&s.ret==='hist')return go(ui.pe&&ui.pe.d===s.orig?'pedit':'hist');ui.cur='';ui.flow='';go('home')},
 pback:()=>{const d=curDate();if(d)openSched(d,'players')},scback:()=>{const s=ui.sc;ui.sc=null;go('app','players')},
 ptedit:()=>{ui.cts=1;ui.ctsFrom='players';render()},
 cth:(x,y)=>{const d=curDate();setCourtH(d,+x,num((courtsOf(d)[+x]||{}).h)+ +y);save();render()},
 cta:()=>{const d=curDate(),n=courtsOf(d).length+1,r=courtRate(d);ui.cta={n:'Court '+n,h:1,cost:r?String(r):''};render()},ctax:()=>{ui.cta=null;render()},
 ctah:x=>{const A=ui.cta,d=curDate();if(!A)return;const r=courtRate(d),h0=num(A.h);A.h=Math.max(.5,Math.min(8,h0+ +x));if(r&&(A.cost===''||num(A.cost)===Math.round(r*h0)))A.cost=String(Math.round(r*A.h));render()},
 ctaok:()=>{const A=ui.cta,d=curDate();if(!A||!d)return;addCourt(d,A);ui.cta=null;RCk='';rbThink(true);render();toast(A.n+' added'+(running(G(d))?' · tap Update to fill it':''))},
 rbsz:x=>{try{localStorage.setItem('rebels.rbsz',x)}catch(e){}if(RC.el&&RC.ph!=='off'){rbPlace();if(RC.ph==='idle'){RC.x=RC.tx;RC.el.style.transform='translateX('+RC.x+'px)'}}render()}});
/* every second: think (cheap unless something changed), footer, Update blink, character */
setInterval(()=>{try{rbThink();footRender();rbSync();const b=document.querySelector('[data-tk="rbup"]');if(b){const g=rbG();b.classList.toggle('pulse',!!(g&&RBM&&RBM.upd&&!inOT(g)))}}catch(e){}},1000);
