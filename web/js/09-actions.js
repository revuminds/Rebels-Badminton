/* ===== render, actions, events, start-up ===== */
function render(){const app=$('.app'),m=$('#main');/* H3: no Finance PIN – the logged-in role decides */ui.unlocked=ui.hun=canFin();ui.bun=ADMIN();if(GM()&&(ui.tab==='finance'||ui.tab==='settings')&&ui.scr==='app')ui.tab='games';if(GM()&&ui.h&&ui.h.tab==='fin')ui.h.tab='games';
  document.body.classList.toggle('viewer',VIEW());document.body.classList.toggle('gm',GM());stRender();RING=null;if(ui.scr==='app'&&ui.tab==='games'){const d0=curDate(),g0=d0&&S.games[d0];if(g0&&g0.st)RING=counts(g0,false)}app.classList.toggle('full',ui.scr!=='app'&&ui.scr!=='home');app.classList.toggle('onhome',ui.scr==='home');
  if(ui.scr==='app'||ui.scr==='home')$('#nav').innerHTML=vNav();
  if(ui.scr==='app'){m.innerHTML=ui.tab==='players'?vPlayers():ui.tab==='games'?vGames():ui.tab==='finance'?vFinance():vSettings()}
  else{if(ui.scr!=='home')$('#nav').innerHTML='';m.innerHTML=ui.scr==='sched'?vSched():ui.scr==='hist'?vHist():ui.scr==='pedit'&&ui.pe?vPE():ui.scr==='addpast'&&ui.ap?vAP():vHome()}
  $('#modal').innerHTML=ui.lvs?vLiveShare():ui.pm?vPMod():ui.am?vAtt():ui.ge?vGE():ui.er?vER():ui.se?vSE():ui.pay?vPayM():ui.qr?vQR():ui.ent?vEnt():ui.bk?vBk():ui.cf&&ui.scr==='app'&&ui.tab==='games'?vCf():ui.asg&&ui.scr==='app'&&ui.tab==='games'?vAsg():ui.cts&&ui.scr==='app'&&ui.tab==='games'?vCts():ui.ck&&ui.scr==='app'&&ui.tab==='games'?vCk():ui.endc&&ui.scr==='app'&&ui.tab==='games'?vEnd():ui.subm&&ui.scr==='app'&&ui.tab==='games'?vSubs():ui.lclm&&ui.scr==='app'&&ui.tab==='games'?vLcl():'';tick()}
