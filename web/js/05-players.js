/* ===== Players ===== */
function noSess(what){return '<h1>'+what+'</h1><div class="pn" style="align-items:center;padding:40px;gap:16px"><div style="font-size:18px;color:var(--mu)">No session scheduled for today or later.</div><button class="btn sh" data-a="newsched">Schedule session</button></div>'}
const sessLab=d=>{const t=TODAY();return (d===t?'Today':d>t?'Upcoming':'Past')+' · '+dlab(d)+' · '+t12((S.days[d]||{}).time)+' · '+((S.days[d]||{}).loc||'')};
function vPlayers(){const d=curDate();if(!d)return noSess('WHO\'S ON <span>COURT</span>');const g=S.games[d],on=onIds(d).length,st=!!(g&&g.st);
  const nA=onIds(d).filter(id=>arrived(d,id)).length;
  return '<div class="sb" style="align-items:flex-start"><div><div class="row" style="gap:8px">'+PIN_SVG+'<span class="laby" style="letter-spacing:.12em">'+esc(sessLab(d).toUpperCase())+'</span></div>'+
   '<h1 style="margin-top:8px">WHO\'S ON <span>COURT</span></h1></div>'+
   (pinned()?'<button class="dlock on" data-a="devlock" aria-label="Tablet locked – tap to unlock">'+UNLOCK_SVG+'</button>':'<button class="dlock" data-a="devlock" aria-label="Tablet unlocked – tap to lock">'+LOCK_SVG.replace(/22/g,'26')+'</button>')+'</div>'+
   '<div style="display:grid;grid-template-columns:repeat('+(st?4:3)+',minmax(0,1fr));gap:12px"><div class="tile"><b>'+active().length+'</b><i>Registered</i></div><div class="tile"><b style="color:var(--ok)">'+on+'</b><i>Playing</i></div>'+(st?'<div class="tile"><b style="color:var(--ok)">'+nA+'</b><i>Arrived</i></div>':'')+'<div class="tile"><b style="color:var(--y)">'+courtsOf(d).length+'</b><i>Courts · '+hrsL(courtHrs(d))+'</i></div></div>'+
   '<div class="row pn" style="flex-direction:row;padding:12px;gap:12px"><input id="pname" class="inp" style="flex:1" placeholder="Add a player name…" value="'+esc(ui.nm)+'" data-i="nm" autocomplete="off"><div class="lvb" id="lvb">'+vLv()+'</div><button class="btn" data-a="add">+ Add</button></div>'+
   '<div id="dup">'+vDup()+'</div>'+
   '<div class="row" style="gap:12px"><div class="search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="psearch" placeholder="Search players, then tap to turn on" value="'+esc(ui.q)+'" data-i="q" autocomplete="off"><button class="ib" style="background:var(--pn);color:var(--mu)" data-a="clearq" aria-label="Clear search">×</button></div><button class="ol" data-a="alloff">Turn all off</button></div>'+
   (st&&!(g&&g.en)?'<div style="font-size:14px;color:var(--mu)">Check players in / out with the <b style="color:var(--tx)">Players</b> button on the Games page. Tap a name for level and stats.</div>':'<div style="font-size:14px;color:var(--mu)">Tap a card to turn a player on · tap the name for level and stats.</div>')+
   '<div id="pgrid">'+vGrid()+'</div>'+
   '<div class="row" style="justify-content:flex-end;padding-bottom:12px"><button class="btn sh" style="min-width:160px" data-a="pnext">Next → Games</button></div>'}
const lvSeg=(cur,a,x)=>LVN.map((n,i)=>'<button'+(cur===i?' class="on"':'')+' data-a="'+a+'"'+(x!=null?' data-x="'+x+'" data-y="'+i+'"':' data-x="'+i+'"')+'>'+n+'</button>').join('');
function vLv(){return lvSeg(ui.lv,'lv')}
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
  return '<div class="grid3">'+L.map(p=>{const on=!!D.on[p.id];const ini=p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return '<div class="pc'+(on?'':' off')+'" data-a="tog" data-x="'+p.id+'"><button class="av" style="background:'+LVC[p.lv]+'" data-a="pmod" data-x="'+p.id+'" aria-label="'+esc(p.name)+'">'+esc(ini)+'</button><div style="flex:1;min-width:0"><button class="pname" data-a="pmod" data-x="'+p.id+'">'+esc(p.name)+(isOrg(p.id)?' <span style="color:var(--y)">★</span>':'')+'</button><div style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--mu);margin-top:2px"><span style="color:'+LVC[p.lv]+';font-size:10px;letter-spacing:1px">'+'▲'.repeat(p.lv+1)+'</span>'+LVN[p.lv]+'</div>'+(on?attChip(d,p.id):'')+'</div><span class="sw'+(on?' on':'')+'"><span></span></span></div>'}).join('')+'</div>'}
