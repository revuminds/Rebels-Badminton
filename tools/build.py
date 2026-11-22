#!/usr/bin/env python3
"""Builds the single offline HTML file (fonts + logo embedded) for the APK and the laptop copy."""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
b64 = lambda p: base64.b64encode(p.read_bytes()).decode()

# v17: one font. The old display face name is mapped onto Outfit Bold, so every heading/numeral uses Outfit.
FONTS = [("Big Shoulders Display", 700, "outfit-latin-700-normal"),
         ("Big Shoulders Display", 900, "outfit-latin-700-normal"),
         ("Outfit", 400, "outfit-latin-400-normal"), ("Outfit", 500, "outfit-latin-500-normal"),
         ("Outfit", 600, "outfit-latin-600-normal"), ("Outfit", 700, "outfit-latin-700-normal")]
css = "".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64(WEB / 'fonts' / (f + '.woff2'))}) format('woff2')}}\n"
    for fam, w, f in FONTS)
logo = "data:image/webp;base64," + b64(WEB / "logo.webp")
sketch = "data:image/webp;base64," + b64(WEB / "logo-sketch.webp")
sketchl = "data:image/webp;base64," + b64(WEB / "logo-sketch-light.webp")   # v25: dark-ink logo for light mode

# v25: Rebel sprites – every folder web/rebel/<anim>/ (01.png, 02.png …) becomes one strip, no code change needed.
# Optional web/rebel/<anim>/anim.json: {"fps": 10, "loop": true, "eyes": [[x, y, rx, ry], …]} (eyes = code-drawn blink)
import json, struct
FPS = {"walk": 9, "run": 13, "turn": 8, "back": 6}
def dims(p):
    b = p.read_bytes()
    if b[:4] == b"\x89PNG": return struct.unpack(">II", b[16:24])
    if b[12:16] == b"VP8X": return (int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1)
    if b[12:16] == b"VP8L": v = int.from_bytes(b[21:25], "little"); return ((v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1)
    return struct.unpack("<HH", b[26:30])
def sprites():
    """no Pillow needed (CI): each frame is embedded as its own PNG; size read from the PNG header"""
    out = {"cell": None, "base": 352, "anims": {}}
    root = WEB / "rebel"
    for d in sorted(p for p in root.glob("*") if p.is_dir()) if root.exists() else []:
        fr = sorted(list(d.glob("*.png")) + list(d.glob("*.webp")))
        if not fr: continue
        w, h = dims(fr[0])
        meta = json.loads((d / "anim.json").read_text()) if (d / "anim.json").exists() else {}
        a = {"f": ["data:image/" + f.suffix[1:] + ";base64," + b64(f) for f in fr], "n": len(fr),
             "fps": meta.get("fps", FPS.get(d.name, 1)), "loop": meta.get("loop", d.name in ("walk", "run"))}
        for k in ("eyes", "lid", "lash"):
            if k in meta: a[k] = meta[k]
        out["anims"][d.name] = a; out["cell"] = [w, h]
        if "base" in meta: out["base"] = meta["base"]
    return out
SPR = sprites()

html = (WEB / "app.html").read_text(encoding="utf-8")
js = "".join(f.read_text(encoding="utf-8") + "\n" for f in sorted((WEB / "js").glob("*.js")))
assert html.count("/*JS*/") == 1
html = html.replace("/*JS*/", "(function(){\n'use strict';\n" + js + "})();")
assert html.count("/*SPRITES*/") == 1 and html.count('src="SKETCHL"') == 1
html = html.replace("/*SPRITES*/", "window.RB_SPR=" + json.dumps(SPR, separators=(",", ":")) + ";").replace('src="SKETCHL"', f'src="{sketchl}"')
assert html.count("/*FONTS*/") == 1 and html.count("url(LOGO)") == 2 and html.count('src="LOGO"') == 2 and html.count('src="SKETCH"') == 1
html = html.replace("/*FONTS*/", css).replace("url(LOGO)", f"url({logo})").replace('src="LOGO"', f'src="{logo}"').replace('src="SKETCH"', f'src="{sketch}"')

for out in (ROOT / "android/app/src/main/assets/index.html", ROOT / "dist/RebelsBadminton.html"):
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(out.relative_to(ROOT), len(html) // 1024, "KB")
