# Rebels Badminton

Offline club manager for an 11" Android tablet (landscape). One HTML file (`web/app.html`, fonts + logo embedded by `tools/build.py`) inside a small Android WebView app. Data is saved on the tablet (localStorage + a copy in app storage) on every tap; Settings (gear) has backup export/import, PIN change and session defaults. Finance → Export PDF uses Android "Save as PDF".

## Getting the APK
Every push to `main` builds a signed APK: **Releases → Build N → rebels-badminton-2.0.N.apk**. Install it over the old app; never uninstall (that deletes the data).

## Signing key (permanent)
- `signing/rebels-release.keystore.enc` is the key, AES-256 encrypted with the password in secret **REBELSBADMINTON**.
- `signing/fingerprint.txt` is checked against every APK.
- Package id `com.rebels.badminton` and the key must never change; versionCode = run number, so it always increases.
- Keep the backup zip + password offline. Losing them means updates can no longer install over the app.

## Laptop
`dist/RebelsBadminton.html` (also attached to each release) runs in any browser, offline.

## Logins, cloud sync & live link (v17)
One Cloudflare Worker (`wrangler.jsonc` + `worker/`) serves the website, the sync API and `/live`: https://rebels-badminton.revuminds.workers.dev. Every push to `main` redeploys it (the build step copies `dist/RebelsBadminton.html`). Setup notes: `worker/README.md`.
- Every app open asks who is using it: **admin** (everything; first password 12345, must be changed), **organizer** (sees everything incl. Finance, changes nothing), **games** = game manager (sessions, players, check-in, games, scores, print). Admin sets the other passwords in Settings → Account & passwords. Face unlock on the tablet per account.
- Offline: remembered accounts still unlock; changes upload when back online.
- Live link `/live`: players can send the score of a finished game (they pick themselves from its 4 players); the tablet shows a blinking **Scores to review** button on Games to accept / edit / reject.
- Live link `/live`: no login, only from 30 min before the session until End session; names, courts, scores, schedule – never money, phones or photos.

## Tests
`python3 tests/run_all.py <copy-of-backup.txt>` (headless Chrome + local Worker) · `python3 tests/v18_test.py <backup> <out-dir>` (v18 checks + screenshots) · `python3 tests/shots.py <backup> out.png` (contact sheet). Never run them against a device's live data.
