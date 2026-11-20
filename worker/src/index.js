/* Rebels Badminton sync Worker (v17 spec A + F)
   D1 = data (one document + daily snapshots kept 90 days) · R2 = player photos · Cloudflare Access (email one-time code) protects /link only.
   Roles by email (env): ADMIN_EMAIL = edit; VIEWER_EMAILS (comma list) = read-only. Enforced here on every request. */
const DAY = 864e5, KEEP_DAYS = 90, LINK_MS = 10 * 60e3;
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...CORS, ...h } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' };
const dubaiDay = (t = Date.now()) => new Date(t + 4 * 3600e3).toISOString().slice(0, 10);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async t => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lc = s => String(s || '').trim().toLowerCase();

function roleOf(env, email) {
  email = lc(email);
  if (!email) return '';
  if (email === lc(env.ADMIN_EMAIL)) return 'admin';
  return String(env.VIEWER_EMAILS || '').split(',').map(lc).filter(Boolean).includes(email) ? 'viewer' : '';
}

let schemaOK = false;
async function schema(db) {
  if (schemaOK) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS doc(id INTEGER PRIMARY KEY CHECK(id=1), rev INTEGER NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, by TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS snaps(day TEXT PRIMARY KEY, rev INTEGER, data TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tokens(h TEXT PRIMARY KEY, email TEXT NOT NULL, at INTEGER NOT NULL, used INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS links(poll TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, at INTEGER NOT NULL, email TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, email TEXT, m TEXT)'),
  ]);
  schemaOK = true;
}
const audit = (env, email, m) => env.DB.prepare('INSERT INTO audit(at,email,m) VALUES(?,?,?)').bind(Date.now(), email || '', m).run();

/* ---------- Cloudflare Access JWT (RS256) ---------- */
let certs = null, certsAt = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function accessEmail(req, env) {
  if (env.DEV_TRUST_HEADER === '1') return req.headers.get('X-Dev-Email') || '';   /* local tests only – never set in production */
  const jwt = req.headers.get('Cf-Access-Jwt-Assertion') || (req.headers.get('Cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1];
  if (!jwt || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return '';
  try {
    const [h, p, s] = jwt.split('.'), hd = JSON.parse(new TextDecoder().decode(b64u(h))), pl = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (!certs || Date.now() - certsAt > 3600e3) { certs = (await (await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)).json()).keys; certsAt = Date.now(); }
    const jwk = certs.find(k => k.kid === hd.kid);
    if (!jwk) return '';
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p));
    const aud = Array.isArray(pl.aud) ? pl.aud : [pl.aud];
    if (!ok || !aud.includes(env.ACCESS_AUD) || pl.exp * 1000 < Date.now()) return '';
    return pl.email || '';
  } catch (e) { return ''; }
}
async function who(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  const row = await env.DB.prepare('SELECT email FROM tokens WHERE h=?').bind(await sha(t)).first();
  if (!row) return null;
  const role = roleOf(env, row.email);
  return role ? { email: row.email, role, t } : null;
}
const getDoc = env => env.DB.prepare('SELECT rev,data,at,by FROM doc WHERE id=1').first();
async function snapToday(env, doc) {
  if (!doc) return;
  await env.DB.prepare('INSERT OR IGNORE INTO snaps(day,rev,data,at) VALUES(?,?,?,?)').bind(dubaiDay(), doc.rev, doc.data, Date.now()).run();
}
async function prune(env) {
  const cut = dubaiDay(Date.now() - KEEP_DAYS * DAY);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM snaps WHERE day < ?').bind(cut),
    env.DB.prepare('DELETE FROM links WHERE at < ?').bind(Date.now() - LINK_MS),
    env.DB.prepare('DELETE FROM audit WHERE at < ?').bind(Date.now() - 365 * DAY),
  ]);
}

