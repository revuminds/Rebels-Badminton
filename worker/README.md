# Rebels sync – Cloudflare setup (free tier, ~10 min, once)

The app works fully offline without this. Sync adds: upload after every save, 2 read-only organizer viewers, daily cloud copies (90 days), photos in R2, and a public club page.

1. **Install** (laptop): `npm i -g wrangler` then `wrangler login`.
2. **Database + photos:** `wrangler d1 create rebels` → paste the `database_id` into `wrangler.toml`. `wrangler r2 bucket create rebels-photos`.
3. **Emails:** in `wrangler.toml` set `ADMIN_EMAIL` (you) and `VIEWER_EMAILS` (the 2 organizers, comma separated).
4. **Build the app** (so `/app` serves it): `python3 tools/build.py` from the repo root.
5. **Deploy:** `cd worker && wrangler deploy`. Note the address, e.g. `https://rebels-sync.<you>.workers.dev`.
6. **Cloudflare Access** (Zero Trust → Access → Applications → Add → Self-hosted):
   - Domain: the worker address, **path `/link` only** (the public page and the app's API must stay outside Access).
   - Policy: Allow → Emails → your email + the 2 organizers. Login method: One-time PIN.
   - Copy the application **AUD tag** into `ACCESS_AUD` and your team domain (`<team>.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN`, then `wrangler deploy` again.
7. **In the app:** Settings → Sync & Account → paste the address → Sign in → approve in the browser page that opens (email code). Admin first sign-in uploads the tablet's data.

Public page: the worker address itself (`/`). Same app on any device: `<address>/app`.
Tests (no Cloudflare account needed): `node tests/worker_test.mjs <backup.txt>` (needs `npm i miniflare` in `tests/`).
