/* Sync Worker tests against a local Miniflare (D1 + R2 in memory). Run: node tests/worker_test.mjs */
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const mf = new Miniflare({ modules: true, script: src, compatibilityDate: '2025-09-01', d1Databases: ['DB'], r2Buckets: ['PHOTOS'],
  bindings: { ADMIN_EMAIL: 'admin@rebels.test', VIEWER_EMAILS: 'v1@rebels.test, v2@rebels.test', DEV_TRUST_HEADER: '1' } });
const B = 'http://sync.test';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const call = async (m, p, body, tok, h = {}) => { const r = await mf.dispatchFetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: body == null ? undefined : JSON.stringify(body) }); let j = null; const t = await r.text(); try { j = JSON.parse(t) } catch (e) { j = t } return { s: r.status, j }; };
async function login(email) {
  const s = await call('POST', '/api/link/start', {});
  const pend = await call('POST', '/api/link/poll', { poll: s.j.poll });
  const r = await mf.dispatchFetch(B + '/link', { method: 'POST', headers: { 'X-Dev-Email': email, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'c=' + s.j.code });
  const html = await r.text();
  const p = await call('POST', '/api/link/poll', { poll: s.j.poll });
  return { pend: pend.j.status, html, ...p };
}
const real = JSON.parse(readFileSync(process.argv[2] || '/home/claude/testdata/real.txt', 'utf8'));
const data = JSON.parse(JSON.stringify(real)); data.players.forEach(p => { p.ph = '+971500000000'; }); data.players[0].hidePub = 1;

const a = await login('admin@rebels.test'); ok(a.pend === 'pending' && a.s === 200 && a.j.role === 'admin', 'admin device link (pending → approved → token)');
const v = await login('v1@rebels.test'); ok(v.j.role === 'viewer', 'viewer device link');
const x = await login('stranger@x.test'); ok(x.s === 403 || /Not allowed/.test(x.html), 'unknown email refused');
ok((await call('GET', '/api/data')).s === 401, 'no token → 401');
let r = await call('PUT', '/api/data', { base: 0, data }, a.j.token); ok(r.s === 200 && r.j.rev === 1, 'admin first upload → rev 1');
r = await call('PUT', '/api/data', { base: 0, data }, a.j.token); ok(r.s === 409 && r.j.rev === 1, 'stale device (base 0 < rev 1) blocked with 409');
r = await call('PUT', '/api/data', { base: 1, data }, a.j.token); ok(r.s === 200 && r.j.rev === 2, 'up-to-date device uploads → rev 2');
r = await call('PUT', '/api/data', { base: 2, data }, v.j.token); ok(r.s === 403, 'viewer cannot edit (403)');
r = await call('GET', '/api/data', null, v.j.token); ok(r.s === 200 && r.j.rev === 2 && JSON.parse(r.j.data).fin, 'viewer reads everything incl. finance');
const fin1 = JSON.stringify(real.fin), back = JSON.parse(r.j.data); ok(JSON.stringify(back.fin) === fin1, 'finance identical after round trip');
r = await call('GET', '/api/snapshots', null, v.j.token); ok(r.s === 403, 'viewer cannot list snapshots (403)');
r = await call('POST', '/api/snapshots/2026-01-01/restore', {}, v.j.token); ok(r.s === 403, 'viewer cannot restore (403)');
r = await call('PUT', '/api/photo/p1', { img: 'data:image/jpeg;base64,AAAA', h: 'x' }, v.j.token); ok(r.s === 403, 'viewer cannot upload photos (403)');
r = await call('PUT', '/api/photo/p1', { img: 'data:image/jpeg;base64,AAAA', h: 'x' }, a.j.token); ok(r.s === 200, 'admin photo → R2');
r = await call('GET', '/api/photo/p1', null, v.j.token); ok(r.j.img === 'data:image/jpeg;base64,AAAA', 'viewer sees photo');
await new Promise(res => setTimeout(res, 300));
r = await call('GET', '/api/snapshots', null, a.j.token); ok(r.s === 200 && r.j.list.length === 1, 'daily snapshot taken on upload');
/* 90-day pruning: plant old snapshots, run cron */
const db = await mf.getD1Database('DB');
const old = new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10), mid = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
await db.prepare('INSERT INTO snaps(day,rev,data,at) VALUES(?,?,?,?),(?,?,?,?)').bind(old, 1, '{"v":4,"players":[]}', 0, mid, 1, JSON.stringify(data), 0).run();
await (await mf.getWorker()).scheduled({ cron: '0 22 * * *' });
r = await call('GET', '/api/snapshots', null, a.j.token); ok(!r.j.list.some(s => s.day === old) && r.j.list.some(s => s.day === mid), '90-day pruning (100-day-old copy deleted, 30-day kept)');
r = await call('POST', '/api/snapshots/' + mid + '/restore', {}, a.j.token); ok(r.s === 200 && r.j.rev === 3, 'admin cloud restore → new rev');
/* public page */
const pub = await mf.dispatchFetch(B + '/'); const html = await pub.text();
ok(pub.status === 200 && /LEADERBOARD/.test(html), 'public page served without login');
ok(!/AED|fee|paid|court":|\+971|data:image|8804/i.test(html), 'public page: no finance / phones / photos / PIN');
ok(!html.includes(real.players[0].name + '<'), 'public page: hidden player not shown by name');
ok(/Tej/.test(html), 'public page: leaderboard names present');
r = await call('POST', '/api/logout', {}, v.j.token); ok((await call('GET', '/api/data', null, v.j.token)).s === 401, 'sign out revokes token');
const o = await mf.dispatchFetch(B + '/api/data', { method: 'OPTIONS' }); ok(o.status === 204 && o.headers.get('access-control-allow-origin') === '*', 'CORS preflight (app from file:// / any origin)');
console.log(`\n${pass} passed, ${fail} failed`); await mf.dispose(); process.exit(fail ? 1 : 0);
