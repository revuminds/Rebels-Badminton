/* ===== render, actions, events, start-up ===== */
function render(){const app=$('.app'),m=$('#main');app.classList.toggle('full',ui.scr!=='app');
  if(ui.scr==='app'){$('#nav').innerHTML=vNav();m.innerHTML=ui.tab==='players'?vPlayers():ui.tab==='games'?vGames():ui.tab==='finance'?vFinance():vSettings()}
  else{$('#nav').innerHTML='';m.innerHTML=ui.scr==='sched'?vSched():ui.scr==='hist'?vHist():vHome()}
  $('#modal').innerHTML=ui.pm?vPMod():ui.am?vAtt():ui.ge?vGE():ui.se?vSE():ui.pay?vPayM():ui.qr?vQR():ui.ent?vEnt():ui.cf&&ui.scr==='app'&&ui.tab==='games'?vCf():ui.ck&&ui.scr==='app'&&ui.tab==='games'?vCk():'';tick()}
function copy(t){if(NB&&NB.copy){NB.copy(t);return toast('Copied')}
  const ta=$('#bexp');if(ta){ta.select();try{document.execCommand('copy');toast('Copied')}catch(e){toast('Select the text and copy')}}
  if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast('Copied'),()=>{})}
const go=(scr,tab)=>{if(ui.tab==='finance'&&(scr!=='app'||tab!=='finance'))ui.unlocked=false;if(scr!=='hist')ui.hun=false;ui.scr=scr;if(tab)ui.tab=tab;ui.pmode=null;ui.pin='';ui.pin1='';ui.err='';render();window.scrollTo(0,0)};
const CG=()=>G(curDate());
const fin=()=>finOf(ui.fsel,true);
const fdone=()=>{save();ui.saved='✓ Auto-saved';render()};
const act={
 tab:x=>{ui.lvE={};ui.ck=0;ui.cf=null;if(x==='home'){ui.cur='';return go('home')}if(x==='games'&&!ui.cur)ui.cur=curDate();go('app',x)},
 home:()=>{ui.sc=null;ui.cur='';ui.flow='';go('home')},
 resume:()=>{ui.cur=TODAY();go('app','games')},opentoday:()=>{ui.cur=TODAY();go('app','players')},
 newsched:()=>openSched(''),sedit2:x=>openSched(x),hedit:x=>openSched(x,'hist'),
 hstart:()=>{ui.cur=TODAY();ui.flow='start';go('app','players');toast('Check who is playing, then tap Next')},
 pnext:()=>{const d=curDate();if(!d)return;ui.cur=d;const g=S.games[d],st=ui.flow==='start'&&canStart(d);ui.flow='';go('app','games');
   if(st){startSession();if(running(S.games[d])){ui.ck=1;render()}}},
 delsess:x=>{const g=S.games[x];if(g&&running(g))return toast('End the session first');
   if(!confirm('Delete the session on '+dlab(x)+'? Its games, attendance and payments are removed. This cannot be undone.'))return;
   delSess(x);if(ui.h&&ui.h.sel==='s:'+x)ui.h.sel=ui.h.selM||'y';save();render();toast('Session deleted')},
 scplayers:()=>schedSave('players'),
 ckopen:()=>{ui.ck=1;render()},closeck:()=>{ui.ck=0;render()},ckplayers:()=>{ui.ck=0;go('app','players')},
 ckin:x=>act.arrive(x),
 ckout:x=>{const d=curDate(),a=att(d,x);if(!a)return;a.l=Date.now();attChanged(x,nameOf(x)+' left at '+hm(a.l)+' – removed from Up Next and the plan');save();render()},
 ckback:x=>{const a=att(curDate(),x);if(a)a.l=0;attChanged(x,nameOf(x)+' is back');save();render()},
 ckdum:x=>{const d=curDate(),D=day(d),v=!isDum(d,x);D.dm=D.dm||{};D.dm[x]=v;const g=S.games[d];
   if(g){if(running(g))autoNext(g,'all',nameOf(x)+(v?' marked dummy – plays only when no regular is free':' is a regular again – gets the 5-game target'));else g.psig=''}save();render()},
 cfopen:x=>{const g=CG(),q=g.nxt[+x];if(!q||!q.every(Boolean))return toast('Fill all 4 players in Up Next first');ui.cf={i:+x};render()},
 closecf:()=>{ui.cf=null;render()},cfok:()=>{const i=ui.cf.i;ui.cf=null;sendCourt(CG(),i);render()},hist:()=>{ui.h=null;go('hist')},
 cancelup:x=>{const D=S.days[x];if(!D)return;const pk=pkgsFor(x).length;
   if(!confirm('Cancel the session on '+dlab(x)+'?'+(pk?' It is part of a court package – to keep its share, use Edit and move it to the new date instead.':'')))return;
   if(D.ser){const sr=S.series.find(s=>s.id===D.ser);if(sr){sr.skip=sr.skip||[];sr.skip.push(x)}}
   if(S.games[x]&&!S.games[x].st)delete S.games[x];if(!(S.fin[x]&&Object.keys(S.fin[x].paid).length))delete S.fin[x];delete S.days[x];if(ui.cur===x)ui.cur='';save();render();toast('Session cancelled')},
 /* schedule */
 scd:x=>{ui.sc.d=x;render()},sch:(x,y)=>{const c=ui.sc.courts[+x];c.h=Math.max(.5,Math.min(8,num(c.h)+ +y));render()},
 scn:x=>{const C=ui.sc.courts;if(+x>0){if(C.length>=8)return;const l=C[C.length-1];C.push({n:'Court '+(C.length+1),h:l?l.h:2})}else if(C.length>1)C.pop();render()},
 screp:()=>{ui.sc.rep=!ui.sc.rep;render()},
 sclast:()=>{const l=Object.keys(S.days).filter(d=>isSched(d)&&d!==ui.sc.d).sort().pop();if(!l)return toast('No earlier session');const D=S.days[l];Object.assign(ui.sc,{time:D.time,loc:D.loc,courts:JSON.parse(JSON.stringify(courtsOf(l)))});render();toast('Copied from '+dlab(l))},
 saveloc:()=>{const n=($('#nloc').value||'').trim();ui.scNew=false;if(n){if(!S.locs.includes(n))S.locs.push(n);ui.sc.loc=n;save()}render()},cancelloc:()=>{ui.scNew=false;render()},
 scsave:()=>schedSave(),
 /* previous sessions */
 hy:x=>{ui.h.y=x;ui.h.sel='y';render()},hsel:x=>{if(x.startsWith('s:')){if(!ui.h.sel.startsWith('s:'))ui.h.selM=ui.h.sel}else ui.h.selM=x;ui.h.sel=x;render()},
 htab:x=>{ui.h.tab=x;render()},hgames:x=>{ui.cur=x;go('app','games')},hfin:x=>{const h=ui.hun;ui.fsub='kitty';ui.ks={m:'session',s:x};go('app','finance');if(h){ui.unlocked=true;render()}},
 /* players */
 devlock:()=>{if(!NB||!NB.pinScreen)return toast('Tablet lock works in the app only');if(pinned())NB.unlock();else{NB.pinScreen();setTimeout(render,800)}},
 lv:x=>{ui.lv=+x;$('#lvb').innerHTML=vLv()},
 add:()=>{const n=ui.nm.trim().replace(/\s+/g,' ');if(!n)return toast('Type a name first');const d=dupInfo(n);if(d&&d.red)return toast('Already in the list');
   const id='p'+(S.nid++);S.players.push({id,name:n,lv:ui.lv,j:Date.now()});ui.nm='';save();render();toast(n+' added');const i=$('#pname');if(i)i.focus()},
 clearq:()=>{ui.q='';$('#psearch').value='';$('#pgrid').innerHTML=vGrid()},
 alloff:()=>{const d=curDate(),D=day(d);if(!onIds(d).length)return;if(!confirm('Turn all players off for '+dlab(d)+'?'))return;
   const ids=onIds(d);D.on={};const g=S.games[d];if(g){const t=Date.now();ids.forEach(id=>benchOff(g,id,t));g.nxt=g.nxt.map(()=>NUL4())}save();render()},
 tog:x=>{const d=curDate();if(!d)return;const D=day(d);D.on[x]=!D.on[x];if(!D.on[x])delete D.on[x];const g=S.games[d];
   if(g&&running(g)){const t=Date.now();if(!D.on[x]){benchOff(g,x,t);g.nxt=g.nxt.map(q=>q.map(y=>y===x?null:y));autoNext(g,'fill',nameOf(x)+' turned off · removed from Up Next')}}
   save();render()},
 pmod:x=>{const p=P(x);if(!p)return;ui.pm={id:x,name:p.name,ph:p.ph||''};render()},
 closepm:()=>{ui.pm=null;render()},noop:()=>{},
 qlv:(x,y)=>{const p=P(x);if(!p||p.lv===+y)return;p.lv=+y;lvChanged([x]);save();render()},
 saveedit:()=>{const e=ui.pm,p=P(e.id),n=e.name.trim().replace(/\s+/g,' ');if(!n)return toast('Name cannot be empty');const d=dupInfo(n,p.id);if(d&&d.red)return toast('That name is already used');
   p.name=n;p.ph=(e.ph||'').trim();ui.pm=null;save();render()},
 delplayer:()=>{const p=P(ui.pm.id);if(!confirm('Delete '+p.name+'? Past games and payments keep their record.'))return;p.gone=true;Object.values(S.days).forEach(D=>delete D.on[p.id]);S.orgs=S.orgs.filter(o=>o!==p.id);ui.pm=null;save();render()},
 arrive:x=>{const d=curDate(),D=day(d),g=S.games[d],t=Date.now();D.att=D.att||{};D.att[x]={a:t};const late=g?(t-Math.max(bookStart(d),g.st||0))/60e3:0;
   attChanged(x,late>10?nameOf(x)+' arrived '+Math.round(late)+' min late – '+target(g,x)+' games realistic':nameOf(x)+' checked in');save();render()},
 attedit:x=>{const a=att(curDate(),x)||{};ui.am={id:x,a:a.a?hm(a.a):'',l:a.l?hm(a.l):''};render()},
 closeam:()=>{ui.am=null;render()},
 amsave:()=>{const d=curDate(),e=ui.am,D=day(d);const a=tms(d,e.a),l=e.l?tms(d,e.l):0;if(!a)return toast('Enter the arrival time');if(l&&l<=a)return toast('Left must be after Arrived');
   D.att[e.id]={a,l};ui.am=null;attChanged(e.id,nameOf(e.id)+' times edited · '+(l?'left '+hm(l):'arrived '+hm(a)));save();render()},
 amleft:()=>{const d=curDate(),e=ui.am,a=att(d,e.id);if(!a)return;a.l=Date.now();ui.am=null;attChanged(e.id,nameOf(e.id)+' left at '+hm(a.l)+' – removed from Up Next and the plan');save();render()},
 amback:()=>{const d=curDate(),e=ui.am,a=att(d,e.id);if(a)a.l=0;ui.am=null;attChanged(e.id,nameOf(e.id)+' is back');save();render()},
 amnot:()=>{const d=curDate(),e=ui.am;delete day(d).att[e.id];ui.am=null;attChanged(e.id,null);save();render()},
 /* games */
 reshuffle:()=>{const g=CG();autoNext(g,'all','Up Next re-shuffled');save();render();toast('Up Next re-shuffled')},
 remix:()=>{const g=CG();if(g.st)autoNext(g,'all','Up Next re-mixed');else{g.nman=[];buildPlan(g)}save();render()},
 startsess:()=>{const d=curDate();startSession();if(running(S.games[d])){ui.ck=1;render()}},
 endsess:()=>{const g=CG();if(!confirm('End this session? All timers stop, scored games are saved and every player is turned off.'))return;endSession(g,Date.now());save();render();toast('Session saved')},
 reopen:()=>{const g=CG();if(!g.en||Date.now()-g.en>=REOPEN_MS)return render();if(!confirm('Reopen this session? Players come back on and timers run again.'))return;const D=day(g.d);
   g.ros.forEach(id=>{if(P(id)&&!P(id).gone)D.on[id]=true});Object.values(D.att||{}).forEach(a=>{if(a.e){delete a.e}});g.en=0;G(g.d);save();render()},
 gch:(x,y)=>{const d=curDate(),D=day(d),c=D.courts[+x];if(!c)return;c.h=Math.max(.5,Math.min(8,num(c.h)+ +y));const g=G(d);
   if(running(g))autoNext(g,'fill',c.n+' now '+hrsL(c.h)+' (ends '+hm(courtEnd(d,+x))+') · remaining games re-planned');else g.psig='';save();render()},
 shuffle:()=>{},
 send:x=>sendCourt(CG(),+x),
 rmslot:(x,y)=>{const g=CG();qref(g,x)[+y]=null;if(String(x)[0]==='0')g.nman[+String(x).split('.')[1]]=1;save();render()},
 gadd:()=>{const g=CG(),l=g.hist[0];ui.ge={d:g.d,i:-1,ids:NUL4(),sa:'',sb:'',w:'',c:1,st:l?hm(l.at+num(g.chg)*60000):g.st?hm(g.st):hm(Date.now()),du:num(g.slot)||15};render()},
 gedit:x=>{const g=CG(),h=g.hist[+x];if(!h)return;ui.ge={d:g.d,i:+x,ids:h.ids.slice(),sa:h.sa,sb:h.sb,w:h.sa>h.sb?'a':h.sb>h.sa?'b':'',c:h.c,st:hm(h.at-h.s*1000),du:Math.round(h.s/60)};render()},
 closege:()=>{ui.ge=null;render()},gesave:()=>geSave(),
 gedel:()=>{const e=ui.ge,g=G(e.d);if(!confirm('Delete this game?'))return;g.hist.splice(e.i,1);g.man=1;ui.ge=null;save();render();toast('Game deleted')},
 gewon:x=>{const e=ui.ge,g=G(e.d),w=x==='a'?'sa':'sb',l=x==='a'?'sb':'sa';e.w=x;const lv=Math.max(0,Math.round(num(e[l])));e[l]=lv;e[w]=winOf(g,lv);if(e[w]<=lv)e[w]=lv+2;render()},
 sedit:()=>{const g=CG();ui.se={d:g.d,st:g.st?hm(g.st):'',en:g.en?hm(g.en):''};render()},
 closese:()=>{ui.se=null;render()},
 sesave:()=>{const e=ui.se,g=G(e.d),run=running(g);const st=tms(e.d,e.st);if(!st)return toast('Enter a start time');
   if(!run){let en=tms(e.d,e.en);if(!en)return toast('Enter an end time');if(en<=st)en+=864e5;g.en=en}g.st=st;if(!isSched(e.d))day(e.d).sch=1;ui.se=null;save();render();toast('Session times saved')},
 won:(x,y)=>{const g=CG(),L=g.live[+x];if(!L)return;L.w=y;const wk=y==='a'?'sa':'sb',lk=y==='a'?'sb':'sa';L[lk]=Math.min(L[lk],capOf(g)-1);L[wk]=winOf(g,L[lk]);save();render()},
 sc:(x,y)=>{const g=CG(),L=g.live[+x];if(!L)return;const k=y[0]==='a'?'sa':'sb',o=k==='sa'?'sb':'sa',c=capOf(g);L[k]=Math.max(0,Math.min(c,L[k]+(y[1]==='+'?1:-1)));
   if(L.w&&L.w!==y[0]){L[k]=Math.min(L[k],c-1);L[o]=winOf(g,L[k])}save();render()},
 timer:x=>{const g=CG(),i=+x,L=g.live[i];if(!L)return;if(!L.run&&!L.sa&&!L.sb){g.live[i]={...L,run:true,start:Date.now()};save();return render()}
   if(!L.sa&&!L.sb){if(!confirm('No score entered. Discard this game timer?'))return;const q=g.cur[i],t=Date.now();g.cur[i]=NUL4();g.live[i]=blankLive();q.forEach(id=>id&&benchOn(g,id,t));save();return render()}
   if(L.sa===L.sb&&!confirm('Scores are level. Save as a draw?'))return;
   saveGame(g,i);save();render()},
 /* finance */
 fsub:x=>{ui.fsub=x;render()},lock:()=>{ui.unlocked=false;ui.pin='';render()},
 ksm:x=>{ui.ks=ui.ks||{};ui.ks.m=x;ui.open=null;render()},kopen:x=>{ui.ks.m='session';ui.ks.s=x;render();window.scrollTo(0,0)},
 mkpdf:()=>{const ss=sessions();if(!ss.length)return toast('No sessions yet');const{k,list}=kSel(ss);if(!list.length)return toast('No sessions in that selection');const ti=selTitle(k,list);
   $('#print').innerHTML=vReport(list,ti);setTimeout(()=>{try{if(NB&&NB.print)NB.print('Rebels Badminton - '+ti);else window.print()}catch(err){toast('PDF not available')}},300)},
 fsave:()=>{save();ui.saved='✓ Saved';render()},unpaid:()=>{ui.unpaid=!ui.unpaid;render()},
 payopen:x=>{const f=fin(),p=payOf(f,x);ui.pay={d:ui.fsel,id:x,m:p?p.m:(S.lastM||'cash'),by:p?p.by:(S.lastBy&&isOrg(S.lastBy)?S.lastBy:(S.orgs[0]||''))};render()},
 closepay:()=>{ui.pay=null;render()},paym:x=>{ui.pay.m=x;render()},payby:x=>{ui.pay.by=x;render()},
 payok:()=>{const e=ui.pay;finOf(e.d,true).paid[e.id]={m:e.m,by:e.by,t:Date.now()};S.lastBy=e.by;S.lastM=e.m;ui.pay=null;fdone()},
 payun:()=>{const e=ui.pay;delete finOf(e.d,true).paid[e.id];ui.pay=null;fdone()},
 qr:(x,y)=>{ui.qr={id:x,ds:y?y.split(','):[ui.fsel]};render()},closeqr:()=>{ui.qr=null;render()},
 tube:x=>{const f=fin(),n=+x;f.used=n===num(f.used)?n-1:n;fdone()},
 cby:x=>{fin().cby=x;S.lastBy=x;fdone()},oby:x=>{ui.oby=x;S.lastBy=x;render()},
 addoth:()=>{const l=($('#olab').value||'').trim(),a=num($('#oamt').value);if(!a)return toast('Enter an amount');fin().oth.push({lab:l||'Misc',amt:a,by:ui.oby||S.lastBy||''});fdone()},
 rmoth:x=>{fin().oth.splice(+x,1);fdone()},
 open:x=>{ui.open=ui.open===x?null:x;render()},
 rpm:x=>{ui.rp={m:x};render()},ef:x=>{ui.ef=x;render()},
 entnew:(x,y)=>{ui.ent={t:x,d:TODAY(),amt:'',by:(x!=='pay'&&x!=='xfer'&&y)?y:(S.lastBy||''),from:y||'',to:'',note:'',tubes:'',loc:S.locs[0]||'',nc:1,hrs:2,dates:[]};render()},
 entedit:x=>{const e=S.ent.find(o=>o.id===x);if(!e)return;ui.ent=JSON.parse(JSON.stringify(Object.assign({dates:[],tubes:'',nc:1,hrs:2,loc:'',from:'',to:'',by:''},e)));render()},
 closeent:()=>{ui.ent=null;render()},entt:x=>{ui.ent.t=x;render()},
 enday:x=>{const a=ui.ent.dates,i=a.indexOf(x);if(i>=0)a.splice(i,1);else a.push(x);render()},
 enfrom:x=>{ui.ent.from=x;render()},ento:x=>{ui.ent.to=x;render()},enby:x=>{ui.ent.by=x;render()},
 entdel:()=>{if(!confirm('Delete this entry?'))return;S.ent=S.ent.filter(o=>o.id!==ui.ent.id);ui.ent=null;save();render()},entsave:()=>entSave(),
 /* settings */
 stab:x=>{ui.setTab=x;if(x==='rules'){render();(S.rules||[]).forEach(r=>delete r.nw);S.newRules=0;save();return}render()},
 ruletog:x=>{const r=S.rules[+x];r.on=!r.on;Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});save();render()},
 ruledel:x=>{if(!confirm('Delete this learned rule?'))return;const r=S.rules.splice(+x,1)[0];S.ovr=(S.ovr||[]).filter(o=>!o.k.includes(r.k));save();render()},
 dpts:x=>{S.def.pts=+x;applyDef('pts');if(+x===30){S.def.deuce=false;applyDef('deuce')}save();render()},ddeuce:()=>{S.def.deuce=!S.def.deuce;applyDef('deuce');save();render()},
 slv:(x,y)=>{const p=P(x);if(!p)return;ui.lvE=ui.lvE||{};if(+y===p.lv)delete ui.lvE[x];else ui.lvE[x]=+y;render()},
 lvupd:()=>{const E=ui.lvE||{};const ks=Object.keys(E);if(!ks.length)return;ks.forEach(id=>{const p=P(id);if(p)p.lv=E[id]});ui.lvE={};
   const d=curDate();if(d)lvChanged(ks);Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});save();render();toast(pl(ks.length,'level')+' updated')},
 org:x=>{S.orgs=S.orgs||[];const i=S.orgs.indexOf(x);if(i>=0)S.orgs.splice(i,1);else{if(S.orgs.length>=5)return toast('Up to 5 organizers');S.orgs.push(x)}save();render()},
 chpin:()=>{ui.pctx='set';ui.pmode=S.pin?'old':'new';ui.pin='';ui.pin1='';ui.err='';render()},
 pincancel:()=>{ui.pmode=null;ui.pin='';ui.pin1='';ui.err='';render()},
 key:x=>pinKey(x),
 bcopy:()=>copy(JSON.stringify(S)),
 bshare:()=>{try{NB.share(JSON.stringify(S))}catch(e){toast('Share not available')}},
 bimport:()=>{const s=parse(($('#bimp').value||'').trim());if(!s)return toast('That is not a valid backup');
   if(!confirm('Replace ALL data on this tablet with this backup?'))return;S=s;migrate();save();ui.ks=null;ui.unlocked=false;toast('Backup imported');render()}
};
function applyDef(f){const t=TODAY();Object.values(S.games).forEach(g=>{if(!g.st&&g.d>=t){g[f]=S.def[f];g.psig=''}})}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;if(el.dataset.a==='noop'){e.stopPropagation();return}
  if(el.classList.contains('modal')&&e.target!==el)return;if(el.disabled)return;
  const f=act[el.dataset.a];if(f){e.stopPropagation();f(el.dataset.x,el.dataset.y)}});
