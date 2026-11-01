/* ===== Players ===== */
function noSess(what){return '<h1>'+what+'</h1><div class="pn" style="align-items:center;padding:40px;gap:16px"><div style="font-size:18px;color:var(--mu)">No session scheduled for today or later.</div><button class="btn sh" data-a="newsched">Schedule session</button></div>'}
const sessLab=d=>{const t=TODAY();return (d===t?'Today':d>t?'Upcoming':'Past')+' · '+dlab(d)+' · '+t12((S.days[d]||{}).time)+' · '+((S.days[d]||{}).loc||'')};
function vPlayers(){const d=curDate();if(!d)return noSess('WHO\'S ON <span>COURT</span>');const g=S.games[d],on=onIds(d).length,st=!!(g&&g.st);
  const nA=onIds(d).filter(id=>arrived(d,id)).length;
  return '<div class="sb" style="align-items:flex-start"><div><div class="row" style="gap:8px">'+PIN_SVG+'<span class="laby" style="letter-spacing:.12em">'+esc(sessLab(d).toUpperCase())+'</span></div>'+
   '<h1 style="margin-top:8px">WHO\'S ON <span>COURT</span></h1></div>'+
   (pinned()?'<button class="dlock on" data-a="devlock" aria-label="Tablet locked – tap to unlock">'+UNLOCK_SVG+'</button>':'<button class="dlock" data-a="devlock" aria-label="Tablet unlocked – tap to lock">'+LOCK_SVG.replace(/22/g,'26')+'</button>')+'</div>'+
   '<div style="display:grid;grid-template-columns:repeat('+(st?4:3)+',minmax(0,1fr));gap:12px"><div class="tile"><b>'+active().length+'</b><i>Registered</i></div><div class="tile"><b style="color:var(--ok)">'+on+'</b><i>Playing</i></div>'+(st?'<div class="tile"><b style="color:var(--ok)">'+nA+'</b><i>Arrived</i></div>':'')+'<div class="tile"><b style="color:var(--y)">'+courtsOf(d).length+'</b><i>Courts · '+hrsL(courtHrs(d))+'</i></div></div>'+
   '<div class="row pn" style="flex-direction:row;padding:12px;gap:12px"><input id="pname" class="inp" style="flex:1" placeholder="Add a player name…" value="'+esc(ui.nm)+'" data-i="nm" autocomplete="off"><div class="lvb" id="lvb">'+vLv()+'</div><div class="lvb" id="sxb">'+sxSeg(ui.sx,'sx',1)+'</div><button class="btn" data-a="add">+ Add</button></div>'+
   '<div id="dup">'+vDup()+'</div>'+
   '<div class="row" style="gap:12px"><div class="search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="psearch" placeholder="Search players, then tap to turn on" value="'+esc(ui.q)+'" data-i="q" autocomplete="off"><button class="ib" style="background:var(--pn);color:var(--mu)" data-a="clearq" aria-label="Clear search">×</button></div><button class="ol" data-a="alloff">Turn all off</button></div>'+
   (st&&!(g&&g.en)?'<div style="font-size:14px;color:var(--mu)">Check players in / out with the <b style="color:var(--tx)">Players</b> button on the Games page. Tap a photo or name for details.</div>':'<div style="font-size:14px;color:var(--mu)">Tap the switch to turn a player on · tap the photo or name for details.</div>')+
   '<div id="pgrid">'+vGrid()+'</div>'+
   '<div class="row" style="justify-content:flex-end;padding-bottom:12px"><button class="btn sh" style="min-width:160px" data-a="pnext">Next → Games</button></div>'}
