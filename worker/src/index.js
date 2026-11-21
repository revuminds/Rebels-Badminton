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
    /* v21: score corrections from the live page (st cp = pending, ca = accepted, cr = rejected) – one pending correction per game */
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS subs_cor ON subs(d,k) WHERE st='cp'"),
    /* v19: names picked on the live page – one phone per name per session (off=1 = freed / reset); th = SHA-256 of the phone's claim token */
    db.prepare('CREATE TABLE IF NOT EXISTS claims(id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT NOT NULL, pid TEXT NOT NULL, th TEXT NOT NULL, nm TEXT, at INTEGER, ip TEXT, off INTEGER DEFAULT 0)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS claims_on ON claims(d,pid) WHERE off=0'),
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
    env.DB.prepare('DELETE FROM claims WHERE d < ?').bind(dubaiDay()),
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
function liveData(S, now = Date.now(), subs = [], mePid = null) {
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
  const lock = {}, cor = {}; (subs || []).forEach(x => { if (x.st === 'p' || x.st === 'a') lock[x.k] = x.st; else if (/^c[par]$/.test(x.st) && (!cor[x.k] || (x.at || 0) >= cor[x.k].at)) cor[x.k] = { st: x.st[1], at: x.at || 0 }; });
  const mine = q => !!mePid && Array.isArray(q) && q.includes(mePid);
  const gpts = o => +(o && o.pts) || +(g && g.pts) || 21, deuce = !!(g && g.deuce);
  const hist = g && Array.isArray(g.hist) ? g.hist : [];
  const doneN = new Set(hist.filter(h => h.n).map(h => h.n)), curN = (g && g.curN) || [];
  const now_ = (g && g.cur || []).map((q, i) => {
    if (!q || !q.every(Boolean)) return null; const L = (g.live || [])[i] || {};
    return { court: cn(i), n: curN[i] || null, ty: ty(q), a: team(q, 0), b: team(q, 1), sa: +L.sa || 0, sb: +L.sb || 0, run: !!L.run, start: L.run ? +L.start || 0 : 0, el: +L.el || 0, pts: +(L.pts || g.pts) || 21,
      me: mine(q), gk: L.run ? i + '-' + (+L.start || 0) : '' };
  }).filter(Boolean);
  const fp = g && Array.isArray(g.fp) ? g.fp : [];
  const qq = (g && g.qq) || [], up = (g && g.up) || [], nxt = (g && g.nxt) || [];
  /* v18: per court the queued / planned game first, then the app-picked Upcoming games (they have no court yet) */
  const next = [], seen = new Set(), full = q => q && q.every && q.length === 4 && q.every(Boolean), onC = new Set((g && g.cur || []).flat().filter(Boolean));
  const add = (q, n, c, nx) => { const k = q.join(); if (seen.has(k)) return; seen.add(k); next.push({ court: c == null ? '' : cn(c), n: n || null, ty: ty(q), a: team(q, 0), b: team(q, 1), me: mine(q), nx: !!nx }); };
  courts(today).forEach((c, i) => {
    let q = qq[i] && qq[i][0] && qq[i][0].q, n = qq[i] && qq[i][0] && qq[i][0].n;
    if (!full(q) && full(nxt[i])) { q = nxt[i]; n = null; }
    if (!full(q) && fp.length) { const u = up.find(x => x.c === i && full(x.q)) || fp.find(x => x.c === i && !x.x && !doneN.has(x.n) && !curN.includes(x.n) && full(x.q)); if (u) { q = u.q; n = u.n || null; } }
    if (full(q)) add(q, n, i, 1);
  });
  up.forEach(x => { if (full(x.q) && next.length < 8) add(x.q, x.n, x.c == null || !fp.length ? null : x.c); });
  const res = hist.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map(h => {
    const k = hKey(h), sc = !!(+h.sa || +h.sb), ok = !sc && Array.isArray(h.ids) && h.ids.length === 4 && h.ids.every(Boolean);
    const c4 = Array.isArray(h.ids) && h.ids.length === 4 && h.ids.every(Boolean), cs = cor[k] ? cor[k].st : null;
    return { k, court: cn((h.c || 1) - 1), n: h.n || null, ty: ty(h.ids), a: team(h.ids, 0), b: team(h.ids, 1), sa: +h.sa || 0, sb: +h.sb || 0, pts: gpts(h), deuce, sc, send: ok && !lock[k], sent: !sc && !!lock[k], me: mine(h.ids),
      fix: sc && c4 && cs !== 'p', cor: sc ? cs : null };
  });
  const st = {};
  hist.forEach(h => { if (!h.ids) return; const aw = h.sa > h.sb, tie = h.sa === h.sb; h.ids.forEach((id, i) => { if (!id || !P[id] || P[id].hidePub) return; const s = st[id] = st[id] || { name: nm(id), g: 0, w: 0 }; s.g++; if (!tie && (i < 2) === aw) s.w++; }); });
  const stats = Object.values(st).sort((a, b) => b.w - a.w || b.g - a.g || a.name.localeCompare(b.name));
  const sched = fp.filter(x => !x.x && x.q && x.q.some(Boolean)).map(x => {
    const h = hist.find(o => o.n === x.n);
    return { n: x.n, court: cn(x.c), ty: ty(x.q), a: team(x.q, 0), b: team(x.q, 1), st: h ? 'done' : curN.includes(x.n) ? 'now' : 'plan', sa: h ? +h.sa || 0 : null, sb: h ? +h.sb || 0 : null };
  });
  /* v19: names that can be picked on the live page = players on / checked in / playing today; hidden players never (they show as Guest).
     _p (the id) is replaced by a per-day hash key before anything leaves the Worker (livePublic). */
  const pk = new Set();
  Object.keys(D.on || {}).forEach(id => D.on[id] && pk.add(id)); Object.keys(D.att || {}).forEach(id => pk.add(id));
  ((g && g.ros) || []).concat(...((g && g.cur) || []), ...hist.map(h => h.ids || [])).forEach(id => id && pk.add(id));
  const pick = [...pk].filter(id => P[id] && !P[id].hidePub && String(P[id].name || '').trim()).map(id => ({ _p: id, name: String(P[id].name) })).sort((a, b) => a.name.localeCompare(b.name));
  return { live: true, date: today, time: D.time || '', loc: D.loc || '', started: !!(g && g.st), courts: courts(today).map((c, i) => cn(i)), now: now_, next, results: res, stats, sched, pick, at: now };
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
/* v21: broadcast-style red pulsing LIVE dot */
.live.on{color:#FF4D4F}.live .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF3B30;margin-right:5px;vertical-align:1px;box-shadow:0 0 0 0 rgba(255,59,48,.7);animation:lp 1.2s ease-in-out infinite}
@keyframes lp{0%{opacity:1;box-shadow:0 0 0 0 rgba(255,59,48,.65)}50%{opacity:.35;box-shadow:0 0 0 6px rgba(255,59,48,0)}100%{opacity:1;box-shadow:0 0 0 0 rgba(255,59,48,0)}}
@media (prefers-reduced-motion:reduce){.live .dot{animation:none}}
/* v21: court graphic – inline SVG stretched to fit (never taller than one screen), names in the 4 half-court boxes, score + timer on the net */
.vc{background:var(--pn);border-radius:18px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0;container-type:inline-size}
.vch{display:flex;align-items:center;gap:8px;font-size:14px;min-height:26px;padding:0 4px}.vch b{font-size:18px}
/* v22: 100svh (address bar shown) – stable while the phone scrolls; --vh = height measured once, re-measured only on rotation/width change */
.vct{position:relative;width:100%;height:min(calc(100cqw * 2.06),calc(100vh - var(--hh,150px)));height:min(calc(100cqw * 2.06),calc(var(--vh,100svh) - var(--hh,150px)));min-height:300px;border-radius:12px;overflow:hidden}
.vct svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.vbx{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:2px;min-width:0}
.vbx span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(10,30,22,.62);border-radius:10px;padding:5px 9px;font-weight:700;font-size:clamp(14px,6.2cqw,24px);line-height:1.15}
.vbx span.mine{outline:3px solid #FFD43B;color:#FFD43B}
.vnet{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.vsc{font-size:clamp(30px,13cqw,54px);font-weight:700;line-height:1;background:rgba(10,30,22,.72);border-radius:12px;padding:4px 14px;min-width:2.2em;text-align:center}
.vtm{display:flex;align-items:center;gap:6px;background:#111;border:2px solid #fff;border-radius:99px;padding:3px 12px;font-weight:700;font-size:clamp(16px,6cqw,24px);color:var(--ok)}
.vtm svg{width:1em;height:1em;position:static}
/* v21: your turn */
#turn{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:14px}#turn.on{display:flex}
#turn .tb{background:var(--pn);border:3px solid var(--ok);border-radius:22px;width:min(560px,100%);padding:22px 18px;display:flex;flex-direction:column;gap:14px;text-align:center}
#turn .tt{font-size:30px;font-weight:800}#turn .tg{font-size:20px;font-weight:700;line-height:1.3}#turn .tc{font-size:26px;font-weight:800;color:var(--ok)}
#turn button{min-height:64px;border-radius:14px;border:0;background:var(--ok);color:#06210F;font:800 22px Outfit,system-ui,sans-serif}
.al{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
.abtn{min-height:44px;padding:0 14px;border-radius:12px;border:2px solid var(--ok);background:transparent;color:var(--ok);font:700 15px Outfit,system-ui,sans-serif}
.abtn.on{background:rgba(52,199,123,.16)}.anote{font-size:12px;color:var(--mu)}
.mine-c{outline:3px solid #FFD43B;outline-offset:-3px}
.pill.ok{background:rgba(52,199,123,.14);color:var(--ok)}.pill.bad{background:rgba(229,56,59,.14);color:#FF6B6E}
.fbtn{min-height:44px;padding:0 14px;border-radius:12px;border:2px solid var(--bd);background:transparent;color:var(--tx);font:700 15px Outfit,system-ui,sans-serif}
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
.sh,.srow,.srow button,.srow input{touch-action:manipulation}
.srow button{width:60px;height:60px;min-width:48px;border-radius:14px;border:0;background:var(--line);color:var(--tx);font-size:30px;font-weight:700;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.srow button:active,.srow button.hold{background:var(--bd)}
.srow input{width:80px;height:60px;border-radius:12px;border:2px solid var(--bd);background:var(--pn);color:var(--tx);font:700 30px Outfit,system-ui,sans-serif;text-align:center}
.err{color:var(--amb);font-weight:700;min-height:20px}
.btns{display:flex;gap:10px}.btns button{flex:1;min-height:54px;border-radius:12px;font:700 17px Outfit,system-ui,sans-serif}
.cx{border:2px solid var(--bd);background:transparent;color:var(--tx)}.ok{border:0;background:var(--ok);color:#06210F}.ok:disabled{opacity:.4}
/* v19: Guest / Player */
.me{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:14px;color:var(--mu)}.me b{color:var(--tx)}
.lk{background:none;border:0;color:var(--win);font:700 14px Outfit,system-ui,sans-serif;padding:8px 4px;min-height:40px;text-decoration:underline}
.gp{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gp button{min-height:84px;border-radius:14px;border:2px solid var(--bd);background:var(--bg);color:var(--tx);font:700 19px Outfit,system-ui,sans-serif;padding:8px}.gp button small{display:block;font-weight:400;font-size:13px;color:var(--mu);margin-top:4px}
.pk{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.pk button{min-height:52px;border-radius:12px;border:2px solid var(--bd);background:var(--bg);color:var(--tx);font:700 16px Outfit,system-ui,sans-serif;padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk button:disabled{opacity:.35;text-decoration:line-through}
#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ok);color:#06210F;font-weight:700;padding:12px 18px;border-radius:12px;display:none;z-index:10}
@media (max-width:640px){.cg{grid-template-columns:1fr}.sc{font-size:40px;min-width:56px}.pc{font-size:16px;padding:6px 10px}}
@media (orientation:portrait) and (max-width:1000px){.cg{grid-template-columns:1fr}}
</style></head>
<body><main><h1>REBELS <b>BADMINTON</b> · LIVE</h1><div class="mu sub" id="sub">Loading…</div><div class="me" id="me"></div><div id="v"></div></main><div id="m"></div><div id="turn" role="alertdialog" aria-live="assertive"></div><div id="toast"></div>
<script>
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t2=x=>{const z=n=>String(n).padStart(2,'0'),s=Math.max(0,Math.floor(x));return z(Math.floor(s/60))+':'+z(s%60)};
const dl=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
const TYN={MD:"Men's doubles",WD:"Women's doubles",XD:'Mixed doubles'};
const cap=P=>P.deuce&&+P.pts<30?Math.max(+P.pts,Math.min(30,+P.pts+9)):+P.pts;
function sErr(a,b,P){const p=+P.pts,c=cap(P),hi=Math.max(a,b),lo=Math.min(a,b);if(hi>c)return 'Max '+c+' in a game to '+p;if(hi<p)return 'Not finished – one side must reach '+p;
 if(!P.deuce||p>=30)return lo>=p?'Only one side can reach '+p:'';if(hi===p)return lo>p-2?'At '+(p-1)+'–'+(p-1)+' deuce: win by 2':'';if(hi===c)return lo<c-2?'Above '+p+' the winner leads by exactly 2':'';return hi-lo!==2?'Above '+p+' the winner leads by exactly 2':''}
let L=null,off=0,M=null,ME=null;
/* v19: Guest or Player – remembered on this phone for the whole session (rb.live = {d,m:'g'|'p',t,name}) */
try{ME=JSON.parse(localStorage.getItem('rb.live')||'null')}catch(x){}
const meSave=v=>{ME=v;try{v?localStorage.setItem('rb.live',JSON.stringify(v)):localStorage.removeItem('rb.live')}catch(x){}};
const PL=()=>!!(ME&&ME.m==='p'&&ME.t);
const T=a=>e(a.join(' & ')),chips=a=>'<div class="nms">'+a.map(n=>'<span class="pc">'+e(n)+'</span>').join('')+'</div>';
const fh=t=>'<div class="fh"><span class="fmt f'+t+'">'+t+'</span>'+TYN[t]+'</div>';
const cols=n=>n<=3?n:Math.ceil(n/2);
const CRT='<svg viewBox="0 0 700 1440" preserveAspectRatio="none" aria-hidden="true"><rect width="700" height="1440" fill="#2D6FA8"/><rect x="45" y="50" width="610" height="1340" fill="#2E8B57"/>'+
 '<g fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"><rect x="45" y="50" width="610" height="1340" vector-effect="non-scaling-stroke"/>'+
 '<path vector-effect="non-scaling-stroke" d="M91 50V1390M609 50V1390M45 126H655M45 1314H655M45 522H655M45 918H655M350 50V522M350 918V1390"/></g>'+
 '<path d="M20 720H680" stroke="#111" stroke-width="5" vector-effect="non-scaling-stroke"/><path d="M20 712V728M680 712V728" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"/></svg>';
const SHU='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z" fill="#fff"/><path d="M9 18 5 3h14l-4 15z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 3v15M8.5 3l2 15M15.5 3l-2 15" stroke="#fff" stroke-width="1"/></svg>';
const nb=(n,cls)=>'<span'+(PL()&&ME.name&&n===ME.name?' class="mine"':'')+'>'+e(n)+'</span>';
/* names sit in the service boxes: Team A top (left / right), Team B bottom */
const BX=['left:6.4%;width:43.6%;top:8.8%;height:27.5%','left:50%;width:43.6%;top:8.8%;height:27.5%','left:6.4%;width:43.6%;top:63.8%;height:27.5%','left:50%;width:43.6%;top:63.8%;height:27.5%'];

function onCourt(c){const now=Date.now()-off,n=c.a.concat(c.b);
 return '<div class="vc'+(c.me&&PL()?' mine-c':'')+'"><div class="vch"><b>'+e(c.court)+'</b><span class="fmt f'+c.ty+'">'+c.ty+'</span><span class="mu">'+(c.n?'Game '+c.n+' · ':'')+'to '+c.pts+'</span></div>'+
  '<div class="vct">'+CRT+n.map((x,i)=>'<div class="vbx" style="'+BX[i]+'">'+nb(x)+'</div>').join('')+
  '<div class="vnet"><span class="vsc" aria-label="Team A score">'+c.sa+'</span><span class="vtm">'+SHU+'<span data-t="'+(c.run?c.start:'')+'">'+(c.run?t2((now-c.start)/1000):t2(c.el))+'</span></span><span class="vsc" aria-label="Team B score">'+c.sb+'</span></div></div></div>'}
function upNext(c){const mine=c.me&&PL(),on=mine&&TU.sel===sig(c);
 return '<div class="cc'+(mine?' mine-c':'')+'"><div class="ch"><b>'+(c.court?e(c.court):'Next free court')+'</b>'+(c.n?'<span class="mu">· Game '+c.n+'</span>':'')+(mine?'<span class="pill ok">Your game</span>':'')+'</div>'+fh(c.ty)+
  '<div class="ut">'+chips(c.a)+'<span class="vs">VS</span>'+chips(c.b)+'</div>'+
  (mine?'<div class="al"><button class="abtn'+(on?' on':'')+'" data-a="arm" data-s="'+e(sig(c))+'">'+(on?'🔔 Alert on':'🔔 Alert me when it starts')+'</button>'+
   (on&&'wakeLock' in navigator?'<button class="abtn'+(TU.wake?' on':'')+'" data-a="wake">'+(TU.wake?'☀ Screen stays on':'☀ Keep screen on')+'</button>':'')+'</div>'+
   (on?'<div class="anote">'+(TU.wake?'Keeping the screen on uses battery · turns off when your game starts. ':'')+'Alerts only while this page is open – a locked phone gets no alert.</div>':''):'')+'</div>'}
function res(r){const aw=r.sc&&r.sa>r.sb,bw=r.sc&&r.sb>r.sa,A=T(r.a)+(r.sc?' ('+r.sa+')':''),B=T(r.b)+(r.sc?' ('+r.sb+')':'');
 return '<div class="rl"><span class="ln">'+e(r.court)+' · '+(aw?'<b class="w">'+A+'</b>':A)+' vs '+(bw?'<b class="w">'+B+'</b>':B)+(r.sc?'':' <span class="mu">· no score yet</span>')+'</span>'+
  (r.send&&r.me&&PL()?'<div class="ra"><button class="sbtn" data-a="open" data-k="'+e(r.k)+'">Send score</button></div>':r.sent?'<div class="ra"><span class="pill">Score sent · waiting for approval</span></div>':
   r.sc&&r.me&&PL()&&(r.fix||r.cor)?'<div class="ra">'+(r.cor==='p'?'<span class="pill">Correction sent · waiting for approval</span>':r.cor==='a'?'<span class="pill ok">Correction accepted</span>':r.cor==='r'?'<span class="pill bad">Correction rejected</span>':'')+
    (r.fix?'<button class="fbtn" data-a="fix" data-k="'+e(r.k)+'">✎ Suggest correction</button>':'')+'</div>':'')+'</div>'}
function fit(){document.querySelectorAll('.ln').forEach(el=>{let f=16;el.style.fontSize='';while(el.scrollWidth>el.clientWidth+1&&f>9){f-=.5;el.style.fontSize=f+'px'}})}
function drawMe(){const el=document.getElementById('me');if(!L||!L.live||!ME){el.innerHTML='';return}
 el.innerHTML=PL()?'<span>Playing as <b>'+e(ME.name)+'</b></span>·<button class="lk" data-a="toguest">Change to guest</button>':'<span>Watching as <b>guest</b></span>·<button class="lk" data-a="choose">I’m playing – pick my name</button>'}
function draw(){const v=document.getElementById('v'),sub=document.getElementById('sub');if(!L)return;drawMe();
 if(!L.live){sub.textContent='';v.innerHTML='<div class="card" style="margin-top:18px"><b>No live session</b>'+(L.next?' · next: '+e(dl(L.next.date))+' '+e(L.next.time)+' · '+e(L.next.loc):'')+'</div>';return}
 sub.innerHTML=e(dl(L.date))+' · '+e(L.time)+' · '+e(L.loc)+' · '+(L.started?'<span class="live on"><i class="dot"></i>LIVE</span>':'<span class="live" style="color:var(--amb)">● STARTING SOON</span>');
 let h='<h2>ON COURT NOW</h2>'+(L.now.length?'<div class="cg" style="--c:'+cols(L.now.length)+'">'+L.now.map(onCourt).join('')+'</div>':'<div class="card mu">No game on court right now.</div>');
 if(L.next.length)h+='<h2>UP NEXT</h2><div class="cg" style="--c:'+cols(Math.min(L.next.length,Math.max(L.courts.length,1)))+'">'+L.next.map(upNext).join('')+'</div>';
 if(L.sched.length)h+='<h2>GAME SCHEDULE</h2><div class="card" style="overflow-x:auto"><table class="sch"><thead><tr><th>#</th><th>COURT</th><th></th><th>TEAM A</th><th class="n">SCORE</th><th>TEAM B</th><th></th></tr></thead><tbody>'+L.sched.map(x=>{const aw=x.st==='done'&&x.sa>x.sb,bw=x.st==='done'&&x.sb>x.sa;return '<tr><td class="mu">'+x.n+'</td><td class="mu">'+e(x.court)+'</td><td><span class="fmt f'+x.ty+'">'+x.ty+'</span></td><td class="'+(aw?'w':'')+'">'+T(x.a)+'</td><td class="n"><b>'+(x.st==='done'?x.sa+' – '+x.sb:'')+'</b></td><td class="'+(bw?'w':'')+'">'+T(x.b)+'</td><td><span class="st '+x.st+'">'+(x.st==='done'?'Done':x.st==='now'?'On court':'Planned')+'</span></td></tr>'}).join('')+'</tbody></table></div>';
 if(L.results.length)h+='<h2>RESULTS · NEWEST FIRST</h2><div class="card">'+L.results.map(res).join('')+'</div>';
 if(L.stats.length)h+='<h2>TODAY · GAMES &amp; WINS</h2><div class="card"><table><thead><tr><th>PLAYER</th><th class="n">GAMES</th><th class="n">WINS</th></tr></thead><tbody>'+L.stats.map(s=>'<tr><td>'+e(s.name)+'</td><td class="n">'+s.g+'</td><td class="n">'+s.w+'</td></tr>').join('')+'</tbody></table></div>';
 v.innerHTML=h;fit();hh();turnCheck()}
/* v21: one court never taller than one screen – the court gets the height left under the header */
let VW=innerWidth,VH=innerHeight;document.documentElement.style.setProperty('--vh',VH+'px');
function hh(){const c=document.querySelector('.vct');if(!c)return;const top=document.querySelector('.cg').getBoundingClientRect().top+scrollY,x=c.parentNode.offsetHeight-c.offsetHeight;document.documentElement.style.setProperty('--hh',Math.round(Math.min(top,VH*.45)+x+6)+'px')}
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',3000)}
/* chooser: Guest or Player → tap your own name (names picked on another phone are greyed out) */
function drawC(m){const P=L.pick||[];
 m.className='on';m.innerHTML='<div class="sh">'+(M.step===1?'<div class="lab" style="color:var(--tx)">WELCOME · WHO IS WATCHING?</div><div class="gp"><button data-a="guest">Guest<small>Just watching</small></button><button data-a="player">Player<small>Pick my name · send scores</small></button></div>':
  '<div class="lab" style="color:var(--tx)">TAP YOUR NAME</div>'+(P.length?'<div class="pk">'+P.map(x=>'<button data-a="pick" data-k="'+e(x.k)+'"'+(x.taken||M.busy?' disabled':'')+(x.taken?' title="Picked on another phone"':'')+'>'+e(x.name)+'</button>').join('')+'</div>':'<div class="mu">No players checked in yet.</div>')+
  '<div class="err">'+e(M.err)+'</div><div class="mu" style="font-size:13px">Greyed out = already picked on another phone. Wrong name taken? Ask the organiser to free it.</div><div class="btns"><button class="cx" data-a="guest">Watch as guest</button></div>')+'</div>'}
/* send score: sender = the picked name */
function drawM(){const m=document.getElementById('m');if(M&&M.c){if(!L||!L.live){M=null}else return drawC(m)}
 const r=M&&L&&L.results.find(x=>x.k===M.k);if(!r||!((M.fx?r.fix:r.send)&&r.me&&PL())&&!M.busy){M=null;m.className='';m.innerHTML='';return}
 const row=(s,nm)=>'<div class="srow"><span>'+T(nm)+'</span><button data-a="dn" data-s="'+s+'" aria-label="Minus">−</button><input id="in'+s+'" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" value="'+e(M[s])+'" aria-label="Score"><button data-a="up" data-s="'+s+'" aria-label="Plus">+</button></div>';
 m.className='on';m.innerHTML='<div class="sh"><div class="lab">'+(M.fx?'SUGGEST CORRECTION':'SEND SCORE')+' · '+e(r.court.toUpperCase())+' · GAME TO '+r.pts+(r.deuce?' · DEUCE':'')+'</div>'+
  '<div class="mu" id="sas">Sending as <b style="color:var(--tx)">'+e(ME.name)+'</b>'+(M.fx?' · saved now: <b style="color:var(--tx)">'+r.sa+' – '+r.sb+'</b>':'')+'</div>'+
  '<div class="lab" style="color:var(--tx)">FINAL SCORE</div>'+row('sa',r.a)+row('sb',r.b)+'<div class="err" id="er">'+e(M.err)+'</div>'+
  '<div class="btns"><button class="cx" data-a="close">Cancel</button><button class="ok" data-a="send"'+(M.busy?' disabled':'')+'>'+(M.busy?'Sending…':M.fx?'Send correction':'Send score')+'</button></div>'+
  '<div class="mu" style="font-size:13px">'+(M.fx?'The organiser checks it on the tablet · the saved score stays until accepted. One correction at a time.':'The organiser checks it on the tablet before it counts. One score per game.')+'</div></div>'}
async function post(u,b){const x=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return{s:x.status,j:await x.json().catch(()=>({}))}}
async function send(){const r=L.results.find(x=>x.k===M.k);if(!r)return;const sa=parseInt(M.sa,10),sb=parseInt(M.sb,10);
 M.err=isNaN(sa)||isNaN(sb)?'Enter both scores':sErr(sa,sb,r)||(M.fx&&sa===r.sa&&sb===r.sb?'Same as the saved score':'');if(M.err)return drawM();
 const fx=!!M.fx;M.busy=1;drawM();try{const x=await post('/api/live/score',fx?{k:M.k,t:ME.t,sa,sb,c:1}:{k:M.k,t:ME.t,sa,sb});
  if(x.s===200){M=null;drawM();toast(fx?'Correction sent · waiting for approval':'Score sent · waiting for approval');load();return}M.busy=0;M.err=x.j.error||'Not sent – try again';
  if(x.s===401){meSave(null);M=null;drawM();toast('Your name was freed – pick it again');load();return}if(x.s===409)load()}catch(err){M.busy=0;M.err='No internet – try again'}drawM()}
async function pick(k){M.busy=1;M.err='';drawM();try{const x=await post('/api/live/claim',{k,old:ME&&ME.t});M.busy=0;
  if(x.s===200){meSave({d:x.j.d,m:'p',t:x.j.t,name:x.j.name});M=null;drawM();toast('Playing as '+x.j.name);load();return}M.err=x.j.error||'Not picked – try again';load()}catch(err){M.busy=0;M.err='No internet – try again'}drawM()}
async function toGuest(){const t=ME&&ME.t;meSave({d:L.date,m:'g'});draw();if(t)try{await post('/api/live/release',{t})}catch(x){}load()}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-a]');if(!b){if(ev.target.id==='m'&&M&&!M.c){M=null;drawM()}return}const a=b.dataset.a;
 if(a==='toguest')return toGuest();if(a==='choose'){M={c:1,step:2,err:''};return drawM()}
 if(a==='arm')return arm(b.dataset.s);if(a==='wake')return wakeT();if(a==='turnok')return turnOk();
 if(a==='fix'){const r=L.results.find(x=>x.k===b.dataset.k);M={k:b.dataset.k,sa:r?String(r.sa):'',sb:r?String(r.sb):'',err:'',fx:1};return drawM()}
 if(a==='open'){M={k:b.dataset.k,sa:'',sb:'',err:''};drawM()}else if(!M)return;
 else if(a==='guest'){if(M.busy)return;M=null;drawM();toGuest()}else if(a==='player'){M.step=2;drawM()}else if(a==='pick'){if(!M.busy)pick(b.dataset.k)}
 else if(a==='close'){M=null;drawM()}
 else if(a==='send')send()});
/* v22: +/− = one step per tap, press-and-hold repeats and speeds up; value changed in place (no redraw) so the hold survives; clamped 0..max */
function stepS(s,d){const r=L&&M&&L.results.find(x=>x.k===M.k);if(!r)return;const v=Math.min(cap(r),Math.max(0,(parseInt(M[s],10)||0)+d));M[s]=String(v);M.err='';
 const i=document.getElementById('in'+s);if(i)i.value=M[s];const er=document.getElementById('er');if(er)er.textContent=''}
let HD=null;function holdEnd(){if(!HD)return;clearTimeout(HD.t);HD.b.classList.remove('hold');HD=null}
document.addEventListener('pointerdown',ev=>{const b=ev.target.closest('.srow button[data-a]');if(!b||!M||M.busy||ev.button>0)return;ev.preventDefault();holdEnd();
 const s=b.dataset.s,d=b.dataset.a==='up'?1:-1;stepS(s,d);if(navigator.vibrate)try{navigator.vibrate(8)}catch(x){}
 HD={b,n:0};b.classList.add('hold');try{b.setPointerCapture(ev.pointerId)}catch(x){}
 const tick=()=>{if(!HD)return;HD.n++;stepS(s,d);HD.t=setTimeout(tick,HD.n<5?220:HD.n<15?110:55)};HD.t=setTimeout(tick,450)});
['pointerup','pointercancel','lostpointercapture','blur'].forEach(t=>addEventListener(t,holdEnd,true));
document.addEventListener('pointerleave',ev=>{if(HD&&ev.target===HD.b)holdEnd()},true);
document.addEventListener('contextmenu',ev=>{if(ev.target.closest&&ev.target.closest('.srow button'))ev.preventDefault()});
document.addEventListener('input',ev=>{if(M&&/^in(sa|sb)$/.test(ev.target.id)){const v=ev.target.value.replace(/[^0-9]/g,'').slice(0,2);if(v!==ev.target.value)ev.target.value=v;M[ev.target.id.slice(2)]=v;M.err='';document.getElementById('er').textContent=''}});
async function load(){try{const r=await fetch('/api/live',{cache:'no-store',headers:PL()?{'X-Claim':ME.t}:{}});if(r.ok){L=await r.json();off=Date.now()-(L.at||Date.now());
 /* session over or a new session → forget the choice; name freed on the tablet → ask again */
 if(ME&&(!L.live||ME.d!==L.date)){meSave(null)}else if(PL()&&L.claimGone){meSave(null);toast('Your name was freed – pick it again')}
 draw();if(L.live&&!ME&&!M)M={c:1,step:1,err:''};if(M&&M.c)drawM();else if(M&&!M.busy){const r2=L.results.find(x=>x.k===M.k);if(!r2||!(M.fx?r2.fix:r2.send)||!r2.me){M=null;drawM()}}}}catch(x){}}

/* ===== v21: "Your turn" alert while this page is open. Tap 🔔 on your Up Next game = unlock sound, ask for notifications, keep the screen on.
   Shown once per game (rb.turn in localStorage). A locked phone / closed browser gets nothing (that needs Web Push – phase 2). ===== */
let TU={};try{TU=JSON.parse(localStorage.getItem('rb.turn')||'{}')||{}}catch(x){}
const tuSave=()=>{try{localStorage.setItem('rb.turn',JSON.stringify(TU))}catch(x){}};
const sig=c=>c.a.concat(c.b).join('|');
let AC=null,WL=null;
function beep(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();[0,.32].forEach(t=>{const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.0001,AC.currentTime+t);g.gain.exponentialRampToValueAtTime(.35,AC.currentTime+t+.02);g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+t+.25);o.start(AC.currentTime+t);o.stop(AC.currentTime+t+.27)})}catch(x){}}
async function wakeOn(){if(!TU.wake||!TU.sel||WL||!('wakeLock' in navigator)||document.visibilityState!=='visible')return;try{WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}catch(x){WL=null}}
function wakeOff(){try{WL&&WL.release()}catch(x){}WL=null}
async function arm(s){if(TU.d!==(L&&L.date))TU={d:L.date,seen:[]};
 if(TU.sel===s){TU.sel='';tuSave();wakeOff();draw();return toast('Alert off')}
 TU.sel=s;if(TU.wake==null)TU.wake=true;tuSave();
 try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();AC.resume();const b=AC.createBuffer(1,1,22050),src=AC.createBufferSource();src.buffer=b;src.connect(AC.destination);src.start(0)}catch(x){}   /* unlock sound with this tap */
 try{if('Notification' in window&&Notification.permission==='default')await Notification.requestPermission()}catch(x){}
 try{if('serviceWorker' in navigator)navigator.serviceWorker.register('/live-sw.js',{scope:'/live'}).catch(()=>{})}catch(x){}
 wakeOn();draw();toast('🔔 We’ll alert you when your game starts')}
function wakeT(){TU.wake=!TU.wake;tuSave();TU.wake?wakeOn():wakeOff();draw()}
async function notify(t,b,tag){try{if(!('Notification' in window)||Notification.permission!=='granted')return;const o={body:b,tag,renotify:true,vibrate:[300,120,300]};
 const r='serviceWorker' in navigator&&await navigator.serviceWorker.getRegistration('/live');if(r&&r.showNotification)return r.showNotification(t,o);new Notification(t,o)}catch(x){}}
function turnCheck(){if(!L||!L.live||!PL())return;if(TU.d!==L.date){TU={d:L.date,seen:[],wake:TU.wake}}TU.seen=TU.seen||[];
 const nw=Date.now()-off;(L.now||[]).forEach(x=>{if(x.me&&x.gk&&nw-x.start>15*60e3&&!TU.seen.includes(x.gk))TU.seen.push(x.gk)});   /* already playing for a while = no alert */
 const c=(L.now||[]).find(x=>x.me&&x.run&&x.gk&&!TU.seen.includes(x.gk));
 if(c){TU.seen.push(c.gk);TU.seen=TU.seen.slice(-40);TU.sel='';tuSave();wakeOff();
  const g=T(c.a)+' vs '+T(c.b);document.getElementById('turn').innerHTML='<div class="tb"><div class="tt">🏸 It’s your turn!</div><div class="tg">'+g+'</div><div class="tc">'+e(c.court)+'</div><button data-a="turnok">OK · On my way</button></div>';
  document.getElementById('turn').className='on';try{navigator.vibrate&&navigator.vibrate([400,150,400,150,400])}catch(x){}beep();
  notify('🏸 It’s your turn! · '+c.court,c.a.join(' & ')+' vs '+c.b.join(' & ')+' — '+c.court,c.gk);return}
 /* optional heads-up: your game is next on a court */
 const n=(L.next||[]).find(x=>x.me&&x.nx&&x.court);if(n){const k='n|'+n.court+'|'+sig(n);if(!TU.seen.includes(k)){TU.seen.push(k);tuSave();toast('⏭ You’re up next on '+n.court);try{navigator.vibrate&&navigator.vibrate(200)}catch(x){}}}}
function turnOk(){const t=document.getElementById('turn');t.className='';t.innerHTML=''}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){load();wakeOn()}});
load();setInterval(load,10000);
setInterval(()=>{const now=Date.now()-off;document.querySelectorAll('[data-t]').forEach(el=>{const s=+el.dataset.t;if(s)el.textContent=t2((now-s)/1000)})},1000);
/* v22: ignore height-only resizes (mobile address bar showing/hiding while scrolling) – only a width change / rotation re-measures */
function reVH(){if(innerWidth===VW)return;VW=innerWidth;VH=innerHeight;document.documentElement.style.setProperty('--vh',VH+'px');fit();hh()}
addEventListener('resize',reVH);addEventListener('orientationchange',()=>setTimeout(()=>{VW=-1;reVH()},250));
</script></body></html>`;

/* v21: tiny service worker – only so Android Chrome can show the "your turn" notification (and tap → back to /live). No caching, no push. */
const LIVE_SW = `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{const c=l.find(x=>x.url.indexOf('/live')>=0);return c?c.focus():self.clients.openWindow('/live')}))});`;
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
  const subs = (await env.DB.prepare("SELECT k,st,at FROM subs WHERE d=? AND st IN ('p','a','cp','ca','cr')").bind(dubaiDay()).all()).results;
  const claims = (await env.DB.prepare('SELECT d,pid,th,nm,at FROM claims WHERE off=0').all()).results;
  return { S, subs, claims };
}
/* v19: picked names reset when the live window closes (End session or auto-off) and on a new day */
const CLAIM_CAP = 20;
const pkey = async pid => (await sha('pk|' + dubaiDay() + '|' + pid)).slice(0, 16);
async function claimsReset(env, claims, live) {
  const today = dubaiDay();
  if (claims.some(c => c.d !== today || !live)) await env.DB.prepare('UPDATE claims SET off=1 WHERE off=0 AND (d<>? OR ?)').bind(today, live ? 0 : 1).run();
  return live ? claims.filter(c => c.d === today) : [];
}
async function myClaim(tok, claims) {
  if (!tok || typeof tok !== 'string' || tok.length > 100) return null;
  const th = await sha('claim|' + tok); return claims.find(c => c.th === th) || null;
}
/* the live data as sent to phones: pick list with hash keys (no ids), the phone's own name, results it may send */
async function livePublic(env, tok) {
  const st = await liveState(env), probe = liveData(st.S, Date.now(), st.subs);
  const claims = await claimsReset(env, st.claims, probe.live), mine = await myClaim(tok, claims);
  const L = mine ? liveData(st.S, Date.now(), st.subs, mine.pid) : probe;
  if (!L.live) return { L, claims, mine: null, S: st.S, keys: {} };
  const taken = new Set(claims.map(c => c.pid)), keys = {};
  L.pick = await Promise.all(L.pick.map(async x => { const k = await pkey(x._p); keys[k] = x._p; return { k, name: x.name, taken: taken.has(x._p) && !(mine && mine.pid === x._p) }; }));
  L.me = mine ? { name: ((st.S.players || []).find(p => p.id === mine.pid) || {}).name || mine.nm || '' } : null;
  if (tok && !mine) L.claimGone = true;
  return { L, claims, mine, S: st.S, keys };
}
async function liveClaim(req, env) {
  const b = await req.json().catch(() => ({})), { L, claims, mine, keys } = await livePublic(env, b.old);
  if (!L.live) return J({ error: 'No live session right now' }, 409);
  const x = L.pick.find(o => o.k === String(b.k || ''));
  if (!x) return J({ error: 'Name not found' }, 404);
  const pid = keys[x.k];
  if (mine && mine.pid === pid) return J({ error: 'Already playing as ' + x.name }, 409);
  if (claims.some(c => c.pid === pid)) return J({ error: x.name + ' is already picked on another phone' }, 409);
  const ip = await sha('ip|' + (req.headers.get('CF-Connecting-IP') || '') + '|' + dubaiDay());
  if (((await env.DB.prepare('SELECT COUNT(*) AS n FROM claims WHERE d=? AND ip=?').bind(dubaiDay(), ip).first()) || {}).n >= CLAIM_CAP) return J({ error: 'Too many name picks from this phone today' }, 429);
  const tok = rand(24);
  try { await env.DB.prepare('INSERT INTO claims(d,pid,th,nm,at,ip,off) VALUES(?,?,?,?,?,?,0)').bind(dubaiDay(), pid, await sha('claim|' + tok), x.name, Date.now(), ip).run(); }
  catch (e) { return J({ error: x.name + ' is already picked on another phone' }, 409); }
  if (mine) await env.DB.prepare('UPDATE claims SET off=1 WHERE th=? AND off=0').bind(mine.th).run();   /* one name per phone */
  return J({ t: tok, name: x.name, d: L.date });
}
/* v18: a player sends the score of a FINISHED game (not on court) from /live. No code: the sender picks themselves from the game's 4 players.
   One score per game: pending or accepted locks it; a rejected score reopens it. Nothing changes the data until the tablet accepts it. */
async function liveScore(req, env) {
  const b = await req.json().catch(() => ({})), { L, mine, S } = await livePublic(env, b.t);
  if (!L.live) return J({ error: 'No live session right now' }, 409);
  const r = L.results.find(x => x.k === String(b.k || '')), fix = !!b.c;
  if (!r) return J({ error: 'Game not found' }, 404);
  if (!fix && r.sc) return J({ error: 'This game already has a score' }, 409);
  if (!fix && !r.send) return J({ error: 'Score already sent · waiting for approval' }, 409);
  /* v21: correction of a score already saved on the tablet – one pending correction per game */
  if (fix && !r.sc) return J({ error: 'No score saved yet – send the score instead' }, 409);
  if (fix && !r.fix) return J({ error: 'Correction sent · waiting for approval' }, 409);
  /* v19: the sender is the phone's picked name (claim token checked on every score) and must have played in this game */
  if (!mine) return J({ error: 'Pick your name first', claim: 1 }, 401);
  const h = (((S.games || {})[L.date] || {}).hist || []).find(o => hKey(o) === r.k), who = h ? h.ids.indexOf(mine.pid) : -1, sa = +b.sa, sb = +b.sb;
  if (who < 0) return J({ error: 'Only the 4 players of this game can send its score' }, 403);
  if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) return J({ error: 'Enter both scores' }, 400);
  const P = { pts: r.pts, deuce: r.deuce }, e = scoreErr(sa, sb, P);
  if (e) return J({ error: e }, 400);
  if (fix && sa === r.sa && sb === r.sb) return J({ error: 'Same as the saved score' }, 400);
  if (!gameWon(sa, sb, P)) return J({ error: 'Not a finished game – one side must reach ' + r.pts }, 400);
  const ip = await sha('ip|' + (req.headers.get('CF-Connecting-IP') || '') + '|' + dubaiDay());
  if (((await env.DB.prepare('SELECT COUNT(*) AS n FROM subs WHERE d=? AND ip=?').bind(dubaiDay(), ip).first()) || {}).n >= 30) return J({ error: 'Too many scores from this phone today' }, 429);
  const byn = L.me.name || r.a.concat(r.b)[who] || '';
  try { await env.DB.prepare('INSERT INTO subs(d,k,st,who,byn,sa,sb,at,ip) VALUES(?,?,?,?,?,?,?,?,?)').bind(dubaiDay(), r.k, fix ? 'cp' : 'p', who, byn, sa, sb, Date.now(), ip).run(); }
  catch (x) { return J({ error: fix ? 'Correction sent · waiting for approval' : 'Score already sent · waiting for approval' }, 409); }
  return J({ ok: 1 });
}

async function api(req, env, ctx, url) {
  const path = url.pathname, m = req.method;
  if (path === '/api/live' && m === 'GET') return J((await livePublic(env, req.headers.get('X-Claim'))).L);
  if (path === '/api/live/score' && m === 'POST') return liveScore(req, env);
  if (path === '/api/live/claim' && m === 'POST') return liveClaim(req, env);
  if (path === '/api/live/release' && m === 'POST') {          /* "Change to guest" frees the phone's name */
    const b = await req.json().catch(() => ({})), { mine } = await livePublic(env, b.t);
    if (mine) await env.DB.prepare('UPDATE claims SET off=1 WHERE th=? AND off=0').bind(mine.th).run();
    return J({ ok: 1 });
  }
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
    return J({ d, list: (await env.DB.prepare("SELECT id,k,st,who,byn,sa,sb,at FROM subs WHERE d=? AND st IN ('p','cp') ORDER BY at").bind(d).all()).results });
  }
  mm = path.match(/^\/api\/subs\/(\d+)$/);
  if (mm && m === 'POST') {
    if (!admin && !gm) return deny();
    const b = await req.json().catch(() => ({})), st = b.st === 'a' ? 'a' : b.st === 'r' ? 'r' : '';
    if (!st) return J({ error: 'bad request' }, 400);
    const x = await env.DB.prepare('SELECT * FROM subs WHERE id=?').bind(+mm[1]).first();
    if (!x) return J({ error: 'not found' }, 404);
    if (x.st !== 'p' && x.st !== 'cp') return J({ error: 'already reviewed', st: x.st }, 409);
    const co = x.st === 'cp', nst = co ? 'c' + st : st;
    const sa = st === 'a' && Number.isInteger(b.sa) ? b.sa : x.sa, sb = st === 'a' && Number.isInteger(b.sb) ? b.sb : x.sb;
    await env.DB.prepare('UPDATE subs SET st=?,sa=?,sb=?,rv=?,rby=? WHERE id=? AND st=?').bind(nst, sa, sb, Date.now(), me.u, x.id, x.st).run();
    await audit(env, me.u, 'Live score ' + (co ? 'correction ' : '') + (st === 'a' ? 'accepted' : 'rejected') + ': ' + sa + '–' + sb + ' from ' + (x.byn || '?') + ' (game ' + x.k + ')' + (st === 'a' && (sa !== x.sa || sb !== x.sb) ? ' · sent as ' + x.sa + '–' + x.sb : ''));
    return J({ ok: 1 });
  }
  /* v19: names picked on the live page – admin + game manager see them and can free a wrongly picked one */
  if (path === '/api/claims' && m === 'GET') {
    if (!admin && !gm) return deny();
    const { claims, S } = await livePublic(env, null), P = {}; (S.players || []).forEach(p => P[p.id] = p);
    return J({ d: dubaiDay(), list: claims.map(c => ({ id: c.pid, name: (P[c.pid] && P[c.pid].name) || c.nm || '?', at: c.at })).sort((a, b) => a.name.localeCompare(b.name)) });
  }
  mm = path.match(/^\/api\/claims\/([\w-]{1,40})$/);
  if (mm && m === 'DELETE') {
    if (!admin && !gm) return deny();
    const c = await env.DB.prepare('SELECT nm FROM claims WHERE d=? AND pid=? AND off=0').bind(dubaiDay(), mm[1]).first();
    if (!c) return J({ error: 'not picked' }, 404);
    await env.DB.prepare('UPDATE claims SET off=1 WHERE d=? AND pid=? AND off=0').bind(dubaiDay(), mm[1]).run();
    await audit(env, me.u, 'Live page name freed: ' + (c.nm || mm[1]));
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
    if (path === '/live-sw.js') return new Response(LIVE_SW, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
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