document.addEventListener('input',e=>{const el=e.target,k=el.dataset.i;if(!k)return;
  if(k==='nm'){ui.nm=el.value;$('#dup').innerHTML=vDup()}
  else if(k==='q'){ui.q=el.value;$('#pgrid').innerHTML=vGrid()}
  else if(k==='ename'){ui.pm.name=el.value;const d=dupInfo(el.value,ui.pm.id);$('#edup').innerHTML=d?'<div class="warn '+(d.red?'red':'yel')+'">⚠ '+esc(d.msg)+'</div>':''}
  else if(k==='eph'){ui.pm.ph=el.value}
  else if(k==='sc_n'){ui.sc.courts[+el.dataset.x].n=el.value}
  else if(k.startsWith('am_')){ui.am[k.slice(3)]=el.value}
  else if(k.startsWith('f_')){const f=k.slice(2);finOf(ui.fsel,true)[f]=el.value;S.def[f]=el.value;save();ui.saved='✓ Auto-saved';const s=$('#fsaved');if(s)s.textContent=ui.saved;clearTimeout(window.__fr);window.__fr=setTimeout(()=>{const a=document.activeElement,id=a&&a.dataset.i;render();if(id){const n=document.querySelector('[data-i="'+id+'"]');if(n){n.focus();const v=n.value;try{n.setSelectionRange(v.length,v.length)}catch(err){}}}},700)}
  else if(k.startsWith('ge_')){const e=ui.ge,f=k.slice(3);e[f]=el.value;if(f==='en'&&e.st&&el.value){let m=(tms(e.d,el.value)-tms(e.d,e.st))/60000;if(m<=0)m+=1440;e.du=Math.round(m);$('#ge_du').value=e.du}
    else if((f==='st'||f==='du')&&$('#ge_en'))$('#ge_en').value=e.st&&num(e.du)?hm(tms(e.d,e.st)+num(e.du)*60000):''}
  else if(k.startsWith('se_')){ui.se[k.slice(3)]=el.value}
  else if(k.startsWith('en_')){ui.ent[k.slice(3)]=el.value}
  else if(k.startsWith('d_')){const f=k.slice(2);S.def[f]=el.value;applyDef(f);save()}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const id=e.target.id;if(id==='pname'){e.preventDefault();act.add()}else if(id==='nloc'){e.preventDefault();act.saveloc()}else if(id==='oamt'){e.preventDefault();act.addoth()}});
