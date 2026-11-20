/* ===== v17 Cloudflare sync (spec A) + backup & recovery (spec F) + roles (H3) =====
   Offline first: every tap saves on this device; when signed in (admin / game manager) the data is uploaded after each save (queued while offline).
   Server keeps a revision number – a device that is behind can never overwrite newer data (pull first).
   Roles (H3): admin = everything · organizer = read-only incl. finance · games = sessions/players/games/scores, no finance/settings/backup.
   The role comes ONLY from the account unlocked on this open (09d-auth.js) – never stored. */
const SKEY='rebels.sync',SNKEY='rebels.snaps',UNKEY='rebels.undo',SCHEMA=6,DEF_URL='https://rebels-badminton.revuminds.workers.dev';
let SY=(()=>{try{return JSON.parse(localStorage.getItem(SKEY))||{}}catch(e){return{}}})();
delete SY.token;delete SY.email;delete SY.role;
/* app opened from the Worker site: the sync address is that site; APK / laptop file: the club Worker */
if(location.protocol==='https:'&&/workers\.dev$|rebels/i.test(location.host))SY.url=location.origin;
if(!SY.url)SY.url=DEF_URL;
const sySave=()=>{try{const o=Object.assign({},SY);delete o.token;delete o.email;delete o.role;localStorage.setItem(SKEY,JSON.stringify(o))}catch(e){}};
const AUTH={u:'',role:''};
const SYNC={who:()=>AUTH.u||'this device',role:()=>AUTH.role||'none',st:''};
const ROLE=()=>AUTH.role;
const ADMIN=()=>AUTH.role==='admin';
const GM=()=>AUTH.role==='games';
/* read-only = organizer (and anyone not unlocked yet) */
function VIEW(){return AUTH.role!=='admin'&&AUTH.role!=='games'}
const canFin=()=>AUTH.role==='admin'||AUTH.role==='organizer';
const ROLEN={admin:'ADMIN',organizer:'ORGANIZER',games:'GAME MANAGER'};
/* cheap text hash (photo change detection) */
const hsh=t=>{let h=5381;for(let i=0;i<t.length;i+=Math.max(1,t.length>>12))h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36)+'.'+t.length};
/* data without photos (backups + cloud doc); photos travel separately (R2) */
function dataOnly(s){const o=JSON.parse(JSON.stringify(s||S));(o.players||[]).forEach(p=>{if(p.img){p.imgH=hsh(p.img);delete p.img}else delete p.imgH});return o}
const photoMap=()=>{const m={};S.players.forEach(p=>{if(p.img)m[p.id]=p.img});return m};
const reattach=m=>S.players.forEach(p=>{if(!p.img&&m[p.id]&&(!p.imgH||p.imgH===hsh(m[p.id]))){p.img=m[p.id]}delete p.imgH});

/* ---------- local safety snapshots: last 5 on this device ---------- */
const snapList=()=>{try{return JSON.parse(localStorage.getItem(SNKEY))||[]}catch(e){return[]}};
function snapTake(why){const L=snapList();L.unshift({t:Date.now(),why,v:S.v,n:S.players.length,d:JSON.stringify(dataOnly())});while(L.length>5)L.pop();
  while(L.length){try{localStorage.setItem(SNKEY,JSON.stringify(L));return L[0].t}catch(e){L.pop()}}return 0}
/* replace all data with `txt` (backup / snapshot / cloud); photos on this device are kept for the same players */
function replaceAll(txt,why){const s=parse(txt);if(!s)return toast('Not valid Rebels data'),false;const m=photoMap(),u=snapTake('Before '+why);
  try{localStorage.setItem(UNKEY,JSON.stringify({t:u,why}))}catch(e){}S=s;reattach(m);APPLY=true;try{migrate()}finally{APPLY=false}audit(why);markDirty();save();return true}
function snapRestore(k){const s=snapList()[k];if(!s)return;if(!confirm('Restore the safety snapshot from '+new Date(s.t).toLocaleString()+' ('+s.why+')?\n\nALL current data on this device is replaced. A snapshot of the current data is taken first, so you can undo.'))return;
  if(replaceAll(s.d,'Restored snapshot from '+new Date(s.t).toLocaleString()))toast('Snapshot restored · Undo is in Settings → Backup');render()}
function undoRestore(){let u=null;try{u=JSON.parse(localStorage.getItem(UNKEY))}catch(e){}const s=u&&snapList().find(x=>x.t===u.t);if(!s)return toast('Nothing to undo');
  if(!confirm('Undo the last restore ('+u.why+')? Data goes back to how it was just before it.'))return;
  if(replaceAll(s.d,'Undo of: '+u.why)){try{localStorage.removeItem(UNKEY)}catch(e){}toast('Restore undone')}render()}
