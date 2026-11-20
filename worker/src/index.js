/* Rebels Badminton – one Cloudflare Worker (v17 A + F + H): the app (static assets) + sync API + live session page.
   D1 = data (one document, daily snapshots kept 90 days, accounts, tokens, audit, photos when no R2 is bound).
   Logins (H3): 3 fixed accounts, username + password, hashed (PBKDF2) and checked here. No emails anywhere.
     admin     – everything. Default password 12345, must be changed on first login.
     organizer – reads everything incl. finance, cannot change anything (403).
     games     – sessions, players, check-in, games, scores. No finance, settings or backup (finance never sent, never accepted).
   5 wrong passwords → account locked 15 min. Live link (H4): /live, no login, only during the session window, no finance/phones/photos. */
const DAY = 864e5, KEEP_DAYS = 90, LOCK_MS = 15 * 60e3, MAX_TRIES = 5, ITER = 100000, DEF_PW = '12345';
const ACCOUNTS = { admin: 'admin', organizer: 'organizer', games: 'games' };
const FIN_KEYS = ['fin', 'ent', 'pin'];                       /* never sent to / accepted from the game manager */
const GM_KEYS = ['players', 'days', 'games', 'locs', 'nid', 'dum', 'delD', 'ovr', 'series', 'savedAt', 'v'];   /* what the game manager may change */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' };
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...h } });
const dubaiDay = (t = Date.now()) => new Date(t + 4 * 3600e3).toISOString().slice(0, 10);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async t => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normU = u => { u = String(u || '').trim().toLowerCase().replace(/\s+/g, ''); return u === 'gamemanager' || u === 'game' ? 'games' : u; };
async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITER }, k, 256));
}
const okPw = p => typeof p === 'string' && p.length >= 5 && p.length <= 64 && p !== DEF_PW;

let schemaOK = false;
async function schema(env) {
  if (schemaOK) return;
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS doc(id INTEGER PRIMARY KEY CHECK(id=1), rev INTEGER NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, by TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS snaps(day TEXT PRIMARY KEY, rev INTEGER, data TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS acct(u TEXT PRIMARY KEY, role TEXT NOT NULL, salt TEXT, h TEXT, mc INTEGER DEFAULT 0, fails INTEGER DEFAULT 0, lock INTEGER DEFAULT 0, at INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tok(h TEXT PRIMARY KEY, u TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, email TEXT, m TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, img TEXT NOT NULL, at INTEGER)'),
    /* v18: scores sent from the live page – one open (pending/accepted) score per game, enforced by the unique index */
    db.prepare('CREATE TABLE IF NOT EXISTS subs(id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT NOT NULL, k TEXT NOT NULL, st TEXT NOT NULL, who INTEGER, byn TEXT, sa INTEGER, sb INTEGER, at INTEGER, ip TEXT, rv INTEGER, rby TEXT)'),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS subs_open ON subs(d,k) WHERE st IN ('p','a')"),
  ]);
  if (!(await db.prepare("SELECT u FROM acct WHERE u='admin'").first())) {
    const salt = rand(16);
    await db.prepare('INSERT OR IGNORE INTO acct(u,role,salt,h,mc,at) VALUES(?,?,?,?,1,?)').bind('admin', 'admin', salt, await pbkdf2(DEF_PW, salt), Date.now()).run();
  }
  await db.batch(['organizer', 'games'].map(u => db.prepare('INSERT OR IGNORE INTO acct(u,role,salt,h,mc,at) VALUES(?,?,NULL,NULL,0,?)').bind(u, ACCOUNTS[u], Date.now())));
  schemaOK = true;
}
const audit = (env, who, m) => env.DB.prepare('INSERT INTO audit(at,email,m) VALUES(?,?,?)').bind(Date.now(), who || '', m).run();
async function who(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  const row = await env.DB.prepare('SELECT a.u,a.role,a.mc FROM tok t JOIN acct a ON a.u=t.u WHERE t.h=?').bind(await sha(t)).first();
  return row ? { u: row.u, role: row.role, mc: !!row.mc, t } : null;
}
const getDoc = env => env.DB.prepare('SELECT rev,data,at,by FROM doc WHERE id=1').first();
async function snapToday(env, doc) {
  if (!doc) return;
  await env.DB.prepare('INSERT OR IGNORE INTO snaps(day,rev,data,at) VALUES(?,?,?,?)').bind(dubaiDay(), doc.rev, doc.data, Date.now()).run();
}
async function prune(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM snaps WHERE day < ?').bind(dubaiDay(Date.now() - KEEP_DAYS * DAY)),
    env.DB.prepare('DELETE FROM audit WHERE at < ?').bind(Date.now() - 365 * DAY),
    env.DB.prepare('DELETE FROM tok WHERE at < ?').bind(Date.now() - 400 * DAY),
  ]);
}

/* ---------- photos: R2 when bound, else D1 ---------- */
const PH = {
  get: async (env, id) => env.PHOTOS ? (await env.PHOTOS.get('photo/' + id))?.text() : (await env.DB.prepare('SELECT img FROM photos WHERE id=?').bind(id).first())?.img,
  put: (env, id, img) => env.PHOTOS ? env.PHOTOS.put('photo/' + id, img, { httpMetadata: { contentType: 'text/plain' } }) : env.DB.prepare('INSERT INTO photos(id,img,at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET img=excluded.img,at=excluded.at').bind(id, img, Date.now()).run(),
  del: (env, id) => env.PHOTOS ? env.PHOTOS.delete('photo/' + id) : env.DB.prepare('DELETE FROM photos WHERE id=?').bind(id).run(),
};