document.addEventListener('change',e=>{const el=e.target,c=el.dataset.c;if(!c)return;
  if(c==='scdate'){if(el.value){ui.sc.d=el.value;render()}}
  else if(c==='sctime'){ui.sc.time=el.value;render()}
  else if(c==='scloc'){if(el.value==='__new'){ui.scNew=true;render();setTimeout(()=>$('#nloc')&&$('#nloc').focus(),50)}else{ui.sc.loc=el.value;render()}}
  else if(c==='slot'){if(!el.value)return;const g=CG(),x=el.dataset.x;qref(g,x)[+el.dataset.y]=el.value;
    if(String(x)[0]==='0'){const i=+String(x).split('.')[1];g.nman[i]=1;if(running(g)&&g.nxt[i].every(Boolean)){g.nxt[i]=orderQ(g.nxt[i],g);recordOverride(g,i)}}save();render()}
  else if(c==='cfslot'){const g=CG(),i=ui.cf.i,k=+el.dataset.y,v=el.value||null;g.nxt.forEach((q,j)=>{if(j!==i)g.nxt[j]=q.map(x=>x===v?null:x)});g.nxt[i][k]=v;g.nman[i]=1;
    if(g.nxt[i].every(Boolean))recordOverride(g,i);save();render()}
  else if(c==='fsel'){ui.ks.s=el.value;ui.saved='';render()}
  else if(c==='ksmo'){ui.ks.mo=el.value;render()}else if(c==='ksy'){ui.ks.y=el.value;render()}else if(c==='ksa'){ui.ks.a=el.value;render()}else if(c==='ksb'){ui.ks.b=el.value;render()}
  else if(c==='rpv'){ui.rp.v=el.value;render()}
  else if(c==='en_loc'){ui.ent.loc=el.value}
  else if(c==='ge_p'){ui.ge.ids[+el.dataset.y]=el.value||null;render()}
  else if(c==='ge_c'){ui.ge.c=+el.value}});