const canUndo=()=>{try{const u=JSON.parse(localStorage.getItem(UNKEY));return !!(u&&snapList().some(x=>x.t===u.t))}catch(e){return false}};
const expDue=()=>sessions().length>0&&(!S.lastExp||Date.now()-S.lastExp>30*864e5);

/* ---------- cloud ---------- */
const API=p=>String(SY.url||'').replace(/\/+$/,'')+p;
async function req(m,p,body,tmo){const c=new AbortController(),t=setTimeout(()=>c.abort(),tmo||20000);
  try{const r=await fetch(API(p),{method:m,signal:c.signal,headers:Object.assign({'Content-Type':'application/json'},SY.token?{Authorization:'Bearer '+SY.token}:{}),body:body==null?undefined:typeof body==='string'?body:JSON.stringify(body)});
    let j=null;try{j=await r.json()}catch(e){}return{s:r.status,j:j||{}}}catch(e){return{s:0,j:{}}}finally{clearTimeout(t)}}
let syT=null,syBusy=false,APPLY=false;
function markDirty(){if(SY.token&&!VIEW()&&!APPLY){SY.dirty=1;sySave()}}
const cloudOK=r=>r.s===200||r.s===401||r.s===403||r.s===409||r.s===429||r.s===400;
function syStatus(){if(!SY.token)return{c:'mu',t:'This device only'};if(syBusy)return{c:'mu',t:'Syncing…'};
  if(SY.err==='auth')return{c:'amb',t:'Sign in again'};if(SY.behind)return{c:'amb',t:'Behind · pull first'};
  if(VIEW())return SY.err==='net'?{c:'amb',t:'Offline · showing last copy'}:{c:'ok',t:'Up to date'};
  return SY.dirty?{c:'amb',t:navigator.onLine===false||SY.err==='net'?'Not synced (offline)':'Not synced yet'}:{c:'ok',t:'Synced ✓'}}
function syLater(){if(!SY.token||VIEW())return;clearTimeout(syT);syT=setTimeout(()=>syncNow(false),1500)}
/* push (admin) / pull (everyone). quiet = no toasts */
async function syncNow(loud){if(!SY.token||!SY.url||syBusy)return;syBusy=true;stRender();
  try{const r=await req('GET','/api/data');
    if(r.s===401||r.s===403){SY.err='auth';authLost(r.s);return loud&&toast('Signed out by the cloud – switch account and log in with the password')}
    if(r.s!==200){SY.err='net';return loud&&toast('Cloud not reachable – will retry')}
    SY.err='';const rev=r.j.rev||0;
    if(VIEW()){if(rev!==SY.rev||!SY.last){await applyCloud(r.j);}SY.last=Date.now();return loud&&toast('Up to date')}
    if(rev>(SY.rev||0)){
      if(SY.dirty){SY.behind=1;if(!loud)return;
        if(!confirm('The cloud has newer data ('+(r.j.by||'another device')+', '+new Date(r.j.at||Date.now()).toLocaleString()+').\n\nThis device is behind and has changes that were not uploaded. Replace this device’s data with the cloud copy?\n\nA safety snapshot of this device is taken first (Settings → Backup).'))return;
        snapTake('Before pull (unsynced changes)')}
      await applyCloud(r.j);SY.behind=0;SY.dirty=0;SY.last=Date.now();return loud&&toast('Pulled the latest data')}
    SY.behind=0;
    if(SY.dirty){const w=await req('PUT','/api/data',{base:SY.rev||0,data:dataOnly()},60000);
      if(w.s===200){SY.rev=w.j.rev;SY.dirty=0;SY.last=Date.now();await pushPhotos();if(loud)toast('Synced ✓')}
      else if(w.s===409){SY.behind=1;if(loud)toast('Cloud has newer data – pull first')}
      else if(w.s===401||w.s===403){SY.err=w.s===403?'':'auth';if(w.s===401)authLost(401);if(loud)toast(w.s===403?'This account is read-only':'Log in again')}
      else{SY.err='net';if(loud)toast('Not synced (offline) – will upload when back online')}}
    else{SY.last=Date.now();await pushPhotos();if(loud)toast('Synced ✓')}}
  finally{syBusy=false;sySave();stRender()}}
async function applyCloud(j){if(!j||!j.data)return;const m=photoMap(),s=typeof j.data==='string'?parse(j.data):Object.assign(blank(),j.data);if(!s)return;
  (j.stripped||[]).forEach(k=>{if(k in S)s[k]=S[k];else delete s[k]});/* game manager: finance never comes from the cloud – this device keeps its own */
  APPLY=true;try{S=s;reattach(m);migrate();save()}finally{APPLY=false}SY.rev=j.rev||0;sySave();render();pullPhotos(j.data)}