const go=(scr,tab)=>{if(ui.tab==='finance'&&(scr!=='app'||tab!=='finance')&&scr!=='home')ui.unlocked=false;if(scr!=='hist')ui.hun=false;if(tab!=='settings')ui.bun=false;ui.scr=scr;if(tab)ui.tab=tab;ui.pmode=null;ui.pin='';ui.pin1='';ui.err='';render();window.scrollTo(0,0)};
const CG=()=>G(curDate());
const fin=()=>finOf(ui.fsel,true);
const fdone=()=>{save();ui.saved='✓ Auto-saved';render()};
const act={
 tab:x=>{ui.lvE={};ui.ck=0;ui.endc=0;ui.cne=null;ui.cf=null;ui.cts=0;ui.asg=0;ui.pick=null;ui.mv=null;if(x==='home'){ui.cur='';return go('home')}if(x==='games'&&!ui.cur)ui.cur=curDate();go('app',x)},
 gsave:()=>{save();toast('Saved ✓');ui.sc=null;ui.cur='';ui.flow='';go('home')},
 home:()=>{ui.sc=null;ui.cur='';ui.flow='';go('home')},
 resume:()=>{ui.cur=TODAY();go('app','games')},opentoday:()=>{ui.cur=TODAY();go('app','players')},
 newsched:()=>openSched(''),sedit2:x=>openSched(x),hedit:x=>openSched(x,'hist'),
 hstart2:()=>{if(!confirm('Start today’s session again? It continues the same session – games, check-ins and payments are kept.'))return;act.hstart()},
 /* v16 edit any past session: players + games */
 pedit:x=>{ui.pe={d:x,q:''};go('pedit')},pedone:()=>{const d=ui.pe&&ui.pe.d;ui.pe=null;if(d){if(ui.h){ui.h.y=d.slice(0,4);ui.h.sel='s:'+d}else ui.h={y:d.slice(0,4),sel:'s:'+d,tab:'games'}}go('hist')},
 peadd:x=>{const d=ui.pe.d,g=ensureMan(d);g.ros=[...new Set([...(g.ros||[]),x])];ui.pe.q='';save();render();toast(nameOf(x)+' added')},
 perm:x=>{const d=ui.pe.d,g=S.games[d],n=g?g.hist.filter(h=>h.ids.includes(x)).length:0,f=S.fin[d],pd=f&&payOf(f,x);
   if(!confirm((n||pd?nameOf(x)+' has '+[n?pl(n,'game'):'',pd?'a payment':''].filter(Boolean).join(' and ')+' in this session. ':'')+'Remove '+nameOf(x)+' from this session?'+(n?' Their games stay in the list.':'')+(pd?' The payment is removed.':'')))return;
   if(g)g.ros=(g.ros||[]).filter(i=>i!==x);const D=S.days[d];if(D){if(D.on)delete D.on[x];if(D.att)delete D.att[x]}if(f){delete f.paid[x];if(f.cnt)delete f.cnt[x]}save();render();toast(nameOf(x)+' removed')},
 pegadd:x=>{ensureMan(x);ui.ge={d:x,i:-1,ids:NUL4(),sa:'',sb:'',w:'',c:1,st:'',du:''};render()},
 pegedit:(x,y)=>{const g=G(x),h=g.hist[+y];if(!h)return;ui.ge={d:x,i:+y,ids:h.ids.slice(),sa:h.sa,sb:h.sb,w:h.sa>h.sb?'a':h.sb>h.sa?'b':'',c:h.c,st:h.u?'':hm(h.at-h.s*1000),du:h.u?'':Math.round(h.s/60)};render()},
 /* v16 add past session */
 apopen:()=>{const L=Object.keys(S.days).filter(d=>isSched(d)).sort().pop(),D=L?S.days[L]:null;ui.ap={d:addD(TODAY(),-1),time:D?D.time:'20:00',loc:D?D.loc:(S.locs[0]||''),courts:D?JSON.parse(JSON.stringify(courtsOf(L))):[{n:'Court 1',h:2}],cost:S.def.court||'',sh:'',ids:[],q:''};go('addpast')},
 apcancel:()=>{ui.ap=null;go('hist')},
 apch:(x,y)=>{const c=ui.ap.courts[+x];c.h=Math.max(.5,Math.min(8,num(c.h)+ +y));render()},
 apcn:x=>{const C=ui.ap.courts;if(+x>0){if(C.length<8)C.push({n:'Court '+(C.length+1),h:C[C.length-1].h})}else if(C.length>1)C.pop();render()},
 aptick:x=>{const a=ui.ap.ids,i=a.indexOf(x);if(i>=0)a.splice(i,1);else a.push(x);$('#aplist').innerHTML=vAPList();$('#apn').textContent=a.length},
 apsave:()=>{const a=ui.ap,d=a.d,t=TODAY();if(!d)return toast('Pick a date');if(d>=t)return toast('Pick a past date');
   const g0=S.games[d];if(isSched(d)||(g0&&(g0.st||(g0.hist||[]).length)))return toast('There is already a session on '+dlab(d)+' – open it in Previous sessions → Edit session');
   if(!a.ids.length&&!confirm('No players ticked. Save anyway?'))return;
   if(S.delD)delete S.delD[d];delete S.games[d];mkDay(d,{time:a.time,loc:a.loc,courts:a.courts.map(c=>({n:(c.n||'').trim()||'Court',h:num(c.h)})),on:{},att:{},man:1});
   const g=G(d);g.st=tms(d,a.time);g.en=g.st+sessLenH(d)*3600e3;g.ros=a.ids.slice();g.man=1;
   const f=finOf(d,true);f.court=a.cost;if(num(a.cost))f.cby=f.cby||S.lastBy||S.orgs[0]||'';f.used=num(a.sh);
   if(a.loc&&!S.locs.includes(a.loc))S.locs.push(a.loc);ui.ap=null;ui.h=null;ui.pe={d,q:''};save();go('pedit');toast('Past session saved · add games here (optional)')},
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
 ckdum:x=>{const d=curDate(),v=!isDum(d,x);S.dum=S.dum||{};if(v)S.dum[x]=1;else delete S.dum[x];const g=S.games[d];
   if(g){if(running(g))autoNext(g,'all','Up Next updated');else g.psig=''}save();render()},
 hist:()=>{ui.h=null;go('hist')},
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
 devlock:()=>{if(!NB||!NB.pinScreen)return toast('Tablet lock works in the app only');if(pinned())return toast('To unlock: swipe up from the bottom and hold 3 seconds',6000);NB.pinScreen();setTimeout(render,800)},
 lv:x=>{ui.lv=+x;$('#lvb').innerHTML=vLv()},sx:x=>{ui.sx=ui.sx===x?'':x;$('#sxb').innerHTML=sxSeg(ui.sx,'sx',1)},pmsx:x=>{ui.pm.sx=ui.pm.sx===x?'':x;render()},
 add:()=>{const n=ui.nm.trim().replace(/\s+/g,' ');if(!n)return toast('Type a name first');if(!ui.sx)return toast('Pick M or F');const d=dupInfo(n);if(d&&d.red)return toast('Already in the list');
   const id='p'+(S.nid++);S.players.push(Object.assign({id,name:n,lv:ui.lv,j:Date.now()},ui.sx?{sx:ui.sx}:{}));ui.nm='';save();render();toast(n+' added');const i=$('#pname');if(i)i.focus()},
 qsx:(x,y)=>{const p=P(x);if(!p)return;p.sx=y;const g=S.games[curDate()];if(g){if(running(g))autoNext(g,'fill',null);else g.psig=''}save();render()},
 clearq:()=>{ui.q='';$('#psearch').value='';$('#pgrid').innerHTML=vGrid()},
 alloff:()=>{const d=curDate(),D=day(d);if(!onIds(d).length)return;if(!confirm('Turn all players off for '+dlab(d)+'?'))return;
   const ids=onIds(d);D.on={};const g=S.games[d];if(g){const t=Date.now();ids.forEach(id=>benchOff(g,id,t));g.nxt=g.nxt.map(()=>NUL4());autoNext(g,'fill',null)}save();render()},
 tog:x=>{const d=curDate();if(!d)return;const D=day(d);D.on[x]=!D.on[x];if(!D.on[x])delete D.on[x];const g=S.games[d];
   if(g&&running(g)){const t=Date.now();if(!D.on[x]){benchOff(g,x,t);autoNext(g,'fill',nameOf(x)+' turned off · removed from upcoming games')}}
   save();render()},
 pmod:x=>{const p=P(x);if(!p)return;ui.pm={id:x,ed:0};render()},
 pmedit:()=>{const p=P(ui.pm.id);if(!p)return;ui.pm={id:p.id,ed:1,name:p.name,ph:p.ph||'',lv:p.lv,sx:p.sx||'',img:p.img||''};render()},pmcancel:()=>{ui.pm={id:ui.pm.id,ed:0};render()},
 pmlv:x=>{ui.pm.lv=+x;render()},phrm:()=>{ui.pm.img='';render()},
 photo:x=>{if(!ui.pm)return;if(NB&&NB.photo){try{NB.photo(x);return}catch(err){}}const f=document.createElement('input');f.type='file';f.accept='image/*';if(x==='cam')f.setAttribute('capture','environment');
   f.onchange=()=>{const r=new FileReader();r.onload=()=>window.__photo(String(r.result||''));if(f.files[0])r.readAsDataURL(f.files[0])};f.click()},
 closepm:()=>{ui.pm=null;render()},noop:()=>{},
 qlv:(x,y)=>{const p=P(x);if(!p||p.lv===+y)return;p.lv=+y;lvChanged([x]);save();render()},
 saveedit:()=>{const e=ui.pm,p=P(e.id),n=e.name.trim().replace(/\s+/g,' ');if(!n)return toast('Name cannot be empty');const d=dupInfo(n,p.id);if(d&&d.red)return toast('That name is already used');
   const lc=p.lv!==e.lv;p.name=n;p.ph=(e.ph||'').trim();p.lv=e.lv;if(e.sx){if(e.sx!==p.sx)Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});p.sx=e.sx}else delete p.sx;if(e.img)p.img=e.img;else delete p.img;ui.pm={id:p.id,ed:0};if(lc){lvChanged([p.id]);Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''})}save();render();toast('Saved')},
 sdel:x=>{const p=P(x);if(!p)return;if(!confirm('Delete '+p.name+'? Past games and payments keep their record.'))return;p.gone=true;Object.values(S.days).forEach(D=>delete D.on[p.id]);S.orgs=S.orgs.filter(o=>o!==p.id);delete ui.lvE[p.id];save();render();toast(p.name+' deleted')},
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
 reshuffle:()=>{const g=CG();autoNext(g,'rp','Upcoming games re-picked · on-court / not-here / double-booked players replaced');save();render();toast('Upcoming games re-picked')},
 remix:()=>{const g=CG();if(g.st)autoNext(g,'all','Upcoming games re-picked');else{g.nman=[];buildPlan(g)}save();render()},
 startsess:()=>{const d=curDate();startSession();if(running(S.games[d])){ui.ck=1;render()}},
 cnedit:x=>{ui.cne=+x;render();const el=$('#cnin');if(el){el.focus();el.select()}},
 endsess:()=>{ui.endc=1;render()},closeend:()=>{ui.endc=0;render()},
 endok:()=>{ui.endc=0;const g=CG();snapTake('Before End session');endSession(g,Date.now());save();render();toast('Session saved')},
 gch:(x,y)=>{const d=curDate(),D=day(d),c=D.courts[+x];if(!c)return;c.h=Math.max(.5,Math.min(8,num(c.h)+ +y));const g=G(d);
   if(running(g))autoNext(g,'fill',c.n+' now '+hrsL(c.h)+' (ends '+hm(courtEnd(d,+x))+') · remaining games re-planned');else g.psig='';save();render()},
 shuffle:()=>{},
 /* v16 full session plan */
 fpplan:()=>{const g=CG();if(planFull(g,false)){logIt(g,'Full session planned · '+g.fp.length+' games');save();render();toast(pl(g.fp.length,'game')+' planned')}},
 fpre:()=>{const g=CG();if(!g.fp)return act.reshuffle();if(!confirm('Re-plan the remaining games? Played, on-court, assigned and edited games stay.'))return;if(planFull(g,true)){logIt(g,'Remaining games re-planned');save();render();toast('Remaining games re-planned')}},
 fpclear:()=>{const g=CG();if(!confirm('Clear the full session plan?'))return;delete g.fp;if(running(g)){g.up=g.up.filter(x=>!x.n);autoNext(g,'fill',null)}else g.psig='';save();render()},
 fpo:()=>{ui.fpo=!ui.fpo;render()},
 fpprint:()=>{const g=CG();if(!g.fp)return;const ti='Game schedule '+g.d,el=$('#print');el.className='sp';el.innerHTML=vFullPrint(g);
   setTimeout(()=>{try{if(NB&&NB.printPortrait)NB.printPortrait('Rebels Badminton - '+ti);else if(NB&&NB.print)NB.print('Rebels Badminton - '+ti);else window.print()}catch(err){toast('PDF not available')}},300)},
 eropen:x=>{const g=G(x||curDate());if(!g.fp)return;erInit(g.d)},closeer:()=>{ui.er=null;render()},ersave:()=>erSave(),
 erp:(x,y)=>{const r=ui.er.r[x]=ui.er.r[x]||{sa:'',sb:''};r.p=r.p===y?'':y;render()},
 rmslot:(x,y)=>{const g=CG();qref(g,x)[+y]=null;if(String(x)[0]==='0')g.nman[+String(x).split('.')[1]]=1;save();render()},
 gadd:()=>{const g=CG(),l=g.hist[0];ui.ge={d:g.d,i:-1,ids:NUL4(),sa:'',sb:'',w:'',c:1,st:l?hm(l.at+num(g.chg)*60000):g.st?hm(g.st):hm(Date.now()),du:Math.round(gameMin(g))};render()},
 gedit:x=>{const g=CG(),h=g.hist[+x];if(!h)return;ui.ge={d:g.d,i:+x,ids:h.ids.slice(),sa:h.sa,sb:h.sb,w:h.sa>h.sb?'a':h.sb>h.sa?'b':'',c:h.c,st:hm(h.at-h.s*1000),du:Math.round(h.s/60)};render()},
 closege:()=>{ui.ge=null;render()},gesave:()=>geSave(),
 gedel:()=>{const e=ui.ge,g=G(e.d);if(!confirm('Delete this game?'))return;g.hist.splice(e.i,1);g.man=1;ui.ge=null;save();render();toast('Game deleted')},
 gewon:x=>{const e=ui.ge,g={pts:+e.pts||G(e.d).pts,deuce:G(e.d).deuce},w=x==='a'?'sa':'sb',l=x==='a'?'sb':'sa';e.w=x;const lv=Math.max(0,Math.round(num(e[l])));e[l]=lv;e[w]=winOf(g,lv);if(e[w]<=lv)e[w]=lv+2;render()},
 sedit:()=>{const g=CG();ui.se={d:g.d,st:g.st?hm(g.st):'',en:g.en?hm(g.en):''};render()},
 closese:()=>{ui.se=null;render()},
 sesave:()=>{const e=ui.se,g=G(e.d),run=running(g);const st=tms(e.d,e.st);if(!st)return toast('Enter a start time');
   if(!run){let en=tms(e.d,e.en);if(!en)return toast('Enter an end time');if(en<=st)en+=864e5;g.en=en}g.st=st;if(!isSched(e.d))day(e.d).sch=1;ui.se=null;save();render();toast('Session times saved')},
 won:(x,y)=>{const g=CG(),L=g.live[+x];if(!L)return;const P=gp(g,L);L.w=y;const wk=y==='a'?'sa':'sb',lk=y==='a'?'sb':'sa';L[lk]=Math.min(L[lk],capOf(P)-1);L[wk]=winOf(P,L[lk]);save();render()},
 sc:(x,y)=>{const g=CG(),L=g.live[+x];if(!L)return;const P=gp(g,L),k=y[0]==='a'?'sa':'sb',o=k==='sa'?'sb':'sa',c=capOf(P);
   if(y[1]==='+'&&!L.w&&gameWon(L.sa,L.sb,P))return toast('Game over at '+L.sa+' – '+L.sb+' (to '+P.pts+') · tap Stop & save');L[k]=Math.max(0,Math.min(c,L[k]+(y[1]==='+'?1:-1)));
   if(L.w&&L.w!==y[0]){L[k]=Math.min(L[k],c-1);L[o]=winOf(P,L[k])}save();render()},
 /* finance */
 dstrong:x=>{S.def.strong=+x;Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});save();render()},dpwr:x=>{S.def.pwr=+x;save();render()},dtgt:x=>{S.def.tgt=+x;save();render()},
 theme:()=>{const l=!document.body.classList.contains('light');document.body.classList.toggle('light',l);try{localStorage.setItem('rebels.theme',l?'light':'dark')}catch(e){}render()},
 pf:(x,y)=>{ui.pf=ui.pf||{};ui.pf[x]=ui.pf[x]===y?'':y;$('#pgrid').innerHTML=vGrid();$('#pfl').innerHTML=vPfl()},
 gpo:()=>{ui.gpo=ui.gpo===0?1:0;render()},
 bpo:()=>{ui.bpo=ui.bpo===0?1:0;render()}, fsub:x=>{ui.fsub=x;render()},lock:()=>{ui.unlocked=false;ui.pin='';render()},
 ksm:x=>{ui.ks=ui.ks||{};ui.ks.m=x;ui.open=null;render()},kopen:x=>{ui.ks.m='session';ui.ks.s=x;render();window.scrollTo(0,0)},
 mkpdf:()=>{const ss=sessions();if(!ss.length)return toast('No sessions yet');const{k,list}=kSel(ss);if(!list.length)return toast('No sessions in that selection');const ti=selTitle(k,list);
   $('#print').className='rp';$('#print').innerHTML=vReport(list,ti);setTimeout(()=>{try{if(NB&&NB.print)NB.print('Rebels Badminton - '+ti);else window.print()}catch(err){toast('PDF not available')}},300)},
 fsave:()=>{save();ui.saved='✓ Saved';render()},unpaid:()=>{ui.unpaid=!ui.unpaid;render()},
 payopen:x=>{const f=fin(),p=payOf(f,x);ui.pay={d:ui.fsel,id:x,m:p?p.m:(S.lastM||'cash'),by:p?p.by:(S.lastBy&&isOrg(S.lastBy)?S.lastBy:(S.orgs[0]||''))};render()},
 closepay:()=>{ui.pay=null;render()},paym:x=>{ui.pay.m=x;render()},payby:x=>{ui.pay.by=x;render()},
 payok:()=>{const e=ui.pay;finOf(e.d,true).paid[e.id]={m:e.m,by:e.by,t:Date.now()};S.lastBy=e.by;S.lastM=e.m;ui.pay=null;fdone()},
 payun:()=>{const e=ui.pay;delete finOf(e.d,true).paid[e.id];ui.pay=null;fdone()},
 qr:(x,y)=>{ui.qr={id:x,ds:y?y.split(','):[ui.fsel]};render()},closeqr:()=>{ui.qr=null;render()},
 tube:x=>{const f=fin(),n=+x;f.used=n===num(f.used)?n-1:n;fdone()},
 cby:x=>{fin().cby=x;S.lastBy=x;fdone()},bkby:x=>{ui.bk.by=x;render()},
 bkedit:x=>{const f=S.fin[x];ui.bk={d:x,court:f&&num(f.court)?f.court:'',by:(f&&f.cby)||(S.lastBy&&isOrg(S.lastBy)?S.lastBy:(S.orgs[0]||''))};render()},closebk:()=>{ui.bk=null;render()},
 bksave:()=>{const e=ui.bk;if(!num(e.court))return toast('Enter the court price');if(!e.by)return toast('Pick who paid');const f=finOf(e.d,true);f.court=e.court;f.cby=e.by;S.lastBy=e.by;S.def.court=e.court;ui.bk=null;save();render();toast('Booking saved')},
 bkdel:()=>{const e=ui.bk,g=S.games[e.d],pld=!!(g&&(g.st||g.hist.length));if(!confirm(pld?'Clear the price and paid by of this booking?':'Delete this unplayed session booking ('+dlab(e.d)+')?'))return;
   if(pld){const f=S.fin[e.d];if(f){f.court='';f.cby=''}}else delSess(e.d);ui.bk=null;save();render();toast('Booking deleted')},
 cnt:x=>{const s=calc(ui.fsel),f=fin();f.cnt=f.cnt||{};f.cnt[x]=!s.ids.includes(x);fdone()},oby:x=>{ui.oby=x;S.lastBy=x;render()},
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
 dpts:x=>{S.def.pts=+x;applyDef('pts');if(+x===30){S.def.deuce=false;applyDef('deuce')}save();render()},dlearn:()=>{S.def.learn=!learnOn();Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});save();render()},ddeuce:()=>{S.def.deuce=!S.def.deuce;applyDef('deuce');save();render()},
 slv:(x,y)=>{const p=P(x);if(!p)return;ui.lvE=ui.lvE||{};if(+y===p.lv)delete ui.lvE[x];else ui.lvE[x]=+y;render()},
 lvupd:()=>{const E=ui.lvE||{};const ks=Object.keys(E);if(!ks.length)return;ks.forEach(id=>{const p=P(id);if(p)p.lv=E[id]});ui.lvE={};
   const d=curDate();if(d)lvChanged(ks);Object.values(S.games).forEach(g=>{if(!g.st)g.psig=''});save();render();toast(pl(ks.length,'level')+' updated')},
 org:x=>{S.orgs=S.orgs||[];const i=S.orgs.indexOf(x);if(i>=0)S.orgs.splice(i,1);else{if(S.orgs.length>=5)return toast('Up to 5 organizers');S.orgs.push(x)}save();render()},
 chpin:()=>{ui.pctx='set';ui.pmode=S.pin?'old':'new';ui.pin='';ui.pin1='';ui.err='';render()},
 pincancel:()=>{ui.pmode=null;ui.pin='';ui.pin1='';ui.err='';render()},
 key:x=>pinKey(x),
 bexport:()=>{if(!ui.bun||VIEW())return render();S.lastExp=Date.now();audit('Backup exported');save();const t=JSON.stringify(dataOnly()),n='rebels-backup-'+TODAY()+'.txt';if(NB&&NB.saveAs){try{NB.saveAs(n,t);return}catch(e){}}
   const u=URL.createObjectURL(new Blob([t],{type:'text/plain'})),l=document.createElement('a');l.href=u;l.download=n;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('Backup saved')},
 bimport:()=>{if(!ui.bun||VIEW())return render();if(NB&&NB.pickFile){try{NB.pickFile();return}catch(e){}}const f=document.createElement('input');f.type='file';f.accept='.txt,.json,text/plain';
   f.onchange=()=>{const r=new FileReader();r.onload=()=>impText(String(r.result||''));if(f.files[0])r.readAsText(f.files[0])};f.click()}
};
function applyDef(f){const t=TODAY();Object.values(S.games).forEach(g=>{if(!g.st&&g.d>=t){g[f]=S.def[f];g.psig=''}})}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;if(el.dataset.a==='noop'){e.stopPropagation();return}
  if(el.classList.contains('modal')&&e.target!==el)return;if(el.disabled)return;
  const f=act[el.dataset.a];if(f){e.stopPropagation();if(viewBlock(el.dataset.a,el.dataset.x))return toast(GM()?'Game manager · no finance or settings':'Organizer · read-only');f(el.dataset.x,el.dataset.y)}});
