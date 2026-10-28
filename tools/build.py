#!/usr/bin/env python3
"""Builds the single offline HTML file (fonts + logo embedded) for the APK and the laptop copy."""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
b64 = lambda p: base64.b64encode(p.read_bytes()).decode()

FONTS = [("Big Shoulders Display", 700, "big-shoulders-display-latin-700-normal"),
         ("Big Shoulders Display", 900, "big-shoulders-display-latin-900-normal"),
         ("Outfit", 400, "outfit-latin-400-normal"), ("Outfit", 500, "outfit-latin-500-normal"),
         ("Outfit", 600, "outfit-latin-600-normal"), ("Outfit", 700, "outfit-latin-700-normal")]
css = "".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64(WEB / 'fonts' / (f + '.woff2'))}) format('woff2')}}\n"
    for fam, w, f in FONTS)
logo = "data:image/webp;base64," + b64(WEB / "logo.webp")
sketch = "data:image/webp;base64," + b64(WEB / "logo-sketch.webp")

html = (WEB / "app.html").read_text(encoding="utf-8")
js = "".join(f.read_text(encoding="utf-8") + "\n" for f in sorted((WEB / "js").glob("*.js")))
assert html.count("/*JS*/") == 1
html = html.replace("/*JS*/", "(function(){\n'use strict';\n" + js + "})();")
assert html.count("/*FONTS*/") == 1 and html.count("url(LOGO)") == 2 and html.count('src="LOGO"') == 2 and html.count('src="SKETCH"') == 1
html = html.replace("/*FONTS*/", css).replace("url(LOGO)", f"url({logo})").replace('src="LOGO"', f'src="{logo}"').replace('src="SKETCH"', f'src="{sketch}"')

for out in (ROOT / "android/app/src/main/assets/index.html", ROOT / "dist/RebelsBadminton.html"):
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(out.relative_to(ROOT), len(html) // 1024, "KB")