setInterval(tick,1000);
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();ui.unlocked=false;ui.hun=false}else{topUp();render()}});

/* ---------- data upgrade ---------- */
function migrate(){const t=TODAY();S.def=Object.assign({pts:21,deuce:true,slot:15,chg:2,court:'',fee:'',spt:12},S.def||{});delete S.def.bh;delete S.def.box;
  ['series','ent','rules','ovr','orgs'].forEach(k=>{if(!Array.isArray(S[k]))S[k]=[]});if(!S.eid)S.eid=1;
  S.orgs=S.orgs.filter(id=>P(id)&&!P(id).gone);
  if((S.v||0)<3){Object.keys(S.games).forEach(d=>{if(!S.days[d])S.days[d]={loc:S.locs[0]||'',on:{}}});
    Object.keys(S.days).forEach(d=>{const D=S.days[d],g=S.games[d];D.sch=1;if(!D.on)D.on={};
      if(!D.time){const st=g&&g.st?new Date(g.st):null;D.time=st?z(st.getHours())+':'+(st.getMinutes()<30?'00':'30'):'20:00'}
      if(!D.courts){const n=Math.max(1,(g&&g.courts)||1),h=num(g&&g.bh)||2;D.courts=Array.from({length:n},(_,i)=>({n:'Court '+(i+1),h}))}
      if(!D.att){D.att={};if(g&&g.st)(g.ros||[]).forEach(id=>{D.att[id]={a:g.st}})}});
    S.v=3}
  Object.keys(S.games).forEach(d=>{const g=S.games[d];g.d=d;if(g.pts==null)g.pts=S.def.pts;if(g.deuce==null)g.deuce=S.def.deuce;if(g.slot==null)g.slot=S.def.slot;if(g.chg==null)g.chg=S.def.chg;
    g.st=g.st||0;g.en=g.en||0;g.live=(g.live||[]).map(L=>L||blankLive());G(d);
    if(!g.st&&g.hist.length){const f=g.hist.map(h=>h.at-h.s*1000);g.st=Math.min(...f)}
    if(d<t&&g.st&&!g.en)endSession(g,g.hist.length?Math.max(...g.hist.map(h=>h.at)):g.st)});
  topUp()}

/* ---------- welcome → home: the logo glides into place ---------- */
const W=$('#wel'),ST=$('#stage');
function fit(){const s=Math.min(innerWidth/1194,innerHeight/834);ST.style.transform='scale('+s+')'}
fit();addEventListener('resize',fit);
let gone=false;
function enter(){if(gone)return;gone=true;const home=document.querySelector('.home'),from=$('#wlogo'),to=$('#homeLogo');
  if(!home||!from||!to){W.classList.add('hide');setTimeout(()=>W.remove(),400);return}
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),c=new Image();c.src=from.src;c.className='glide';
  Object.assign(c.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});document.body.appendChild(c);
  W.classList.add('hide');requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.transform='translate('+(b.left-a.left)+'px,'+(b.top-a.top)+'px) scale('+(b.width/a.width)+')'}));
  setTimeout(()=>{home.classList.remove('pre');home.classList.add('go');c.remove();W.remove()},620)}
W.addEventListener('click',enter);setTimeout(enter,5000);
migrate();save();render();const H0=document.querySelector('.home');if(H0)H0.classList.add('pre');
