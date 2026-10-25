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