const lvSeg=(cur,a,x)=>LVN.map((n,i)=>'<button'+(cur===i?' class="on"':'')+' data-a="'+a+'"'+(x!=null?' data-x="'+x+'" data-y="'+i+'"':' data-x="'+i+'"')+'>'+n+'</button>').join('');
function vLv(){return lvSeg(ui.lv,'lv')}
function sxSeg(v,a,short){return [['m',short?'M':'Male'],['f',short?'F':'Female']].map(([k,l])=>'<button class="'+(v===k?'on':'')+'" data-a="'+a+'" data-x="'+k+'"'+(short?' style="min-width:44px"':'')+'>'+l+'</button>').join('')}
function lev(a,b){const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 9;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
function dupInfo(nm,skip){nm=nm.trim().toLowerCase().replace(/\s+/g,' ');if(!nm)return null;const L=S.players.filter(p=>!p.gone&&p.id!==skip);
  const ex=L.find(p=>p.name.toLowerCase()===nm);if(ex)return{red:true,msg:ex.name+' is already in the list. Search below to turn them on.'};
  if(nm.length<3)return null;const f=nm.split(' ')[0];
  const sim=L.filter(p=>{const n=p.name.toLowerCase();return n.split(' ').some(w=>w.startsWith(f)||f.startsWith(w)&&w.length>=3)||lev(n,nm)<=2});
  return sim.length?{red:false,msg:'Similar name already added: '+sim.map(p=>p.name).join(', ')+'. Check before adding.'}:null}
function vDup(){const d=dupInfo(ui.nm);return d?'<div class="warn '+(d.red?'red':'yel')+'">⚠ '+esc(d.msg)+'</div>':''}
function attChip(d,id){const a=att(d,id),g=S.games[d];if(!g||!g.st)return '';
  if(!a||!a.a)return '<span class="att no">'+(g.en?'Did not come':'Not here yet')+'</span>';
  return '<span class="att '+(a.l?'left':'in')+'">'+(a.l?'Left '+hm(a.l):'Arrived '+hm(a.a))+'</span>'}
function vGrid(){const d=curDate(),q=ui.q.trim().toLowerCase(),D=day(d),L=active().filter(p=>!q||p.name.toLowerCase().includes(q));
  if(!active().length)return '<div class="empty">No players yet. Add your first player above.</div>';
  if(!L.length)return '<div class="empty">No player with that name. Add them above.</div>';
  return '<div class="grid3">'+L.map(p=>{const on=!!D.on[p.id];
    return '<div class="pc'+(on?'':' off')+'"><button class="pcm" data-a="pmod" data-x="'+p.id+'">'+pav(p.id,48)+'<span class="pnm" style="flex:1"><b style="font-size:17px">'+esc(p.name)+(isOrg(p.id)?' <span style="color:var(--y)">★</span>':'')+'</b><small style="font-size:13px">Level: '+LVS[p.lv]+'</small>'+(on?attChip(d,p.id):'')+'</span></button>'+
      '<button class="swb" data-a="tog" data-x="'+p.id+'" aria-label="'+(on?'Turn off':'Turn on')+' '+esc(p.name)+'"><span class="sw'+(on?' on':'')+'"><span></span></span></button></div>'}).join('')+'</div>'}
function pStats(id){let ses=0,gm=0,w=0,first='';Object.keys(S.games).sort().forEach(d=>{const g=S.games[d];const inS=(g.ros||[]).includes(id)||arrived(d,id)||g.hist.some(h=>h.ids.includes(id));
  if(inS&&(g.st||g.hist.length)){ses++;if(!first)first=d}g.hist.forEach(h=>{const k=h.ids.indexOf(id);if(k<0)return;gm++;if((k<2&&h.sa>h.sb)||(k>=2&&h.sb>h.sa))w++})});
  const p=P(id);return{ses,gm,wp:gm?Math.round(w/gm*100):0,j:p&&p.j?iso(new Date(p.j)):first}}
/* player pop-up: view (photo, stats) → Edit (level, name, phone, photo). Delete lives in Settings. */
function vPMod(){const e=ui.pm,p=P(e.id);if(!p)return '';const s=pStats(p.id),ed=!!e.ed,lv=ed?e.lv:p.lv,img=ed?e.img:imgOf(p.id),d=ed?dupInfo(e.name,p.id):null;
  const pb='<div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn sm" data-a="photo" data-x="cam">Camera</button><button class="ol sm" data-a="photo" data-x="gal">Gallery</button>'+(ed&&img?'<button class="ol sm" style="color:var(--bad)" data-a="phrm">Remove</button>':'')+'</div>';
  const photo='<div class="phbox" style="border-color:'+LVC[lv]+'">'+(img?'<img src="'+img+'" alt="">':ed?(e.sx?avSvg(e.sx):'<span class="phini">'+esc(ini(e.name||p.name))+'</span>'):'<span style="font-weight:700;color:var(--mu)">Add photo</span>'+pb)+'</div>'+(ed&&img?pb:ed?'':'');
  const left='<div style="display:flex;flex-direction:column;gap:12px;align-items:center;width:240px;flex:none"><div style="text-align:center;min-width:0;max-width:100%"><div class="d" style="font-size:30px;line-height:1.1;overflow-wrap:anywhere">'+esc(ed?(e.name||p.name):p.name)+'</div><span class="lvtag" style="background:'+LVC[lv]+'">'+LVS[lv]+'</span></div>'+photo+(ed&&!img?pb:'')+'</div>';
  const right=ed?'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:12px"><div class="lab">LEVEL</div><div class="lvb">'+lvSeg(lv,'pmlv')+'</div><div class="lab">GENDER</div><div class="lvb" style="align-self:flex-start">'+sxSeg(e.sx,'pmsx')+'</div>'+
     '<label class="fl">Name<input id="ename" class="gei" value="'+esc(e.name)+'" data-i="ename" autocomplete="off"></label><label class="fl">Phone (optional, for WhatsApp reminders)<input class="gei" type="tel" inputmode="tel" value="'+esc(e.ph)+'" data-i="eph" placeholder="+971…"></label>'+
     '<div id="edup">'+(d?'<div class="warn '+(d.red?'red':'yel')+'">⚠ '+esc(d.msg)+'</div>':'')+'</div></div>':
    '<div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start"><div class="tile"><b>'+s.ses+'</b><i>Sessions attended</i></div><div class="tile"><b>'+s.gm+'</b><i>Total games</i></div><div class="tile"><b style="color:var(--ok)">'+s.wp+'%</b><i>Win rate</i></div><div class="tile"><b style="font-size:24px;line-height:1.4">'+(s.j?dshort(s.j)+' '+s.j.slice(2,4):'—')+'</b><i>Joined</i></div>'+(p.ph?'<div style="grid-column:1/-1;font-size:14px;color:var(--mu)">Phone: '+esc(p.ph)+'</div>':'')+'</div>';
  return '<div class="modal" data-a="closepm"><div class="pn" data-a="noop" style="gap:16px;width:min(820px,94vw)"><div class="sb"><div class="laby">'+(ed?'EDIT PLAYER':'PLAYER')+'</div><button class="ib" data-a="closepm" aria-label="Close">×</button></div>'+
   '<div style="display:flex;gap:22px;align-items:flex-start">'+left+right+'</div>'+
   '<div class="sb"><span></span>'+(ed?'<span class="row"><button class="ol" data-a="pmcancel">Cancel</button><button class="btn" data-a="saveedit">Save</button></span>':'<button class="btn" data-a="pmedit">Edit</button>')+'</div></div></div>'}
/* photo → small square JPEG (fast app, small backups) */
function shrinkPhoto(src,cb){const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),S2=192,m=Math.min(im.width,im.height);c.width=c.height=S2;
  c.getContext('2d').drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,S2,S2);try{cb(c.toDataURL('image/jpeg',.72))}catch(err){toast('Photo not saved')}};im.onerror=()=>toast('Could not read that photo');im.src=src}