function pStats(id){let ses=0,gm=0,w=0,first='';Object.keys(S.games).sort().forEach(d=>{const g=S.games[d];const inS=(g.ros||[]).includes(id)||arrived(d,id)||g.hist.some(h=>h.ids.includes(id));
  if(inS&&(g.st||g.hist.length)){ses++;if(!first)first=d}g.hist.forEach(h=>{const k=h.ids.indexOf(id);if(k<0)return;gm++;if((k<2&&h.sa>h.sb)||(k>=2&&h.sb>h.sa))w++})});
  const p=P(id);return{ses,gm,wp:gm?Math.round(w/gm*100):0,j:p&&p.j?iso(new Date(p.j)):first}}
function vPMod(){const e=ui.pm,p=P(e.id);if(!p)return '';const s=pStats(p.id),d=dupInfo(e.name,p.id);
  return '<div class="modal" data-a="closepm"><div class="pn" data-a="noop" style="gap:14px"><div class="sb"><div class="laby">'+esc(p.name.toUpperCase())+'</div><button class="ib" data-a="closepm" aria-label="Close">×</button></div>'+
   '<div class="grid3" style="grid-template-columns:repeat(4,1fr)"><div class="tile"><b>'+s.ses+'</b><i>Sessions attended</i></div><div class="tile"><b>'+s.gm+'</b><i>Total games</i></div><div class="tile"><b style="color:var(--ok)">'+s.wp+'%</b><i>Win rate</i></div><div class="tile"><b style="font-size:24px;line-height:1.4">'+(s.j?dshort(s.j)+' '+s.j.slice(2,4):'—')+'</b><i>Joined</i></div></div>'+
   '<div class="lab">LEVEL · CHANGES APPLY RIGHT AWAY</div><div class="lvb">'+lvSeg(p.lv,'qlv',p.id)+'</div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="fl">Name<input id="ename" class="gei" value="'+esc(e.name)+'" data-i="ename" autocomplete="off"></label><label class="fl">Phone (optional, for WhatsApp reminders)<input class="gei" type="tel" inputmode="tel" value="'+esc(e.ph)+'" data-i="eph" placeholder="+971…"></label></div>'+
   '<div id="edup">'+(d?'<div class="warn '+(d.red?'red':'yel')+'">⚠ '+esc(d.msg)+'</div>':'')+'</div>'+
   '<div class="sb"><button class="ol" style="color:var(--bad);border-color:var(--bad)" data-a="delplayer">Delete player</button><button class="btn" data-a="saveedit">Save</button></div></div></div>'}
function vAtt(){const e=ui.am,d=curDate();
  return '<div class="modal" data-a="closeam"><div class="pn" data-a="noop" style="gap:14px;width:min(520px,92vw)"><div class="sb"><div class="laby">ATTENDANCE · '+esc(nameOf(e.id).toUpperCase())+'</div><button class="ib" data-a="closeam">×</button></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="fl">Arrived<input class="gei" type="time" value="'+e.a+'" data-i="am_a"></label><label class="fl">Left<input class="gei" type="time" value="'+e.l+'" data-i="am_l"></label></div>'+
   '<div class="row" style="flex-wrap:wrap"><button class="ol" data-a="amleft">Left now ('+hm(Date.now())+')</button>'+(e.l?'<button class="ol" data-a="amback">Back – clear Left</button>':'')+'<button class="ol" style="color:var(--bad)" data-a="amnot">Not here yet</button></div>'+
   '<div class="sb"><span style="font-size:13px;color:var(--mu)">Games re-plan automatically</span><button class="btn" data-a="amsave">Save</button></div></div></div>'}
/* attendance change → re-plan Up Next */
function attChanged(id,why){const d=curDate(),g=S.games[d];if(!g||!running(g))return;const t=Date.now();
  if(eligible(d,id))benchOn(g,id,t);else{benchOff(g,id,t);g.nxt=g.nxt.map(q=>q.map(x=>x===id?null:x))}
  autoNext(g,'fill',why);save()}
function lvChanged(ids){const d=curDate(),g=S.games[d];if(!g)return;if(running(g)){if(autoNext(g,'all','Level change: '+ids.map(id=>nameOf(id)+' → '+LVN[lvOf(id)]).join(', ')+' · Up Next re-balanced'))toast('Up Next updated')}else g.psig=''}
