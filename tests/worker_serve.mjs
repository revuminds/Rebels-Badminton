/* Local sync server for the app tests: Miniflare on :8787 with the 3 accounts ready (admin password changed, organizer + games set). Prints JSON, keeps running. */
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const mf = new Miniflare({ modules: true, script: src, compatibilityDate: '2026-08-01', port: 8787, host: '127.0.0.1', d1Databases: ['DB'] });
const url = (await mf.ready).toString().replace(/\/$/, '');
const post = async (p, b, t) => (await fetch(url + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) })).json();
const a = await post('/api/login', { u: 'admin', p: '12345' });
await post('/api/password', { old: '12345', new: 'adminpw1' }, a.token);
await post('/api/accounts/games/password', { new: 'gamespw1' }, a.token);
await post('/api/accounts/organizer/password', { new: 'orgpw1' }, a.token);
console.log(JSON.stringify({ url, pw: { admin: 'adminpw1', games: 'gamespw1', organizer: 'orgpw1' } }));
