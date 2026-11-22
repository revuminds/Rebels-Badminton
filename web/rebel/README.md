# Rebel sprite frames
One folder per animation, frames `01.png`, `02.png` … (300 × 360 px cell, transparent, feet on y = 352, body centred).
`tools/build.py` packs every folder into the app – **no code change** when frames are replaced or added.

Make frames from a sheet (figures in a row on white): `python3 tools/rebel_cut.py sheet.jpg walk` (see the script for picking frames).

| folder | used for |
|---|---|
| walk | walking in / off (side view, faces right) |
| run | urgent: running in, running off after Update |
| turn | side → ¾ → front (played backwards to turn away) |
| idle | standing front-on (breathing + code-drawn blink, eyes in `idle/anim.json`) |
| wave | occasional wave / urgent bounce |
| thumbs | "Thanks Raj! 👍" |
| cheer | good news |
| back | spare (¾ back, back) |

Optional `anim.json`: `{"fps": 10, "loop": true, "eyes": [[x, y, rx, ry], …], "lid": "#E3A882"}`. If a folder is missing the app falls back to `idle` (glide + bounce).