window.__photo=src=>{if(!src||!ui.pm)return src===''?toast('No photo'):0;shrinkPhoto(src,x=>{const e=ui.pm;if(!e)return;if(e.ed)e.img=x;else{const p=P(e.id);if(p){p.img=x;save()}}render();toast('Photo saved')})};
function vAtt(){const e=ui.am,d=curDate();
  return '<div class="modal" data-a="closeam"><div class="pn" data-a="noop" style="gap:14px;width:min(520px,92vw)"><div class="sb"><div class="laby">ATTENDANCE · '+esc(nameOf(e.id).toUpperCase())+'</div><button class="ib" data-a="closeam">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="fl">Arrived<input class="gei" type="time" value="'+e.a+'" data-i="am_a"></label><label class="fl">Left<input class="gei" type="time" value="'+e.l+'" data-i="am_l"></label></div>'+
   '<div class="row" style="flex-wrap:wrap"><button class="ol" data-a="amleft">Left now ('+hm(Date.now())+')</button>'+(e.l?'<button class="ol" data-a="amback">Back – clear Left</button>':'')+'<button class="ol" style="color:var(--bad)" data-a="amnot">Not here yet</button></div>'+
   '<div class="sb"><span style="font-size:13px;color:var(--mu)">Games re-plan automatically</span><button class="btn" data-a="amsave">Save</button></div></div></div>'}
/* attendance change → re-plan Up Next */
function attChanged(id,why){const d=curDate(),g=S.games[d];if(!g||!running(g))return;const t=Date.now();
  if(eligible(d,id))benchOn(g,id,t);else benchOff(g,id,t);
  autoNext(g,'all',why);save()}
function lvChanged(ids){const d=curDate(),g=S.games[d];if(!g)return;if(running(g)){if(autoNext(g,'all','Level change: '+ids.map(id=>nameOf(id)+' → '+LVN[lvOf(id)]).join(', ')+' · upcoming games re-picked'))toast('Upcoming games updated')}else g.psig=''}