document.addEventListener('input',e=>{const el=e.target,k=el.dataset.i;if(!k)return;
  if(k.startsWith('lg_')){if(ui.lg)ui.lg[k.slice(3)]=el.value;return}
  if(k.startsWith('qp_')){const v=el.value.replace(/\D/g,'').slice(0,4);if(v!==el.value)el.value=v;ui.qpi=ui.qpi||{};ui.qpi[k.slice(3)]=v;return}
  if(k.startsWith('acc_')&&ADMIN()){const f=k.slice(4);ui.acc=ui.acc||{};if(f==='lock'){const v=Math.round(num(el.value));if(v>0)try{localStorage.setItem(LKKEY,String(v))}catch(e){}}else if(f==='organizer'||f==='games')ui.acc['p_'+f]=el.value;else ui.acc[f]=el.value;return}if(VIEW()&&!['q','pe_q','ap_q','lg_u','lg_p','lg_n1','lg_n2'].includes(k))return toast('Organizer · read-only');if(GM()&&(/^d_|^en_|^f_|^acc/.test(k)||k==='syu'))return;
  if(k==='syu'){ui.syu=el.value;return}
  if(k==='nm'){ui.nm=el.value;$('#dup').innerHTML=vDup()}
  else if(k==='q'){ui.q=el.value;$('#pgrid').innerHTML=vGrid()}
  else if(k==='ename'){ui.pm.name=el.value;const d=dupInfo(el.value,ui.pm.id);$('#edup').innerHTML=d?'<div class="warn '+(d.red?'red':'yel')+'">⚠ '+esc(d.msg)+'</div>':''}
  else if(k==='eph'){ui.pm.ph=el.value}
  else if(k==='cn'){const D=S.days[curDate()],c=D&&D.courts[+el.dataset.x];if(c){c.n=el.value;clearTimeout(window.__cn);window.__cn=setTimeout(save,400)}}
  else if(k==='sc_n'){ui.sc.courts[+el.dataset.x].n=el.value}
  else if(k.startsWith('am_')){ui.am[k.slice(3)]=el.value}
  else if(k==='bk_court'){if(ui.bk)ui.bk.court=el.value}
  else if(k.startsWith('f_')){const f=k.slice(2);finOf(ui.fsel,true)[f]=el.value;S.def[f]=el.value;save();ui.saved='✓ Auto-saved';const s=$('#fsaved');if(s)s.textContent=ui.saved;clearTimeout(window.__fr);window.__fr=setTimeout(()=>{const a=document.activeElement,id=a&&a.dataset.i;render();if(id){const n=document.querySelector('[data-i="'+id+'"]');if(n){n.focus();const v=n.value;try{n.setSelectionRange(v.length,v.length)}catch(err){}}}},700)}
  else if(k.startsWith('ge_')){const e=ui.ge,f=k.slice(3);e[f]=el.value;if(f==='en'&&e.st&&el.value){let m=(tms(e.d,el.value)-tms(e.d,e.st))/60000;if(m<=0)m+=1440;e.du=Math.round(m);$('#ge_du').value=e.du}
    else if((f==='st'||f==='du')&&$('#ge_en'))$('#ge_en').value=e.st&&num(e.du)?hm(tms(e.d,e.st)+num(e.du)*60000):''}
  else if(k.startsWith('se_')){ui.se[k.slice(3)]=el.value}
  else if(k==='pe_q'){ui.pe.q=el.value;$('#pesug').innerHTML=vPESug(ui.pe.d)}
  else if(k==='ap_q'){ui.ap.q=el.value;$('#aplist').innerHTML=vAPList()}
  else if(k==='ap_cn'){ui.ap.courts[+el.dataset.x].n=el.value}else if(k==='ap_cost'){ui.ap.cost=el.value}else if(k==='ap_sh'){ui.ap.sh=el.value}
  else if(k==='er_sa'||k==='er_sb'){const r=ui.er.r[el.dataset.x]=ui.er.r[el.dataset.x]||{sa:'',sb:''};r[k.slice(3)]=el.value;if(el.value!==''&&!r.p)r.p='y'}
  else if(k.startsWith('en_')){ui.ent[k.slice(3)]=el.value}
  else if(k==='g_pts'||k==='fp_pts'||k==='lv_pts'){const g=CG(),v=Math.round(num(el.value));if(v<1||v>99)return;
    if(k==='g_pts'){const o=+g.pts;g.pts=v;S.def.pts=v;/* H8: next session starts with this value */(g.fp||[]).forEach(x=>{if(+x.pts===o||+x.pts===v)delete x.pts});(g.live||[]).forEach(L=>{if(+L.pts===o)L.pts=v})}
    else if(k==='fp_pts'){const x=(g.fp||[]).find(o=>o.n==el.dataset.x);if(x){if(v===+g.pts)delete x.pts;else x.pts=v}}
    else{const L=g.live[+el.dataset.x];if(L)L.pts=v}
    clearTimeout(window.__pt);window.__pt=setTimeout(()=>{save();const a=document.activeElement&&document.activeElement.dataset.i;if(!a||!/pts$/.test(a))render()},800)}
  else if(k.startsWith('d_')){const f=k.slice(2);S.def[f]=el.value;applyDef(f);save()}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const id=e.target.id;if(id==='lgp'||id==='lgu'){e.preventDefault();return act.lgpw()}if(e.target.dataset&&/^lg_n/.test(e.target.dataset.i||'')){e.preventDefault();return act.lgchg()}if(id==='cnin'){e.preventDefault();e.target.blur();return}if(id==='pname'){e.preventDefault();act.add()}else if(id==='nloc'){e.preventDefault();act.saveloc()}else if(id==='oamt'){e.preventDefault();act.addoth()}});