/* ---------- v18 scoring rules – same as the app (02-plan.js) ---------- */
const capOf = P => P.deuce && +P.pts < 30 ? Math.max(+P.pts, Math.min(30, +P.pts + 9)) : +P.pts;
function scoreErr(a, b, P) {
  a = +a || 0; b = +b || 0; const p = +P.pts, c = capOf(P), hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi > c) return 'Max ' + c + ' in a game to ' + p; if (hi < p) return '';
  if (!P.deuce || p >= 30) return lo >= p ? 'Only one side can reach ' + p : '';
  if (hi === p) return lo > p - 2 ? 'At ' + (p - 1) + '–' + (p - 1) + ' deuce: win by 2' : ''; if (hi === c) return lo < c - 2 ? 'Above ' + p + ' the winner leads by exactly 2' : ''; return hi - lo !== 2 ? 'Above ' + p + ' the winner leads by exactly 2' : '';
}
const gameWon = (a, b, P) => { const hi = Math.max(a, b), lo = Math.min(a, b), p = +P.pts; return P.deuce && p < 30 ? (hi >= p && hi - lo >= 2) || hi >= capOf(P) : hi >= p; };
const hKey = h => (h.at || 0) + '-' + (h.c || 1);                 /* game key shared with the app (06-games.js hKey) */
const TYN = { MD: "Men's doubles", WD: "Women's doubles", XD: 'Mixed doubles' };

