# Rebels Badminton Worker – setup (once)

One Worker = the website (the app), the sync API (`/api/*`) and the live session page (`/live`). Config: `wrangler.jsonc` in the repo root.

**Cloudflare dashboard → Workers → rebels-badminton → Settings → Build** (GitHub connected, branch `main`):
- Build command: can stay as it is (the deploy step copies the app from the repo anyway).
- Deploy command: `npx wrangler deploy` (the older `npx wrangler deploy --assets ./public --name rebels-badminton --compatibility-date 2026-11-01` also works).

On the first deploy Wrangler creates the D1 database **rebels** by itself (no ID to paste). Photos are stored in D1 (no R2 / card needed).
If the first deploy fails at "provisioning", create it once by hand: Storage & Databases → D1 → Create → name `rebels`, then redeploy.

First login: username `admin`, password `12345` → choose a new password. Then Settings → Account & passwords → set passwords for `organizer` and `games`.
The first admin login on the tablet uploads the tablet's data. Daily cloud copies at 02:00 Dubai, kept 90 days (Settings → Sync → Cloud history).

Tests (no Cloudflare account needed): `node tests/worker_test.mjs <copy-of-backup.txt>` (needs `npm i miniflare` in `tests/`).