document.addEventListener('focusout',e=>{if(e.target.id==='cnin'&&ui.cne!=null){ui.cne=null;save();setTimeout(()=>{if(ui.cne==null)render()},200)}});
document.addEventListener('change',e=>{const el=e.target,c=el.dataset.c;if(!c)return;if(VIEW()&&!['fsel','ksmo','ksy','ksa','ksb','rpv'].includes(c)){toast('Organizer · read-only');return render()}
  if(c==='scdate'){if(el.value){ui.sc.d=el.value;render()}}
  else if(c==='sctime'){ui.sc.time=el.value;render()}
  else if(c==='scloc'){if(el.value==='__new'){ui.scNew=true;render();setTimeout(()=>$('#nloc')&&$('#nloc').focus(),50)}else{ui.sc.loc=el.value;render()}}
  else if(c==='slot'){if(!el.value)return;const g=CG(),x=el.dataset.x,k=+el.dataset.y,v=el.value,fx=String(x)[0]==='f'?(g.fp||[]).find(o=>o.n==String(x).slice(2)):null;
    const nq=(fx?fx.q:qref(g,x)).slice();nq[k]=v;const ck=checkGame(g,nq,fx?{r:fx.r,x:fx}:{}),hard=ck.e.filter(m=>!/^Fill all 4/.test(m));
    if(hard.length){toast(hard[0]);return render()}if(ck.fmt&&!fmtGate(nq,fx?'game '+fx.n:'plan'))return render();
    qref(g,x)[k]=v;
    if(String(x)[0]==='0')g.nman[+String(x).split('.')[1]]=1;save();render()}
  else if(c==='cfslot'){const g=CG(),x=cfGame(g);if(!x)return;const k=+el.dataset.y,v=el.value||null;x.q=x.q.map((id,j)=>j===k?v:id===v?null:id);x.m=1;
    if(x.q.every(Boolean)&&x.a)recordOverride(g,x);save();render()}
  else if(c==='fsel'){ui.ks.s=el.value;ui.saved='';render()}
  else if(c==='ksmo'){ui.ks.mo=el.value;render()}else if(c==='ksy'){ui.ks.y=el.value;render()}else if(c==='ksa'){ui.ks.a=el.value;render()}else if(c==='ksb'){ui.ks.b=el.value;render()}
  else if(c==='rpv'){ui.rp.v=el.value;render()}
  else if(c==='en_loc'){ui.ent.loc=el.value}
  else if(c==='ge_p'){ui.ge.ids[+el.dataset.y]=el.value||null;render()}
  else if(c==='ge_c'){ui.ge.c=+el.value}
  else if(c==='ap_d'){ui.ap.d=el.value}else if(c==='ap_t'){ui.ap.time=el.value}else if(c==='ap_l'){ui.ap.loc=el.value}});
