/* ===== v17 H3: logins (username + password, no emails) =====
   Never auto-login: every app open (after the logo) → account picker. Accounts used on this device are remembered as tiles.
   Tap a tile → face unlock (tablet app, if turned on for that account) or password → the app opens with THAT role only.
   Password is checked by the Worker when online (5 wrong → 15 min lock there); offline, remembered accounts unlock with a
   hash kept on this device. First ever use with no cloud: admin / 12345, must be changed at once (kept on this device until the cloud is reached).
   Device keeps one token per remembered account – used only after an unlock on this open. Locks again after > N min in the background. */
const ACKEY='rebels.acc',LKKEY='rebels.lockmin',ACN={admin:'Admin',organizer:'Organizer',games:'Game manager'};
let ACC=(()=>{try{return JSON.parse(localStorage.getItem(ACKEY))||{}}catch(e){return{}}})();
const accSave=()=>{try{localStorage.setItem(ACKEY,JSON.stringify(ACC))}catch(e){}};
const normU=u=>{u=String(u||'').trim().toLowerCase().replace(/\s+/g,'');return u==='gamemanager'||u==='game'?'games':u};
const lockMin=()=>{const v=num(localStorage.getItem(LKKEY));return v>0?v:5};
/* small SHA-256 (works offline, also on file:// pages) – local unlock hash only; the cloud uses PBKDF2 */
function sha256(str){const K=[],H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  for(let i=0,c=2;i<64;c++){let p=1;for(let d=2;d*d<=c;d++)if(c%d===0){p=0;break}if(p){K[i++]=(Math.pow(c,1/3)%1)*4294967296|0}}
  const b=unescape(encodeURIComponent(str)),n=b.length,w=new Array(((n+9+63)>>6)<<4).fill(0);for(let i=0;i<n;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
  w[n>>2]|=0x80<<(24-(n%4)*8);w[w.length-1]=n*8;const h=H.slice(),r=(x,y)=>(x>>>y)|(x<<(32-y)),W=new Array(64);
  for(let j=0;j<w.length;j+=16){for(let i=0;i<64;i++){if(i<16)W[i]=w[j+i];else{const a=W[i-15],c=W[i-2];W[i]=(W[i-16]+(r(a,7)^r(a,18)^(a>>>3))+W[i-7]+(r(c,17)^r(c,19)^(c>>>10)))|0}}
    let [a,b2,c,d,e,f,g,hh]=h;for(let i=0;i<64;i++){const t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+W[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b2)^(a&c)^(b2&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b2;b2=a;a=(t1+t2)|0}
    [a,b2,c,d,e,f,g,hh].forEach((v,i)=>h[i]=(h[i]+v)|0)}
  return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('')}
const lhash=(pw,salt)=>{let x=salt+'|'+pw;for(let i=0;i<4000;i++)x=sha256(salt+x);return x};
const rsalt=()=>{try{return [...crypto.getRandomValues(new Uint8Array(12))].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){return Math.random().toString(36).slice(2)+Date.now().toString(36)}};
const bioOK=()=>{try{return !!(NB&&NB.bioAvailable&&NB.bioAvailable())}catch(e){return false}};
function remember(u,role,pw,tok){const a=ACC[u]||{},s=rsalt();ACC[u]=Object.assign(a,{role,s,h:lhash(pw,s),tok:tok===undefined?a.tok||'':tok,t:Date.now(),fails:0,lock:0,qf:0,qx:0});accSave()}

/* ---------- lock / unlock ---------- */
let hidAt=0;
function lockApp(){AUTH.u='';AUTH.role='';SY.token='';ui.lg={step:'pick'};['pm','am','ge','er','se','pay','qr','ent','bk','lvs','cf','asg','cts','ck','endc'].forEach(k=>ui[k]=k==='lvs'?0:null);ui.scr='home';ui.cur='';render();lgRender()}
function enterAs(u,role,offline){AUTH.u=u;AUTH.role=role;SY.token=(ACC[u]&&ACC[u].tok)||'';SY.email=u;SY.role=role;SY.err='';if(ACC[u]){ACC[u].t=Date.now();accSave()}
  ui.lg=null;ui.scr='home';lgRender();render();toast('Logged in as '+ACN[u]+(offline?' (offline)':''));if(SY.token)syncNow(false)}
/* cloud says the token is no longer valid (password changed / logged out elsewhere) */
function authLost(s){if(s===401&&AUTH.u&&ACC[AUTH.u]){ACC[AUTH.u].tok='';accSave();SY.token=''}}

async function lgPassword(u,p){u=normU(u);const L=ui.lg;if(!u||!p)return lgErr('Enter username and password');
  if(!['admin','organizer','games'].includes(u))return lgErr('Unknown account. Use admin, organizer or games.');
  const a=ACC[u];if(a&&a.lock>Date.now())return lgErr('Locked – try again at '+hm(a.lock));
  L.busy=1;lgRender();const r=await req('POST','/api/login',{u,p},10000);L.busy=0;
  if(r.s===200&&r.j.token){if(r.j.mc){Object.assign(L,{step:'chg',u,role:r.j.role,tok:r.j.token,old:p,err:''});return lgRender()}
    const first=!a;remember(u,r.j.role,p,r.j.token);if(first&&r.j.role==='admin'&&!SY.rev)SY.dirty=r.j.hasData?0:1;return lgAfter(u,r.j.role,first)}
  if(r.s===429)return lgErr('Locked after 5 wrong tries – try again at '+hm(r.j.until||Date.now()+15*60e3));
  if(r.s===401){/* a local admin password (set offline) is adopted by the cloud while the cloud still has the default 12345 */
    if(u==='admin'&&a&&!a.tok&&a.h===lhash(p,a.s)){const d=await req('POST','/api/login',{u,p:'12345'},10000);
      if(d.s===200&&d.j.mc){const ch=await authReq(d.j.token,'POST','/api/password',{old:'12345',new:p});if(ch.s===200){remember(u,'admin',p,d.j.token);if(!SY.rev)SY.dirty=d.j.hasData?0:1;return lgAfter(u,'admin',false)}}}
    return lgErr('Wrong username or password'+(r.j.left!=null?' · '+pl2(r.j.left,'try','tries')+' left':''))}
  /* no cloud (offline / not set up): remembered account → local check */
  if(a&&a.h){if(a.h===lhash(p,a.s)){a.fails=0;a.qf=0;a.qx=0;accSave();return enterAs(u,a.role,true)}
    a.fails=(a.fails||0)+1;if(a.fails>=5){a.lock=Date.now()+15*60e3;a.fails=0}accSave();return lgErr(a.lock>Date.now()?'Locked after 5 wrong tries – try again at '+hm(a.lock):'Wrong password (offline check)')}
  if(u==='admin'&&p==='12345'&&!ACC.admin){Object.assign(L,{step:'chg',u,role:'admin',tok:'',old:p,err:'',local:1});return lgRender()}
  lgErr('No internet – this account hasn’t been used on this device yet. Connect once to log in.')}
const pl2=(n,a,b)=>n+' '+(n===1?a:b);
async function authReq(tok,m,p,body){const o=SY.token;SY.token=tok;try{return await req(m,p,body,10000)}finally{SY.token=o}}
async function lgChange(){const L=ui.lg,n1=L.n1||'',n2=L.n2||'';if(n1.length<5)return lgErr('At least 5 characters');if(n1==='12345')return lgErr('Choose a password other than 12345');if(n1!==n2)return lgErr('The two passwords don’t match');
  if(L.local){remember('admin','admin',n1,'');return lgAfter('admin','admin',true)}
  L.busy=1;lgRender();const r=await authReq(L.tok,'POST','/api/password',{old:L.old,new:n1});L.busy=0;
  if(r.s!==200)return lgErr(r.s===0?'No internet – try again':(r.j.error||'Could not change the password'));
  const first=!ACC[L.u];remember(L.u,L.role,n1,L.tok);if(first&&L.role==='admin'&&!SY.rev)SY.dirty=1;lgAfter(L.u,L.role,first)}
/* after a password login: offer face unlock once (tablet app) */
function lgAfter(u,role,first){if(ACC[u]&&!ACC[u].qp&&!ACC[u].qpno){ui.lg={step:'qpnew',u,role,pin:''};return lgRender()}enterAs(u,role)}
/* ---------- v20: 4-digit quick PIN per account, this device only (works offline) ----------
   ACC[u].qp={s,h} (salted hash) · qf = wrong tries · qx=1 after 5 wrong → password needed (cleared by a password login) */
const qpOn=u=>!!(ACC[u]&&ACC[u].qp&&!ACC[u].qx);
function qpSet(u,pin){const a=ACC[u];if(!a)return false;const s=rsalt();a.qp={s,h:lhash(pin,s)};a.qf=0;a.qx=0;delete a.qpno;accSave();return true}
function qpKey(k){const L=ui.lg;if(!L||!['qpin','qpnew','qpcon'].includes(L.step))return;L.pin=L.pin||'';
  if(k==='⌫'){L.pin=L.pin.slice(0,-1);return lgRender()}if(!/^\d$/.test(k)||L.pin.length>=4)return;L.pin+=k;L.err='';if(L.pin.length<4)return lgRender();
  const p=L.pin,u=L.u,a=ACC[u];L.pin='';if(!a)return lgRender();
  if(L.step==='qpin'){if(a.qp&&a.qp.h===lhash(p,a.qp.s)){a.qf=0;accSave();return enterAs(u,a.role,navigator.onLine===false)}
    a.qf=(a.qf||0)+1;if(a.qf>=5){a.qx=1;a.qf=0;accSave();ui.lg={step:'pw',u,err:'5 wrong PINs – log in with the password'};return lgRender()}
    accSave();L.err='Wrong PIN · '+pl2(5-a.qf,'try','tries')+' left';return lgRender()}
  if(L.step==='qpnew'){L.p1=p;L.step='qpcon';return lgRender()}
  if(p!==L.p1){L.step='qpnew';L.p1='';L.err='PINs didn’t match – start again';return lgRender()}
  qpSet(u,p);toast('Quick PIN saved');enterAs(u,L.role||a.role)}
document.addEventListener('keydown',e=>{const L=ui.lg;if(!L||!['qpin','qpnew','qpcon'].includes(L.step))return;if(/^\d$/.test(e.key)){e.preventDefault();qpKey(e.key)}else if(e.key==='Backspace'){e.preventDefault();qpKey('⌫')}});
function lgBio(u){if(!bioOK())return;ui.lg={step:'bio',u};lgRender();try{NB.bioAuth(u)}catch(e){ui.lg={step:'pw',u};lgRender()}}
window.__bio=(u,ok)=>{const L=ui.lg;if(!L||L.u!==u)return;if(ok&&ACC[u]){if(L.step==='faceset'){ACC[u].face=1;accSave();return enterAs(u,L.role||ACC[u].role)}return enterAs(u,ACC[u].role,navigator.onLine===false)}
  if(L.step==='faceset'){ACC[u].face=0;accSave();return enterAs(u,L.role||ACC[u].role)}ui.lg={step:'pw',u,err:'Not unlocked – use the password'};lgRender()};
function lgErr(m){if(ui.lg){ui.lg.err=m;ui.lg.busy=0}lgRender()}

/* ---------- login screen ---------- */
function vLogin(){const L=ui.lg,ks=['admin','games','organizer'].filter(u=>ACC[u]);
  const tile=u=>'<button class="lgt" data-a="lgpick" data-x="'+u+'"><span class="lgi">'+ACN[u][0]+'</span><b>'+ACN[u]+'</b><i>'+(qpOn(u)?'Quick PIN':ACC[u].face&&bioOK()?'Tablet unlock':'Password')+'</i></button>';
  const err=L.err?'<div class="note amb" style="width:100%">'+esc(L.err)+'</div>':'';const busy=L.busy?' disabled':'';
  let body='';
  if(L.step==='pick')body='<div class="lgh">Who is using the app?</div><div class="lgtiles">'+ks.map(tile).join('')+'<button class="lgt oth" data-a="lgother"><span class="lgi">+</span><b>Other account</b><i>Username &amp; password</i></button></div>'+
    (ks.length?'':'<div class="lgs">First time on this device? Log in with <b>admin</b>. Organizer and game manager passwords are set by admin in Settings.</div>');
  else if(L.step==='pw'||L.step==='other')body='<div class="lgh">'+(L.step==='pw'?ACN[L.u]:'Log in')+'</div>'+err+
    (L.step==='other'?'<input class="inp lgin" id="lgu" placeholder="Username (admin · organizer · games)" autocomplete="username" autocapitalize="off" data-i="lg_u" value="'+esc(L.uu||'')+'">':'')+
    '<input class="inp lgin" id="lgp" type="password" placeholder="Password" autocomplete="current-password" data-i="lg_p">'+
    '<div class="row" style="width:100%"><button class="gh" data-a="lgback">Back</button><button class="btn" style="flex:1" data-a="lgpw"'+busy+'>'+(L.busy?'Checking…':'Log in')+'</button></div>'+
    (L.step==='pw'&&ACC[L.u]&&ACC[L.u].face&&bioOK()?'<button class="lnk" data-a="lgbio" data-x="'+L.u+'">Use tablet unlock</button>':'');
  else if(L.step==='chg')body='<div class="lgh">Choose a new password</div><div class="lgs">'+(L.local?'No internet – the new password is kept on this device and sent to the cloud the first time you log in online.':'The default password must be changed on first login.')+'</div>'+err+
    '<input class="inp lgin" type="password" placeholder="New password (5+ characters)" autocomplete="new-password" data-i="lg_n1"><input class="inp lgin" type="password" placeholder="New password again" autocomplete="new-password" data-i="lg_n2">'+
    '<div class="row" style="width:100%"><button class="gh" data-a="lgback">Cancel</button><button class="btn" style="flex:1" data-a="lgchg"'+busy+'>'+(L.busy?'Saving…':'Save &amp; continue')+'</button></div>';
  else if(L.step==='face')body='<div class="lgh">Use tablet unlock?</div><div class="lgs">Next time on this tablet, '+ACN[L.u]+' opens with the tablet’s own unlock (face, PIN or pattern) instead of the password. Anyone who can unlock this tablet can then open '+ACN[L.u]+' – keep the tablet PIN private.</div>'+
    '<div class="row" style="width:100%"><button class="gh" style="flex:1" data-a="lgnoface">Not now</button><button class="btn" style="flex:1" data-a="lgface">Turn on</button></div>';
  else if(L.step==='qpin'||L.step==='qpnew'||L.step==='qpcon'){const pin=L.pin||'',keys=['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k=>k?'<button class="key" data-a="qpk" data-x="'+k+'" aria-label="'+(k==='⌫'?'Delete':k)+'">'+k+'</button>':'<span></span>').join('');
    body='<div class="lgh">'+(L.step==='qpin'?ACN[L.u]:L.step==='qpnew'?'Set a quick PIN':'Same PIN again')+'</div><div class="lgs">'+(L.step==='qpin'?'Enter your 4-digit quick PIN':L.step==='qpnew'?'4 digits to open '+ACN[L.u]+' on this device next time – works offline. 5 wrong → password.':'Enter the same 4 digits again')+'</div>'+
     '<div class="row" style="gap:14px;margin:4px 0">'+[0,1,2,3].map(i=>'<span class="pdot'+(i<pin.length?' on':'')+'"></span>').join('')+'</div><div style="min-height:20px;font-size:14px;color:var(--bad);font-weight:600">'+esc(L.err||'')+'</div>'+
     '<div style="display:grid;grid-template-columns:repeat(3,76px);gap:10px">'+keys+'</div>'+
     (L.step==='qpin'?'<div class="row"><button class="gh" data-a="lgback">Back</button><button class="lnk" data-a="lgqpw">Use password</button></div>':'<button class="gh" data-a="qpno">Not now</button>')}
  else if(L.step==='bio'||L.step==='faceset')body='<div class="lgh">Unlock with the tablet…</div><div class="lgs">'+ACN[L.u]+'</div><button class="gh" data-a="lgback">Use password</button>';
  return '<div class="lgbox"><img src="'+$('#lg').src+'" alt="" class="lglogo"><div class="d lgtt">REBELS <span>BADMINTON</span></div>'+body+
   '<div class="lgs" style="margin-top:6px">'+(navigator.onLine===false?'Offline – remembered accounts still unlock':'')+'</div></div>'}
function lgRender(){const el=$('#login');if(!el)return;if(!ui.lg){el.innerHTML='';el.hidden=true;document.body.classList.remove('locked');return}
  el.hidden=false;document.body.classList.add('locked');el.innerHTML=vLogin();const f=el.querySelector('#lgu')||el.querySelector('#lgp')||el.querySelector('[data-i="lg_n1"]');if(f&&!ui.lg.busy)setTimeout(()=>{try{f.focus()}catch(e){}},50)}
document.addEventListener('visibilitychange',()=>{if(document.hidden){hidAt=Date.now()}else if(AUTH.u&&hidAt&&Date.now()-hidAt>lockMin()*60e3){lockApp()}});

/* ---------- Settings → Account & passwords (admin) ---------- */
function vQuickPin(){const u=AUTH.u,on=!!(ACC[u]&&ACC[u].qp);
  return '<div class="lab">QUICK PIN · THIS DEVICE · '+esc((ACN[u]||'').toUpperCase())+'</div><div style="font-size:14px;color:var(--mu)">'+(on?'ON – tap the '+esc(ACN[u]||'')+' tile → 4-digit PIN.'+(ACC[u].qx?' <b style="color:var(--bad)">Blocked after 5 wrong tries – the next password login turns it back on.</b>':''):'OFF – set 4 digits to open this account without the password.')+' Works offline; 5 wrong tries → password.</div>'+
   '<div class="row" style="flex-wrap:wrap"><input class="inp" type="password" inputmode="numeric" maxlength="4" style="width:150px" placeholder="New PIN" data-i="qp_n1" autocomplete="off"><input class="inp" type="password" inputmode="numeric" maxlength="4" style="width:150px" placeholder="PIN again" data-i="qp_n2" autocomplete="off"><button class="btn sm" data-a="qpset">'+(on?'Change PIN':'Set quick PIN')+'</button>'+(on?'<button class="ol sm" style="color:var(--bad)" data-a="qpdel">Remove</button>':'')+'</div>'}
function vAcctSet(){if(!ADMIN())return '<section class="pn"><div class="laby">ACCOUNT &amp; PASSWORDS</div><div class="kv"><span>Logged in as</span><span>'+esc(ACN[AUTH.u]||'')+'</span></div>'+vQuickPin()+'<div class="row"><button class="ol sm" data-a="switchacc">Switch account / Log out</button></div></section>';
  const A=ui.acc||(ui.acc={}),L=A.list,row=u=>{const x=L&&L.find(o=>o.u===u);return '<div class="erow" style="flex-wrap:wrap"><b style="min-width:150px">'+ACN[u]+' <small style="color:var(--mu)">· '+u+'</small></b><span style="flex:1;color:var(--mu);font-size:14px">'+(!L?'':x&&x.set?(x.locked?'Locked until '+hm(x.locked):'Password set'):'No password yet – cannot log in')+'</span>'+
    '<input class="inp" type="password" style="width:200px" placeholder="New password" data-i="acc_'+u+'" autocomplete="new-password"><button class="btn sm" data-a="accset" data-x="'+u+'">'+(x&&x.set?'Reset':'Set')+'</button></div>'};
  const rem=['admin','games','organizer'].filter(u=>ACC[u]);
  return '<section class="pn"><div class="laby">ACCOUNT &amp; PASSWORDS</div><div style="font-size:14px;color:var(--mu)">3 accounts: <b>admin</b> (everything) · <b>organizer</b> (sees everything incl. Finance, changes nothing) · <b>games</b> = game manager (sessions, players, check-in, games, scores, print – no Finance, Settings or backup). Passwords are checked by the cloud; 5 wrong tries lock the account for 15 min.</div>'+
   '<div class="lab">MY PASSWORD (ADMIN)</div><div class="row" style="flex-wrap:wrap"><input class="inp" type="password" style="width:200px" placeholder="Current password" data-i="acc_old" autocomplete="current-password"><input class="inp" type="password" style="width:200px" placeholder="New password" data-i="acc_new" autocomplete="new-password"><button class="btn sm" data-a="accpw">Change</button></div>'+
   '<div class="sb"><div class="lab">ORGANIZER &amp; GAME MANAGER</div><button class="gh" data-a="acclist">'+(L?'Refresh':'Show status')+'</button></div>'+row('organizer')+row('games')+
   vQuickPin()+'<div class="lab">REMEMBERED ON THIS DEVICE</div>'+(rem.length?rem.map(u=>'<div class="erow"><b style="flex:1">'+ACN[u]+(ACC[u].qp?' <small style="color:var(--ok)">· quick PIN</small>':'')+'</b>'+(bioOK()?'<button class="fc'+(ACC[u].face?' on':'')+'" data-a="accface" data-x="'+u+'">Tablet unlock '+(ACC[u].face?'ON':'OFF')+'</button>':'')+'<button class="ol sm" style="color:var(--bad)" data-a="accrm" data-x="'+u+'">Remove</button></div>').join(''):'<div class="empty" style="padding:8px">None.</div>')+
   '<div class="row" style="gap:10px;flex-wrap:wrap"><label class="fl" style="max-width:260px">Lock after app in background (min)<input class="fin" type="number" inputmode="numeric" min="1" value="'+lockMin()+'" data-i="acc_lock"></label><button class="ol sm" data-a="switchacc">Switch account / Log out</button></div></section>'}
async function accList(){const r=await req('GET','/api/accounts');if(r.s!==200)return toast(r.s===0?'No internet':'Could not load accounts');ui.acc.list=r.j.list;render()}

Object.assign(SYACT,{
 switchacc:()=>{if(pinned())return toast('Unlock the tablet first');save();lockApp()},
 lgpick:x=>{const a=ACC[x];if(!a)return;if(qpOn(x)){ui.lg={step:'qpin',u:x,pin:''};return lgRender()}if(a.face&&bioOK())return lgBio(x);ui.lg={step:'pw',u:x};lgRender()},
 sgo:x=>{ui.sopen=ui.sopen===x?'':x;render()},sgsave:()=>{if(!VIEW())save();ui.sopen='';render();toast(VIEW()?'Closed':'Saved')},
 qpk:x=>qpKey(x),lgqpw:()=>{const L=ui.lg;if(L){ui.lg={step:'pw',u:L.u};lgRender()}},
 qpno:()=>{const L=ui.lg;if(!L)return;if(ACC[L.u]){ACC[L.u].qpno=1;accSave()}enterAs(L.u,L.role||ACC[L.u].role)},
 qpset:()=>{const u=AUTH.u,v=ui.qpi||{};if(!ACC[u])return toast('Log in with the password once on this device first');if(!/^\d{4}$/.test(v.n1||''))return toast('PIN must be 4 digits');if(v.n1!==v.n2)return toast('The two PINs don’t match');qpSet(u,v.n1);ui.qpi={};toast('Quick PIN saved for '+ACN[u]);render()},
 qpdel:()=>{const a=ACC[AUTH.u];if(!a)return;delete a.qp;a.qpno=1;accSave();toast('Quick PIN removed');render()},
 lgother:()=>{ui.lg={step:'other'};lgRender()},lgback:()=>{ui.lg={step:'pick'};lgRender()},
 lgpw:()=>{const L=ui.lg;if(!L||L.busy)return;const p=($('#lgp')||{}).value||'',u=L.step==='pw'?L.u:(($('#lgu')||{}).value||'');L.uu=u;lgPassword(u,p)},
 lgchg:()=>{if(ui.lg&&!ui.lg.busy)lgChange()},lgbio:x=>lgBio(x),
 lgface:()=>{const L=ui.lg;ui.lg={step:'faceset',u:L.u,role:L.role};lgRender();try{NB.bioAuth(L.u)}catch(e){window.__bio(L.u,false)}},
 lgnoface:()=>{const L=ui.lg;ACC[L.u].face=0;accSave();enterAs(L.u,L.role)},
 acclist:()=>accList(),
 accset:async x=>{const v=(ui.acc||{})['p_'+x]||'';if(v.length<5||v==='12345')return toast('At least 5 characters, not 12345');const r=await req('POST','/api/accounts/'+x+'/password',{new:v});
   if(r.s!==200)return toast(r.s===0?'No internet – passwords are set in the cloud':(r.j.error||'Not saved'));ui.acc['p_'+x]='';audit('Password set for '+ACN[x]);save();toast(ACN[x]+' password saved');accList()},
 accpw:async()=>{const A=ui.acc||{},o=A.old||'',n=A.new||'';if(n.length<5||n==='12345')return toast('New password: at least 5 characters, not 12345');const r=await req('POST','/api/password',{old:o,new:n});
   if(r.s!==200)return toast(r.s===0?'No internet – try again online':(r.j.error||'Not changed'));remember('admin','admin',n,SY.token);A.old=A.new='';toast('Password changed');render()},
 accrm:x=>{if(!confirm('Remove '+ACN[x]+' from this device? It can log in again with the password.'))return;delete ACC[x];accSave();if(AUTH.u===x)return lockApp();render()},
 accface:x=>{const a=ACC[x];if(!a)return;a.face=a.face?0:1;accSave();render()}
});
