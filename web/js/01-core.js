/* ===== core: helpers, storage, schedule model ===== */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LVN=['Beginner','Beginner +','Intermediate','Intermediate +','Advanced'];
const LVC=['#3DDC97','#9BE36D','#FFD23F','#FF9F43','#FF6B5B'];
const KEY='rebels.v1';
const NB=window.Android||null;

function blank(){return{v:3,nid:1,players:[],locs:['Venue A','Venue B'],days:{},games:{},fin:{},pin:'',
  def:{pts:21,deuce:true,slot:15,chg:2,court:'',fee:'',spt:12},orgs:[],series:[],ent:[],rules:[],ovr:[],eid:1,lastBy:'',lastM:'cash',newRules:0,savedAt:0}}
function parse(t){try{const s=JSON.parse(t);if(s&&s.v&&Array.isArray(s.players))return Object.assign(blank(),s)}catch(e){}return null}
let S=null;
try{S=parse(localStorage.getItem(KEY))}catch(e){}
if(!S&&NB&&NB.loadFile){try{S=parse(NB.loadFile())}catch(e){}}
if(!S)S=blank();
function save(){S.savedAt=Date.now();const t=JSON.stringify(S);
  try{localStorage.setItem(KEY,t)}catch(e){toast('Could not save – export a backup')}
  if(NB&&NB.saveFile){try{NB.saveFile(t)}catch(e){}}}
let tT;function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(tT);tT=setTimeout(()=>t.style.display='none',2200)}

/* ---------- dates & numbers ---------- */
const z=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());
const TODAY=()=>iso(new Date());
const pd=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addD=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)};
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MNF=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dlab=s=>{const d=pd(s);return DN[d.getDay()]+' '+d.getDate()+' '+MN[d.getMonth()]};
const dshort=s=>{const d=pd(s);return d.getDate()+' '+MN[d.getMonth()]};
const mlab=m=>{const a=m.split('-');return MNF[+a[1]-1]+' '+a[0]};
const fmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600);return h?h+':'+z(Math.floor(s%3600/60))+':'+z(s%60):z(Math.floor(s/60))+':'+z(s%60)};
const fmtL=s=>{s=Math.max(0,Math.floor(s));return s>=3600?Math.floor(s/3600)+'h '+z(Math.floor(s%3600/60))+'m':fmt(s)};
const fmtH=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/3600)+'h '+z(Math.floor(s%3600/60))+'m'};
const num=v=>{const x=parseFloat(v);return isNaN(x)?0:x};
const A=v=>'AED '+v.toFixed(2);
const A0=v=>'AED '+Math.round(v).toLocaleString('en-US');
const sg=v=>(v<0?'−':'+')+Math.abs(v).toFixed(2);
const hm=ms=>{const x=new Date(ms);return z(x.getHours())+':'+z(x.getMinutes())};
const tms=(d,v)=>{if(!v)return 0;const a=v.split(':').map(Number),x=pd(d);x.setHours(a[0]||0,a[1]||0,0,0);return x.getTime()};
const t12=v=>{if(!v)return '';const a=v.split(':').map(Number),h=a[0]%12||12;return h+':'+z(a[1]||0)+' '+(a[0]<12?'am':'pm')};
const hrsL=h=>(h%1?h.toFixed(1):h)+' h';
const pl=(n,w)=>n+' '+w+(n===1?'':'s');

/* ---------- players ---------- */
const P=id=>S.players.find(p=>p.id===id);
const nameOf=id=>{const p=P(id);return p?p.name:'?'};
const lvOf=id=>{const p=P(id);return p?p.lv:0};
const active=()=>S.players.filter(p=>!p.gone).sort((a,b)=>a.name.localeCompare(b.name));
const pchip=id=>'box-shadow:inset 0 -3px 0 '+LVC[lvOf(id)];
const isOrg=id=>(S.orgs||[]).includes(id);