/* photos: R2 via the Worker, keyed by player id */
async function pushPhotos(){if(VIEW())return;SY.ph=SY.ph||{};for(const p of S.players){const h=p.img?hsh(p.img):'';if((SY.ph[p.id]||'')===h)continue;
  const r=h?await req('PUT','/api/photo/'+encodeURIComponent(p.id),{img:p.img,h},60000):await req('DELETE','/api/photo/'+encodeURIComponent(p.id));if(r.s===200)SY.ph[p.id]=h;else break}sySave()}
async function pullPhotos(d){const ps=(typeof d==='string'?JSON.parse(d):d).players||[];let ch=0;SY.ph=SY.ph||{};
  for(const q of ps){const p=P(q.id);if(!p)continue;if(!q.imgH){if(p.img&&VIEW()){delete p.img;ch=1}continue}if(p.img&&hsh(p.img)===q.imgH)continue;
    const r=await req('GET','/api/photo/'+encodeURIComponent(q.id),null,60000);if(r.s===200&&r.j.img){p.img=r.j.img;SY.ph[q.id]=q.imgH;ch=1}}
  if(ch){APPLY=true;try{save()}finally{APPLY=false}sySave();render()}}
function openUrl(u){if(NB&&NB.openUrl){try{NB.openUrl(u);return}catch(e){}}window.open(u,'_blank','noopener')}
async function cloudSnaps(){const r=await req('GET','/api/snapshots');if(r.s!==200)return toast(r.s===403?'Admin only':'Cloud not reachable');ui.csn=r.j.list||[];render()}
async function cloudRestore(day){if(!confirm('Restore the cloud copy from '+day+'?\n\nThe cloud AND this device go back to that day. A safety snapshot of this device is taken first.'))return;
  const r=await req('POST','/api/snapshots/'+day+'/restore',{});if(r.s!==200)return toast(r.s===403?'Admin only':'Restore failed');
  const g=await req('GET','/api/data');if(g.s===200&&g.j.data){replaceAll(typeof g.j.data==='string'?g.j.data:JSON.stringify(g.j.data),'Cloud restore of '+day);SY.rev=g.j.rev;SY.dirty=0;sySave();save();render();toast('Restored '+day)}}
window.addEventListener('online',()=>syncNow(false));
setInterval(()=>{if(SY.token&&(SY.dirty||VIEW()||GM())&&!syBusy&&navigator.onLine!==false)syncNow(false)},30000);

/* ---------- top status bar: sync · role · session clock ---------- */
function vStat(){const s=syStatus(),d=TODAY(),g=S.games[d],run=running(g),r=AUTH.role;
  return '<span class="stlogo">REBELS <b>BADMINTON</b></span><span class="stchip '+s.c+'"><i></i>'+esc(s.t)+'</span>'+(SY.token&&!VIEW()?'<button class="stbtn" data-a="synow" aria-label="Sync now">↻</button>':'')+
   (r?'<span class="strole '+(r==='admin'?'a':r==='games'?'g':'v')+'">'+ROLEN[r]+(SY.token?'':' · LOCAL')+'</span>':'')+
   (run?'<span class="stclk">● LIVE <b data-tk="sclk">'+fmtH(playMs(g)/1000)+'</b></span>':'')+'<button class="stbtn" data-a="theme" aria-label="Light / dark">'+(document.body.classList.contains('light')?'☾':'☀')+'</button>'+
   (r&&!pinned()?'<button class="stbtn pwr" data-a="switchacc" aria-label="Log off" title="Log off">'+PWR_SVG+'</button>':'')}
/* v20: own drawn power icon (red) – log off = back to the account tiles; hidden while the tablet is locked */
const PWR_SVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M7.1 6.6a8 8 0 1 0 9.8 0"/><path d="M12 3v8.5"/></svg>';
function stRender(){const el=$('#stat');if(el)el.innerHTML=vStat()}