/* ---------- H4 live session: only during the session window; names, courts, scores, schedule – nothing else ---------- */
const tms = (d, hhmm) => Date.parse(d + 'T' + (/^\d\d:\d\d$/.test(hhmm || '') ? hhmm : '20:00') + ':00+04:00');
function liveData(S, now = Date.now(), subs = []) {
  S = S || {};
  const P = {}; (S.players || []).forEach(p => P[p.id] = p);
  const nm = id => !id ? '' : P[id] && !P[id].hidePub ? String(P[id].name || '') : 'Guest';
  const days = S.days || {}, games = S.games || {}, today = dubaiDay(now);
  const D = days[today], g = games[today];
  const courts = d => (days[d] && days[d].courts && days[d].courts.length ? days[d].courts : [{ n: 'Court 1', h: 2 }]);
  const lenH = d => Math.max(0, ...courts(d).map(c => +c.h || 0));
  let on = false;
  if (D && D.sch && !D.x && !(g && g.en)) {
    const st = tms(today, D.time), end = st + lenH(today) * 3600e3;
    on = (g && g.st ? true : now >= st - 30 * 60e3) && now <= end + 3600e3;      /* 30 min before start … End session (auto-off at booked end + 1 h) */
  }
  if (!on) {
    const nx = Object.keys(days).filter(d => d >= today && days[d].sch && !days[d].x && !(games[d] && games[d].en) && !(d === today && tms(d, days[d].time) + lenH(d) * 3600e3 + 3600e3 < now)).sort()[0];
    return { live: false, next: nx ? { date: nx, time: days[nx].time || '', loc: days[nx].loc || '' } : null };
  }
  const cn = i => String((courts(today)[i] || {}).n || 'Court ' + (i + 1));
  const team = (q, k) => (q || []).slice(k * 2, k * 2 + 2).map(nm);
  const ty = q => { const f = (q || []).filter(id => id && P[id] && P[id].sx === 'f').length; return f === 2 ? 'XD' : f >= 3 ? 'WD' : 'MD'; };
  const lock = {}; (subs || []).forEach(x => { lock[x.k] = x.st; });
  const gpts = o => +(o && o.pts) || +(g && g.pts) || 21, deuce = !!(g && g.deuce);
  const hist = g && Array.isArray(g.hist) ? g.hist : [];
  const doneN = new Set(hist.filter(h => h.n).map(h => h.n)), curN = (g && g.curN) || [];
  const now_ = (g && g.cur || []).map((q, i) => {
    if (!q || !q.every(Boolean)) return null; const L = (g.live || [])[i] || {};
    return { court: cn(i), n: curN[i] || null, ty: ty(q), a: team(q, 0), b: team(q, 1), sa: +L.sa || 0, sb: +L.sb || 0, run: !!L.run, start: L.run ? +L.start || 0 : 0, el: +L.el || 0, pts: +(L.pts || g.pts) || 21 };
  }).filter(Boolean);
  const fp = g && Array.isArray(g.fp) ? g.fp : [];
  const qq = (g && g.qq) || [], up = (g && g.up) || [], nxt = (g && g.nxt) || [];
  /* v18: per court the queued / planned game first, then the app-picked Upcoming games (they have no court yet) */
  const next = [], seen = new Set(), full = q => q && q.every && q.length === 4 && q.every(Boolean), onC = new Set((g && g.cur || []).flat().filter(Boolean));
  const add = (q, n, c) => { const k = q.join(); if (seen.has(k)) return; seen.add(k); next.push({ court: c == null ? '' : cn(c), n: n || null, ty: ty(q), a: team(q, 0), b: team(q, 1) }); };
  courts(today).forEach((c, i) => {
    let q = qq[i] && qq[i][0] && qq[i][0].q, n = qq[i] && qq[i][0] && qq[i][0].n;
    if (!full(q) && full(nxt[i])) { q = nxt[i]; n = null; }
    if (!full(q) && fp.length) { const u = up.find(x => x.c === i && full(x.q)) || fp.find(x => x.c === i && !x.x && !doneN.has(x.n) && !curN.includes(x.n) && full(x.q)); if (u) { q = u.q; n = u.n || null; } }
    if (full(q)) add(q, n, i);
  });
  up.forEach(x => { if (full(x.q) && next.length < 8) add(x.q, x.n, x.c == null || !fp.length ? null : x.c); });
  const res = hist.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map(h => {
    const k = hKey(h), sc = !!(+h.sa || +h.sb), ok = !sc && Array.isArray(h.ids) && h.ids.length === 4 && h.ids.every(Boolean);
    return { k, court: cn((h.c || 1) - 1), n: h.n || null, ty: ty(h.ids), a: team(h.ids, 0), b: team(h.ids, 1), sa: +h.sa || 0, sb: +h.sb || 0, pts: gpts(h), deuce, sc, send: ok && !lock[k], sent: !sc && !!lock[k] };
  });
  const st = {};
  hist.forEach(h => { if (!h.ids) return; const aw = h.sa > h.sb, tie = h.sa === h.sb; h.ids.forEach((id, i) => { if (!id || !P[id] || P[id].hidePub) return; const s = st[id] = st[id] || { name: nm(id), g: 0, w: 0 }; s.g++; if (!tie && (i < 2) === aw) s.w++; }); });
  const stats = Object.values(st).sort((a, b) => b.w - a.w || b.g - a.g || a.name.localeCompare(b.name));
  const sched = fp.filter(x => !x.x && x.q && x.q.some(Boolean)).map(x => {
    const h = hist.find(o => o.n === x.n);
    return { n: x.n, court: cn(x.c), ty: ty(x.q), a: team(x.q, 0), b: team(x.q, 1), st: h ? 'done' : curN.includes(x.n) ? 'now' : 'plan', sa: h ? +h.sa || 0 : null, sb: h ? +h.sb || 0 : null };
  });
  return { live: true, date: today, time: D.time || '', loc: D.loc || '', started: !!(g && g.st), courts: courts(today).map((c, i) => cn(i)), now: now_, next, results: res, stats, sched, at: now };
}
const LIVE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#16181D"><title>Rebels Badminton · Live</title>
<style>
@font-face{font-family:Outfit;font-weight:400;font-display:swap;src:url(/fonts/outfit-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:Outfit;font-weight:600;font-display:swap;src:url(/fonts/outfit-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:Outfit;font-weight:700;font-display:swap;src:url(/fonts/outfit-latin-700-normal.woff2) format('woff2')}
:root{color-scheme:dark;--bg:#16181D;--pn:#22252C;--y:#E5383B;--court:#1D5E47;--tx:#F2F3F5;--mu:#9AA0AB;--bd:#3A404C;--ok:#34C77B;--amb:#F5A524;--line:#2E333C;--md:#14B8A6;--wd:#A178FF;--xd:#3B82F6;--win:#4C9AFF}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.35 Outfit,system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
main{max-width:1280px;margin:0 auto;padding:14px 12px calc(40px + env(safe-area-inset-bottom))}
h1{font-size:22px;margin:0;font-weight:700;letter-spacing:.02em}h1 b{color:var(--y)}
h2{font-size:12px;letter-spacing:.16em;color:var(--mu);margin:20px 2px 8px;font-weight:700}
.mu{color:var(--mu)}.live{color:var(--ok);font-weight:700}
.sub{font-size:14px;margin-top:2px}
.cg{display:grid;grid-template-columns:repeat(var(--c,1),minmax(0,1fr));gap:12px}
.cc{background:var(--pn);border-radius:18px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px}.ch b{font-size:22px;font-weight:700}
.tm{margin-left:auto;font-size:24px;font-weight:700;color:var(--ok)}
.fh{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}
.fmt{display:inline-block;min-width:34px;text-align:center;padding:3px 7px;border-radius:7px;font-size:12px;font-weight:800;letter-spacing:.06em;color:#fff}.fMD{background:var(--md)}.fWD{background:var(--wd)}.fXD{background:var(--xd)}
.ct{position:relative;background:var(--court);border:3px solid rgba(255,255,255,.85);border-radius:14px;padding:14px 12px;display:flex;flex-direction:column;gap:22px;overflow:hidden}
.ct i{position:absolute;pointer-events:none}.ct .l1{inset:10px 22px;border-left:2px solid rgba(255,255,255,.45);border-right:2px solid rgba(255,255,255,.45)}
.ct .l2{left:50%;top:0;bottom:0;width:2px;background:rgba(255,255,255,.35)}
.ct .net{left:-4px;right:-4px;top:50%;height:6px;margin-top:-3px;background:repeating-linear-gradient(90deg,#EAF2FA 0 3px,transparent 3px 7px);border-top:2px solid #EAF2FA;border-bottom:2px solid #EAF2FA}
.tr{position:relative;z-index:1;display:flex;align-items:center;gap:8px}
.nms{flex:1;display:flex;gap:6px;flex-wrap:wrap;min-width:0}
.pc{background:var(--bg);border-radius:12px;padding:7px 12px;font-weight:700;font-size:17px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc{font-size:46px;font-weight:700;min-width:64px;text-align:center;line-height:1;background:rgba(22,24,29,.55);border-radius:12px;padding:6px 4px}
.ut{display:flex;flex-direction:column;gap:6px;background:var(--bg);border-radius:14px;padding:10px}
.ut .vs{color:var(--y);font-weight:800;font-size:13px;letter-spacing:.1em;padding-left:4px}
.card{background:var(--pn);border-radius:14px;padding:10px 12px}
.rl{padding:9px 2px;border-top:1px solid var(--line)}.rl:first-child{border-top:0}
.ln{display:block;white-space:nowrap;overflow:hidden;font-size:16px}
.w{color:var(--win);font-weight:800}
.ra{display:flex;align-items:center;gap:8px;margin-top:6px}
.sbtn{min-height:48px;padding:0 20px;border-radius:12px;border:0;background:var(--y);color:#fff;font:700 16px Outfit,system-ui,sans-serif}
.pill{display:inline-block;font-size:13px;padding:5px 10px;border-radius:99px;background:rgba(245,165,36,.14);color:var(--amb);font-weight:700}
table{width:100%;border-collapse:collapse}td,th{padding:8px 6px;border-top:1px solid var(--line);text-align:left}th{border:0;font-size:11px;color:var(--mu);letter-spacing:.08em}.n{text-align:right}
.st{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--line);color:var(--mu);white-space:nowrap}.st.now{background:var(--ok);color:#06210F}.st.done{background:var(--bd);color:var(--tx)}
.sch td{font-size:14px}.sch .w{color:var(--win)}
#m{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;z-index:9}#m.on{display:flex}
.sh{background:var(--pn);width:min(560px,100%);border-radius:20px 20px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;max-height:94vh;overflow:auto}
.lab{font-size:12px;letter-spacing:.14em;color:var(--mu);font-weight:700}
.who{display:grid;grid-template-columns:1fr 1fr;gap:8px}.who button{min-height:56px;border-radius:12px;border:2px solid var(--bd);background:var(--bg);color:var(--tx);font:700 17px Outfit,system-ui,sans-serif;padding:0 8px}
.who button.on{border-color:var(--ok);background:rgba(52,199,123,.16);color:var(--ok)}
.srow{display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:14px;padding:8px}.srow span{flex:1;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srow button{width:52px;height:52px;border-radius:12px;border:0;background:var(--line);color:var(--tx);font-size:26px;font-weight:700}
.srow input{width:76px;height:56px;border-radius:12px;border:2px solid var(--bd);background:var(--pn);color:var(--tx);font:700 30px Outfit,system-ui,sans-serif;text-align:center}
.err{color:var(--amb);font-weight:700;min-height:20px}
.btns{display:flex;gap:10px}.btns button{flex:1;min-height:54px;border-radius:12px;font:700 17px Outfit,system-ui,sans-serif}
.cx{border:2px solid var(--bd);background:transparent;color:var(--tx)}.ok{border:0;background:var(--ok);color:#06210F}.ok:disabled{opacity:.4}
#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ok);color:#06210F;font-weight:700;padding:12px 18px;border-radius:12px;display:none;z-index:10}
@media (max-width:640px){.cg{grid-template-columns:1fr}.sc{font-size:40px;min-width:56px}.pc{font-size:16px;padding:6px 10px}}
@media (orientation:portrait) and (max-width:1000px){.cg{grid-template-columns:1fr}}
</style></head>
<body><main><h1>REBELS <b>BADMINTON</b> · LIVE</h1><div class="mu sub" id="sub">Loading…</div><div id="v"></div></main><div id="m"></div><div id="toast"></div>
<script>
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t2=x=>{const z=n=>String(n).padStart(2,'0'),s=Math.max(0,Math.floor(x));return z(Math.floor(s/60))+':'+z(s%60)};
const dl=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
const TYN={MD:"Men's doubles",WD:"Women's doubles",XD:'Mixed doubles'};
const cap=P=>P.deuce&&+P.pts<30?Math.max(+P.pts,Math.min(30,+P.pts+9)):+P.pts;
function sErr(a,b,P){const p=+P.pts,c=cap(P),hi=Math.max(a,b),lo=Math.min(a,b);if(hi>c)return 'Max '+c+' in a game to '+p;if(hi<p)return 'Not finished – one side must reach '+p;
 if(!P.deuce||p>=30)return lo>=p?'Only one side can reach '+p:'';if(hi===p)return lo>p-2?'At '+(p-1)+'–'+(p-1)+' deuce: win by 2':'';if(hi===c)return lo<c-2?'Above '+p+' the winner leads by exactly 2':'';return hi-lo!==2?'Above '+p+' the winner leads by exactly 2':''}
let L=null,off=0,M=null;
const T=a=>e(a.join(' & ')),chips=a=>'<div class="nms">'+a.map(n=>'<span class="pc">'+e(n)+'</span>').join('')+'</div>';
const fh=t=>'<div class="fh"><span class="fmt f'+t+'">'+t+'</span>'+TYN[t]+'</div>';
const cols=n=>n<=3?n:Math.ceil(n/2);
function onCourt(c){const now=Date.now()-off;
 return '<div class="cc"><div class="ch"><b>'+e(c.court)+'</b><span class="mu">· Points '+c.pts+'</span>'+(c.n?'<span class="mu">· Game '+c.n+'</span>':'')+'<span class="tm" data-t="'+(c.run?c.start:'')+'">'+(c.run?t2((now-c.start)/1000):t2(c.el))+'</span></div>'+fh(c.ty)+
  '<div class="ct"><i class="l1"></i><i class="l2"></i><i class="net"></i><div class="tr">'+chips(c.a)+'<span class="sc">'+c.sa+'</span></div><div class="tr">'+chips(c.b)+'<span class="sc">'+c.sb+'</span></div></div></div>'}
function upNext(c){return '<div class="cc"><div class="ch"><b>'+(c.court?e(c.court):'Next free court')+'</b>'+(c.n?'<span class="mu">· Game '+c.n+'</span>':'')+'</div>'+fh(c.ty)+
  '<div class="ut">'+chips(c.a)+'<span class="vs">VS</span>'+chips(c.b)+'</div></div>'}
function res(r){const aw=r.sc&&r.sa>r.sb,bw=r.sc&&r.sb>r.sa,A=T(r.a)+(r.sc?' ('+r.sa+')':''),B=T(r.b)+(r.sc?' ('+r.sb+')':'');
 return '<div class="rl"><span class="ln">'+e(r.court)+' · '+(aw?'<b class="w">'+A+'</b>':A)+' vs '+(bw?'<b class="w">'+B+'</b>':B)+(r.sc?'':' <span class="mu">· no score yet</span>')+'</span>'+
  (r.send?'<div class="ra"><button class="sbtn" data-a="open" data-k="'+e(r.k)+'">Send score</button></div>':r.sent?'<div class="ra"><span class="pill">Score sent · waiting for approval</span></div>':'')+'</div>'}
function fit(){document.querySelectorAll('.ln').forEach(el=>{let f=16;el.style.fontSize='';while(el.scrollWidth>el.clientWidth+1&&f>9){f-=.5;el.style.fontSize=f+'px'}})}
function draw(){const v=document.getElementById('v'),sub=document.getElementById('sub');if(!L)return;
 if(!L.live){sub.textContent='';v.innerHTML='<div class="card" style="margin-top:18px"><b>No live session</b>'+(L.next?' · next: '+e(dl(L.next.date))+' '+e(L.next.time)+' · '+e(L.next.loc):'')+'</div>';return}
 sub.innerHTML=e(dl(L.date))+' · '+e(L.time)+' · '+e(L.loc)+' · <span class="live">● '+(L.started?'LIVE':'STARTING SOON')+'</span>';
 let h='<h2>ON COURT NOW</h2>'+(L.now.length?'<div class="cg" style="--c:'+cols(L.now.length)+'">'+L.now.map(onCourt).join('')+'</div>':'<div class="card mu">No game on court right now.</div>');
 if(L.next.length)h+='<h2>UP NEXT</h2><div class="cg" style="--c:'+cols(Math.min(L.next.length,Math.max(L.courts.length,1)))+'">'+L.next.map(upNext).join('')+'</div>';
 if(L.sched.length)h+='<h2>GAME SCHEDULE</h2><div class="card" style="overflow-x:auto"><table class="sch"><thead><tr><th>#</th><th>COURT</th><th></th><th>TEAM A</th><th class="n">SCORE</th><th>TEAM B</th><th></th></tr></thead><tbody>'+L.sched.map(x=>{const aw=x.st==='done'&&x.sa>x.sb,bw=x.st==='done'&&x.sb>x.sa;return '<tr><td class="mu">'+x.n+'</td><td class="mu">'+e(x.court)+'</td><td><span class="fmt f'+x.ty+'">'+x.ty+'</span></td><td class="'+(aw?'w':'')+'">'+T(x.a)+'</td><td class="n"><b>'+(x.st==='done'?x.sa+' – '+x.sb:'')+'</b></td><td class="'+(bw?'w':'')+'">'+T(x.b)+'</td><td><span class="st '+x.st+'">'+(x.st==='done'?'Done':x.st==='now'?'On court':'Planned')+'</span></td></tr>'}).join('')+'</tbody></table></div>';
 if(L.results.length)h+='<h2>RESULTS · NEWEST FIRST</h2><div class="card">'+L.results.map(res).join('')+'</div>';
 if(L.stats.length)h+='<h2>TODAY · GAMES &amp; WINS</h2><div class="card"><table><thead><tr><th>PLAYER</th><th class="n">GAMES</th><th class="n">WINS</th></tr></thead><tbody>'+L.stats.map(s=>'<tr><td>'+e(s.name)+'</td><td class="n">'+s.g+'</td><td class="n">'+s.w+'</td></tr>').join('')+'</tbody></table></div>';
 v.innerHTML=h;fit()}
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',3000)}
/* send score: pick yourself from the 4 players, then the score */
function drawM(){const m=document.getElementById('m');const r=M&&L&&L.results.find(x=>x.k===M.k);if(!r||!r.send&&!M.busy){M=null;m.className='';m.innerHTML='';return}
 const ps=r.a.concat(r.b),row=(s,nm)=>'<div class="srow"><span>'+T(nm)+'</span><button data-a="dn" data-s="'+s+'" aria-label="Minus">−</button><input id="in'+s+'" type="number" inputmode="numeric" min="0" max="'+cap(r)+'" value="'+e(M[s])+'" aria-label="Score"><button data-a="up" data-s="'+s+'" aria-label="Plus">+</button></div>';
 m.className='on';m.innerHTML='<div class="sh"><div class="lab">SEND SCORE · '+e(r.court.toUpperCase())+' · GAME TO '+r.pts+(r.deuce?' · DEUCE':'')+'</div>'+
  '<div class="lab" style="color:var(--tx)">1 · WHO ARE YOU?</div><div class="who">'+ps.map((n,i)=>'<button data-a="who" data-i="'+i+'" class="'+(M.who===i?'on':'')+'">'+(M.who===i?'✓ ':'')+e(n)+'</button>').join('')+'</div>'+
  '<div class="lab" style="color:var(--tx)">2 · FINAL SCORE</div>'+row('sa',r.a)+row('sb',r.b)+'<div class="err" id="er">'+e(M.err)+'</div>'+
  '<div class="btns"><button class="cx" data-a="close">Cancel</button><button class="ok" data-a="send"'+(M.who<0||M.busy?' disabled':'')+'>'+(M.busy?'Sending…':'Send score')+'</button></div>'+
  '<div class="mu" style="font-size:13px">The organiser checks it on the tablet before it counts. One score per game.</div></div>'}
async function send(){const r=L.results.find(x=>x.k===M.k);if(!r)return;const sa=parseInt(M.sa,10),sb=parseInt(M.sb,10);
 M.err=M.who<0?'Pick your name':isNaN(sa)||isNaN(sb)?'Enter both scores':sErr(sa,sb,r);if(M.err)return drawM();
 M.busy=1;drawM();try{const x=await fetch('/api/live/score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:M.k,who:M.who,sa,sb})}),j=await x.json().catch(()=>({}));
  if(x.ok){M=null;drawM();toast('Score sent · waiting for approval');load();return}M.busy=0;M.err=j.error||'Not sent – try again';if(x.status===409)load()}catch(err){M.busy=0;M.err='No internet – try again'}drawM()}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-a]');if(!b){if(ev.target.id==='m'){M=null;drawM()}return}const a=b.dataset.a;
 if(a==='open'){M={k:b.dataset.k,who:-1,sa:'',sb:'',err:''};drawM()}else if(!M)return;
 else if(a==='close'){M=null;drawM()}else if(a==='who'){M.who=+b.dataset.i;M.err='';drawM()}
 else if(a==='up'||a==='dn'){const s=b.dataset.s;M[s]=String(Math.max(0,(parseInt(M[s],10)||0)+(a==='up'?1:-1)));M.err='';drawM()}else if(a==='send')send()});
document.addEventListener('input',ev=>{if(M&&/^in(sa|sb)$/.test(ev.target.id)){M[ev.target.id.slice(2)]=ev.target.value;M.err='';document.getElementById('er').textContent=''}});
async function load(){try{const r=await fetch('/api/live',{cache:'no-store'});if(r.ok){L=await r.json();off=Date.now()-(L.at||Date.now());draw();if(M&&!M.busy){const r2=L.results.find(x=>x.k===M.k);if(!r2||!r2.send){M=null;drawM()}}}}catch(x){}}
load();setInterval(load,10000);
setInterval(()=>{const now=Date.now()-off;document.querySelectorAll('[data-t]').forEach(el=>{const s=+el.dataset.t;if(s)el.textContent=t2((now-s)/1000)})},1000);
addEventListener('resize',fit);
</script></body></html>`;

/* ---------- data for each role ---------- */
function forRole(txt, role) {
  if (role !== 'games') return { data: txt };
  const o = JSON.parse(txt); FIN_KEYS.forEach(k => delete o[k]);
  return { data: JSON.stringify(o), stripped: FIN_KEYS };
}
function mergeGM(curTxt, inc) {      /* game manager upload: only game keys change; finance/settings/rules/backups stay as they are */
  const cur = curTxt ? JSON.parse(curTxt) : {}, out = Object.assign({}, cur);
  GM_KEYS.forEach(k => { if (k in inc) out[k] = inc[k]; });
  const seen = new Set((cur.audit || []).map(a => a.t + '|' + a.m));
  out.audit = (cur.audit || []).concat((inc.audit || []).filter(a => a && !seen.has(a.t + '|' + a.m))).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 300);
  return out;
}

async function liveState(env) {
  const d = await getDoc(env); let S = {}; try { S = JSON.parse(d ? d.data : '{}'); } catch (e) {}
  const subs = (await env.DB.prepare("SELECT k,st FROM subs WHERE d=? AND st IN ('p','a')").bind(dubaiDay()).all()).results;
  return { S, subs };
}
/* v18: a player sends the score of a FINISHED game (not on court) from /live. No code: the sender picks themselves from the game's 4 players.
   One score per game: pending or accepted locks it; a rejected score reopens it. Nothing changes the data until the tablet accepts it. */
async function liveScore(req, env) {
  const b = await req.json().catch(() => ({})), { S, subs } = await liveState(env), L = liveData(S, Date.now(), subs);
  if (!L.live) return J({ error: 'No live session right now' }, 409);
  const r = L.results.find(x => x.k === String(b.k || ''));
  if (!r) return J({ error: 'Game not found' }, 404);
  if (r.sc) return J({ error: 'This game already has a score' }, 409);
  if (!r.send) return J({ error: 'Score already sent · waiting for approval' }, 409);
  const who = +b.who, sa = +b.sa, sb = +b.sb;
  if (!(who >= 0 && who <= 3 && Number.isInteger(who))) return J({ error: 'Pick your name' }, 400);
  if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) return J({ error: 'Enter both scores' }, 400);
  const P = { pts: r.pts, deuce: r.deuce }, e = scoreErr(sa, sb, P);
  if (e) return J({ error: e }, 400);
  if (!gameWon(sa, sb, P)) return J({ error: 'Not a finished game – one side must reach ' + r.pts }, 400);
  const ip = await sha('ip|' + (req.headers.get('CF-Connecting-IP') || '') + '|' + dubaiDay());
  if (((await env.DB.prepare('SELECT COUNT(*) AS n FROM subs WHERE d=? AND ip=?').bind(dubaiDay(), ip).first()) || {}).n >= 30) return J({ error: 'Too many scores from this phone today' }, 429);
  const byn = r.a.concat(r.b)[who] || '';
  try { await env.DB.prepare("INSERT INTO subs(d,k,st,who,byn,sa,sb,at,ip) VALUES(?,?,'p',?,?,?,?,?,?)").bind(dubaiDay(), r.k, who, byn, sa, sb, Date.now(), ip).run(); }
  catch (x) { return J({ error: 'Score already sent · waiting for approval' }, 409); }
  return J({ ok: 1 });
}

async function api(req, env, ctx, url) {
  const path = url.pathname, m = req.method;
  if (path === '/api/live' && m === 'GET') { const { S, subs } = await liveState(env); return J(liveData(S, Date.now(), subs)); }
  if (path === '/api/live/score' && m === 'POST') return liveScore(req, env);
  if (path === '/api/ping') return J({ ok: 1 });
  if (path === '/api/login' && m === 'POST') {
    const b = await req.json().catch(() => ({})), u = normU(b.u), now = Date.now();
    const a = ACCOUNTS[u] && await env.DB.prepare('SELECT * FROM acct WHERE u=?').bind(u).first();
    if (!a || !a.h) return J({ error: 'Wrong username or password' }, 401);
    if (a.lock > now) return J({ error: 'Locked after 5 wrong tries', until: a.lock }, 429);
    if (await pbkdf2(String(b.p || ''), a.salt) !== a.h) {
      const f = (a.fails || 0) + 1, lock = f >= MAX_TRIES ? now + LOCK_MS : 0;
      await env.DB.prepare('UPDATE acct SET fails=?,lock=? WHERE u=?').bind(lock ? 0 : f, lock, u).run();
      if (lock) { await audit(env, u, 'Locked 15 min after 5 wrong passwords'); return J({ error: 'Locked after 5 wrong tries', until: lock }, 429); }
      return J({ error: 'Wrong username or password', left: MAX_TRIES - f }, 401);
    }
    const token = rand(32);
    await env.DB.batch([env.DB.prepare('UPDATE acct SET fails=0,lock=0 WHERE u=?').bind(u), env.DB.prepare('INSERT INTO tok(h,u,at) VALUES(?,?,?)').bind(await sha(token), u, now)]);
    await audit(env, u, 'Signed in');
    return J({ token, u, role: a.role, mc: !!a.mc, hasData: !!(await getDoc(env)) });
  }

  const me = await who(req, env);
  if (!me) return J({ error: 'sign in' }, 401);
  const admin = me.role === 'admin', gm = me.role === 'games', deny = () => J({ error: 'not allowed for ' + me.role }, 403);
  if (path === '/api/logout' && m === 'POST') { await env.DB.prepare('DELETE FROM tok WHERE h=?').bind(await sha(me.t)).run(); return J({ ok: 1 }); }
  if (path === '/api/me') return J({ u: me.u, role: me.role, mc: me.mc });
  if (path === '/api/password' && m === 'POST') {          /* own password: needs the old one */
    const b = await req.json().catch(() => ({})), a = await env.DB.prepare('SELECT * FROM acct WHERE u=?').bind(me.u).first();
    if (await pbkdf2(String(b.old || ''), a.salt) !== a.h) return J({ error: 'Old password is wrong' }, 403);
    if (!okPw(b.new)) return J({ error: 'New password: at least 5 characters, not 12345' }, 400);
    const salt = rand(16);
    await env.DB.batch([env.DB.prepare('UPDATE acct SET salt=?,h=?,mc=0,fails=0,lock=0 WHERE u=?').bind(salt, await pbkdf2(b.new, salt), me.u),
      env.DB.prepare('DELETE FROM tok WHERE u=? AND h<>?').bind(me.u, await sha(me.t))]);
    await audit(env, me.u, 'Changed own password');
    return J({ ok: 1 });
  }
  if (me.mc) return J({ error: 'Change the default password first', mc: 1 }, 403);

  if (path === '/api/accounts' && m === 'GET') {
    if (!admin) return deny();
    const r = await env.DB.prepare('SELECT u,role,h IS NOT NULL AS isSet,lock FROM acct ORDER BY u').all();
    return J({ list: r.results.map(x => ({ u: x.u, role: x.role, set: !!x.isSet, locked: x.lock > Date.now() ? x.lock : 0 })) });
  }
  let mm = path.match(/^\/api\/accounts\/(organizer|games)\/password$/);
  if (mm && m === 'POST') {                                  /* admin sets / resets organizer + game manager */
    if (!admin) return deny();
    const b = await req.json().catch(() => ({}));
    if (!okPw(b.new)) return J({ error: 'Password: at least 5 characters, not 12345' }, 400);
    const salt = rand(16);
    await env.DB.batch([env.DB.prepare('UPDATE acct SET salt=?,h=?,mc=0,fails=0,lock=0 WHERE u=?').bind(salt, await pbkdf2(b.new, salt), mm[1]),
      env.DB.prepare('DELETE FROM tok WHERE u=?').bind(mm[1])]);
    await audit(env, me.u, 'Set password for ' + mm[1]);
    return J({ ok: 1 });
  }
  if (path === '/api/data' && m === 'GET') {
    const d = await getDoc(env);
    return J(d ? { rev: d.rev, at: d.at, by: d.by, ...forRole(d.data, me.role) } : { rev: 0, data: null });
  }
  if (path === '/api/data' && m === 'PUT') {
    if (!admin && !gm) return deny();
    const b = await req.json().catch(() => null);
    if (!b || !b.data || !Array.isArray(b.data.players)) return J({ error: 'bad data' }, 400);
    const cur = await getDoc(env), rev = cur ? cur.rev : 0;
    if ((b.base || 0) !== rev) return J({ error: 'behind', rev }, 409);   /* stale device can never overwrite newer data */
    if (gm && !cur) return J({ error: 'admin must upload first' }, 409);
    const txt = JSON.stringify(gm ? mergeGM(cur.data, b.data) : b.data), now = Date.now();
    const r = await env.DB.prepare(cur ? 'UPDATE doc SET rev=?,data=?,at=?,by=? WHERE id=1 AND rev=?' : 'INSERT INTO doc(rev,data,at,by,id) VALUES(?,?,?,?,1)')
      .bind(...(cur ? [rev + 1, txt, now, me.u, rev] : [1, txt, now, me.u])).run();
    if (cur && !r.meta.changes) return J({ error: 'behind', rev: (await getDoc(env)).rev }, 409);
    ctx.waitUntil(snapToday(env, { rev: rev + 1, data: txt }));
    return J({ rev: rev + 1 });
  }
  mm = path.match(/^\/api\/photo\/([\w-]{1,40})$/);
  if (mm) {
    if (m === 'GET') { const img = await PH.get(env, mm[1]); return img ? J({ img }) : J({ error: 'none' }, 404); }
    if (!admin && !gm) return deny();
    if (m === 'DELETE') { await PH.del(env, mm[1]); return J({ ok: 1 }); }
    if (m === 'PUT') {
      const b = await req.json().catch(() => null);
      if (!b || !/^data:image\/(jpeg|png|webp);base64,/.test(b.img || '') || b.img.length > 1.9e6) return J({ error: 'bad photo' }, 400);
      await PH.put(env, mm[1], b.img); return J({ ok: 1 });
    }
  }
  /* v18: scores sent from the live page – the tablet (admin / game manager) reviews them */
  if (path === '/api/subs' && m === 'GET') {
    if (!admin && !gm) return deny();
    const d = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('d') || '') ? url.searchParams.get('d') : dubaiDay();
    return J({ d, list: (await env.DB.prepare("SELECT id,k,who,byn,sa,sb,at FROM subs WHERE d=? AND st='p' ORDER BY at").bind(d).all()).results });
  }
  mm = path.match(/^\/api\/subs\/(\d+)$/);
  if (mm && m === 'POST') {
    if (!admin && !gm) return deny();
    const b = await req.json().catch(() => ({})), st = b.st === 'a' ? 'a' : b.st === 'r' ? 'r' : '';
    if (!st) return J({ error: 'bad request' }, 400);
    const x = await env.DB.prepare('SELECT * FROM subs WHERE id=?').bind(+mm[1]).first();
    if (!x) return J({ error: 'not found' }, 404);
    if (x.st !== 'p') return J({ error: 'already reviewed', st: x.st }, 409);
    const sa = st === 'a' && Number.isInteger(b.sa) ? b.sa : x.sa, sb = st === 'a' && Number.isInteger(b.sb) ? b.sb : x.sb;
    await env.DB.prepare('UPDATE subs SET st=?,sa=?,sb=?,rv=?,rby=? WHERE id=? AND st=?').bind(st, sa, sb, Date.now(), me.u, x.id, 'p').run();
    await audit(env, me.u, 'Live score ' + (st === 'a' ? 'accepted' : 'rejected') + ': ' + sa + '–' + sb + ' from ' + (x.byn || '?') + ' (game ' + x.k + ')' + (st === 'a' && (sa !== x.sa || sb !== x.sb) ? ' · sent as ' + x.sa + '–' + x.sb : ''));
    return J({ ok: 1 });
  }
  if (path === '/api/snapshots' && m === 'GET') {
    if (!admin) return deny();
    return J({ list: (await env.DB.prepare('SELECT day,rev,length(data) AS size,at FROM snaps ORDER BY day DESC').all()).results });
  }
  mm = path.match(/^\/api\/snapshots\/(\d{4}-\d{2}-\d{2})\/restore$/);
  if (mm && m === 'POST') {
    if (!admin) return deny();
    const s = await env.DB.prepare('SELECT data FROM snaps WHERE day=?').bind(mm[1]).first();
    if (!s) return J({ error: 'no snapshot' }, 404);
    const cur = await getDoc(env), rev = (cur ? cur.rev : 0) + 1;
    await env.DB.prepare('INSERT INTO doc(id,rev,data,at,by) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rev=excluded.rev,data=excluded.data,at=excluded.at,by=excluded.by').bind(rev, s.data, Date.now(), me.u).run();
    await audit(env, me.u, 'Cloud restore of ' + mm[1]);
    return J({ rev });
  }
  if (path === '/api/audit' && m === 'GET') {
    if (!admin) return deny();
    return J({ list: (await env.DB.prepare('SELECT at,email AS who,m FROM audit ORDER BY id DESC LIMIT 100').all()).results });
  }
  return J({ error: 'not found' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/live' || path === '/live/') return new Response(LIVE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    if (path.startsWith('/api/')) {
      if (!env.DB) return J({ error: 'cloud not set up' }, 503);
      try { await schema(env); return await api(req, env, ctx, url); } catch (e) { return J({ error: 'server error' }, 500); }
    }
    return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
  },
  /* daily 02:00 Dubai: snapshot (kept 90 days) + clean-up */
  async scheduled(ev, env) {
    if (!env.DB) return;
    await schema(env);
    await snapToday(env, await getDoc(env));
    await prune(env);
  },
};
export { dubaiDay, liveData, mergeGM, normU, scoreErr, gameWon, hKey };
