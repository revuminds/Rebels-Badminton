/* Local sync server for the app tests: Miniflare on :8787, prints admin + viewer tokens as JSON, then keeps running. */
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const mf = new Miniflare({ modules: true, script: src, compatibilityDate: '2025-09-01', port: 8787, host: '127.0.0.1', d1Databases: ['DB'], r2Buckets: ['PHOTOS'],
  bindings: { ADMIN_EMAIL: 'admin@rebels.test', VIEWER_EMAILS: 'v1@rebels.test', DEV_TRUST_HEADER: '1' } });
const url = (await mf.ready).toString().replace(/\/$/, '');
async function tok(email) {
  const s = await (await fetch(url + '/api/link/start', { method: 'POST' })).json();
  await fetch(url + '/link', { method: 'POST', headers: { 'X-Dev-Email': email, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'c=' + s.code });
  return (await (await fetch(url + '/api/link/poll', { method: 'POST', body: JSON.stringify({ poll: s.poll }) })).json()).token;
}
console.log(JSON.stringify({ url, admin: await tok('admin@rebels.test'), admin2: await tok('admin@rebels.test'), viewer: await tok('v1@rebels.test') }));