/* ---------- Settings sections: Sync & Account, Backup ---------- */
function vSyncSet(){const s=syStatus();
  const head='<div class="sb"><div class="laby">SYNC · CLOUDFLARE</div><span class="stchip '+s.c+'"><i></i>'+esc(s.t)+'</span></div>';
  return '<section class="pn">'+head+
   '<div class="kv"><span>Signed in</span><span>'+esc(ROLEN[AUTH.role]||'—')+(SY.token?'':' · this device only (cloud not reached yet)')+'</span></div>'+
   '<div class="kv"><span>Last synced</span><span>'+(SY.last?new Date(SY.last).toLocaleString():'—')+' · rev '+(SY.rev||0)+'</span></div>'+
   (ADMIN()?'<label class="fl">SYNC ADDRESS<input class="inp" style="width:100%" value="'+esc(ui.syu!=null?ui.syu:SY.url||'')+'" data-i="syu" autocomplete="off" autocapitalize="off"></label>'+(ui.syu!=null&&ui.syu!==SY.url?'<div class="row"><button class="btn sm" data-a="syurl">Save address</button></div>':''):'')+
   (SY.behind?'<div class="note amb">The cloud has newer data than this device. Tap <b>Sync now</b> to pull it'+(SY.dirty?' (this device’s unsynced changes are kept in a safety snapshot)':'')+'.</div>':'')+
   '<div class="row" style="flex-wrap:wrap"><button class="btn sm" data-a="synow">↻ Sync now</button>'+(ADMIN()&&SY.token?'<button class="ol sm" data-a="sysnaps">Cloud history (90 days)</button>':'')+'</div>'+
   (ui.csn&&ADMIN()?'<div class="lab">CLOUD HISTORY · DAILY COPIES · KEPT 90 DAYS</div>'+(ui.csn.length?'<div class="snl">'+ui.csn.map(x=>'<div class="erow"><b style="flex:1">'+esc(dlab(x.day))+' '+x.day.slice(0,4)+'</b><span style="color:var(--mu)">'+Math.round((x.size||0)/1024)+' KB</span><button class="ol sm" data-a="sycrest" data-x="'+esc(x.day)+'">Restore</button></div>').join('')+'</div>':'<div class="empty" style="padding:8px">No daily copies yet (first one is made today).</div>'):'')+
   (ADMIN()?'<div class="lab">LIVE LINK · HIDE PLAYERS</div><div class="row" style="flex-wrap:wrap;gap:10px"><span style="font-size:14px;color:var(--mu);flex:1">'+esc(liveUrl())+' – on only during a session. Shows names, courts, scores, schedule. Never money, phones or photos. Tap a name to hide it.</span><button class="ol sm" data-a="liveshare">Share live link</button></div><div class="row" style="flex-wrap:wrap;gap:8px">'+active().map(p=>'<button class="orgc sm'+(p.hidePub?' on':'')+'" data-a="pubhide" data-x="'+p.id+'">'+(p.hidePub?'🚫 ':'')+esc(p.name)+'</button>').join('')+'</div>':'')+'</section>'}
