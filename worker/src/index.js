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

/* ---------- H4 live session: only during the session window; names, courts, scores, schedule – nothing else ---------- */
const tms = (d, hhmm) => Date.parse(d + 'T' + (/^\d\d:\d\d$/.test(hhmm || '') ? hhmm : '20:00') + ':00+04:00');
function liveData(S, now = Date.now()) {
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
  const hist = g && Array.isArray(g.hist) ? g.hist : [];
  const doneN = new Set(hist.filter(h => h.n).map(h => h.n)), curN = (g && g.curN) || [];
  const now_ = (g && g.cur || []).map((q, i) => {
    if (!q || !q.every(Boolean)) return null; const L = (g.live || [])[i] || {};
    return { court: cn(i), n: curN[i] || null, a: team(q, 0), b: team(q, 1), sa: +L.sa || 0, sb: +L.sb || 0, run: !!L.run, start: L.run ? +L.start || 0 : 0, el: +L.el || 0, pts: +(L.pts || g.pts) || 21 };
  }).filter(Boolean);
  const fp = g && Array.isArray(g.fp) ? g.fp : [];
  const qq = (g && g.qq) || [], up = (g && g.up) || [], nxt = (g && g.nxt) || [];
  const next = courts(today).map((c, i) => {
    let q = qq[i] && qq[i][0] && qq[i][0].q, n = qq[i] && qq[i][0] && qq[i][0].n;
    if (!(q && q.every(Boolean)) && nxt[i] && nxt[i].every && nxt[i].every(Boolean)) { q = nxt[i]; n = null; }
    if (!(q && q.every(Boolean))) { const u = up.find(x => x.c === i && x.q && x.q.every(Boolean)) || fp.find(x => x.c === i && !x.x && !doneN.has(x.n) && !curN.includes(x.n) && x.q.every(Boolean)); if (u) { q = u.q; n = u.n || null; } }
    return q && q.every(Boolean) ? { court: cn(i), n: n || null, a: team(q, 0), b: team(q, 1) } : null;
  }).filter(Boolean);
  const res = hist.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map(h => ({ court: cn((h.c || 1) - 1), n: h.n || null, a: team(h.ids, 0), b: team(h.ids, 1), sa: +h.sa || 0, sb: +h.sb || 0 }));
  const st = {};
  hist.forEach(h => { if (!h.ids) return; const aw = h.sa > h.sb, tie = h.sa === h.sb; h.ids.forEach((id, i) => { if (!id || !P[id] || P[id].hidePub) return; const s = st[id] = st[id] || { name: nm(id), g: 0, w: 0 }; s.g++; if (!tie && (i < 2) === aw) s.w++; }); });
  const stats = Object.values(st).sort((a, b) => b.w - a.w || b.g - a.g || a.name.localeCompare(b.name));
  const sched = fp.filter(x => !x.x && x.q && x.q.some(Boolean)).map(x => {
    const h = hist.find(o => o.n === x.n);
    return { n: x.n, court: cn(x.c), a: team(x.q, 0), b: team(x.q, 1), st: h ? 'done' : curN.includes(x.n) ? 'now' : 'plan', sa: h ? +h.sa || 0 : null, sb: h ? +h.sb || 0 : null };
  });
  return { live: true, date: today, time: D.time || '', loc: D.loc || '', started: !!(g && g.st), courts: courts(today).map((c, i) => cn(i)), now: now_, next, results: res, stats, sched, at: now };
}
const LIVE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebels Badminton · Live</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#16181D;color:#F2F3F5;font:16px/1.4 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}main{max-width:900px;margin:0 auto;padding:18px 14px 48px}
h1{font-size:26px;margin:0}h1 b{color:#E5383B}h2{font-size:13px;letter-spacing:.14em;color:#9AA0AB;margin:22px 0 8px}.mu{color:#9AA0AB}.card{background:#22252C;border-radius:14px;padding:12px 14px;margin-bottom:10px}
.cg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.ct{font-size:12px;letter-spacing:.12em;color:#9AA0AB;display:flex;justify-content:space-between}.tm{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;font-weight:600}
.sc{font-size:34px;font-weight:800;min-width:48px;text-align:right}.live{color:#34C77B;font-weight:700}.w{color:#34C77B;font-weight:700}table{width:100%;border-collapse:collapse}td,th{padding:7px 6px;border-top:1px solid #2C3038;text-align:left}th{border:0;font-size:12px;color:#9AA0AB;letter-spacing:.08em}
.n{text-align:right}.pill{font-size:11px;padding:2px 8px;border-radius:99px;background:#2C3038;color:#9AA0AB}.pill.now{background:#34C77B;color:#0B1A12}.pill.done{background:#3A404C;color:#F2F3F5}</style></head>
<body><main><h1>REBELS <b>BADMINTON</b> · LIVE</h1><div class="mu" id="sub">Loading…</div><div id="v"></div></main>
<script>
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t2=x=>{const z=n=>String(n).padStart(2,'0'),s=Math.max(0,Math.floor(x));return z(Math.floor(s/60))+':'+z(s%60)};
const dl=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
let L=null,off=0;
function draw(){const v=document.getElementById('v'),sub=document.getElementById('sub');if(!L)return;
 if(!L.live){sub.textContent='';v.innerHTML='<div class="card" style="margin-top:18px"><b>No live session</b>'+(L.next?' · next: '+e(dl(L.next.date))+' '+e(L.next.time)+' · '+e(L.next.loc):'')+'</div>';return}
 sub.innerHTML=e(dl(L.date))+' · '+e(L.time)+' · '+e(L.loc)+' · <span class="live">● '+(L.started?'LIVE':'STARTING SOON')+'</span>';
 const T=a=>e(a.join(' & ')),now=Date.now()-off;let h='';
 h+='<h2>ON COURT NOW</h2>'+(L.now.length?'<div class="cg">'+L.now.map(c=>'<div class="card"><div class="ct"><span>'+e(c.court)+(c.n?' · GAME '+c.n:'')+' · TO '+c.pts+'</span><span class="live">'+(c.run?t2((now-c.start)/1000):t2(c.el))+'</span></div><div class="tm"><span>'+T(c.a)+'</span><span class="sc">'+c.sa+'</span></div><div class="tm"><span>'+T(c.b)+'</span><span class="sc">'+c.sb+'</span></div></div>').join('')+'</div>':'<div class="card mu">No game on court right now.</div>');
 if(L.next.length)h+='<h2>UP NEXT</h2><div class="cg">'+L.next.map(c=>'<div class="card"><div class="ct"><span>'+e(c.court)+(c.n?' · GAME '+c.n:'')+'</span></div><div class="tm"><span>'+T(c.a)+'</span><span class="mu">vs</span><span>'+T(c.b)+'</span></div></div>').join('')+'</div>';
 if(L.sched.length)h+='<h2>GAME SCHEDULE</h2><div class="card"><table><thead><tr><th>#</th><th>COURT</th><th>TEAM A</th><th class="n">SCORE</th><th>TEAM B</th><th></th></tr></thead><tbody>'+L.sched.map(x=>{const aw=x.st==='done'&&x.sa>x.sb,bw=x.st==='done'&&x.sb>x.sa;return '<tr><td class="mu">'+x.n+'</td><td class="mu">'+e(x.court)+'</td><td class="'+(aw?'w':'')+'">'+T(x.a)+'</td><td class="n"><b>'+(x.st==='done'?x.sa+' – '+x.sb:'')+'</b></td><td class="'+(bw?'w':'')+'">'+T(x.b)+'</td><td><span class="pill '+x.st+'">'+(x.st==='done'?'Done':x.st==='now'?'On court':'Planned')+'</span></td></tr>'}).join('')+'</tbody></table></div>';
 if(L.stats.length)h+='<h2>TODAY · GAMES &amp; WINS</h2><div class="card"><table><thead><tr><th>PLAYER</th><th class="n">GAMES</th><th class="n">WINS</th></tr></thead><tbody>'+L.stats.map(s=>'<tr><td>'+e(s.name)+'</td><td class="n">'+s.g+'</td><td class="n">'+s.w+'</td></tr>').join('')+'</tbody></table></div>';
 if(L.results.length)h+='<h2>RESULTS</h2><div class="card"><table><tbody>'+L.results.map(r=>'<tr><td class="mu">'+e(r.court)+'</td><td class="'+(r.sa>r.sb?'w':'')+'">'+T(r.a)+'</td><td class="n"><b>'+r.sa+' – '+r.sb+'</b></td><td class="'+(r.sb>r.sa?'w':'')+'">'+T(r.b)+'</td></tr>').join('')+'</tbody></table></div>';
 v.innerHTML=h}
async function load(){try{const r=await fetch('/api/live',{cache:'no-store'});if(r.ok){L=await r.json();off=Date.now()-(L.at||Date.now());draw()}}catch(x){}}
load();setInterval(load,10000);setInterval(()=>{if(L&&L.live&&L.now.some(c=>c.run))draw()},1000);
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

async function api(req, env, ctx, url) {
  const path = url.pathname, m = req.method;
  if (path === '/api/live' && m === 'GET') { const d = await getDoc(env); let S = {}; try { S = JSON.parse(d ? d.data : '{}'); } catch (e) {} return J(liveData(S)); }
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
export { dubaiDay, liveData, mergeGM, normU };