/* ---------- scheduled sessions (one per date) ---------- */
const D_=d=>S.days[d];
const isSched=d=>{const D=S.days[d];return !!(D&&D.sch&&!D.x)};
function mkDay(d,o){S.days[d]=Object.assign({sch:1,time:'20:00',loc:S.locs[0]||'',courts:[{n:'Court 1',h:2}],on:{},att:{}},o||{});return S.days[d]}
function day(d){return S.days[d]||mkDay(d)}
const onIds=d=>{const D=S.days[d];return D?Object.keys(D.on).filter(k=>D.on[k]&&P(k)&&!P(k).gone):[]};
const courtsOf=d=>{const D=S.days[d];return D&&D.courts&&D.courts.length?D.courts:[{n:'Court 1',h:2}]};
const cname=(d,i)=>{const c=courtsOf(d)[i];return c?(c.n||'Court '+(i+1)):'Court '+(i+1)};
const sessLenH=d=>Math.max(...courtsOf(d).map(c=>num(c.h)||0),0);
const courtHrs=d=>courtsOf(d).reduce((a,c)=>a+num(c.h),0);
/* booked start: scheduled time; falls back to the actual start */
function bookStart(d){const D=S.days[d],g=S.games[d];if(D&&D.time)return tms(d,D.time);return g&&g.st?g.st:tms(d,'20:00')}
const courtEnd=(d,i)=>bookStart(d)+num((courtsOf(d)[i]||{}).h)*3600e3;
const sessEnd=d=>bookStart(d)+sessLenH(d)*3600e3;
const upcoming=()=>{const t=TODAY();return Object.keys(S.days).filter(d=>d>t&&isSched(d)).sort()};
const pastSched=()=>{const t=TODAY();return Object.keys(S.days).filter(d=>d<t&&isSched(d)).sort()};
const courtSum=d=>courtsOf(d).map(c=>esc(c.n)+' ('+hrsL(num(c.h))+')').join(' + ');

/* weekly repeat: keeps the next 4 weeks scheduled */
function topUp(){const t=TODAY();(S.series||[]).forEach(s=>{let d=s.from;while(d<t)d=addD(d,7);
  for(let k=0;k<5;k++){const x=addD(d,7*k);if(x>addD(t,28))break;if(!S.days[x]&&!(s.skip||[]).includes(x))mkDay(x,{time:s.time,loc:s.loc,courts:JSON.parse(JSON.stringify(s.courts)),ser:s.id})}})}

/* the session the app works on: today, else the next upcoming one */
function curDate(){const t=TODAY();if(ui.cur&&(isSched(ui.cur)||S.games[ui.cur]))return ui.cur;if(isSched(t))return t;return upcoming()[0]||''}

/* ---------- attendance ---------- */
const att=(d,id)=>{const D=S.days[d];return D&&D.att?D.att[id]||null:null};
const arrived=(d,id)=>{const a=att(d,id);return !!(a&&a.a)};
const leftAt=(d,id)=>{const a=att(d,id);return a&&a.l?a.l:0};
const eligible=(d,id)=>arrived(d,id)&&!leftAt(d,id);
/* dummy = family/friend filler (tick box in Games → Players): no game target, plays only when no regular is free */
const isDum=(d,id)=>!!(S.dum&&S.dum[id]);
const canStart=d=>{const D=S.days[d],g=S.games[d];return d===TODAY()&&isSched(d)&&!(g&&g.st)&&Date.now()>=tms(d,D.time)-30*60e3};
/* delete a session completely (sample / mistake) */
function delSess(d){const D=S.days[d];if(D&&D.ser){const sr=S.series.find(s=>s.id===D.ser);if(sr){sr.skip=sr.skip||[];if(!sr.skip.includes(d))sr.skip.push(d)}}
  (S.ent||[]).forEach(e=>{if(e.t==='pkg'&&e.dates)e.dates=e.dates.filter(x=>x!==d)});delete S.days[d];delete S.games[d];delete S.fin[d];if(ui.cur===d)ui.cur=''}