function vBackup(){if(!ADMIN())return '<section class="pn"><div class="laby">BACKUP</div><div style="font-size:14px;color:var(--mu)">Backup, export and restore are admin only.</div></section>';
  const L=snapList(),ss=sessions().length,gm=Object.values(S.games).reduce((a,x)=>a+x.hist.length,0);
  return '<section class="pn"><div class="laby">BACKUP · ADMIN ONLY</div><div style="font-size:14px;color:var(--mu)">Everything is saved on this device on every tap. Backups hold the data only (no photos – photos stay on the device and in the cloud).</div>'+
   (expDue()?'<div class="note amb">No backup exported in over 30 days'+(S.lastExp?' (last '+new Date(S.lastExp).toLocaleDateString()+')':'')+'. Export one and keep it off the tablet.</div>':'')+
   '<div class="row" style="flex-wrap:wrap"><div class="tile"><b>'+active().length+'</b><i>Players</i></div><div class="tile"><b>'+ss+'</b><i>Sessions</i></div><div class="tile"><b>'+gm+'</b><i>Games saved</i></div><div class="tile"><b style="font-size:18px;line-height:1.9">'+(S.savedAt?new Date(S.savedAt).toLocaleString():'—')+'</b><i>Last saved</i></div></div>'+
   (!ui.bun&&!ui.pmode?(()=>{ui.pctx='bak';return '<div class="lab">EXPORT / IMPORT / RESTORE · ADMIN PIN</div><div style="display:flex;justify-content:center;padding:10px 0">'+vPin()+'</div>'})():ui.bun?
   '<div class="row" style="flex-wrap:wrap"><button class="btn" data-a="bexport">Export backup</button><button class="ol" style="border-color:var(--amb);color:var(--amb)" data-a="bimport">Import backup</button>'+(canUndo()?'<button class="ol" data-a="snundo">↶ Undo last restore</button>':'')+'</div>'+
   '<div style="font-size:14px;color:var(--mu)">Export saves rebels-backup-'+TODAY()+'.txt. Import replaces ALL data on this device (older backups are upgraded). A safety snapshot is taken first.</div>'+
   '<div class="lab">SAFETY SNAPSHOTS ON THIS DEVICE · LAST 5 · TAKEN BEFORE IMPORT, RESTORE, UPGRADE, END SESSION</div>'+
   (L.length?L.map((s,k)=>'<div class="erow"><b style="flex:1">'+new Date(s.t).toLocaleString()+'</b><span style="color:var(--mu)">'+esc(s.why)+' · '+pl(s.n||0,'player')+'</span><button class="ol sm" data-a="snrest" data-x="'+k+'">Restore</button></div>').join(''):'<div class="empty" style="padding:8px">None yet.</div>')+
   ((S.audit||[]).length?'<div class="lab">AUDIT LOG</div><div class="snl">'+S.audit.slice(0,25).map(a=>'<div class="tip"><span style="color:var(--mu);min-width:120px">'+new Date(a.t).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</span><span>'+esc(a.m)+' <small style="color:var(--mu)">· '+esc(a.by||'')+'</small></span></div>').join('')+'</div>':''):'')+'</section>'}
/* viewer: read-only – only looking around is allowed */
const VIEW_OK=new Set('theme pf tab home hist htab hy hsel hgames hfin fsub ksm kopen open rpm mkpdf noop fpo gpo stab unpaid lock pmod qr pnext cancelup synow switchacc pickx mv mvx lgpick lgother lgback lgpw lgbio lgchg lgface lgnoface qpk lgqpw qpno qpset qpdel sgo sgsave'.split(' '));
/* game manager: no finance, settings, backup, accounts */
const GM_NO=new Set('fsub ksm mkpdf fsave payopen closepay payok payun qr tube cby bkedit bksave bkdel cnt addoth rmoth open rpm entnew entedit closeent enday enfrom entdel hfin stab ruletog ruledel dpts slv lvupd org sdel chpin bexport bimport dstrong dpwr ddeuce dlearn sysnaps sycrest snrest snundo pubhide syurl accset accpw accrm accface'.split(' '));
const viewBlock=(a,x)=>(VIEW()&&!VIEW_OK.has(a)&&!/^close/.test(a))||(GM()&&(GM_NO.has(a)||(a==='tab'&&(x==='finance'||x==='settings'))||(a==='htab'&&x==='fin')));
const SYACT=({
 synow:()=>syncNow(true),syurl:()=>{const u=String(ui.syu||'').trim().replace(/\/+$/,'');if(!/^https:\/\/[^ ]+$/.test(u))return toast('Address must start with https://');SY.url=u;SY.rev=0;ui.syu=null;sySave();toast('Saved · log in again to use it');lockApp()},
 sysnaps:()=>cloudSnaps(),sycrest:x=>cloudRestore(x),
 snrest:x=>snapRestore(+x),snundo:()=>undoRestore(),
 pubhide:x=>{const p=P(x);if(!p)return;if(p.hidePub)delete p.hidePub;else p.hidePub=1;save();render()},
 liveshare:()=>{ui.lvs=1;render()},closelvs:()=>{ui.lvs=0;render()},livecopy:()=>{const u=liveUrl();try{navigator.clipboard.writeText(u).then(()=>toast('Link copied'),()=>toast(u))}catch(e){toast(u)}},liveopen:()=>openUrl(liveUrl()),
 livewa:()=>openUrl('https://wa.me/?text='+encodeURIComponent('Rebels Badminton · live games & scores: '+liveUrl()))
});
/* H4 live link: one fixed URL, no login */
const liveUrl=()=>String(SY.url||DEF_URL).replace(/\/+$/,'')+'/live';
function vLiveShare(){const u=liveUrl();return '<div class="modal" data-a="closelvs"><div class="pn" data-a="noop" style="gap:14px;width:min(480px,92vw);align-items:center;text-align:center"><div class="laby">SHARE LIVE LINK</div>'+
  '<div style="font-size:14px;color:var(--mu)">Players open it on their phone – no login. On only from 30 min before the session until End session. Shows courts, live scores, schedule and results – never money, phones or photos.</div>'+
  '<div style="background:#fff;padding:10px;border-radius:12px">'+QR.svg(u,260)+'</div><div style="font-weight:700;word-break:break-all">'+esc(u)+'</div>'+
  '<div class="row" style="flex-wrap:wrap;justify-content:center"><button class="btn" data-a="livecopy">Copy link</button><button class="ol" data-a="livewa">WhatsApp</button><button class="ol" data-a="liveopen">Open</button><button class="gh" data-a="closelvs">Close</button></div></div></div>'}