/* ---------- pages ---------- */
const PAGE = (title, body) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#16181D;color:#F2F3F5;font:16px/1.45 system-ui,sans-serif}main{max-width:860px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:28px;margin:0 0 4px}h1 b{color:#E5383B}h2{font-size:15px;letter-spacing:.12em;color:#9AA0AB;margin:28px 0 8px}.card{background:#22252C;border-radius:14px;padding:14px 16px}
table{width:100%;border-collapse:collapse}th{text-align:left;color:#9AA0AB;font-size:12px;letter-spacing:.08em;padding:6px 8px}td{padding:8px;border-top:1px solid #2C3038}.n{text-align:right;font-variant-numeric:tabular-nums}
.w{color:#34C77B;font-weight:700}.mu{color:#9AA0AB}button{height:48px;padding:0 24px;border:0;border-radius:12px;background:#E5383B;color:#fff;font-weight:700;font-size:17px}</style></head><body><main>${body}</main></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });

/* PUBLIC club page: player stats only – no finance, phones or photos. Players can be hidden (p.hidePub). */
function publicPage(doc) {
  let S = {}; try { S = JSON.parse(doc ? doc.data : '{}') || {}; } catch (e) {}
  const P = {}; (S.players || []).forEach(p => P[p.id] = p);
  const show = id => P[id] && !P[id].hidePub, nm = id => show(id) ? esc(P[id].name) : 'Guest';
  const st = {}, games = S.games || {}, days = S.days || {};
  Object.values(games).forEach(g => (g.hist || []).forEach(h => {
    if (!h.ids) return; const aw = h.sa > h.sb, tie = h.sa === h.sb;
    h.ids.forEach((id, i) => { if (!show(id)) return; const s = st[id] = st[id] || { g: 0, w: 0 }; s.g++; if (!tie && (i < 2) === aw) s.w++; });
  }));
  const lb = Object.keys(st).map(id => ({ id, ...st[id], p: st[id].g ? st[id].w / st[id].g : 0 })).sort((a, b) => b.w - a.w || b.p - a.p || b.g - a.g).slice(0, 40);
  const played = Object.keys(games).filter(d => (games[d].hist || []).length).sort(), last = played[played.length - 1];
  const today = dubaiDay(), up = Object.keys(days).filter(d => d >= today && days[d].sch && !days[d].x && !(games[d] && games[d].en)).sort()[0];
  const dl = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const team = (h, k) => h.ids.slice(k * 2, k * 2 + 2).map(nm).join(' &amp; ');
  const lastH = last ? (games[last].hist || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0) || a.at - b.at) : [];
  return PAGE('Rebels Badminton', `<h1>REBELS <b>BADMINTON</b></h1><div class="mu">Club page · player stats only</div>
<h2>UPCOMING SESSION</h2><div class="card">${up ? `<b>${esc(dl(up))}</b> · ${esc(days[up].time || '')} · ${esc(days[up].loc || '')}` : '<span class="mu">Nothing scheduled yet.</span>'}</div>
<h2>LEADERBOARD</h2><div class="card">${lb.length ? `<table><thead><tr><th>#</th><th>PLAYER</th><th class="n">GAMES</th><th class="n">WINS</th><th class="n">WIN %</th></tr></thead><tbody>${lb.map((x, i) => `<tr><td class="mu">${i + 1}</td><td>${nm(x.id)}</td><td class="n">${x.g}</td><td class="n">${x.w}</td><td class="n">${Math.round(x.p * 100)}%</td></tr>`).join('')}</tbody></table>` : '<span class="mu">No games yet.</span>'}</div>
<h2>LAST SESSION${last ? ' · ' + esc(dl(last).toUpperCase()) : ''}</h2><div class="card">${lastH.length ? `<table><tbody>${lastH.map(h => { const aw = h.sa > h.sb, tie = h.sa === h.sb; return `<tr><td class="${!tie && aw ? 'w' : ''}">${team(h, 0)}</td><td class="n"><b>${h.sa} – ${h.sb}</b></td><td class="${!tie && !aw ? 'w' : ''}">${team(h, 1)}</td></tr>`; }).join('')}</tbody></table>` : '<span class="mu">No results yet.</span>'}</div>`);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname, m = req.method;
    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    await schema(env.DB);
    try {
      if (path === '/' && m === 'GET') return publicPage(await getDoc(env));
      if (path === '/app' || path.startsWith('/app/')) return env.ASSETS ? env.ASSETS.fetch(new Request(new URL('/RebelsBadminton.html', url), { headers: req.headers })) : new Response('Not found', { status: 404 });

      /* device link: the app shows a code; this page (behind Cloudflare Access) approves it */
      if (path === '/link') {
        const email = await accessEmail(req, env), role = roleOf(env, email), code = String(url.searchParams.get('c') || (m === 'POST' ? (await req.formData()).get('c') : '') || '').toUpperCase().slice(0, 12);
        if (!email) return PAGE('Sign in', '<h1>Sign-in needed</h1><p class="mu">This page must be opened through Cloudflare Access (email one-time code).</p>');
        if (!role) return PAGE('Not allowed', `<h1>Not allowed</h1><p>${esc(email)} is not on the Rebels Badminton list.</p>`);
        const row = await env.DB.prepare('SELECT poll,at,email FROM links WHERE code=?').bind(code).first();
        if (!row || Date.now() - row.at > LINK_MS) return PAGE('Expired', '<h1>Code expired</h1><p class="mu">Start Sign in again in the app.</p>');
        if (m === 'POST') {
          await env.DB.prepare('UPDATE links SET email=? WHERE code=?').bind(email, code).run();
          return PAGE('Approved', `<h1>Approved ✓</h1><p>Signed in as <b>${esc(email)}</b> (${role}). Go back to the app – it continues by itself.</p>`);
        }
        return PAGE('Approve device', `<h1>Approve this device?</h1><p>Code <b>${esc(code)}</b> · ${esc(email)} · <b>${role === 'admin' ? 'ADMIN (can edit)' : 'VIEWER (read-only)'}</b></p><form method="post"><input type="hidden" name="c" value="${esc(code)}"><button>Approve</button></form>`);
      }
      if (!path.startsWith('/api/')) return new Response('Not found', { status: 404 });

      if (path === '/api/link/start' && m === 'POST') {
        const code = rand(3).toUpperCase(), poll = rand(24);
        await env.DB.prepare('INSERT INTO links(poll,code,at) VALUES(?,?,?)').bind(poll, code, Date.now()).run();
        return J({ code, poll });
      }
      if (path === '/api/link/poll' && m === 'POST') {
        const { poll } = await req.json().catch(() => ({}));
        const row = poll && await env.DB.prepare('SELECT code,at,email FROM links WHERE poll=?').bind(String(poll)).first();
        if (!row || Date.now() - row.at > LINK_MS) return J({ error: 'expired' }, 410);
        if (!row.email) return J({ status: 'pending' });
        const role = roleOf(env, row.email);
        await env.DB.prepare('DELETE FROM links WHERE poll=?').bind(String(poll)).run();
        if (!role) return J({ error: row.email + ' is not allowed' }, 403);
        const token = rand(32);
        await env.DB.prepare('INSERT INTO tokens(h,email,at,used) VALUES(?,?,?,?)').bind(await sha(token), lc(row.email), Date.now(), Date.now()).run();
        await audit(env, row.email, 'Device signed in (' + role + ')');
        return J({ token, email: lc(row.email), role, hasData: !!(await getDoc(env)) });
      }

      const u = await who(req, env);
      if (!u) return J({ error: 'sign in' }, 401);
      const admin = u.role === 'admin', deny = () => J({ error: 'admin only' }, 403);

      if (path === '/api/logout' && m === 'POST') { await env.DB.prepare('DELETE FROM tokens WHERE h=?').bind(await sha(u.t)).run(); return J({ ok: 1 }); }
      if (path === '/api/me') return J({ email: u.email, role: u.role });
      if (path === '/api/data' && m === 'GET') {
        const d = await getDoc(env);
        return J(d ? { rev: d.rev, data: d.data, at: d.at, by: d.by } : { rev: 0, data: null });
      }
      if (path === '/api/data' && m === 'PUT') {
        if (!admin) return deny();
        const b = await req.json().catch(() => null);
        if (!b || !b.data || !Array.isArray(b.data.players)) return J({ error: 'bad data' }, 400);
        const cur = await getDoc(env), rev = cur ? cur.rev : 0;
        if ((b.base || 0) !== rev) return J({ error: 'behind', rev }, 409);   /* stale device can never overwrite newer data */
        const txt = JSON.stringify(b.data), now = Date.now();
        const r = await env.DB.prepare(cur ? 'UPDATE doc SET rev=?,data=?,at=?,by=? WHERE id=1 AND rev=?' : 'INSERT INTO doc(rev,data,at,by,id) VALUES(?,?,?,?,1)')
          .bind(...(cur ? [rev + 1, txt, now, u.email, rev] : [1, txt, now, u.email])).run();
        if (cur && !r.meta.changes) return J({ error: 'behind', rev: (await getDoc(env)).rev }, 409);
        ctx.waitUntil(snapToday(env, { rev: rev + 1, data: txt }));
        return J({ rev: rev + 1 });
      }
      let mm = path.match(/^\/api\/photo\/([\w-]{1,40})$/);
      if (mm) {
        const key = 'photo/' + mm[1];
        if (m === 'GET') { const o = await env.PHOTOS.get(key); return o ? J({ img: await o.text() }) : J({ error: 'none' }, 404); }
        if (!admin) return deny();
        if (m === 'DELETE') { await env.PHOTOS.delete(key); return J({ ok: 1 }); }
        if (m === 'PUT') {
          const b = await req.json().catch(() => null);
          if (!b || !/^data:image\/(jpeg|png|webp);base64,/.test(b.img || '') || b.img.length > 3e6) return J({ error: 'bad photo' }, 400);
          await env.PHOTOS.put(key, b.img, { httpMetadata: { contentType: 'text/plain' } }); return J({ ok: 1 });
        }
      }
      if (path === '/api/snapshots' && m === 'GET') {
        if (!admin) return deny();
        const r = await env.DB.prepare('SELECT day,rev,length(data) AS size,at FROM snaps ORDER BY day DESC').all();
        return J({ list: r.results });
      }
      mm = path.match(/^\/api\/snapshots\/(\d{4}-\d{2}-\d{2})\/restore$/);
      if (mm && m === 'POST') {
        if (!admin) return deny();
        const s = await env.DB.prepare('SELECT data FROM snaps WHERE day=?').bind(mm[1]).first();
        if (!s) return J({ error: 'no snapshot' }, 404);
        const cur = await getDoc(env), rev = (cur ? cur.rev : 0) + 1;
        await env.DB.prepare('INSERT INTO doc(id,rev,data,at,by) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rev=excluded.rev,data=excluded.data,at=excluded.at,by=excluded.by').bind(rev, s.data, Date.now(), u.email).run();
        await audit(env, u.email, 'Cloud restore of ' + mm[1]);
        return J({ rev });
      }
      if (path === '/api/audit' && m === 'GET') {
        if (!admin) return deny();
        return J({ list: (await env.DB.prepare('SELECT at,email,m FROM audit ORDER BY id DESC LIMIT 100').all()).results });
      }
      return J({ error: 'not found' }, 404);
    } catch (e) { return J({ error: 'server error' }, 500); }
  },
  /* daily: snapshot (kept 90 days) + clean-up */
  async scheduled(ev, env, ctx) {
    await schema(env.DB);
    await snapToday(env, await getDoc(env));
    await prune(env);
  },
};
export { roleOf, dubaiDay, publicPage };