setInterval(tick,1000);
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();ui.unlocked=false;ui.hun=false;ui.bun=false}else{topUp();render()}});

/* ---------- data upgrade ---------- */
function impText(x){if(VIEW())return;x=(x||'').trim();const s=parse(x);if(!s)return toast('That is not a valid backup file');
  if(!confirm('Replace ALL data on this device with this backup ('+s.players.length+' players, '+Object.keys(s.days||{}).length+' sessions)?\n\nA safety snapshot of the current data is taken first.'))return;
  if(replaceAll(x,'Backup imported'+(s.savedAt?' (saved '+new Date(s.savedAt).toLocaleDateString()+')':'')))toast('Backup imported');ui.ks=null;ui.unlocked=false;render()}
window.__imp=impText;window.__saved=n=>toast(n?'Backup saved':'Not saved');
function migrate(){const t=TODAY();if((S.v||0)<SCHEMA&&S.players&&S.players.length&&!APPLY)snapTake('Before upgrade to v'+SCHEMA);S.dum=S.dum||{};S.def=Object.assign({pts:21,deuce:false,slot:15,chg:2,court:'',fee:'',spt:12},S.def||{});delete S.def.bh;delete S.def.box;
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
  S.delD=S.delD||{};
  if((S.v||0)<4){/* v11 one-time cleanup: orphan / never-played leftovers */
    const inPkg=new Set((S.ent||[]).filter(e=>e.t==='pkg').flatMap(e=>e.dates||[]));
    Object.keys(S.games).forEach(d=>{const g=S.games[d];if(!S.days[d]&&!g.st&&!(g.hist||[]).length)delete S.games[d]});
    Object.keys(S.days).forEach(d=>{const D=S.days[d],g=S.games[d],f=S.fin[d],played=!!(g&&(g.st||(g.hist||[]).length)),money=!!(f&&(num(f.court)||Object.keys(f.paid||{}).length||(f.oth||[]).length));
      if(!played&&!money&&!inPkg.has(d)&&(!D.sch||d<t)){delete S.days[d];delete S.games[d];delete S.fin[d];S.delD[d]=1}});
    Object.keys(S.fin).forEach(d=>{if(!S.days[d]&&!S.games[d])delete S.fin[d]});
    S.v=4}
  if((S.v||0)<5){/* v17: audit log, scheduling settings, deuce default off for new data */S.audit=S.audit||[];if(S.def.strong==null)S.def.strong=3;if(S.def.pwr==null)S.def.pwr=1;S.v=5}
  if((S.v||0)<6){/* v17 H3: logins replace the Finance PIN */delete S.pin;if(S.def.bAmb==null)S.def.bAmb=20;if(S.def.bRed==null)S.def.bRed=30;S.v=6}
  if(!Array.isArray(S.audit))S.audit=[];
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

