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
- Every app open asks who is using it: **admin** (everything; first password 12345, must be changed), **organizer** (sees everything incl. Finance, changes nothing), **games** = game manager (sessions, players, check-in, games, scores, print). Admin sets the other passwords in Settings → Account & passwords. 4-digit quick PIN per account on each device (Settings → Account & passwords; works offline; 5 wrong → password). Red power icon in the top bar = log off.
- Offline: remembered accounts still unlock; changes upload when back online.
- Live link `/live` (v19): first visit asks **Guest** (view only) or **Player** (tap your name from today's checked-in players; one phone per name, remembered for the session, "Change to guest" frees it). A player can send the score of a finished game they played in; the tablet shows a blinking **Scores to review** button on Games to accept / edit / reject, and **Live page names** (✕ frees a wrongly picked name, logged). All names reset at End session.
- Live link `/live` (v21): each game on court is drawn as a court (names in the 4 boxes, score + timer on the net, never taller than the screen); red pulsing ● LIVE. A player can tap 🔔 on their Up next game → "It's your turn" popup + beep/vibration (+ notification on Android) when it starts – only while the page is open, with an optional keep-screen-on. Players can **✎ Suggest correction** on a scored game they played; it shows as **Correction** (old → new) in Scores to review. Tablet: **Save · score from players** closes a game with no score (shown as Score pending).
- Live link `/live` (v23): after End session it stays up read-only (results + schedule, no score sending) for 48 h, or until the next session's 30-min window opens.
- Live link `/live`: no login, only from 30 min before the session until End session; names, courts, scores, schedule – never money, phones or photos.

## Rebel (v24)
The app persona is **Rebel**; it talks to Raj in **Rebel’s notes** (Games tab) and **Rebel’s tips** (Finance). While a session is LIVE the only planning button is **⟳ Update**: it keeps the plan and repairs it (regulars capped at the Settings target, default 6 · long games drop a fill-in game, short games add one back · nobody on court now / 3 in a row in the next 2 games · longest-waiting in · fill-ins never in the first 30 min). It blinks red/amber with a short reason when something drifted; the change applies at once with an **Undo** toast and a timestamped summary in Rebel’s notes. The full re-plan is in **⋯ More → Rebuild remaining games (emergency)**. After the booked end the court pill counts **+X min** and blinks; Rebel schedules nothing – add games by hand (＋ Overtime game); they are recorded as overtime.

## Rebel on the footer (v25)
Header (clock in the middle) and a thin footer are frozen on every screen. The footer shows Rebel's status (green all good · red blinking = Rebel wants to talk · amber = good news) and 💬 = Rebel's message history (every Update tap, progress reports, tips). When Rebel has something to say he walks in on the footer (runs when urgent), turns to face you and says "Raj, got a minute?" – tap him for the message with **Update / Decline** (or options when you're ahead of time). Progress checks: halfway through the booked court-time (target 3) and 15 min before the last court ends (target 6), regulars only. ⋯ More → Courts (also ✎ on Players and Edit session while live) = one courts editor: hours, close/reopen, **＋ Add court** mid-session (cost goes into Finance).
Sprite frames live in `web/rebel/<anim>/01.png…` – replace or add frames and push; `tools/build.py` packs them (no code change). `python3 tools/rebel_cut.py sheet.jpg walk` cuts a white-background sheet into frames.

## Tests
`python3 tests/run_all.py <copy-of-backup.txt>` (headless Chrome + local Worker) · `python3 tests/v18_test.py <backup> <out-dir> [--noshots]` (v18 checks + screenshots) · `python3 tests/v19_test.py <backup>` (v19 Guest/Player + live names) · `python3 tests/v21_test.py <backup> [shots-dir]` (v21 court graphic, your turn, corrections, score pending) · `python3 tests/shots.py <backup> out.png` (contact sheet). · `python3 tests/v24_test.py <backup> [shots-dir]` (v24 Rebel: 6-game cap + fill-ins by simulation, Update loop, header/More, chips + time pill, booked end, Idle, overtime, tips, /live table + player card + score keyboard) · `python3 tests/v23_test.py <backup> [shots-dir]` (v23 planner stress simulation + tonight's regression, court queues in Upcoming, share QR codes, /live read-only 48 h after End session, per-session target). `python3 tests/v25_test.py <backup> [shots-dir]` (v25: header/sidebar/footer every screen light+dark, court text, Update no-loop + logging, checkpoints 2×2 h/1×3 h/2 h+1 h, Rebel walk/run/turn/blink/chat/Update/Decline/urgent, add court + Finance, ahead options, PIN every login). Never run them against a device's live data.
